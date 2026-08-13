import { CreateMultipartUploadCommand, HeadObjectCommand, type S3Client } from '@aws-sdk/client-s3'
import { requireAdmin } from '~~/server/utils/authz'
import { createS3Client, isNotFound } from '~~/server/utils/s3'
import { MAX_KEY_LENGTH, assertUploadFileName, normalizeDestPrefix } from '~~/server/utils/videoKeys'
import { videoContentType } from '~~/shared/utils/videoExt'

// Admin-only: open a multipart upload and tell the browser how to slice the file.
// Body: { destPrefix: string, fileName: string, size: number }
//
// The bytes never pass through this server. The site sits behind a Cloudflare
// tunnel that caps request bodies far below the size of a session recording, so
// the browser PUTs each part straight to S3 with a presigned URL and Nitro only
// brokers the multipart lifecycle: create -> sign -> complete (or abort).
//
// Nothing is written to MongoDB. S3 is the source of truth for the library, the
// listing endpoints pick the object up on the next request, `uploadedAt` falls
// back to S3 LastModified (which is exactly right for a fresh upload), and the
// thumbnail Lambda fires on s3:ObjectCreated — CompleteMultipartUpload included.

const MIN_PART_SIZE = 16 * 1024 * 1024 // comfortably above S3's 5 MiB floor
const MAX_PARTS = 10_000 // S3 hard limit
const MAX_UPLOAD_SIZE = 100 * 1024 * 1024 * 1024
const MAX_NAME_TRIES = 50

// One part size for the whole file. S3 exempts only the LAST part from the
// 5 MiB floor, so a sub-16 MiB file simply uploads as a single part and the
// client keeps one code path for every size. 16 MiB also bounds what a retry
// costs on a flaky connection; the size/MAX_PARTS term only starts to matter
// past ~160 GB, well beyond the cap above.
function partSizeFor(size: number): number {
  const needed = Math.ceil(size / MAX_PARTS)
  const roundedToMiB = Math.ceil(needed / (1024 * 1024)) * 1024 * 1024
  return Math.max(MIN_PART_SIZE, roundedToMiB)
}

// Never overwrite: suffix " (2)", " (3)"… the way duplicate recordings from the
// same day are already named in the bucket.
async function findFreeKey(s3: S3Client, bucket: string, prefix: string, fileName: string): Promise<string> {
  const dot = fileName.lastIndexOf('.')
  const stem = fileName.slice(0, dot)
  const ext = fileName.slice(dot)

  for (let n = 1; n <= MAX_NAME_TRIES; n++) {
    const key = prefix + (n === 1 ? fileName : `${stem} (${n})${ext}`)
    try {
      await s3.send(new HeadObjectCommand({ Bucket: bucket, Key: key }))
    } catch (err: any) {
      if (isNotFound(err)) return key
      throw createError({ statusCode: 500, message: 'Error al verificar la carpeta de destino' })
    }
  }
  throw createError({
    statusCode: 409,
    message: 'Ya existen demasiados archivos con ese nombre en la carpeta',
  })
}

export default defineEventHandler(async (event) => {
  await requireAdmin(event)

  const body = await readBody<{ destPrefix?: string; fileName?: string; size?: number }>(event)
  const destPrefix = normalizeDestPrefix(body?.destPrefix ?? '')
  const fileName = assertUploadFileName(body?.fileName ?? '')
  const size = Number(body?.size)

  if (!Number.isInteger(size) || size <= 0) {
    throw createError({ statusCode: 400, message: 'Tamaño de archivo inválido' })
  }
  if (size > MAX_UPLOAD_SIZE) {
    throw createError({ statusCode: 400, message: 'El archivo supera el límite de 100 GB' })
  }

  const { s3, bucket } = createS3Client()
  const key = await findFreeKey(s3, bucket, destPrefix, fileName)

  if (key.length > MAX_KEY_LENGTH) {
    throw createError({ statusCode: 400, message: 'La ruta de destino es demasiado larga' })
  }

  let uploadId: string | undefined
  try {
    const res = await s3.send(new CreateMultipartUploadCommand({
      Bucket: bucket,
      Key: key,
      ContentType: videoContentType(fileName),
    }))
    uploadId = res.UploadId
  } catch {
    throw createError({ statusCode: 500, message: 'No se pudo iniciar la subida' })
  }
  if (!uploadId) {
    throw createError({ statusCode: 500, message: 'No se pudo iniciar la subida' })
  }

  const partSize = partSizeFor(size)
  return { key, uploadId, partSize, partCount: Math.ceil(size / partSize) }
})
