import { HeadObjectCommand, S3Client } from '@aws-sdk/client-s3'

export default defineEventHandler(async (event) => {
  await requireUserSession(event)
  const key = decodeURIComponent(getRouterParam(event, 'key') ?? '')
  if (!key) throw createError({ statusCode: 400, message: 'Missing video key' })

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
      url: `https://${config.public.cloudfrontDomain}/${key}`
    }
  } catch (err: any) {
    if (err?.name === 'NotFound' || err?.$metadata?.httpStatusCode === 404) {
      throw createError({ statusCode: 404, message: 'Video not found' })
    }
    throw createError({ statusCode: 500, message: 'Failed to fetch video' })
  }
})
