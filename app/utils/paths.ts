// Route builders for the two dynamic routes. Both S3 keys and folder prefixes
// contain spaces, accents and `&` (e.g. `Q&A/2026/Mayo 2026/`), so every
// segment has to be encoded — and encoded the same way in all call sites, or
// links silently 404 on exactly the folders whose names are most interesting.

/** `/videos/[key]` — the whole key is one encoded segment. */
export function videoPath(key: string): string {
  return `/videos/${encodeURIComponent(key)}`
}

/** `/folders/[...path]` — one encoded segment per path level. */
export function folderPath(prefix: string): string {
  const clean = prefix.replace(/\/$/, '')
  if (!clean) return '/'
  return '/folders/' + clean.split('/').map(encodeURIComponent).join('/')
}
