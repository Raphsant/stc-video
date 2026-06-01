import { ListObjectsV2Command, S3Client } from '@aws-sdk/client-s3'

const VIDEO_EXT = /\.(mp4|mov|m4v|mkv|webm|avi)$/i

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
    .filter((p): p is string => !!p && !p.startsWith('bitacora/'))

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
        .filter(obj => obj.Key && VIDEO_EXT.test(obj.Key) && (obj.Size ?? 0) > 0)
        .map(obj => ({
          key: obj.Key!,
          name: obj.Key!.slice(prefix.length).replace(/\.[^/.]+$/, ''),
          size: obj.Size,
          lastModified: obj.LastModified?.getTime(),
          url: signVideoUrl(obj.Key!, config),
          thumb: signVideoUrl(`${obj.Key!}.jpg`, config),
        }))
        .sort((a, b) => {
          const da = parseVideoDate(a.name) ?? a.lastModified ?? 0
          const db = parseVideoDate(b.name) ?? b.lastModified ?? 0
          return db - da
        })
        .slice(0, 5)
        .map(({ lastModified: _, ...v }) => v)

      return { prefix, name, recentVideos }
    })
  )

  return { folders }
})
