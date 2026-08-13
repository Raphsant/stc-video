import { DeleteObjectsCommand, HeadObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { VideoMeta } from '~~/server/models/VideoMeta'
import { videoProgress } from '~~/server/models/VideoProgress'
import { requireAdmin } from '~~/server/utils/authz'
import { VIDEO_EXT } from '~~/shared/utils/videoExt'

// Admin-only: permanently delete a video, its thumbnail, and its MongoDB rows.
// Body: { key: string }
//
// Stricter than the other admin endpoints — rename and move are recoverable,
// this is not, so it takes the Admin role specifically rather than any staff
// role. S3 is the source of truth for the library, so the object delete is the
// only step allowed to fail the request; leftover Mongo rows are keyed by
// s3Key and simply never match anything again, so they degrade to warnings.

function isNotFound(err: any): boolean {
  return (
    err?.name === 'NotFound' ||
    err?.name === 'NoSuchKey' ||
    err?.$metadata?.httpStatusCode === 404
  )
}

export default defineEventHandler(async (event) => {
  await requireAdmin(event)

  const body = await readBody<{ key?: string }>(event)
  const key = (body?.key ?? '').trim()

  if (!key) throw createError({ statusCode: 400, message: 'Clave de video faltante' })
  if (!VIDEO_EXT.test(key) || key.startsWith('bitacora/')) {
    throw createError({ statusCode: 400, message: 'Solo se pueden eliminar archivos de video' })
  }

  const config = useRuntimeConfig()
  const bucket = config.s3Bucket
  const s3 = new S3Client({
    region: config.awsRegion,
    credentials: {
      accessKeyId: config.awsAccessKeyId,
      secretAccessKey: config.awsSecretAccessKey,
    },
  })

  try {
    await s3.send(new HeadObjectCommand({ Bucket: bucket, Key: key }))
  } catch (err: any) {
    if (isNotFound(err)) throw createError({ statusCode: 404, message: 'Video no encontrado' })
    throw createError({ statusCode: 500, message: 'Error al verificar el video' })
  }

  const warnings: string[] = []

  // The thumbnail lives at `${key}.jpg`, next to the video.
  let res
  try {
    res = await s3.send(new DeleteObjectsCommand({
      Bucket: bucket,
      Delete: { Objects: [{ Key: key }, { Key: `${key}.jpg` }], Quiet: true },
    }))
  } catch {
    throw createError({ statusCode: 500, message: 'No se pudo eliminar el video. No se borró nada.' })
  }

  // DeleteObjects returns 200 even when individual objects fail, so the per-key
  // errors have to be inspected. Quiet mode reports only failures.
  if (res.Errors?.some(e => e.Key === key)) {
    throw createError({ statusCode: 500, message: 'No se pudo eliminar el video' })
  }
  if (res.Errors?.some(e => e.Key === `${key}.jpg`)) {
    warnings.push('No se pudo eliminar la miniatura')
  }

  // Cast: nuxt-mongoose types the filter loosely (same quirk as the models).
  try {
    await VideoMeta.deleteOne({ s3Key: key } as any)
  } catch {
    warnings.push('No se pudieron limpiar los metadatos del video')
  }

  try {
    await videoProgress.deleteMany({ videoKey: key } as any)
  } catch {
    warnings.push('No se pudo limpiar el historial de reproducción')
  }

  return { deleted: true, key, warnings }
})
