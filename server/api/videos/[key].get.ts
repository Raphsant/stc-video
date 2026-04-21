import { HeadObjectCommand, S3Client } from '@aws-sdk/client-s3'

export default defineEventHandler(async (event) => {
  await requireUserSession(event)
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
    return {
      key,
      name: key.replace(/\.[^/.]+$/, ''),
      size: result.ContentLength,
      url: signVideoUrl(key, config)
    }
  } catch (err: any) {
    if (err?.name === 'NotFound' || err?.$metadata?.httpStatusCode === 404) {
      throw createError({ statusCode: 404, message: 'Video no encontrado' })
    }
    throw createError({ statusCode: 500, message: 'Error al obtener el video' })
  }
})
