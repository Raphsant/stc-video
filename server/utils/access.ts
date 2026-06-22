// Role-based access control for video content.
//
// Two tiers, derived from a user's synced Discord roles (resolved in
// shared/utils/tier.ts, shared with the client):
//   alpha — sees everything, no time limit, all folders
//   delta — only the last 30 days of uploads, no alpha-exclusive folders
//
// Enforcement is server-side: the listing endpoints mark inaccessible
// videos as `locked` (url: null) for upsell UI, and the URL-signing
// endpoints hard-deny. Never trust the client to filter.

// The canonical role->tier logic lives in shared/utils/tier.ts (shared with
// the client). We re-export it here because Nitro's server auto-import resolves
// `resolveGroup` to this util, not to shared/.
import type { AccessGroup } from '../../shared/utils/tier'
export { resolveGroup, isContentManager, type AccessGroup } from '../../shared/utils/tier'

export type LockReason = 'no-group' | 'folder' | 'window'

// Per-tier rules. `daysBack: null` means no time limit.
const GROUP_RULES: Record<AccessGroup, { daysBack: number | null; exclusiveFolders: string[] }> = {
  alpha: { daysBack: null, exclusiveFolders: [] },
  delta: { daysBack: 30, exclusiveFolders: [] },
}

// S3 key-prefix -> groups allowed to view it. Empty for now (no folder is
// alpha-exclusive yet); add entries like 'alpha-exclusive/': ['alpha'] here.
const RESTRICTED_FOLDERS: Record<string, AccessGroup[]> = {
  // 'alpha-exclusive/': ['alpha'],
}

const DAY_MS = 24 * 60 * 60 * 1000

export interface AccessDecision {
  allowed: boolean
  reason?: LockReason
}

// The single source of truth for "can this group view this video?".
//   uploadedAt — when the content became available (S3 LastModified, ms epoch).
//                Used for the delta time window. CLAUDE.md: use the upload
//                time, not the recording date parsed from the filename.
export function checkVideoAccess(opts: {
  group: AccessGroup | null
  key: string
  uploadedAt?: number | null
  now?: number
}): AccessDecision {
  const { group, key } = opts
  const now = opts.now ?? Date.now()

  if (!group) return { allowed: false, reason: 'no-group' }

  // 1. Folder restriction
  for (const [prefix, allowed] of Object.entries(RESTRICTED_FOLDERS)) {
    if (key.startsWith(prefix) && !allowed.includes(group)) {
      return { allowed: false, reason: 'folder' }
    }
  }

  // 2. Time window
  const { daysBack } = GROUP_RULES[group]
  if (daysBack != null) {
    if (opts.uploadedAt == null) return { allowed: false, reason: 'window' }
    const cutoff = now - daysBack * DAY_MS
    if (opts.uploadedAt < cutoff) return { allowed: false, reason: 'window' }
  }

  return { allowed: true }
}
