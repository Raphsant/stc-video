import { HeadObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { VideoMeta } from '~~/server/models/VideoMeta'

// Staff-only: set or clear a video's display-name override.
// Body: { key: string, name: string }
//   name non-empty -> upsert the override
//   name empty      -> remove the override (reset to the filename)
// The S3 object is never touched; this is a pure metadata edit.
export default defineEventHandler(async (event) => {
  const { user } = await requireUserSession(event)
  if (!isContentManager(user.roles)) {
    throw createError({ statusCode: 403, message: 'No tienes permiso para editar videos' })
  }

  const body = await readBody<{ key?: string; name?: string }>(event)
  const key = (body?.key ?? '').trim()
  const name = (body?.name ?? '').trim()

  if (!key) throw createError({ statusCode: 400, message: 'Clave de video faltante' })
  if (name.length > 200) {
    throw createError({ statusCode: 400, message: 'El nombre es demasiado largo (máx. 200)' })
  }

  const config = useRuntimeConfig()
  const s3 = new S3Client({
    region: config.awsRegion,
    credentials: {
      accessKeyId: config.awsAccessKeyId,
      secretAccessKey: config.awsSecretAccessKey,
    },
  })

  // Verify the object exists so we never persist an override for a ghost key.
  try {
    await s3.send(new HeadObjectCommand({ Bucket: config.s3Bucket, Key: key }))
  } catch (err: any) {
    if (err?.name === 'NotFound' || err?.$metadata?.httpStatusCode === 404) {
      throw createError({ statusCode: 404, message: 'Video no encontrado' })
    }
    throw createError({ statusCode: 500, message: 'Error al verificar el video' })
  }

  // Empty name resets to the filename-derived default.
  const fallbackName = key.split('/').pop()?.replace(/\.[^/.]+$/, '') ?? key

  if (!name) {
    // Cast: nuxt-mongoose types the filter loosely (same quirk as the models).
    await VideoMeta.deleteOne({ s3Key: key } as any)
    return { key, name: fallbackName, overridden: false }
  }

  await VideoMeta.findOneAndUpdate(
    { s3Key: key } as any,
    { s3Key: key, displayName: name },
    { upsert: true, new: true },
  )

  return { key, name, overridden: true }
})
