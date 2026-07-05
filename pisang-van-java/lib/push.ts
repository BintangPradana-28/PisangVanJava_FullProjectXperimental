/**
 * lib/push.ts
 *
 * Server-side Web Push utility using VAPID authentication.
 *
 * Security Strategy : Full FT Zero-Trust Model — server-only module, no client exposure
 * Style Alignment   : LoRA PVJ notification pattern (mirrors lib/notifications.ts structure)
 * State Source      : RAG — lib/redis.ts (@upstash/redis), prisma/schema.prisma (User.id as key)
 *
 * Storage decision: Upstash Redis (already in project) — avoids schema migration entirely.
 * Key pattern     : push:sub:{userId}  → JSON-serialised PushSubscriptionPayload
 * TTL             : 90 days (auto-evicts stale subs from inactive users)
 */
import 'server-only'

import webpush from 'web-push'

import { redis } from './redis'

// ─── VAPID Init ───────────────────────────────────────────────────────────────
// Sourced from process.env directly (same pattern as lib/redis.ts).
// These are validated at startup; missing keys produce a warning, not a crash.
// RAG Source: lib/redis.ts (pattern: optional env with console.warn fallback)
const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY ?? ''
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY ?? ''
const VAPID_EMAIL = process.env.VAPID_EMAIL ?? 'mailto:admin@pisangvanjava.com'

if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
  console.warn('⚠️  VAPID_PUBLIC_KEY or VAPID_PRIVATE_KEY is missing. Web Push will be disabled.')
} else {
  webpush.setVapidDetails(VAPID_EMAIL, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY)
}

// ─── Redis key helper ─────────────────────────────────────────────────────────
const pushKey = (userId: string): string => `push:sub:${userId}`
const SUB_TTL_SECONDS = 60 * 60 * 24 * 90 // 90 days

// ─── Types ────────────────────────────────────────────────────────────────────

/** W3C PushSubscription serialised shape (from subscription.toJSON()) */
export interface PushSubscriptionPayload {
  endpoint: string
  expirationTime: number | null
  keys: {
    p256dh: string
    auth: string
  }
}

/** Payload sent inside the push notification */
export interface PushNotificationPayload {
  title: string
  body: string
  url: string
  icon?: string
  badge?: string
}

// ─── Redis CRUD ───────────────────────────────────────────────────────────────

/**
 * Persist a push subscription for a user.
 * Latest device wins (MVP scope — one active sub per user).
 * Refreshes TTL on every call.
 */
export async function savePushSubscription(
  userId: string,
  subscription: PushSubscriptionPayload
): Promise<void> {
  await redis.set(pushKey(userId), JSON.stringify(subscription), {
    ex: SUB_TTL_SECONDS
  })
}

/** Remove a push subscription — called on explicit unsubscribe or 410 response. */
export async function deletePushSubscription(userId: string): Promise<void> {
  await redis.del(pushKey(userId))
}

/** Retrieve a subscription; returns null when absent or malformed. */
export async function getPushSubscription(userId: string): Promise<PushSubscriptionPayload | null> {
  const raw = await redis.get<string>(pushKey(userId))
  if (!raw) return null
  try {
    // Upstash returns the stored value; parse if it came back as string
    const parsed: unknown = typeof raw === 'string' ? JSON.parse(raw) : raw
    return parsed as PushSubscriptionPayload
  } catch {
    return null
  }
}

// ─── Send ─────────────────────────────────────────────────────────────────────

/**
 * Send a Web Push notification to a specific user.
 *
 * Fire-and-forget safe: never throws. Logs all errors.
 * Handles 410/404 (expired subscription) by auto-deleting from Redis.
 *
 * RAG Source: lib/notifications.ts pattern — non-blocking, silent failure
 */
export async function sendPushNotification(
  userId: string,
  payload: PushNotificationPayload
): Promise<void> {
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    console.warn('[PUSH] VAPID keys not configured — skipping push notification.')
    return
  }

  const subscription = await getPushSubscription(userId)
  if (!subscription) return // User has no active subscription

  try {
    await webpush.sendNotification(
      // web-push accepts PushSubscription shape directly
      subscription as Parameters<typeof webpush.sendNotification>[0],
      JSON.stringify(payload),
      {
        TTL: 60 * 60 * 24 // Deliver within 24 h or discard (suits order updates)
      }
    )
  } catch (err: unknown) {
    // Type-narrow the web-push error shape
    const statusCode =
      err !== null &&
      typeof err === 'object' &&
      'statusCode' in err &&
      typeof (err as Record<string, unknown>).statusCode === 'number'
        ? (err as { statusCode: number }).statusCode
        : null

    if (statusCode === 410 || statusCode === 404) {
      // Push endpoint expired/revoked — clean up stale subscription
      await deletePushSubscription(userId)
      console.info(`[PUSH] Stale subscription evicted for user ${userId.slice(-6).toUpperCase()}`)
    } else {
      console.error('[PUSH] Failed to send push notification:', err)
    }
  }
}

// ─── Message builder ──────────────────────────────────────────────────────────

/**
 * Build Bahasa Indonesia push payload for order status transitions.
 * Only actionable statuses generate a push (same guard as WhatsApp in lib/notifications.ts).
 *
 * RAG Source: lib/notifications.ts message pattern (PROCESSING / READY / CANCELED)
 * + COMPLETED added for push (not in WA flow) to prompt reviews.
 */
export function buildOrderStatusPushPayload(
  orderId: string,
  status: string
): PushNotificationPayload | null {
  const shortId = orderId.slice(-5).toUpperCase()

  const messages: Record<string, { title: string; body: string }> = {
    PROCESSING: {
      title: '🍌 Pesanan Sedang Diproses!',
      body: `Pesanan #${shortId} sedang dimasak di dapur kami. Mohon tunggu sebentar ya!`
    },
    READY: {
      title: '🎉 Pesanan Siap Diambil!',
      body: `Pesanan #${shortId} sudah siap! Segera ambil atau tunggu kurir kami.`
    },
    OUT_FOR_DELIVERY: {
      title: '🛵 Kurir Sedang Mengantar!',
      body: `Pesanan #${shortId} sedang dalam perjalanan ke alamat Anda.`
    },
    DELIVERED: {
      title: '📦 Pesanan Telah Sampai!',
      body: `Pesanan #${shortId} sudah diantar. Selamat menikmati!`
    },
    COMPLETED: {
      title: '✅ Pesanan Selesai',
      body: `Terima kasih! Pesanan #${shortId} selesai. Jangan lupa kasih ulasan ya! ⭐`
    },
    CANCELED: {
      title: '❌ Pesanan Dibatalkan',
      body: `Maaf, pesanan #${shortId} dibatalkan. Hubungi admin untuk info lebih lanjut.`
    }
  }

  const msg = messages[status]
  if (!msg) return null

  return {
    ...msg,
    url: '/profile/pesanan',
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png'
  }
}
