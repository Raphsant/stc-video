import { ListObjectsV2Command, S3Client } from '@aws-sdk/client-s3'

export default defineEventHandler(async (event) => {
  await requireUserSession(event)

  const { prefix = '' } = getQuery(event) as { prefix?: string }
  const config = useRuntimeConfig()

  const s3 = new S3Client({
    region: config.awsRegion,
    credentials: {
      accessKeyId: config.awsAccessKeyId,
      secretAccessKey: config.awsSecretAccessKey,
    },
  })

  const result = await s3.send(
    new ListObjectsV2Command({
      Bucket: config.s3Bucket,
      Prefix: prefix,
      Delimiter: '/',
    })
  )

  const folders = (result.CommonPrefixes ?? [])
    .map(p => p.Prefix)
    .filter((p): p is string => !!p)
    .map(p => ({
      prefix: p,
      name: p.slice(prefix.length).replace(/\/$/, ''),
    }))

  const videos = (result.Contents ?? [])
    .filter(obj => obj.Key && !obj.Key.endsWith('/') && !obj.Key.endsWith('.jpg') && (obj.Size ?? 0) > 0)
    .map(obj => ({
      key: obj.Key!,
      name: obj.Key!.slice(prefix.length).replace(/\.[^/.]+$/, ''),
      size: obj.Size,
      url: signVideoUrl(obj.Key!, config),
      thumb: signVideoUrl(`${obj.Key!}.jpg`, config),
    }))

  return { prefix, folders, videos }
})
