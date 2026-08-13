// Key and prefix validation for the endpoints that write to the bucket (move,
// upload). Folders in S3 are virtual, so a not-yet-existing prefix is perfectly
// valid — these checks exist to keep writes inside the video namespace, not to
// prove the folder is already there.
//
import { VIDEO_EXT } from '../../shared/utils/videoExt'

export const MAX_KEY_LENGTH = 1024 // S3 hard limit
export const MAX_FILE_NAME_LENGTH = 255

// eslint-disable-next-line no-control-regex
const CONTROL_CHARS = /[\x00-\x1F\x7F]/

/**
 * Normalize and validate a destination folder prefix, always trailing-slashed.
 * Rejects the bucket root: everything lives under a session-type folder.
 */
export function normalizeDestPrefix(raw: string): string {
  let prefix = raw.trim().replace(/^\/+/, '')
  if (prefix && !prefix.endsWith('/')) prefix += '/'

  if (!prefix || prefix === '/') {
    throw createError({ statusCode: 400, message: 'Selecciona una carpeta de destino' })
  }
  if (CONTROL_CHARS.test(prefix)) {
    throw createError({ statusCode: 400, message: 'La carpeta de destino contiene caracteres inválidos' })
  }
  const segments = prefix.slice(0, -1).split('/')
  if (segments.some(s => !s.trim() || s === '.' || s === '..')) {
    throw createError({ statusCode: 400, message: 'La carpeta de destino no es válida' })
  }
  if (prefix.toLowerCase().startsWith('bitacora/')) {
    throw createError({ statusCode: 400, message: 'Esa carpeta está reservada' })
  }
  return prefix
}

/**
 * Validate a bare file name (no path separators) destined for the bucket.
 * Returns the trimmed name.
 */
export function assertUploadFileName(raw: string): string {
  const name = raw.trim()
  if (!name) {
    throw createError({ statusCode: 400, message: 'Falta el nombre del archivo' })
  }
  if (name.includes('/') || name.includes('\\') || CONTROL_CHARS.test(name)) {
    throw createError({ statusCode: 400, message: 'El nombre del archivo contiene caracteres inválidos' })
  }
  if (name.length > MAX_FILE_NAME_LENGTH) {
    throw createError({ statusCode: 400, message: 'El nombre del archivo es demasiado largo' })
  }
  if (!VIDEO_EXT.test(name)) {
    throw createError({
      statusCode: 400,
      message: 'Solo se pueden subir videos (mp4, mov, m4v, mkv, webm, avi)',
    })
  }
  return name
}

/**
 * Guard for a full object key supplied by the browser. create.post.ts mints the
 * key, but sign/complete/abort receive it back from the client, so every hop
 * re-validates that it still points inside the video namespace.
 */
export function assertUploadKey(raw: string): string {
  const key = raw.trim()
  if (!key) {
    throw createError({ statusCode: 400, message: 'Clave de video faltante' })
  }
  if (key.length > MAX_KEY_LENGTH) {
    throw createError({ statusCode: 400, message: 'La ruta del archivo es demasiado larga' })
  }
  if (CONTROL_CHARS.test(key)) {
    throw createError({ statusCode: 400, message: 'La ruta del archivo contiene caracteres inválidos' })
  }
  const segments = key.split('/')
  if (segments.length < 2 || segments.some(s => !s.trim() || s === '.' || s === '..')) {
    throw createError({ statusCode: 400, message: 'La ruta del archivo no es válida' })
  }
  if (key.toLowerCase().startsWith('bitacora/')) {
    throw createError({ statusCode: 400, message: 'Esa carpeta está reservada' })
  }
  if (!VIDEO_EXT.test(key)) {
    throw createError({ statusCode: 400, message: 'Solo se pueden subir archivos de video' })
  }
  return key
}
