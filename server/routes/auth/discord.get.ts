import { DiscordUser } from '~~/server/models/DiscordUser'

export default defineOAuthDiscordEventHandler({
  config: {
    scope: ['identify'],
  },
  async onSuccess(event, { user }) {
    const record = await DiscordUser.findById(user.id).lean()

    if (!record) {
      throw createError({
        statusCode: 403,
        message: 'Tu cuenta de Discord no está autorizada para acceder a este sitio.',
      })
    }

    // Coerce: nuxt-mongoose's .lean() types these as the schema
    // constructors (String/[String]) rather than string/string[].
    const discordId = String(record._id)
    let roles = (record.roles ?? []).map(String)
    let roleIds: string[] = []
    let rolesSyncedAt = 0

    // Enrich with live roles where we can. When the bot is unreachable we sign
    // in on the stored roles with rolesSyncedAt 0, and the refresh middleware
    // retries on the first request.
    const fetched = await fetchMemberRoles(discordId)

    // The bot is certain this user is not in the guild (Discord's own Unknown
    // Member). guildMemberRemove only stamps removedAt, so their DiscordUser
    // record survives and the check above would let them back in. Refusing
    // here matches the refresh middleware, which would end the session on
    // their next request anyway — better a clear message than a login that
    // silently undoes itself.
    if (fetched === 'not_found') {
      throw createError({
        statusCode: 403,
        message: 'Tu cuenta de Discord ya no pertenece al servidor de STC.',
      })
    }

    if (fetched) {
      roles = fetched.roles.map(r => r.name)
      roleIds = fetched.roles.map(r => r.id)
      rolesSyncedAt = Date.now()
      // Fire and forget: keeps the next login correct even if the bot is down
      // by then. Cast per the nuxt-mongoose filter typing quirk.
      DiscordUser.findByIdAndUpdate(discordId, { roles } as any).catch(() => {})
    }

    // replace, not set: setUserSession merges through defu, which concatenates
    // arrays — re-logging in with fewer roles would keep the old ones.
    await replaceUserSession(event, {
      user: {
        id: discordId,
        username: String(record.username),
        roles,
        roleIds,
        rolesSyncedAt,
      },
    })

    return sendRedirect(event, '/')
  },
  onError(event, error) {
    console.error('Discord OAuth error:', error)
    return sendRedirect(event, '/?error=oauth')
  },
})
