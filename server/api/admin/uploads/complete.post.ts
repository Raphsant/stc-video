import { CompleteMultipartUploadCommand, HeadObjectCommand } from '@aws-sdk/client-s3'
import { requireAdmin } from '~~/server/utils/authz'
import { createS3Client } from '~~/server/utils/s3'
import { assertUploadKey } from '~~/server/utils/videoKeys'

// Admin-only: assemble the parts the browser uploaded into the final object.
// Body: { key, uploadId, parts: [{ partNumber, etag }], size }
//
// A failure here leaves the multipart upload open on purpose, so the client can
// re-complete without re-uploading a single byte. Abandoned uploads are reaped
// by the bucket's AbortIncompleteMultipartUpload lifecycle rule.

export default defineEventHandler(async (event) => {
  await requireAdmin(event)

  const body = await readBody<{
    key?: string
    uploadId?: string
    parts?: { partNumber?: number; etag?: string }[]
    size?: number
  }>(event)

  const key = assertUploadKey(body?.key ?? '')
  const uploadId = (body?.uploadId ?? '').trim()
  const parts = body?.parts

  if (!uploadId) {
    throw createError({ statusCode: 400, message: 'Subida no identificada' })
  }
  if (!Array.isArray(parts) || parts.length === 0) {
    throw createError({ statusCode: 400, message: 'No se recibió ninguna parte' })
  }
  if (parts.some(p => !Number.isInteger(p?.partNumber) || !p?.etag)) {
    throw createError({ statusCode: 400, message: 'Datos de parte inválidos' })
  }

  // S3 requires the parts in ascending order, and wants the ETag quoted the way
  // it handed it out — some proxies strip the quotes off the response header.
  const ordered = [...parts]
    .sort((a, b) => a.partNumber! - b.partNumber!)
    .map(p => ({ PartNumber: p.partNumber!, ETag: `"${p.etag!.replace(/^"|"$/g, '')}"` }))

  const { s3, bucket } = createS3Client()

  try {
    await s3.send(new CompleteMultipartUploadCommand({
      Bucket: bucket,
      Key: key,
      UploadId: uploadId,
      MultipartUpload: { Parts: ordered },
    }))
  } catch {
    throw createError({ statusCode: 500, message: 'No se pudo finalizar la subida' })
  }

  // Verify, but never fail a completed upload over the check itself: the object
  // exists either way, and a warning is more useful than a false error.
  const warnings: string[] = []
  let size: number | null = null
  try {
    const head = await s3.send(new HeadObjectCommand({ Bucket: bucket, Key: key }))
    size = head.ContentLength ?? null
    if (Number.isInteger(body?.size) && size !== body!.size) {
      warnings.push('El tamaño del archivo subido no coincide con el original; verifícalo antes de publicarlo')
    }
  } catch {
    warnings.push('El archivo se subió, pero no se pudo verificar su tamaño')
  }

  return { key, size, warnings }
})
