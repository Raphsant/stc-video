import { AbortMultipartUploadCommand } from '@aws-sdk/client-s3'
import { requireAdmin } from '~~/server/utils/authz'
import { createS3Client, isNotFound } from '~~/server/utils/s3'
import { assertUploadKey } from '~~/server/utils/videoKeys'

// Admin-only: discard a multipart upload and its already-uploaded parts.
// Body: { key, uploadId }
//
// Idempotent — the client may abort an upload S3 has already dropped, so a
// missing upload is a success, not an error.

export default defineEventHandler(async (event) => {
  await requireAdmin(event)

  const body = await readBody<{ key?: string; uploadId?: string }>(event)
  const key = assertUploadKey(body?.key ?? '')
  const uploadId = (body?.uploadId ?? '').trim()

  if (!uploadId) {
    throw createError({ statusCode: 400, message: 'Subida no identificada' })
  }

  const { s3, bucket } = createS3Client()

  try {
    await s3.send(new AbortMultipartUploadCommand({ Bucket: bucket, Key: key, UploadId: uploadId }))
  } catch (err: any) {
    if (err?.name !== 'NoSuchUpload' && !isNotFound(err)) {
      throw createError({ statusCode: 500, message: 'No se pudo cancelar la subida' })
    }
  }

  return { aborted: true }
})
