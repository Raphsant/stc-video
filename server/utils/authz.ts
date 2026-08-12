// Authorization gates for the admin endpoints. Both read the session only —
// no network, no DB — so they stay cheap enough to call on every request.

import type { H3Event } from 'h3'

// Staff (admin/mod/coach): may rename, move, and edit access rules.
export async function requireContentManager(event: H3Event) {
  const { user } = await requireUserSession(event)
  if (!isContentManager(user.roles)) {
    throw createError({
      statusCode: 403,
      message: 'No tienes permiso para administrar videos',
    })
  }
  return user
}

// Admin only, matched on the Discord role ID. Fails closed when the session
// carries no roleIds — either it predates the role sync or the bot was down at
// login. The refresh middleware repopulates them on the next request, and
// failing closed is the right side to err on for a permanent delete.
export async function requireAdmin(event: H3Event) {
  const { user } = await requireUserSession(event)
  if (!isAdmin(user.roleIds)) {
    throw createError({
      statusCode: 403,
      message: 'Solo un administrador puede realizar esta acción',
    })
  }
  return user
}
