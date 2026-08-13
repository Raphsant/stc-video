import { ListObjectsV2Command, S3Client } from '@aws-sdk/client-s3'
import type { AccessDecision } from '~~/server/utils/access'
import { VIDEO_EXT } from '~~/shared/utils/videoExt'

export default defineEventHandler(async (event) => {
  const { user } = await requireUserSession(event)

  const config = useRuntimeConfig()
  const group = resolveGroup(user.roles)
  const rules = await getAccessRules()
  // Admins (by Discord role ID) see and play everything. For everyone else,
  // folders blocked for BOTH tiers (admin-only content) are hidden outright;
  // single-tier blocks and window locks stay visible as locked upsell cards
  // — see isFolderHiddenFromMembers.
  const admin = isAdmin(user.roleIds)

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
    .filter(p => admin || !isFolderHiddenFromMembers(p, rules))

  const folders = await Promise.all(
    folderPrefixes.map(async prefix => {
      const name = prefix.replace(/\/$/, '')

      const folderResult = await s3.send(
        new ListObjectsV2Command({
          Bucket: config.s3Bucket,
          Prefix: prefix,
        })
      )

      const candidates = (folderResult.Contents ?? [])
        .filter(obj => obj.Key && VIDEO_EXT.test(obj.Key) && (obj.Size ?? 0) > 0)
        .filter(obj => admin || !isFolderHiddenFromMembers(obj.Key!, rules))

      // Overrides must load before the access check: uploadedAt overrides
      // (set on folder moves) take precedence over S3 LastModified.
      const overrides = await getVideoOverrides(candidates.map(obj => obj.Key!))

      const ranked = candidates
        .map(obj => {
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
        .sort((a, b) => {
          const da = parseVideoDate(a.name) ?? a.lastModified ?? 0
          const db = parseVideoDate(b.name) ?? b.lastModified ?? 0
          return db - da
        })
        .slice(0, 5)

      const recentVideos = ranked.map(({ lastModified: _, ...v }) => ({
        ...v,
        name: overrides.get(v.key)?.displayName ?? v.name,
      }))

      return { prefix, name, recentVideos }
    })
  )

  return { folders }
})
