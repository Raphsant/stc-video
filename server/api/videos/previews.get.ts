import { ListObjectsV2Command, S3Client } from '@aws-sdk/client-s3'

export default defineEventHandler(async (event) => {
  await requireUserSession(event)

  const config = useRuntimeConfig()

  const s3 = new S3Client({
    region: config.awsRegion,
    credentials: {
      accessKeyId: config.awsAccessKeyId,
      secretAccessKey: config.awsSecretAccessKey,
    },
  })

  const rootResult = await s3.send(
    new ListObjectsV2Command({
      Bucket: config.s3Bucket,
      Prefix: '',
      Delimiter: '/',
    })
  )

  const folderPrefixes = (rootResult.CommonPrefixes ?? [])
    .map(p => p.Prefix)
    .filter((p): p is string => !!p)

  const folders = await Promise.all(
    folderPrefixes.map(async prefix => {
      const name = prefix.replace(/\/$/, '')

      const folderResult = await s3.send(
        new ListObjectsV2Command({
          Bucket: config.s3Bucket,
          Prefix: prefix,
        })
      )

      const recentVideos = (folderResult.Contents ?? [])
        .filter(obj => obj.Key && !obj.Key.endsWith('/') && !obj.Key.endsWith('.jpg') && (obj.Size ?? 0) > 0)
        .sort((a, b) => (b.LastModified?.getTime() ?? 0) - (a.LastModified?.getTime() ?? 0))
        .slice(0, 5)
        .map(obj => ({
          key: obj.Key!,
          name: obj.Key!.slice(prefix.length).replace(/\.[^/.]+$/, ''),
          size: obj.Size,
          url: signVideoUrl(obj.Key!, config),
          thumb: signVideoUrl(`${obj.Key!}.jpg`, config),
        }))

      return { prefix, name, recentVideos }
    })
  )

  return { folders }
})
