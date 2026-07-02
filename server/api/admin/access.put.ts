import { AccessConfig } from '~~/server/models/AccessConfig'

// Staff-only: save the access rules edited in the /admin panel.
// Body: {
//   alphaDaysBack: number | null,   // null = unlimited
//   deltaDaysBack: number | null,
//   folderRules: { prefix: string, alpha: boolean, delta: boolean }[]
// }
// Only meaningful rules are persisted (both-allowed entries are dropped).

const MAX_RULES = 200
const MAX_PREFIX_LENGTH = 512
const MAX_DAYS = 3650 // ~10 years; enough for "unlimited but explicit"

function parseDays(value: unknown, label: string): number | null {
  if (value == null) return null
  const n = Number(value)
  if (!Number.isInteger(n) || n < 1 || n > MAX_DAYS) {
    throw createError({
      statusCode: 400,
      message: `La ventana de ${label} debe ser un número entero entre 1 y ${MAX_DAYS} días`,
    })
  }
  return n
}

function parsePrefix(raw: unknown): string {
  const prefix = typeof raw === 'string' ? raw.trim() : ''
  const valid =
    prefix.length > 0 &&
    prefix.length <= MAX_PREFIX_LENGTH &&
    prefix.endsWith('/') &&
    !prefix.startsWith('/') &&
    // eslint-disable-next-line no-control-regex
    !/[\x00-\x1F\x7F]/.test(prefix) &&
    !prefix.slice(0, -1).split('/').some(s => !s.trim() || s === '.' || s === '..')
  if (!valid) {
    throw createError({ statusCode: 400, message: `Regla de carpeta inválida: "${prefix}"` })
  }
  return prefix
}

export default defineEventHandler(async (event) => {
  const { user } = await requireUserSession(event)
  if (!isContentManager(user.roles)) {
    throw createError({ statusCode: 403, message: 'No tienes permiso para administrar el acceso' })
  }

  const body = await readBody<{
    alphaDaysBack?: unknown
    deltaDaysBack?: unknown
    folderRules?: unknown
  }>(event)

  const alphaDaysBack = parseDays(body?.alphaDaysBack, 'Alpha')
  const deltaDaysBack = parseDays(body?.deltaDaysBack, 'Delta')

  const rawRules = Array.isArray(body?.folderRules) ? body!.folderRules : []
  if (rawRules.length > MAX_RULES) {
    throw createError({ statusCode: 400, message: `Demasiadas reglas de carpeta (máx. ${MAX_RULES})` })
  }

  // Dedupe by prefix (last wins) and drop no-op rules where both are allowed.
  const byPrefix = new Map<string, { prefix: string; alpha: boolean; delta: boolean }>()
  for (const raw of rawRules as any[]) {
    const prefix = parsePrefix(raw?.prefix)
    const alpha = raw?.alpha !== false
    const delta = raw?.delta !== false
    if (alpha && delta) {
      byPrefix.delete(prefix)
      continue
    }
    byPrefix.set(prefix, { prefix, alpha, delta })
  }
  const folderRules = Array.from(byPrefix.values()).sort((a, b) => a.prefix.localeCompare(b.prefix, 'es'))

  // Cast: nuxt-mongoose types the filter loosely (same quirk as the models).
  await AccessConfig.findOneAndUpdate(
    { key: 'global' } as any,
    { key: 'global', alphaDaysBack, deltaDaysBack, folderRules },
    { upsert: true },
  )

  // This instance sees the change immediately; other serverless instances
  // converge within the 30 s rules-cache TTL.
  invalidateAccessRulesCache()

  return { saved: true, alphaDaysBack, deltaDaysBack, folderRules }
})
