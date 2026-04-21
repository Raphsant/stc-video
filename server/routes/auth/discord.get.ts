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
        message: 'Your Discord account is not authorized to access this site.',
      })
    }

    await setUserSession(event, {
      user: {
        id: record._id,
        username: record.username,
        roles: record.roles,
      },
    })

    return sendRedirect(event, '/')
  },
  onError(event, error) {
    console.error('Discord OAuth error:', error)
    return sendRedirect(event, '/?error=oauth')
  },
})
