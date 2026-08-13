import { UploadPartCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { requireAdmin } from '~~/server/utils/authz'
import { createS3Client } from '~~/server/utils/s3'
import { assertUploadKey } from '~~/server/utils/videoKeys'

// Admin-only: presign a batch of UploadPart URLs so the browser can PUT parts
// straight to S3. Body: { key, uploadId, partNumbers: number[] }
//
// The client asks for a window of parts at a time and re-asks for a single part
// before every retry, so an expired URL, a clock skew and a transient 403 all
// recover through the same path.
//
// No server-side record ties an uploadId to its creator: every caller has
// already cleared requireAdmin, and admins can move and delete anything in the
// bucket anyway. The one real hazard is a write landing outside the video
// namespace, and assertUploadKey closes that.

const MAX_BATCH = 100
const URL_TTL_SECONDS = 3600 // matches the CloudFront signing convention

export default defineEventHandler(async (event) => {
  await requireAdmin(event)

  const body = await readBody<{ key?: string; uploadId?: string; partNumbers?: number[] }>(event)
  const key = assertUploadKey(body?.key ?? '')
  const uploadId = (body?.uploadId ?? '').trim()
  const partNumbers = body?.partNumbers

  if (!uploadId) {
    throw createError({ statusCode: 400, message: 'Subida no identificada' })
  }
  if (!Array.isArray(partNumbers) || partNumbers.length === 0) {
    throw createError({ statusCode: 400, message: 'No se solicitaron partes' })
  }
  if (partNumbers.length > MAX_BATCH) {
    throw createError({ statusCode: 400, message: 'Demasiadas partes en una sola petición' })
  }
  if (partNumbers.some(n => !Number.isInteger(n) || n < 1 || n > 10_000)) {
    throw createError({ statusCode: 400, message: 'Número de parte inválido' })
  }

  const { s3, bucket } = createS3Client()

  // Presigning is local crypto — no S3 round-trip — so a batch costs nothing.
  const urls = await Promise.all(partNumbers.map(async partNumber => ({
    partNumber,
    url: await getSignedUrl(
      s3,
      new UploadPartCommand({ Bucket: bucket, Key: key, UploadId: uploadId, PartNumber: partNumber }),
      { expiresIn: URL_TTL_SECONDS },
    ),
  })))

  return { urls }
})
