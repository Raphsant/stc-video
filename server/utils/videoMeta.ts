import { VideoMeta } from '../models/VideoMeta'

// Fetch displayName overrides for a batch of S3 keys in one query.
// Returns a Map of s3Key -> displayName for keys that have a non-empty
// override. Callers apply it as `overrides.get(key) ?? filenameDerivedName`.
export async function getDisplayNames(keys: string[]): Promise<Map<string, string>> {
  const map = new Map<string, string>()
  if (!keys.length) return map

  // Cast: nuxt-mongoose's defineMongooseModel types the filter loosely and
  // rejects plain field literals (same quirk affects the other models here).
  const docs = await VideoMeta.find({
    s3Key: { $in: keys },
    displayName: { $nin: [null, ''] },
  } as any).lean()

  for (const doc of docs) {
    const key = String(doc.s3Key)
    const name = doc.displayName ? String(doc.displayName) : ''
    if (name) map.set(key, name)
  }
  return map
}
