import { ListObjectsV2Command, S3Client } from '@aws-sdk/client-s3'

type VideoEntry = {
  key: string
  name: string
  size?: number
  lastModified?: number
}

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

  const groups = new Map<string, VideoEntry[]>()
  let ContinuationToken: string | undefined

  do {
    const result = await s3.send(
      new ListObjectsV2Command({
        Bucket: config.s3Bucket,
        ContinuationToken,
      })
    )

    for (const obj of result.Contents ?? []) {
      if (!obj.Key || obj.Key.endsWith('/') || obj.Key.endsWith('.jpg') || !obj.Size) continue

      const lastSlash = obj.Key.lastIndexOf('/')
      const folder = lastSlash === -1 ? '' : obj.Key.slice(0, lastSlash)
      const fileName = lastSlash === -1 ? obj.Key : obj.Key.slice(lastSlash + 1)

      const video: VideoEntry = {
        key: obj.Key,
        name: fileName.replace(/\.[^/.]+$/, ''),
        size: obj.Size,
        lastModified: obj.LastModified?.getTime(),
      }

      const list = groups.get(folder) ?? []
      list.push(video)
      groups.set(folder, list)
    }

    ContinuationToken = result.IsTruncated ? result.NextContinuationToken : undefined
  } while (ContinuationToken)

  const groupEntries = Array.from(groups.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([folder, videos]) => {
      const sorted = videos.sort((a, b) => (b.lastModified ?? 0) - (a.lastModified ?? 0))
      const preview = sorted.slice(0, 5).map(({ lastModified: _, ...v }) => ({
        ...v,
        url: signVideoUrl(v.key, config),
        thumb: signVideoUrl(`${v.key}.jpg`, config),
      }))
      return { folder, count: videos.length, videos: preview }
    })

  return {
    total: groupEntries.reduce((n, g) => n + g.count, 0),
    groups: groupEntries,
  }
})
