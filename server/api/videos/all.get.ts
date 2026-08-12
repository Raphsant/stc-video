import { ListObjectsV2Command, S3Client } from '@aws-sdk/client-s3'
import type { AccessDecision } from '~~/server/utils/access'

const VIDEO_EXT = /\.(mp4|mov|m4v|mkv|webm|avi)$/i

type VideoEntry = {
  key: string
  name: string
  size?: number
  lastModified?: number
}

export default defineEventHandler(async (event) => {
  const { user } = await requireUserSession(event)

  const config = useRuntimeConfig()
  const group = resolveGroup(user.roles)
  const rules = await getAccessRules()
  // Admins (by Discord role ID) see and play everything. For everyone else,
  // folders blocked for BOTH tiers (admin-only content) are hidden outright;
  // single-tier blocks and window locks stay visible as locked upsell cards
  // — see isFolderHiddenFromMembers. Filtering happens before grouping so
  // the per-folder counts don't betray hidden videos.
  const admin = isAdmin(user.roleIds)
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
      if (!obj.Key || !obj.Size) continue
      if (obj.Key.startsWith('bitacora/')) continue
      if (!VIDEO_EXT.test(obj.Key)) continue
      if (!admin && isFolderHiddenFromMembers(obj.Key, rules)) continue

      const firstSlash = obj.Key.indexOf('/')
      const folder = firstSlash === -1 ? '' : obj.Key.slice(0, firstSlash)
      const lastSlash = obj.Key.lastIndexOf('/')
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

  const overrides = await getVideoOverrides(
    Array.from(groups.values()).flatMap(list => list.map(v => v.key)),
  )

  const groupEntries = Array.from(groups.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([folder, videos]) => {
      const sorted = videos.sort((a, b) => {
        const da = parseVideoDate(a.name) ?? a.lastModified ?? 0
        const db = parseVideoDate(b.name) ?? b.lastModified ?? 0
        return db - da
      })
      const preview = sorted.slice(0, 5).map(({ lastModified, ...v }) => {
        const uploadedAt = overrides.get(v.key)?.uploadedAt ?? lastModified ?? null
        const decision: AccessDecision = admin
          ? { allowed: true }
          : checkVideoAccess({ group, key: v.key, uploadedAt, rules })
        return {
          ...v,
          name: overrides.get(v.key)?.displayName ?? v.name,
          url: decision.allowed ? signVideoUrl(v.key, config) : null,
          thumb: signVideoUrl(`${v.key}.jpg`, config),
          locked: !decision.allowed,
          lockReason: decision.reason ?? null,
        }
      })
      return { folder, count: videos.length, videos: preview }
    })

  return {
    total: groupEntries.reduce((n, g) => n + g.count, 0),
    groups: groupEntries,
  }
})
