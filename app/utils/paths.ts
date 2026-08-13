// Route builders for the two dynamic routes. Both S3 keys and folder prefixes
// contain spaces, accents and `&` (e.g. `Q&A/2026/Mayo 2026/`), so every
// segment has to be encoded — and encoded the same way in all call sites, or
// links silently 404 on exactly the folders whose names are most interesting.

/**
 * `/videos/[...key]` — one encoded segment per path level.
 *
 * The key's slashes have to stay real slashes. Packing the whole key into a
 * single `%2F`-encoded segment works locally but 404s in production: Cloudflare
 * normalizes `%2F` back to `/` before the request reaches the app, and the URL
 * then matches no single-segment route. Same reason folderPath splits below.
 */
export function videoPath(key: string): string {
  return '/videos/' + key.split('/').map(encodeURIComponent).join('/')
}

/** The `/api/videos/[...key]` URL for a key, encoded the same way. */
export function videoApiPath(key: string): string {
  return '/api/videos/' + key.split('/').map(encodeURIComponent).join('/')
}

/** `/folders/[...path]` — one encoded segment per path level. */
export function folderPath(prefix: string): string {
  const clean = prefix.replace(/\/$/, '')
  if (!clean) return '/'
  return '/folders/' + clean.split('/').map(encodeURIComponent).join('/')
}
