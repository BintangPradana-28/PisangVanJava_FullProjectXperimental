import * as jwt from 'jose'
import type { DefaultSession, NextAuthConfig } from 'next-auth'
import GoogleProvider from 'next-auth/providers/google'
import { getAuthSecret } from '@/src/env'

declare module 'next-auth' {
  interface Session {
    supabaseAccessToken?: string
    user: {
      id: string
      role: string
      isBanned: boolean
      sessionId?: string
    } & DefaultSession['user']
  }
}

export const authConfig = {
  pages: {
    signIn: '/member-login'
  },
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60 // 30 Days
  },
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.id = user.id
        token.role = (user as any).role
        token.isBanned = (user as any).isBanned

        // Inject sessionId
        const { nanoid } = await import('nanoid')
        const sessionId = nanoid()
        token.sessionId = sessionId

        // Register session to Redis
        try {
          const { redis } = await import('@/lib/redis')
          const sessionKey = `session:${user.id}:${sessionId}`
          const userAgent = 'Unknown Device' // Could fetch from headers if passed, but this is server-side
          await redis.setex(
            sessionKey,
            60 * 60 * 24 * 30,
            JSON.stringify({ createdAt: Date.now(), device: userAgent })
          )
        } catch (e) {
          console.error('Failed to register session in Redis', e)
        }
      }

      if (trigger === 'update' && session) {
        if (session.role) token.role = session.role
        if (session.name) token.name = session.name
        if (session.image) token.picture = session.image
      }

      // Refresh user role & banned status from DB every 1 minute to avoid stale credentials
      const now = Date.now()
      const lastChecked = token.lastChecked as number | undefined
      if (token.id && (!lastChecked || now - lastChecked > 60 * 1000)) {
        try {
          const { prisma } = await import('@/lib/prisma')
          const dbUser = await prisma.user.findUnique({
            where: { id: token.id as string },
            select: { role: true, isBanned: true }
          })
          if (dbUser) {
            token.role = dbUser.role
            token.isBanned = dbUser.isBanned
          }
          token.lastChecked = now
        } catch (e) {
          console.error('Failed to refresh token role from DB', e)
        }
      }

      return token
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = (token.id as string) || (token.sub as string)
        session.user.role = (token.role as any) || 'CUSTOMER'
        session.user.isBanned = token.isBanned as boolean
        session.user.sessionId = token.sessionId as string

        // ─── SUPABASE JOSE JWT BRIDGE ──────────────────────────────────────
        const signingSecret = process.env.SUPABASE_JWT_SECRET
        if (signingSecret) {
          const payload = {
            aud: 'authenticated',
            exp: Math.floor(new Date(session.expires).getTime() / 1000),
            sub: session.user.id,
            email: session.user.email,
            role: 'authenticated'
          }
          session.supabaseAccessToken = await new jwt.SignJWT(payload)
            .setProtectedHeader({ alg: 'HS256' })
            .sign(new TextEncoder().encode(signingSecret))
        } else {
          console.warn('[SECURITY] SUPABASE_JWT_SECRET is missing. Storage RLS will fail.')
        }
      }
      return session
    }
  },
  // SECURITY FIX: sebelumnya fallback ke string hardcoded jika NEXTAUTH_SECRET kosong —
  // lihat src/env.ts:getAuthSecret() untuk detail. Sekarang fail-closed (throw) alih-alih
  // diam-diam memakai secret publik yang bisa dipakai siapa pun memalsukan session JWT.
  secret: getAuthSecret(),
  debug: false,
  logger: {
    error(error) {
      console.error('[NEXTAUTH SECURITY ERROR]:', error)
    },
    warn(code) {
      console.warn('[NEXTAUTH WARN]:', code)
    },
    debug(_code) {}
  },
  providers: [
    GoogleProvider({
      clientId: process.env.AUTH_GOOGLE_ID || 'MOCK_CLIENT_ID',
      clientSecret: process.env.AUTH_GOOGLE_SECRET || 'MOCK_CLIENT_SECRET',
      // SECURITY FIX: sebelumnya `true`. Karena registrasi Credentials di aplikasi ini
      // TIDAK memverifikasi kepemilikan email (emailVerified tidak pernah di-set — lihat
      // src/features/auth/actions.ts), auto-linking akun Google ke akun password dengan
      // email yang sama membuka celah account-takeover: penyerang mendaftar duluan pakai
      // email korban + password miliknya, lalu korban login via Google ter-link ke akun
      // yang sudah dikuasai penyerang. `false` memaksa NextAuth menolak login dengan error
      // OAuthAccountNotLinked jika email sudah terdaftar via provider lain — aman by default.
      allowDangerousEmailAccountLinking: false
    })
  ]
} satisfies NextAuthConfig
