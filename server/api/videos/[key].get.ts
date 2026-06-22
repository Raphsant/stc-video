import { HeadObjectCommand, S3Client } from '@aws-sdk/client-s3'

export default defineEventHandler(async (event) => {
  const { user } = await requireUserSession(event)
  const key = decodeURIComponent(getRouterParam(event, 'key') ?? '')
  if (!key) throw createError({ statusCode: 400, message: 'Clave de video faltante' })

  const config = useRuntimeConfig()
  const s3 = new S3Client({
    region: config.awsRegion,
    credentials: {
      accessKeyId: config.awsAccessKeyId,
      secretAccessKey: config.awsSecretAccessKey
    }
  })

  try {
    const result = await s3.send(
      new HeadObjectCommand({ Bucket: config.s3Bucket, Key: key })
    )

    const group = resolveGroup(user.roles)
    const decision = checkVideoAccess({ group, key, uploadedAt: result.LastModified?.getTime() ?? null })

    const override = (await getDisplayNames([key])).get(key)

    return {
      key,
      name: override ?? key.replace(/\.[^/.]+$/, ''),
      size: result.ContentLength,
      thumb: signVideoUrl(`${key}.jpg`, config),
      url: decision.allowed ? signVideoUrl(key, config) : null,
      locked: !decision.allowed,
      lockReason: decision.reason ?? null,
    }
  } catch (err: any) {
    if (err?.name === 'NotFound' || err?.$metadata?.httpStatusCode === 404) {
      throw createError({ statusCode: 404, message: 'Video no encontrado' })
    }
    throw createError({ statusCode: 500, message: 'Error al obtener el video' })
  }
})
