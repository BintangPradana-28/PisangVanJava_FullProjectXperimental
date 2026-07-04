const { withSentryConfig } = require('@sentry/nextjs')

const withBundleAnalyzer = require('@next/bundle-analyzer')({
  enabled: process.env.ANALYZE === 'true'
})

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // High-performance image formats & Edge caching
  images: {
    formats: ['image/avif', 'image/webp'],
    minimumCacheTTL: 31536000,
    remotePatterns: [
      { protocol: 'https', hostname: 'vamxyslzeimlsofhgmry.supabase.co' },
      { protocol: 'https', hostname: 'lh3.googleusercontent.com' } // Google OAuth avatars
    ]
  },

  // Eliminate console logs in production for performance
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production' ? { exclude: ['error', 'warn'] } : false
  },

  serverExternalPackages: ['@prisma/client', '@node-rs/argon2'],

  experimental: {
    optimizePackageImports: [
      'framer-motion',
      'lucide-react',
      'react-hot-toast',
      '@radix-ui/react-icons',
      'lodash'
    ]
  },

  // Military-grade HTTP Security Headers & Content Security Policy (CSP)
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'on'
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=31536000; includeSubDomains; preload'
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block'
          },
          {
            key: 'X-Frame-Options',
            value: 'SAMEORIGIN'
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff'
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin'
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(), browsing-topics=()'
          }
          // SECURITY FIX (audit QA & Security): Content-Security-Policy SEBELUMNYA didefinisikan
          // di sini DENGAN 'unsafe-inline' & 'unsafe-eval' TANPA syarat dev/prod — bertentangan
          // langsung dengan CSP nonce-based + strict-dynamic yang jauh lebih ketat di
          // middleware.ts (yang juga sudah mencakup domain Cloudflare Turnstile, Google Maps,
          // dan endpoint pelaporan /api/csp-report yang CSP di file ini tidak punya sama sekali).
          // Dua definisi CSP untuk header yang sama adalah bug konfigurasi — middleware.ts adalah
          // satu-satunya sumber kebenaran sekarang. Header keamanan LAIN di atas (HSTS,
          // X-Frame-Options, dst.) tetap di sini karena middleware.ts tidak menyetelnya.
        ]
      }
    ]
  }
}

module.exports = withBundleAnalyzer(nextConfig)
