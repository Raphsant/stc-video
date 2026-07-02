import { AccessConfig } from '~~/server/models/AccessConfig'

// Staff-only: the current admin-editable access rules for the /admin panel.
// Distinguishes "no document yet" (built-in defaults) from an explicit
// stored null (= unlimited).
export default defineEventHandler(async (event) => {
  const { user } = await requireUserSession(event)
  if (!isContentManager(user.roles)) {
    throw createError({ statusCode: 403, message: 'No tienes permiso para administrar el acceso' })
  }

  // Cast: nuxt-mongoose types the filter loosely (same quirk as the models).
  const doc = await AccessConfig.findOne({ key: 'global' } as any).lean()

  if (!doc) {
    return {
      alphaDaysBack: DEFAULT_ACCESS_RULES.windows.alpha,
      deltaDaysBack: DEFAULT_ACCESS_RULES.windows.delta,
      folderRules: [] as { prefix: string; alpha: boolean; delta: boolean }[],
    }
  }

  return {
    alphaDaysBack: doc.alphaDaysBack ?? null,
    deltaDaysBack: doc.deltaDaysBack ?? null,
    folderRules: (doc.folderRules ?? []).map((r: any) => ({
      prefix: String(r.prefix),
      alpha: r.alpha !== false,
      delta: r.delta !== false,
    })),
  }
})
