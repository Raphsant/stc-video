import { AccessConfig } from '../models/AccessConfig'
import { DEFAULT_ACCESS_RULES, type AccessRules } from './access'

// Admin-editable access rules, loaded from the AccessConfig singleton and
// cached in memory so listing endpoints don't hit Mongo per request. The
// cache is per serverless instance: after a save, other instances converge
// within CACHE_TTL_MS (the saving instance is invalidated immediately).
const CACHE_TTL_MS = 30_000

let cached: { rules: AccessRules; at: number } | null = null

function normalizeDays(value: unknown): number | null {
  if (value == null) return null
  const n = Number(value)
  if (!Number.isFinite(n) || n <= 0) return null
  return Math.floor(n)
}

export async function getAccessRules(): Promise<AccessRules> {
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.rules

  try {
    // Cast: nuxt-mongoose types the filter loosely (same quirk as the models).
    const doc = await AccessConfig.findOne({ key: 'global' } as any).lean()
    const rules: AccessRules = doc
      ? {
          windows: {
            alpha: normalizeDays(doc.alphaDaysBack),
            delta: normalizeDays(doc.deltaDaysBack),
          },
          folderRules: (doc.folderRules ?? []).map((r: any) => ({
            prefix: String(r.prefix),
            allowed: { alpha: r.alpha !== false, delta: r.delta !== false },
          })),
        }
      : DEFAULT_ACCESS_RULES
    cached = { rules, at: Date.now() }
    return rules
  } catch {
    // DB hiccup: serve the stale cache or the safe defaults instead of
    // failing every video listing.
    return cached?.rules ?? DEFAULT_ACCESS_RULES
  }
}

export function invalidateAccessRulesCache(): void {
  cached = null
}
