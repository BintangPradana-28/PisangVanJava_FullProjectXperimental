import NextAuth, { DefaultSession, DefaultUser } from 'next-auth'
import { JWT } from 'next-auth/jwt'

declare module 'next-auth' {
  /**
   * Returned by `useSession`, `getSession` and received as a prop on the `SessionProvider` React Context
   */
  interface Session {
    user: {
      id: string
      role: 'SUPER_ADMIN' | 'ADMIN' | 'KITCHEN' | 'CASHIER' | 'CUSTOMER' | 'RESELLER'
      isBanned: boolean
    } & DefaultSession['user']
  }

  interface User extends DefaultUser {
    id: string
    role: 'SUPER_ADMIN' | 'ADMIN' | 'KITCHEN' | 'CASHIER' | 'CUSTOMER' | 'RESELLER'
    isBanned: boolean
  }
}

declare module 'next-auth/jwt' {
  /** Returned by the `jwt` callback and `getToken`, when using JWT sessions */
  interface JWT {
    id: string
    role: 'SUPER_ADMIN' | 'ADMIN' | 'KITCHEN' | 'CASHIER' | 'CUSTOMER' | 'RESELLER'
    isBanned: boolean
  }
}
