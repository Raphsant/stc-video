// Mirrors app/../auth.d.ts so the nuxt-auth-utils `User` augmentation is also
// visible to the Nitro server context (its tsconfig includes shared/**/*.d.ts
// but not the root auth.d.ts). Keep the two in sync.
declare module '#auth-utils' {
  interface User {
    id: string
    username: string
    roles: string[]
    // Discord role IDs, from the bot API. Optional: sessions created before
    // the role sync existed, or while the bot was unreachable, have none.
    roleIds?: string[]
    // ms epoch of the last successful role sync. Missing/0 reads as stale, so
    // those older sessions refresh on their next request.
    rolesSyncedAt?: number
  }

  interface UserSession {
    user: User
  }
}

export {}
