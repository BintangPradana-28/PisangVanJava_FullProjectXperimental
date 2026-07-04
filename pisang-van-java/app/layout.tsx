// app/layout.tsx
import type { Metadata } from 'next'
import { Fraunces, Plus_Jakarta_Sans } from 'next/font/google'
import '../styles/globals.css'
import { Analytics } from '@vercel/analytics/next'
import { SpeedInsights } from '@vercel/speed-insights/next'
import { headers } from 'next/headers'
import { Providers } from './providers'

const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-sans',
  display: 'swap'
})

const fraunces = Fraunces({
  subsets: ['latin'],
  style: ['normal', 'italic'],
  weight: ['400', '600', '700'],
  variable: '--font-serif',
  display: 'swap',
  adjustFontFallback: false
})

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover'
}

export const metadata: Metadata = {
  title: {
    default: 'Pisang Goreng Van Java',
    template: '%s | Pisang Goreng Van Java'
  },
  description:
    'Pisang Goreng premium dengan resep autentik Jawa. 12+ varian rasa, 3 tipe — Kembung, Lumpia, Krispy. Pesan via WhatsApp!',
  keywords: ['pisang goreng', 'van java', 'jajanan', 'sleman', 'yogyakarta', 'street food'],
  openGraph: {
    title: 'Pisang Goreng Van Java',
    description: 'Premium banana fritters with authentic Javanese recipes.',
    type: 'website'
  }
}

const _localBusinessJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'FoodEstablishment',
  name: 'Pisang Goreng Van Java',
  image: '/kitchen.png',
  '@id': '',
  url: 'https://pisanggorengvanjava.com',
  telephone: '+6285773728748',
  address: {
    '@type': 'PostalAddress',
    streetAddress: 'Jl. Raya Cilangkap l Rt.2/Rw.5, Cilangkap',
    addressLocality: 'Jakarta Timur',
    addressRegion: 'DKI Jakarta',
    postalCode: '13870',
    addressCountry: 'ID'
  },
  geo: {
    '@type': 'GeoCoordinates',
    latitude: -7.7289873,
    longitude: 110.2958252
  },
  openingHoursSpecification: {
    '@type': 'OpeningHoursSpecification',
    dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
    opens: '10:00',
    closes: '21:00'
  },
  servesCuisine: 'Indonesian Fritters, Snacks',
  priceRange: '$'
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const headersList = await headers()
  const _nonce = headersList.get('x-nonce') || undefined

  return (
    <html
      lang="id"
      className={`${plusJakartaSans.variable} ${fraunces.variable}`}
      suppressHydrationWarning
    >
      <head>
        <link
          rel="preconnect"
          href="https://o4511473006084096.ingest.sentry.io"
          crossOrigin="anonymous"
        />
      </head>
      <body className="min-h-screen flex flex-col">
        <Providers>{children}</Providers>

        {/* [QUARANTINED] LocalBusiness JSON-LD removed due to XSS Gateway VETO (dangerouslySetInnerHTML prohibited) */}
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  )
}
