// The video formats the library accepts, in one place. The listing endpoints
// filter on VIDEO_EXT, the upload endpoints validate against it, and the upload
// dropzone advertises VIDEO_ACCEPT to the file picker — they must not drift.

export const VIDEO_EXT = /\.(mp4|mov|m4v|mkv|webm|avi)$/i

/** `accept` attribute for the file input / dropzone. */
export const VIDEO_ACCEPT = '.mp4,.mov,.m4v,.mkv,.webm,.avi'

// Browsers fill File.type inconsistently for these containers (mkv and m4v are
// routinely empty), and the value ends up on the S3 object forever, so the
// upload endpoint derives it from the extension instead of trusting the client.
const CONTENT_TYPES: Record<string, string> = {
  mp4: 'video/mp4',
  mov: 'video/quicktime',
  m4v: 'video/x-m4v',
  mkv: 'video/x-matroska',
  webm: 'video/webm',
  avi: 'video/x-msvideo',
}

export function videoContentType(fileName: string): string {
  const ext = fileName.split('.').pop()?.toLowerCase() ?? ''
  return CONTENT_TYPES[ext] ?? 'application/octet-stream'
}
