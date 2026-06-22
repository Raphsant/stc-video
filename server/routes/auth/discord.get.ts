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

    await setUserSession(event, {
      user: {
        // Coerce: nuxt-mongoose's .lean() types these as the schema
        // constructors (String/[String]) rather than string/string[].
        id: String(record._id),
        username: String(record.username),
        roles: (record.roles ?? []).map(String),
      },
    })

    return sendRedirect(event, '/')
  },
  onError(event, error) {
    console.error('Discord OAuth error:', error)
    return sendRedirect(event, '/?error=oauth')
  },
})
