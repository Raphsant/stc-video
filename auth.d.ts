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
