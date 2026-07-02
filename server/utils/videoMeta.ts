import { VideoMeta } from '../models/VideoMeta'

// Per-video admin overrides layered on top of the S3-derived truth.
//   displayName — shown instead of the filename-derived name.
//   uploadedAt  — original availability date (ms epoch); set on folder moves
//                 because an S3 copy resets LastModified. Access-window checks
//                 must prefer this over S3's LastModified when present.
export interface VideoOverrides {
  displayName: string | null
  uploadedAt: number | null
}

// Fetch overrides for a batch of S3 keys in one query. Returns a Map of
// s3Key -> overrides for keys that have at least one meaningful value.
// Callers apply each field as `overrides.get(key)?.field ?? s3DerivedValue`.
export async function getVideoOverrides(keys: string[]): Promise<Map<string, VideoOverrides>> {
  const map = new Map<string, VideoOverrides>()
  if (!keys.length) return map

  // Cast: nuxt-mongoose's defineMongooseModel types the filter loosely and
  // rejects plain field literals (same quirk affects the other models here).
  const docs = await VideoMeta.find({ s3Key: { $in: keys } } as any).lean()

  for (const doc of docs) {
    const displayName = doc.displayName ? String(doc.displayName) : null
    const uploadedAt = doc.uploadedAt ? new Date(doc.uploadedAt as any).getTime() : null
    if (displayName || uploadedAt) {
      map.set(String(doc.s3Key), { displayName, uploadedAt })
    }
  }
  return map
}
