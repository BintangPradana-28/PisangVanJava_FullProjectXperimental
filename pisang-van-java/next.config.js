const path = require('path')
const { withSentryConfig } = require('@sentry/nextjs')

const withBundleAnalyzer = require('@next/bundle-analyzer')({
  enabled: process.env.ANALYZE === 'true'
})

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // Required for the multi-stage Dockerfile, which copies .next/standalone
  // into the final image — that directory doesn't exist without this.
  output: 'standalone',

  // Next.js 16's file tracing does not reliably bundle Prisma's query engine
  // binary into the standalone output on its own (serverExternalPackages
  // below marks it as external, but doesn't guarantee it gets *copied* —
  // this is a currently open gap tracked across several Next.js/Prisma
  // GitHub discussions). Without this, the Docker image builds successfully
  // but crashes at runtime on the first DB query with
  // "PrismaClientInitializationError: Query Engine not found".
  outputFileTracingIncludes: {
    '/**/*': ['./node_modules/.prisma/client/**/*']
  },

  turbopack: {
    root: path.join(__dirname, '..')
  },

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

  serverExternalPackages: ['@prisma/client'],

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
