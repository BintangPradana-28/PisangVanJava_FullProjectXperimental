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
    VAPID_EMAIL: z.string().email().optional()
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
    NEXT_PUBLIC_VAPID_PUBLIC_KEY: z.string().optional()
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
    NEXT_PUBLIC_VAPID_PUBLIC_KEY: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  },
  skipValidation: !!process.env.SKIP_ENV_VALIDATION || process.env.npm_lifecycle_event === 'lint',
  emptyStringAsUndefined: true
})
