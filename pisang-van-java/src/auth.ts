import { PrismaAdapter } from '@auth/prisma-adapter'
import * as Sentry from '@sentry/nextjs'
import { headers } from 'next/headers'
import NextAuth from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import { prisma } from '@/lib/prisma'
import { rateLimit } from '@/lib/redis'
import { loginSchema } from '@/src/features/auth/schemas'
import { verifyPassword } from '@/src/lib/password'
import { authConfig } from './auth.config'

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  adapter: PrismaAdapter(prisma),
  providers: [
    ...authConfig.providers, // Import Edge-compatible providers (Google)

    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        username: { label: 'Email', type: 'email', placeholder: 'email@example.com' },
        password: { label: 'Password', type: 'password' },
        otp: { label: 'OTP', type: 'text' }
      },
      async authorize(credentials) {
        // 1. ZOD ENFORCER
        const parsedCredentials = loginSchema.safeParse(credentials)

        if (!parsedCredentials.success) {
          Sentry.captureMessage(
            `[SECURITY] Zod Login Validation Failed for: ${credentials?.username}`,
            'warning'
          )
          throw new Error('Kredensial tidak valid.')
        }

        const { username, password, otp } = parsedCredentials.data

        // 2. IP-BASED RATE LIMITING
        const headerStore = await headers()
        const ip = headerStore.get('x-forwarded-for')?.split(',')[0] || 'unknown-ip'
        console.log('Rate limiting IP:', ip)

        let rateLimitSuccess = true
        try {
          const res = await rateLimit.limit(`login_ip_${ip}`)
          rateLimitSuccess = res.success
        } catch (redisError) {
          Sentry.captureException(redisError)
        }

        if (!rateLimitSuccess) {
          throw new Error('Terlalu banyak percobaan. Silakan coba lagi nanti.')
        }
        console.log('Rate limit passed or bypassed.')

        const user = await prisma.user.findUnique({
          where: { email: username }
        })
        console.log('User found in DB:', !!user)

        // 3. OPAQUE ERRORS & BAN CHECK
        if (!user || user.isDeleted || !user.passwordHash) {
          console.log('User missing or no password hash.')
          throw new Error('Email atau Sandi tidak valid.')
        }

        if (user.isBanned) {
          Sentry.captureMessage(`[SECURITY] Banned user attempted login: ${user.email}`, 'warning')
          throw new Error('Akun Anda telah ditangguhkan. Hubungi admin.')
        }

        // 4. ARGON2ID VERIFICATION
        let isPasswordValid = false
        try {
          isPasswordValid = await verifyPassword(user.passwordHash, password)
        } catch (error) {
          Sentry.captureException(error)
          throw new Error('Email atau Sandi tidak valid.')
        }

        if (!isPasswordValid) {
          await prisma.authLog.create({
            data: {
              userId: user.id,
              event: 'FAILED_SIGN_IN',
              ip: ip,
              userAgent: headerStore.get('user-agent') || 'unknown'
            }
          })
          throw new Error('Email atau Sandi tidak valid.')
        }

        if (user.twoFactorEnabled) {
          if (!otp) {
            throw new Error('2FA_REQUIRED')
          }
          const { authenticator } = await import('otplib')
          const isValidOTP = authenticator.check(otp, user.twoFactorSecret!)
          if (!isValidOTP) {
            await prisma.authLog.create({
              data: {
                userId: user.id,
                event: 'FAILED_2FA',
                ip: ip,
                userAgent: headerStore.get('user-agent') || 'unknown'
              }
            })
            throw new Error('INVALID_OTP')
          }
        }

        await prisma.authLog.create({
          data: {
            userId: user.id,
            event: 'SIGN_IN',
            ip: ip,
            userAgent: headerStore.get('user-agent') || 'unknown'
          }
        })

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          isBanned: user.isBanned
        }
      }
    })
  ]
})
