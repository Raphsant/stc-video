import { ListObjectsV2Command, S3Client } from '@aws-sdk/client-s3'

type Video = {
  key: string
  name: string
  size?: number
  url: string
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

  const groups = new Map<string, Video[]>()
  let ContinuationToken: string | undefined

  do {
    const result = await s3.send(
      new ListObjectsV2Command({
        Bucket: config.s3Bucket,
        ContinuationToken,
      })
    )

    for (const obj of result.Contents ?? []) {
      if (!obj.Key || obj.Key.endsWith('/') || !obj.Size) continue

      const lastSlash = obj.Key.lastIndexOf('/')
      const folder = lastSlash === -1 ? '' : obj.Key.slice(0, lastSlash)
      const fileName = lastSlash === -1 ? obj.Key : obj.Key.slice(lastSlash + 1)

      const video: Video = {
        key: obj.Key,
        name: fileName.replace(/\.[^/.]+$/, ''),
        size: obj.Size,
        url: `https://${config.public.cloudfrontDomain}/${obj.Key}`,
      }

      const list = groups.get(folder) ?? []
      list.push(video)
      groups.set(folder, list)
    }

    ContinuationToken = result.IsTruncated ? result.NextContinuationToken : undefined
  } while (ContinuationToken)

  return {
    total: Array.from(groups.values()).reduce((n, v) => n + v.length, 0),
    groups: Array.from(groups.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([folder, videos]) => ({ folder, videos })),
  }
})
