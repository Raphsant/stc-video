import { ListObjectsV2Command, S3Client } from '@aws-sdk/client-s3'
import type { AccessDecision } from '~~/server/utils/access'

const VIDEO_EXT = /\.(mp4|mov|m4v|mkv|webm|avi)$/i

export default defineEventHandler(async (event) => {
  const { user } = await requireUserSession(event)

  const { prefix = '' } = getQuery(event) as { prefix?: string }
  const config = useRuntimeConfig()
  const group = resolveGroup(user.roles)
  const rules = await getAccessRules()
  // Admins (by Discord role ID) see and play everything; for everyone else,
  // folder-restricted content is hidden outright (window locks stay visible
  // as upsell cards — see isFolderBlockedForGroup).
  const admin = isAdmin(user.roleIds)

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
    .filter(p => admin || !isFolderBlockedForGroup(p, group, rules))
    .map(p => ({
      prefix: p,
      name: p.slice(prefix.length).replace(/\/$/, ''),
    }))

  const candidates = (result.Contents ?? [])
    .filter(obj => obj.Key && !obj.Key.startsWith('bitacora/') && VIDEO_EXT.test(obj.Key) && (obj.Size ?? 0) > 0)
    .filter(obj => admin || !isFolderBlockedForGroup(obj.Key!, group, rules))

  // Overrides must load before the access check: uploadedAt overrides
  // (set on folder moves) take precedence over S3 LastModified.
  const overrides = await getVideoOverrides(candidates.map(obj => obj.Key!))

  const built = candidates.map(obj => {
    const uploadedAt = overrides.get(obj.Key!)?.uploadedAt ?? obj.LastModified?.getTime() ?? null
    const decision: AccessDecision = admin
      ? { allowed: true }
      : checkVideoAccess({ group, key: obj.Key!, uploadedAt, rules })
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

  // Apply display-name overrides after sorting, so chronological order still
  // derives from the original filename (renames must not reorder the grid).
  const videos = built
    .sort((a, b) => {
      const da = parseVideoDate(a.name) ?? a.lastModified ?? 0
      const db = parseVideoDate(b.name) ?? b.lastModified ?? 0
      return db - da
    })
    .map(({ lastModified: _, ...v }) => ({ ...v, name: overrides.get(v.key)?.displayName ?? v.name }))

  return { prefix, folders, videos }
})
