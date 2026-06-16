/**
 * app/api/push/subscribe/route.ts
 *
 * POST /api/push/subscribe
 * Save a Web Push subscription for the authenticated user.
 *
 * Security Strategy : Full FT Zero-Trust — auth required, Zod validation, rate-limit
 * Style Alignment   : LoRA PVJ API pattern (mirrors app/api/user/profile/route.ts)
 * State Source      : RAG — lib/push.ts (savePushSubscription), lib/redis.ts (rateLimit),
 *                     src/auth.ts (auth()), prisma/schema.prisma (User.id ownership)
 *
 * BOLA prevention: subscription stored under session.user.id — users can only write
 * their own subscription; no userId accepted from client payload.
 */
import { type NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { savePushSubscription } from '@/lib/push'
import { rateLimit } from '@/lib/redis'
import { auth } from '@/src/auth'

export const dynamic = 'force-dynamic'

// ─── Zod schema (W3C PushSubscription.toJSON() shape) ────────────────────────
// RAG Source: W3C Push API spec + src/features/checkout/schemas.ts pattern
const pushSubscriptionSchema = z.object({
  endpoint: z
    .string()
    .url('Endpoint harus berupa URL yang valid')
    .max(500, 'Endpoint terlalu panjang'),
  expirationTime: z.number().nullable().optional().default(null),
  keys: z.object({
    p256dh: z
      .string()
      .min(10, 'p256dh key tidak valid')
      .max(200, 'p256dh key terlalu panjang'),
    auth: z
      .string()
      .min(10, 'auth key tidak valid')
      .max(100, 'auth key terlalu panjang'),
  }),
})

export async function POST(req: NextRequest) {
  // ── 1. AUTH GATE ─────────────────────────────────────────────────────────────
  // RAG Source: app/api/user/profile/route.ts auth pattern
  const session = await auth()
  const userId = session?.user?.id
  if (!session || !userId) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  // ── 2. RATE LIMIT ─────────────────────────────────────────────────────────────
  // Keyed by userId (same pattern as app/api/user/profile/route.ts)
  // Prevents a compromised account from flooding Redis with fake subscriptions
  // RAG Source: lib/redis.ts (rateLimit), app/api/user/profile/route.ts usage
  const { success: rateLimitOk } = await rateLimit.limit(`push_sub_${userId}`)
  if (!rateLimitOk) {
    return NextResponse.json(
      { success: false, error: 'Terlalu banyak permintaan. Coba lagi nanti.' },
      { status: 429 }
    )
  }

  // ── 3. PARSE BODY ─────────────────────────────────────────────────────────────
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json(
      { success: false, error: 'Request body tidak valid' },
      { status: 400 }
    )
  }

  // ── 4. ZOD VALIDATION ────────────────────────────────────────────────────────
  const parsed = pushSubscriptionSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      {
        success: false,
        error: 'Data subscription tidak valid',
        details: parsed.error.flatten(),
      },
      { status: 422 }
    )
  }

  // ── 5. PERSIST TO REDIS ───────────────────────────────────────────────────────
  // Ownership enforced: userId comes from server-side session, NOT client payload
  try {
    await savePushSubscription(userId, {
      endpoint: parsed.data.endpoint,
      expirationTime: parsed.data.expirationTime ?? null,
      keys: parsed.data.keys,
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[PUSH] Failed to save subscription:', error)
    return NextResponse.json(
      { success: false, error: 'Gagal menyimpan subscription. Coba lagi.' },
      { status: 500 }
    )
  }
}
