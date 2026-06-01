import { ListObjectsV2Command, S3Client } from '@aws-sdk/client-s3'

const VIDEO_EXT = /\.(mp4|mov|m4v|mkv|webm|avi)$/i

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
    .filter((p): p is string => !!p && !p.startsWith('bitacora/'))
    .map(p => ({
      prefix: p,
      name: p.slice(prefix.length).replace(/\/$/, ''),
    }))

  const videos = (result.Contents ?? [])
    .filter(obj => obj.Key && !obj.Key.startsWith('bitacora/') && VIDEO_EXT.test(obj.Key) && (obj.Size ?? 0) > 0)
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
    .map(({ lastModified: _, ...v }) => v)

  return { prefix, folders, videos }
})
