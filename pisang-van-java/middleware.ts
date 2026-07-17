import { type NextFetchEvent, type NextRequest, NextResponse } from 'next/server'
import NextAuth from 'next-auth'
import { authConfig } from '@/src/auth.config'

const { auth } = NextAuth(authConfig)

import { globalRateLimit, redis } from '@/lib/redis'

// ─── Native TypeScript RBAC Route Map ───────────────────────────────────────────

type AllowedRoles = ('SUPER_ADMIN' | 'ADMIN' | 'KITCHEN' | 'CASHIER' | 'CUSTOMER' | 'RESELLER')[]

const PROTECTED: Record<string, AllowedRoles> = {
  // STRICT ADMIN
  '/dashboard': ['SUPER_ADMIN', 'ADMIN'],
  '/manage-menu': ['SUPER_ADMIN', 'ADMIN'],
  '/manage-users': ['SUPER_ADMIN', 'ADMIN'],
  '/manage-vouchers': ['SUPER_ADMIN', 'ADMIN'],
  '/kontak-leads': ['SUPER_ADMIN', 'ADMIN'],
  '/banners': ['SUPER_ADMIN', 'ADMIN'],
  '/complaints': ['SUPER_ADMIN', 'ADMIN'],
  '/b2b-pipeline': ['SUPER_ADMIN', 'ADMIN'],
  '/settings': ['SUPER_ADMIN', 'ADMIN'],
  '/reports': ['SUPER_ADMIN', 'ADMIN'],
  '/toppings': ['SUPER_ADMIN', 'ADMIN'],
  '/api/admin': ['SUPER_ADMIN', 'ADMIN'],

  // STAFF
  '/orders': ['SUPER_ADMIN', 'ADMIN', 'KITCHEN', 'CASHIER'],
  '/kasir': ['SUPER_ADMIN', 'ADMIN', 'CASHIER'],
  '/kitchen': ['SUPER_ADMIN', 'ADMIN', 'KITCHEN'],

  // CUSTOMER BOUNDARY
  '/checkout': ['CUSTOMER', 'RESELLER', 'SUPER_ADMIN', 'ADMIN'],
  // KITCHEN & CASHIER ditambahkan agar staff punya jalur untuk mengatur akun mereka
  // sendiri (termasuk setup 2FA wajib — lihat blok enforcement di bawah).
  '/profile': ['CUSTOMER', 'RESELLER', 'SUPER_ADMIN', 'ADMIN', 'KITCHEN', 'CASHIER'],
  '/track-order': ['CUSTOMER', 'RESELLER', 'SUPER_ADMIN', 'ADMIN'],
  '/api/cart': ['CUSTOMER', 'RESELLER', 'SUPER_ADMIN', 'ADMIN']
}

const EDGE_CONTEXT_PATHS = ['/menu-spesial']

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getWIBHour(): number {
  return new Date(Date.now() + 7 * 60 * 60 * 1000).getUTCHours()
}

function deriveMenuContext(hour: number) {
  return {
    earlyMorning: hour >= 4 && hour < 7,
    lunch: hour >= 11 && hour < 14,
    lateAfternoon: hour >= 16 && hour < 18,
    evening: hour >= 18 && hour < 21,
    isLateNight: hour >= 21 || hour < 4
  }
}

function isEdgeContextPath(pathname: string): boolean {
  return EDGE_CONTEXT_PATHS.some((p) => pathname.startsWith(p))
}

/**
 * Resolves the required roles for a given pathname by checking the PROTECTED map.
 */
function getRequiredRoles(pathname: string): AllowedRoles | null {
  for (const [route, roles] of Object.entries(PROTECTED)) {
    if (pathname.startsWith(route)) {
      return roles
    }
  }
  return null
}

// ─── Main middleware (wrapped with Auth.js v5) ───────────────────────────────

const authMiddleware = auth(async (req) => {
  const { pathname } = req.nextUrl

  // ── 1. Global rate limiting (runs on all matched routes) ──────────────────
  try {
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? '127.0.0.1'
    const { success } = await globalRateLimit.limit(`global_${ip}`)

    if (!success) {
      return new NextResponse(JSON.stringify({ error: 'Too many requests. Coba lagi sebentar.' }), {
        status: 429,
        headers: { 'Content-Type': 'application/json' }
      })
    }
  } catch {
    console.error('[SECURITY] Rate limiter unavailable, failing open.')
  }

  // ── 2. Edge context injection for /menu-spesial ───────────────────────────
  if (isEdgeContextPath(pathname)) {
    const hour = getWIBHour()
    const context = deriveMenuContext(hour)
    const contextStr = JSON.stringify(context)
    const existingCookie = req.cookies.get('x-menu-context')?.value

    const res = NextResponse.next()

    if (existingCookie !== contextStr) {
      res.cookies.set('x-menu-context', contextStr, {
        httpOnly: false,
        maxAge: 1800,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production'
      })
    }
    return res
  }

  // ── 3. Route Protection & RBAC Resolution ───────────────────────────────────
  const requiredRoles = getRequiredRoles(pathname)
  const token = req.auth?.user

  // ── 3.5. Banned User Check ────────────────────────────────────────────────
  if (token && requiredRoles) {
    let isBanned = token.isBanned

    if (!isBanned) {
      try {
        const bannedInRedis = await redis.get(`banned:${token.id}`)
        if (bannedInRedis) isBanned = true
      } catch (err) {
        console.error('[SECURITY] Redis ban check failed', err)
      }
    }

    if (isBanned) {
      const response = NextResponse.redirect(new URL('/banned', req.url))
      response.cookies.delete('authjs.session-token')
      response.cookies.delete('__Secure-authjs.session-token')
      return response
    }

    // ── 3.6. Hybrid Session Check ────────────────────────────────────────────────
    if (token.sessionId) {
      try {
        const sessionKey = `session:${token.id}:${token.sessionId}`
        const isActiveSession = await redis.exists(sessionKey)

        if (!isActiveSession) {
          console.warn(`[SECURITY] Revoked session access attempt for User: ${token.id}`)
          const response = NextResponse.redirect(
            new URL('/member-login?error=session_revoked', req.url)
          )
          response.cookies.delete('authjs.session-token')
          response.cookies.delete('__Secure-authjs.session-token')
          return response
        }
      } catch (err) {
        console.error('[SECURITY] Redis session check failed. FAILING CLOSED.', err)
        // ZERO-TRUST MANDATE: FAIL CLOSED. If we can't verify the session, deny access.
        const response = NextResponse.redirect(new URL('/member-login?error=system_error', req.url))
        response.cookies.delete('authjs.session-token')
        response.cookies.delete('__Secure-authjs.session-token')
        return response
      }
    }
  }

  if (!requiredRoles) {
    // Route is fully public
    return NextResponse.next()
  }

  // ── 4. Unauthenticated Boundary ──────────────────────────────────────────────
  if (!token) {
    // Determine login portal based on route intent
    const _isStaffRoute = requiredRoles.includes('ADMIN') && !requiredRoles.includes('CUSTOMER')
    const loginUrl = new URL('/member-login', req.url)

    loginUrl.searchParams.set('callbackUrl', req.url)
    return NextResponse.redirect(loginUrl)
  }

  // ── 5. Native Role Validation (The Core Security Check) ────────────────────
  const userRole = token.role as AllowedRoles[number]
  if (!requiredRoles.includes(userRole)) {
    // Authorized but Forbidden
    console.warn(`[RBAC BLOCK] User ${token.id} (${userRole}) attempted to access ${pathname}`)
    return NextResponse.redirect(new URL('/', req.url)) // Send back to home or a 403 page
  }

  // ── 5.5. Mandatory 2FA for staff roles ──────────────────────────────────────
  // ADDITION (QA & Security): akun staff (SUPER_ADMIN/ADMIN/KITCHEN/CASHIER) punya
  // akses ke operasi sensitif (override harga POS, adjust koin, ubah menu, status
  // pesanan) — sebelumnya 2FA murni opt-in per-user tanpa syarat role sama sekali.
  // Login TETAP diizinkan (tidak di-hard-block di src/auth.ts) untuk menghindari staff
  // yang sedang aktif mendadak terkunci begitu deploy — sebagai gantinya, request
  // diarahkan paksa ke halaman setup 2FA (/profile/keamanan) untuk rute apa pun selain
  // halaman profil itu sendiri, sampai twoFactorEnabled bernilai true.
  const STAFF_ROLES_REQUIRING_2FA: AllowedRoles = ['SUPER_ADMIN', 'ADMIN', 'KITCHEN', 'CASHIER']
  if (
    STAFF_ROLES_REQUIRING_2FA.includes(userRole) &&
    !token.twoFactorEnabled &&
    !pathname.startsWith('/profile')
  ) {
    const setupUrl = new URL('/profile/keamanan', req.url)
    setupUrl.searchParams.set('require2fa', '1')
    return NextResponse.redirect(setupUrl)
  }

  return NextResponse.next()
})

export default async function middleware(req: NextRequest, event: NextFetchEvent) {
  const nonce = btoa(crypto.randomUUID())

  const isDev = process.env.NODE_ENV === 'development'
  const cspHeader = `
    default-src 'self';
    script-src 'self' ${isDev ? "'unsafe-eval'" : ''} 'nonce-${nonce}' 'strict-dynamic' https://maps.googleapis.com https://challenges.cloudflare.com;
    style-src 'self' 'unsafe-inline';
    img-src 'self' blob: data: https://res.cloudinary.com https://lh3.googleusercontent.com https://vamxyslzeimlsofhgmry.supabase.co https://maps.gstatic.com https://maps.googleapis.com;
    font-src 'self' data:;
    connect-src 'self' https://*.supabase.co https://*.upstash.io https://api.midtrans.com https://app.sandbox.midtrans.com https://app.posthog.com https://us.posthog.com https://eu.posthog.com https://www.google-analytics.com https://analytics.google.com https://region1.google-analytics.com https://api.biteship.com https://api.fonnte.com https://*.sentry.io https://o*.ingest.sentry.io https://maps.googleapis.com https://challenges.cloudflare.com;
    frame-src 'self' https://app.midtrans.com https://app.sandbox.midtrans.com https://challenges.cloudflare.com;
    object-src 'none';
    base-uri 'self';
    form-action 'self' https://app.midtrans.com https://app.sandbox.midtrans.com;
    report-uri /api/csp-report;
    report-to csp-endpoint;
  `
    .replace(/\s{2,}/g, ' ')
    .trim()

  req.headers.set('x-nonce', nonce)

  // Execute auth middleware
  const response =
    (await authMiddleware(req, event as any)) ||
    NextResponse.next({
      request: {
        headers: req.headers
      }
    })

  // Inject CSP into response
  response.headers.set('Content-Security-Policy', cspHeader)
  response.headers.set(
    'Report-To',
    JSON.stringify({
      group: 'csp-endpoint',
      max_age: 10886400,
      endpoints: [{ url: '/api/csp-report' }]
    })
  )

  return response
}

// ─── Route matcher ────────────────────────────────────────────────────────────

export const config = {
  // Explicit, even though Vercel currently defaults to Node.js here (no
  // bunVersion set in vercel.json): per Vercel's Bun runtime docs, Routing
  // Middleware needs this override once bunVersion is enabled project-wide,
  // or this Redis/NextAuth-heavy middleware can break silently. No-op today;
  // becomes load-bearing the moment bunVersion is turned on.
  runtime: 'nodejs',
  matcher: [
    '/dashboard/:path*',
    '/manage-menu/:path*',
    '/manage-users/:path*',
    '/manage-vouchers/:path*',
    '/kontak-leads/:path*',
    '/banners/:path*',
    '/complaints/:path*',
    '/b2b-pipeline/:path*',
    '/orders/:path*',
    '/reports/:path*',
    '/settings/:path*',
    '/toppings/:path*',
    '/api/admin/:path*',
    '/checkout/:path*',
    '/profile/:path*',
    '/track-order/:path*',
    '/api/cart/:path*',
    '/menu-spesial/:path*',
    '/kitchen/:path*',
    '/kasir/:path*'
  ]
}
