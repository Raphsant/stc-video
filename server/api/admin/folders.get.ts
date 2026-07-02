import { ListObjectsV2Command, S3Client } from '@aws-sdk/client-s3'

// Staff-only: the complete folder tree of the bucket, as a flat sorted list
// of prefixes (e.g. "Live/Livetrading 2026/Mayo 2026/"). Feeds the move-video
// destination picker. Derived from every object key (plus explicit folder
// placeholder objects), so empty folders created via the console appear too.
export default defineEventHandler(async (event) => {
  const { user } = await requireUserSession(event)
  if (!isContentManager(user.roles)) {
    throw createError({ statusCode: 403, message: 'No tienes permiso para administrar videos' })
  }

  const config = useRuntimeConfig()
  const s3 = new S3Client({
    region: config.awsRegion,
    credentials: {
      accessKeyId: config.awsAccessKeyId,
      secretAccessKey: config.awsSecretAccessKey,
    },
  })

  const folders = new Set<string>()
  let ContinuationToken: string | undefined

  do {
    const result = await s3.send(
      new ListObjectsV2Command({
        Bucket: config.s3Bucket,
        ContinuationToken,
      })
    )

    for (const obj of result.Contents ?? []) {
      const key = obj.Key
      if (!key || key.startsWith('bitacora/')) continue
      // Record every ancestor prefix. A placeholder key "a/b/" contributes
      // "a/" and "a/b/"; a file key "a/b/c.mp4" contributes the same.
      const parts = key.split('/')
      let acc = ''
      for (let i = 0; i < parts.length - 1; i++) {
        acc += parts[i] + '/'
        folders.add(acc)
      }
    }

    ContinuationToken = result.IsTruncated ? result.NextContinuationToken : undefined
  } while (ContinuationToken)

  return { folders: Array.from(folders).sort((a, b) => a.localeCompare(b, 'es')) }
})
