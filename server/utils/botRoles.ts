// Live Discord roles, read from stcbot's internal API.
//
// Discord OAuth here uses the `identify` scope only, so the site never sees a
// user's roles directly — it reads whatever the bot last wrote to the
// DiscordUser collection. That snapshot goes stale as soon as someone's roles
// change, which is why login and the daily refresh call the bot instead.

export interface FetchedMember {
  id: string
  username: string
  roles: { id: string; name: string }[]
}

// Three outcomes the callers need to tell apart:
//   FetchedMember — live roles
//   'not_found'   — the user left the guild; their session should end
//   null          — bot unreachable or unconfigured; keep the roles we have
export async function fetchMemberRoles(
  discordId: string,
): Promise<FetchedMember | 'not_found' | null> {
  const config = useRuntimeConfig()
  if (!config.botApiUrl || !config.botApiKey) return null

  try {
    return await $fetch<FetchedMember>(
      `/api/members/${encodeURIComponent(discordId)}/roles`,
      {
        baseURL: config.botApiUrl,
        headers: { 'x-api-key': config.botApiKey },
        // Short and no retry: this runs inline on page requests, so a hung
        // bot must not hold the response open.
        timeout: 3000,
        retry: 0,
      },
    )
  } catch (err: any) {
    if (err?.statusCode === 404 || err?.status === 404) return 'not_found'
    console.error('Bot role fetch failed:', err?.message ?? err)
    return null
  }
}
