// Mirrors app/../auth.d.ts so the nuxt-auth-utils `User` augmentation is also
// visible to the Nitro server context (its tsconfig includes shared/**/*.d.ts
// but not the root auth.d.ts). Keep the two in sync.
declare module '#auth-utils' {
  interface User {
    id: string
    username: string
    roles: string[]
  }

  interface UserSession {
    user: User
  }
}

export {}
