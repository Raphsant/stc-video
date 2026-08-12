// Keeps a logged-in session's Discord roles fresh, at most once a day.
//
// Sessions are sealed cookies with no server-side store, so they can only be
// rewritten during a request the user makes — a cron job has nothing to write
// to. This piggybacks on normal navigation instead: once a day, the first
// eligible request a user makes re-reads their roles from the bot. Someone
// promoted to Alpha (or demoted out of it) sees the change on their next visit
// rather than at their next login, which may be months away.
//
// Every access decision reads the session (resolveGroup, isContentManager,
// isAdmin), so rewriting it here is all that's needed for the new roles to
// take effect everywhere.

import { DiscordUser } from '../models/DiscordUser'

const SYNC_INTERVAL_MS = 24 * 60 * 60 * 1000

// A failed sync leaves rolesSyncedAt untouched, so without a separate brake
// every request would retry a down bot. Last-attempt lives in memory rather
// than the cookie — writing it would mean a Set-Cookie on every request. Per
// serverless instance, same tradeoff as the getAccessRules cache.
const FAILURE_BACKOFF_MS = 5 * 60 * 1000
const lastAttempt = new Map<string, number>()

const STATIC_EXT = /\.(js|mjs|css|map|json|png|jpe?g|webp|svg|gif|ico|woff2?|ttf|txt|xml|webmanifest)$/i

// Worth a sync check? Covers API calls (client-side navigation) and page
// documents (SSR), skipping assets and the endpoints that manage the session
// themselves.
function isEligible(path: string, method: string): boolean {
  const p = path.split('?')[0] ?? path
  if (p.startsWith('/api/')) return !p.startsWith('/api/_auth')
  if (method !== 'GET') return false
  if (p.startsWith('/_') || p.startsWith('/__')) return false
  if (p.startsWith('/auth/')) return false
  return !STATIC_EXT.test(p)
}

export default defineEventHandler(async (event) => {
  if (!isEligible(event.path, event.method)) return

  // Cheapest possible bail-out for anonymous traffic: no session cookie means
  // nothing to refresh, and we skip unsealing entirely.
  const config = useRuntimeConfig(event)
  const cookieName = (config.session as { name?: string } | undefined)?.name ?? 'nuxt-session'
  if (!getCookie(event, cookieName)) return

  const { user } = await getUserSession(event)
  if (!user?.id) return

  const now = Date.now()
  if (now - (user.rolesSyncedAt ?? 0) < SYNC_INTERVAL_MS) return
  if (now - (lastAttempt.get(user.id) ?? 0) < FAILURE_BACKOFF_MS) return
  lastAttempt.set(user.id, now)

  const fetched = await fetchMemberRoles(user.id)

  // Bot unreachable: keep the roles we have. A sync outage must not lock
  // members out of content they paid for.
  if (fetched === null) return

  // Left the guild — end the session. Pages then render logged-out and API
  // calls 401, same as any expired session.
  if (fetched === 'not_found') {
    await clearUserSession(event)
    return
  }

  const roles = fetched.roles.map(r => r.name)
  const roleIds = fetched.roles.map(r => r.id)

  // replace, not set: setUserSession merges through defu, which concatenates
  // arrays — a demoted user would keep their old roles alongside the new ones
  // and never actually lose access.
  await replaceUserSession(event, {
    user: {
      id: user.id,
      username: fetched.username,
      roles,
      roleIds,
      rolesSyncedAt: now,
    },
  })

  // Fire and forget: keeps the next login correct even if the bot is down then.
  DiscordUser.findByIdAndUpdate(user.id, {
    roles,
    username: fetched.username,
  } as any).catch(() => {})
})
