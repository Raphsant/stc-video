// Display formatters shared by the video grids and the single-video page.

/** Human file size, rounded the way a video library wants it: "820 MB", "1.4 GB". */
export function formatSize(bytes?: number | null): string {
  if (!bytes) return ''
  const mb = bytes / (1024 * 1024)
  return mb >= 1000 ? `${(mb / 1024).toFixed(1)} GB` : `${mb.toFixed(0)} MB`
}

/** Transfer rate for the upload queue: "820 KB/s", "12.4 MB/s". */
export function formatSpeed(bytesPerSecond: number): string {
  if (!bytesPerSecond || bytesPerSecond < 1) return ''
  const mb = bytesPerSecond / (1024 * 1024)
  if (mb < 1) return `${Math.round(bytesPerSecond / 1024)} KB/s`
  return `${mb.toFixed(1)} MB/s`
}

/** Playback position as h:mm:ss (or m:ss under an hour). */
export function formatTimestamp(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)
  return h > 0
    ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
    : `${m}:${String(s).padStart(2, '0')}`
}
