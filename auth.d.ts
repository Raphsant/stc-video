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
