import {
  AbortMultipartUploadCommand,
  CompleteMultipartUploadCommand,
  CopyObjectCommand,
  CreateMultipartUploadCommand,
  DeleteObjectsCommand,
  HeadObjectCommand,
  S3Client,
  UploadPartCopyCommand,
} from '@aws-sdk/client-s3'
import { VideoMeta } from '~~/server/models/VideoMeta'
import { videoProgress } from '~~/server/models/VideoProgress'
import { createS3Client, isNotFound } from '~~/server/utils/s3'
import { MAX_KEY_LENGTH, normalizeDestPrefix } from '~~/server/utils/videoKeys'
import { VIDEO_EXT } from '~~/shared/utils/videoExt'

// Staff-only: move a video (and its thumbnail) to another S3 folder.
// Body: { key: string, destPrefix: string }
//
// Order of operations is deliberate — the original is only deleted after the
// copy is verified and MongoDB is re-keyed, so a failure at any step never
// loses data (worst case: a duplicate that a retry cleans up).
//   1. validate + HeadObject both source and destination
//   2. copy (multipart above S3's 5 GB single-copy limit)
//   3. verify the copy's size
//   4. re-key VideoMeta / VideoProgress, preserving the original uploadedAt
//      (a copy resets LastModified; without this, moving an old video would
//      re-open the delta 30-day window for it)
//   5. delete the original + its thumbnail
// A MongoDB failure rolls the copy back; S3 cleanup failures degrade to
// warnings in the response instead of failing the move.

const MAX_SINGLE_COPY = 5 * 1024 * 1024 * 1024 // S3 CopyObject hard limit
const PART_SIZE = 1024 * 1024 * 1024
const PART_CONCURRENCY = 4

// CopySource wants the key URL-encoded but with "/" kept as separators
// (keys here contain spaces, brackets and "&").
function copySource(bucket: string, key: string): string {
  return `${bucket}/${key.split('/').map(encodeURIComponent).join('/')}`
}

// Server-side S3 copy; switches to multipart above the single-copy limit.
async function copyWithinBucket(s3: S3Client, bucket: string, srcKey: string, destKey: string, size: number) {
  if (size <= MAX_SINGLE_COPY) {
    await s3.send(new CopyObjectCommand({
      Bucket: bucket,
      Key: destKey,
      CopySource: copySource(bucket, srcKey),
    }))
    return
  }

  const { UploadId } = await s3.send(new CreateMultipartUploadCommand({ Bucket: bucket, Key: destKey }))
  try {
    const partCount = Math.ceil(size / PART_SIZE)
    const parts: { ETag: string; PartNumber: number }[] = []

    for (let batch = 0; batch < partCount; batch += PART_CONCURRENCY) {
      const batchResults = await Promise.all(
        Array.from({ length: Math.min(PART_CONCURRENCY, partCount - batch) }, async (_, j) => {
          const i = batch + j
          const start = i * PART_SIZE
          const end = Math.min(start + PART_SIZE, size) - 1
          const res = await s3.send(new UploadPartCopyCommand({
            Bucket: bucket,
            Key: destKey,
            UploadId,
            PartNumber: i + 1,
            CopySource: copySource(bucket, srcKey),
            CopySourceRange: `bytes=${start}-${end}`,
          }))
          return { ETag: res.CopyPartResult!.ETag!, PartNumber: i + 1 }
        })
      )
      parts.push(...batchResults)
    }

    await s3.send(new CompleteMultipartUploadCommand({
      Bucket: bucket,
      Key: destKey,
      UploadId,
      MultipartUpload: { Parts: parts },
    }))
  } catch (err) {
    await s3
      .send(new AbortMultipartUploadCommand({ Bucket: bucket, Key: destKey, UploadId }))
      .catch(() => {})
    throw err
  }
}

export default defineEventHandler(async (event) => {
  const { user } = await requireUserSession(event)
  if (!isContentManager(user.roles)) {
    throw createError({ statusCode: 403, message: 'No tienes permiso para mover videos' })
  }

  const body = await readBody<{ key?: string; destPrefix?: string }>(event)
  const key = (body?.key ?? '').trim()
  const destPrefix = normalizeDestPrefix(body?.destPrefix ?? '')

  if (!key) throw createError({ statusCode: 400, message: 'Clave de video faltante' })
  if (!VIDEO_EXT.test(key) || key.startsWith('bitacora/')) {
    throw createError({ statusCode: 400, message: 'Solo se pueden mover archivos de video' })
  }

  const fileName = key.split('/').pop()!
  const destKey = destPrefix + fileName
  if (destKey === key) {
    throw createError({ statusCode: 400, message: 'El video ya está en esa carpeta' })
  }
  if (destKey.length > MAX_KEY_LENGTH) {
    throw createError({ statusCode: 400, message: 'La ruta de destino es demasiado larga' })
  }

  const { s3, bucket } = createS3Client()

  // 1. Source must exist; destination must be free (no silent overwrites).
  let sourceHead
  try {
    sourceHead = await s3.send(new HeadObjectCommand({ Bucket: bucket, Key: key }))
  } catch (err: any) {
    if (isNotFound(err)) throw createError({ statusCode: 404, message: 'Video no encontrado' })
    throw createError({ statusCode: 500, message: 'Error al verificar el video' })
  }

  let destTaken = true
  try {
    await s3.send(new HeadObjectCommand({ Bucket: bucket, Key: destKey }))
  } catch (err: any) {
    if (!isNotFound(err)) throw createError({ statusCode: 500, message: 'Error al verificar la carpeta de destino' })
    destTaken = false
  }
  if (destTaken) {
    throw createError({
      statusCode: 409,
      message: 'Ya existe un archivo con ese nombre en la carpeta de destino',
    })
  }

  const size = sourceHead.ContentLength ?? 0

  // Preserve the ORIGINAL availability date. If this video was moved before,
  // its VideoMeta already holds it; otherwise fall back to S3 LastModified.
  // Cast: nuxt-mongoose types the filter loosely (same quirk as the models).
  const existingMeta = await VideoMeta.findOne({ s3Key: key } as any).lean()
  const originalUploadedAt = existingMeta?.uploadedAt
    ? new Date(existingMeta.uploadedAt as any)
    : sourceHead.LastModified ?? null

  const warnings: string[] = []

  // 2 + 3. Copy, then verify before touching anything else.
  try {
    await copyWithinBucket(s3, bucket, key, destKey, size)
    const destHead = await s3.send(new HeadObjectCommand({ Bucket: bucket, Key: destKey }))
    if (destHead.ContentLength !== size) {
      throw new Error(`size mismatch: ${destHead.ContentLength} != ${size}`)
    }
  } catch {
    await s3
      .send(new DeleteObjectsCommand({ Bucket: bucket, Delete: { Objects: [{ Key: destKey }], Quiet: true } }))
      .catch(() => {})
    throw createError({ statusCode: 500, message: 'Error al copiar el video. No se movió nada.' })
  }

  // Thumbnail: best effort — the Lambda regenerates it for the new key anyway.
  try {
    await s3.send(new CopyObjectCommand({
      Bucket: bucket,
      Key: `${destKey}.jpg`,
      CopySource: copySource(bucket, `${key}.jpg`),
    }))
  } catch (err: any) {
    if (!isNotFound(err)) warnings.push('No se pudo copiar la miniatura (se regenerará sola)')
  }

  // 4. Re-key MongoDB. On failure, roll the copy back so S3 and the DB never
  // disagree about where the video lives.
  try {
    await VideoMeta.deleteOne({ s3Key: destKey } as any) // stale doc from a past life of destKey
    await VideoMeta.findOneAndUpdate(
      { s3Key: key } as any,
      { s3Key: destKey, uploadedAt: originalUploadedAt },
      { upsert: true },
    )
  } catch {
    await s3
      .send(new DeleteObjectsCommand({
        Bucket: bucket,
        Delete: { Objects: [{ Key: destKey }, { Key: `${destKey}.jpg` }], Quiet: true },
      }))
      .catch(() => {})
    throw createError({ statusCode: 500, message: 'Error al actualizar la base de datos. No se movió nada.' })
  }

  // Watch progress is nice-to-have — never fail a completed move over it.
  try {
    await videoProgress.updateMany({ videoKey: key } as any, { $set: { videoKey: destKey } })
  } catch {
    warnings.push('No se pudo migrar el historial de reproducción')
  }

  // 5. Delete the original last. A failure here leaves a duplicate, not a loss.
  try {
    const res = await s3.send(new DeleteObjectsCommand({
      Bucket: bucket,
      Delete: { Objects: [{ Key: key }, { Key: `${key}.jpg` }], Quiet: true },
    }))
    if (res.Errors?.length) throw new Error(res.Errors[0]?.Message ?? 'delete failed')
  } catch {
    warnings.push('El video se movió, pero el archivo original no se pudo eliminar; elimínalo manualmente')
  }

  return { moved: true, from: key, to: destKey, warnings }
})
