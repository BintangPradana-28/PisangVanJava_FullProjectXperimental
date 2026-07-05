// src/env.ts
// RAG Source: src/env.ts (existing structure preserved, VAPID keys added)
// Pattern: @t3-oss/env-nextjs + Zod — matches all existing env definitions
import { createEnv } from '@t3-oss/env-nextjs'
import { z } from 'zod'

export const env = createEnv({
  server: {
    DATABASE_URL: z.string().optional(),
    DIRECT_URL: z.string().optional(),
    AUTH_SECRET: z.string().optional(),
    MIDTRANS_SERVER_KEY: z.string().optional(),
    UPSTASH_REDIS_REST_URL: z.string().optional(),
    UPSTASH_REDIS_REST_TOKEN: z.string().optional(),
    RESEND_API_KEY: z.string().optional(),
    FONNTE_API_TOKEN: z.string().min(1).optional(),
    DOPPLER_TOKEN: z.string().optional(),
    SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),
    BACKUP_ENCRYPTION_KEY: z.string().min(1).optional(),
    QSTASH_TOKEN: z.string().optional(),
    QSTASH_CURRENT_SIGNING_KEY: z.string().optional(),
    QSTASH_NEXT_SIGNING_KEY: z.string().optional(),

    // ✅ Tambahan yang tertinggal
    CLOUDINARY_API_SECRET: z.string().min(1).optional(),
    CLOUDINARY_API_KEY: z.string().min(1).optional(),
    CLOUDINARY_CLOUD_NAME: z.string().min(1).optional(),
    BITESHIP_API_KEY: z.string().optional(),

    // ✅ Web Push VAPID (server-side only)
    // RAG Source: lib/push.ts — VAPID keys consumed server-side by web-push library
    // Generate with: npx web-push generate-vapid-keys
    VAPID_PUBLIC_KEY: z.string().optional(),
    VAPID_PRIVATE_KEY: z.string().optional(),
    VAPID_EMAIL: z.string().optional()
  },
  client: {
    NEXT_PUBLIC_SUPABASE_URL: z.string().optional(),
    NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().optional(),
    NEXT_PUBLIC_MIDTRANS_CLIENT_KEY: z.string().optional(),
    NEXT_PUBLIC_MIDTRANS_IS_PRODUCTION: z.string().optional().default('false'),

    // ✅ Tambahan yang tertinggal
    NEXT_PUBLIC_POSTHOG_KEY: z.string().optional(),
    NEXT_PUBLIC_POSTHOG_HOST: z.string().optional().default('https://app.posthog.com'),

    // ✅ Web Push VAPID public key (safe to expose to browser)
    // RAG Source: components/push/PushNotificationManager.tsx (applicationServerKey)
    // This is the SAME key as VAPID_PUBLIC_KEY — public keys are safe in client bundles.
    NEXT_PUBLIC_VAPID_PUBLIC_KEY: z.string().optional(),
    NEXT_PUBLIC_APP_URL: z.string().optional()
  },
  runtimeEnv: {
    DATABASE_URL: process.env.DATABASE_URL,
    DIRECT_URL: process.env.DIRECT_URL,
    AUTH_SECRET: process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET,
    MIDTRANS_SERVER_KEY: process.env.MIDTRANS_SERVER_KEY,
    UPSTASH_REDIS_REST_URL: process.env.UPSTASH_REDIS_REST_URL,
    UPSTASH_REDIS_REST_TOKEN: process.env.UPSTASH_REDIS_REST_TOKEN,
    RESEND_API_KEY: process.env.RESEND_API_KEY,
    FONNTE_API_TOKEN: process.env.FONNTE_API_TOKEN,
    DOPPLER_TOKEN: process.env.DOPPLER_TOKEN,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    BACKUP_ENCRYPTION_KEY: process.env.BACKUP_ENCRYPTION_KEY,
    QSTASH_TOKEN: process.env.QSTASH_TOKEN,
    QSTASH_CURRENT_SIGNING_KEY: process.env.QSTASH_CURRENT_SIGNING_KEY,
    QSTASH_NEXT_SIGNING_KEY: process.env.QSTASH_NEXT_SIGNING_KEY,
    CLOUDINARY_API_SECRET: process.env.CLOUDINARY_API_SECRET,
    CLOUDINARY_API_KEY: process.env.CLOUDINARY_API_KEY,
    CLOUDINARY_CLOUD_NAME: process.env.CLOUDINARY_CLOUD_NAME,
    BITESHIP_API_KEY: process.env.BITESHIP_API_KEY,

    // Web Push VAPID
    VAPID_PUBLIC_KEY: process.env.VAPID_PUBLIC_KEY,
    VAPID_PRIVATE_KEY: process.env.VAPID_PRIVATE_KEY,
    VAPID_EMAIL: process.env.VAPID_EMAIL,

    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_MIDTRANS_CLIENT_KEY: process.env.NEXT_PUBLIC_MIDTRANS_CLIENT_KEY,
    NEXT_PUBLIC_MIDTRANS_IS_PRODUCTION: process.env.NEXT_PUBLIC_MIDTRANS_IS_PRODUCTION,
    NEXT_PUBLIC_POSTHOG_KEY: process.env.NEXT_PUBLIC_POSTHOG_KEY,
    NEXT_PUBLIC_POSTHOG_HOST: process.env.NEXT_PUBLIC_POSTHOG_HOST,
    NEXT_PUBLIC_VAPID_PUBLIC_KEY: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL
  },
  skipValidation: !!process.env.SKIP_ENV_VALIDATION || process.env.npm_lifecycle_event === 'lint',
  emptyStringAsUndefined: true
})

/**
 * Zero-Trust secret resolver untuk AUTH_SECRET.
 *
 * SECURITY FIX: sebelumnya beberapa file (src/auth.config.ts,
 * src/features/pos/utils/verifyApprovalToken.ts, app/api/pos/auth-pin/route.ts)
 * masing-masing membaca `process.env.NEXTAUTH_SECRET` secara langsung dengan fallback
 * ke string hardcoded ('default_secret_key_change_me_in_production' /
 * 'fallback_secret_for_local_only'). Karena .env.example mendokumentasikan nama
 * AUTH_SECRET (bukan NEXTAUTH_SECRET), deployment yang mengikuti .env.example akan
 * selalu jatuh ke fallback publik tersebut — melemahkan signing session JWT DAN
 * token approval PIN Manager POS.
 *
 * Fungsi ini adalah SATU-SATUNYA sumber resolusi secret: menerima AUTH_SECRET atau
 * NEXTAUTH_SECRET (kompatibilitas mundur), dan fail-closed (throw) jika keduanya
 * kosong — bukan diam-diam memakai nilai default yang bisa ditebak siapa pun.
 */
export function getAuthSecret(): string {
  const secret = env.AUTH_SECRET
  if (!secret) {
    throw new Error(
      '[SECURITY] AUTH_SECRET (atau NEXTAUTH_SECRET) belum di-set di environment. ' +
        'Aplikasi tidak boleh berjalan tanpa secret ini karena dipakai untuk menandatangani ' +
        'session JWT dan token approval PIN Manager POS. Generate dengan: ' +
        'openssl rand -base64 32, lalu set sebagai AUTH_SECRET.'
    )
  }
  return secret
}
