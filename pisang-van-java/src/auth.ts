import { PrismaAdapter } from '@auth/prisma-adapter'
import * as Sentry from '@sentry/nextjs'
import { headers } from 'next/headers'
import NextAuth from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import { prisma } from '@/lib/prisma'
import { rateLimit, redis } from '@/lib/redis'
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

        // 3.5. ADDITION (QA & Security): persistent per-account lockout.
        // login_ip_${ip} rate limit di atas membatasi kecepatan per-IP, tapi tidak
        // menghentikan penyerang yang menyebar percobaan ke banyak IP/proxy untuk satu
        // akun yang sama. Ini menambah lapisan kedua: kunci AKUN (bukan IP) setelah
        // beberapa kali gagal berturut-turut, terlepas dari IP asalnya.
        const lockoutKey = `account_lockout:${user.id}`
        const failedAttemptsKey = `failed_login_count:${user.id}`
        try {
          const isLockedOut = await redis.get(lockoutKey)
          if (isLockedOut) {
            throw new Error(
              'Akun sementara dikunci karena terlalu banyak percobaan gagal. Coba lagi dalam 15 menit atau reset password.'
            )
          }
        } catch (error) {
          if (error instanceof Error && error.message.startsWith('Akun sementara dikunci')) {
            throw error
          }
          // Redis unreachable saat cek lockout — jangan blokir login sah hanya karena
          // Redis down; rate limiter IP di atas tetap berjalan sebagai lapisan pertama.
          Sentry.captureException(error)
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

          try {
            const attempts = await redis.incr(failedAttemptsKey)
            if (attempts === 1) {
              await redis.expire(failedAttemptsKey, 30 * 60) // window 30 menit
            }
            const MAX_FAILED_ATTEMPTS = 5
            if (attempts >= MAX_FAILED_ATTEMPTS) {
              await redis.setex(lockoutKey, 15 * 60, '1') // kunci 15 menit
              await redis.del(failedAttemptsKey)
              Sentry.captureMessage(
                `[SECURITY] Account locked out after ${attempts} failed attempts: ${user.email}`,
                'warning'
              )
            }
          } catch (redisError) {
            Sentry.captureException(redisError)
          }

          throw new Error('Email atau Sandi tidak valid.')
        }

        // Login password berhasil — reset counter percobaan gagal untuk akun ini.
        try {
          await redis.del(failedAttemptsKey)
        } catch {
          // non-fatal
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
          isBanned: user.isBanned,
          twoFactorEnabled: user.twoFactorEnabled
        }
      }
    })
  ]
})
