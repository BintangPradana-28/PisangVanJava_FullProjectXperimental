const { withSentryConfig } = require('@sentry/nextjs')

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
          },
          {
            key: 'Content-Security-Policy',
            value: "default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline' https://va.vercel-scripts.com https://app.midtrans.com https://app.sandbox.midtrans.com; style-src 'self' 'unsafe-inline'; img-src 'self' blob: data: https://vamxyslzeimlsofhgmry.supabase.co https://lh3.googleusercontent.com; font-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-src 'self' https://maps.google.com https://www.google.com https://app.midtrans.com https://app.sandbox.midtrans.com; connect-src 'self' https://va.vercel-scripts.com https://*.sentry.io https://*.ingest.sentry.io https://app.midtrans.com https://app.sandbox.midtrans.com; frame-ancestors 'none'; upgrade-insecure-requests;"
          }
        ]
      }
    ]
  }
}

module.exports = nextConfig
