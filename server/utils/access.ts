// Role-based access control for video content.
//
// Two tiers, derived from a user's synced Discord roles (resolved in
// shared/utils/tier.ts, shared with the client):
//   alpha — sees everything by default, no time limit
//   delta — only the last 30 days of uploads by default
//
// The actual rules (time windows + folder restrictions) are admin-editable
// and live in the AccessConfig collection — load them once per request with
// getAccessRules() and pass them to checkVideoAccess(). Without rules the
// defaults below apply.
//
// Enforcement is server-side: the listing endpoints mark inaccessible
// videos as `locked` (url: null) for upsell UI, and the URL-signing
// endpoints hard-deny. Never trust the client to filter.

// The canonical role->tier logic lives in shared/utils/tier.ts (shared with
// the client). We re-export it here because Nitro's server auto-import resolves
// `resolveGroup` to this util, not to shared/.
import type { AccessGroup } from '../../shared/utils/tier'
export { resolveGroup, isContentManager, isAdmin, ADMIN_ROLE_ID, type AccessGroup } from '../../shared/utils/tier'

export type LockReason = 'no-group' | 'folder' | 'window'

// A folder restriction: any S3 key under `prefix` is denied for groups
// mapped to false. Nested rules combine as AND (every matching rule must
// allow the group).
export interface FolderRule {
  prefix: string
  allowed: Record<AccessGroup, boolean>
}

export interface AccessRules {
  // Days back from now per tier; null = unlimited.
  windows: Record<AccessGroup, number | null>
  folderRules: FolderRule[]
}

// Fallback when no AccessConfig document exists (or the DB is unreachable):
// the original hardcoded behavior.
export const DEFAULT_ACCESS_RULES: AccessRules = {
  windows: { alpha: null, delta: 30 },
  folderRules: [],
}

const DAY_MS = 24 * 60 * 60 * 1000

export interface AccessDecision {
  allowed: boolean
  reason?: LockReason
}

// The single source of truth for "can this group view this video?".
//   uploadedAt — when the content became available (S3 LastModified or the
//                VideoMeta override, ms epoch). Used for the time window.
//                CLAUDE.md: use the upload time, not the recording date
//                parsed from the filename.
//   rules      — admin-editable rules from getAccessRules(); defaults apply
//                when omitted.
export function checkVideoAccess(opts: {
  group: AccessGroup | null
  key: string
  uploadedAt?: number | null
  now?: number
  rules?: AccessRules
}): AccessDecision {
  const { group, key } = opts
  const rules = opts.rules ?? DEFAULT_ACCESS_RULES
  const now = opts.now ?? Date.now()

  if (!group) return { allowed: false, reason: 'no-group' }

  // 1. Folder restrictions
  for (const rule of rules.folderRules) {
    if (key.startsWith(rule.prefix) && !rule.allowed[group]) {
      return { allowed: false, reason: 'folder' }
    }
  }

  // 2. Time window
  const daysBack = rules.windows[group]
  if (daysBack != null) {
    if (opts.uploadedAt == null) return { allowed: false, reason: 'window' }
    const cutoff = now - daysBack * DAY_MS
    if (opts.uploadedAt < cutoff) return { allowed: false, reason: 'window' }
  }

  return { allowed: true }
}

// Whether a path sits inside a subtree some folder rule denies to `group`.
// Used by the listing endpoints to HIDE folder-restricted content outright —
// unlike window locks, which stay visible as locked cards to drive upgrades,
// a restricted folder shouldn't advertise its existence. Works for folder
// prefixes and full video keys alike; because nested rules AND together (a
// child can't re-allow what an ancestor blocks), any path inside a blocked
// subtree is wholly blocked, so hiding the entry hides nothing reachable.
// Group-less users don't hide: everything of theirs is already locked
// 'no-group', and the folder tree doubles as the upsell surface.
export function isFolderBlockedForGroup(
  path: string,
  group: AccessGroup | null,
  rules: AccessRules,
): boolean {
  if (!group) return false
  return rules.folderRules.some(r => !r.allowed[group] && path.startsWith(r.prefix))
}
