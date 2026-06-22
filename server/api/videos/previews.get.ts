import { ListObjectsV2Command, S3Client } from '@aws-sdk/client-s3'

const VIDEO_EXT = /\.(mp4|mov|m4v|mkv|webm|avi)$/i

export default defineEventHandler(async (event) => {
  const { user } = await requireUserSession(event)

  const config = useRuntimeConfig()
  const group = resolveGroup(user.roles)

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

      const ranked = (folderResult.Contents ?? [])
        .filter(obj => obj.Key && VIDEO_EXT.test(obj.Key) && (obj.Size ?? 0) > 0)
        .map(obj => {
          const uploadedAt = obj.LastModified?.getTime() ?? null
          const decision = checkVideoAccess({ group, key: obj.Key!, uploadedAt })
          return {
            key: obj.Key!,
            name: obj.Key!.slice(prefix.length).replace(/\.[^/.]+$/, ''),
            size: obj.Size,
            lastModified: uploadedAt,
            url: decision.allowed ? signVideoUrl(obj.Key!, config) : null,
            thumb: signVideoUrl(`${obj.Key!}.jpg`, config),
            locked: !decision.allowed,
            lockReason: decision.reason ?? null,
          }
        })
        .sort((a, b) => {
          const da = parseVideoDate(a.name) ?? a.lastModified ?? 0
          const db = parseVideoDate(b.name) ?? b.lastModified ?? 0
          return db - da
        })
        .slice(0, 5)

      const overrides = await getDisplayNames(ranked.map(v => v.key))
      const recentVideos = ranked.map(({ lastModified: _, ...v }) => ({
        ...v,
        name: overrides.get(v.key) ?? v.name,
      }))

      return { prefix, name, recentVideos }
    })
  )

  return { folders }
})
