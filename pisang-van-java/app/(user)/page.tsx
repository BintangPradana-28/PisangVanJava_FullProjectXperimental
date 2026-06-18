// app/(user)/page.tsx

import type { Metadata } from 'next'
import { unstable_cache } from 'next/cache'
import nextDynamic from 'next/dynamic'
import Hero from '@/components/user/Hero'
import { prisma } from '@/lib/prisma'
import MenuCards, { type ProductType } from '@/src/features/menu/components/MenuCards'

const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://pisanggorengvanjava.com'

export const metadata: Metadata = {
  metadataBase: new URL(baseUrl),
  title: 'Pisang Van Java | Premium Crispy Banana',
  description:
    'Nikmati kelezatan Pisang Goreng Krispy premium dengan aneka topping lezat. Pesan online sekarang tanpa antre!',
  openGraph: {
    title: 'Pisang Van Java | Premium Crispy Banana',
    description: 'Pesan Pisang Goreng Krispy premium dengan aneka topping lezat.',
    url: baseUrl,
    siteName: 'Pisang Van Java',
    locale: 'id_ID',
    type: 'website'
  }
}

// REMOVED force-dynamic to allow ISR and static shell generation
const About = nextDynamic(() => import('@/components/user/About'))
const Gallery = nextDynamic(() => import('@/components/user/Gallery'))
const LocationMap = nextDynamic(() => import('@/src/features/settings/components/LocationMap'))
const Footer = nextDynamic(() => import('@/components/user/Footer'))

// Server Component — fetches data at request time using SWR Caching
// Server Component — fetches data at request time using SWR Caching
const getCachedMenuRaw = unstable_cache(
  async (): Promise<ProductType[]> => {
    // Zero Trust & Flawless DB: Mengambil produk yang belum dihapus (Soft Delete)
    const dbProducts = await prisma.menuVariant.findMany({
      where: { isDeleted: false, isActive: true },
      orderBy: { createdAt: 'desc' }
    })

    // THE CISO FIX: Aggregation Queries Instead of Massive Joins
    const reviewAggregates = await prisma.review.groupBy({
      by: ['variantId'],
      _avg: { rating: true },
      _count: { rating: true }
    })
    const aggregateMap = new Map(reviewAggregates.map((r: any) => [r.variantId, r]))

    const products: ProductType[] = dbProducts.map((p: any) => {
      const agg = aggregateMap.get(p.id) as any
      return {
        id: p.id,
        flavorName: p.flavorName,
        priceKembung: p.priceKembung,
        priceLumpia: p.priceLumpia,
        priceKrispy: p.priceKrispy,
        imageUrl: p.imageUrl,
        isAvailable: p.isAvailable,
        stock: p.stock,
        soldCount: p.soldCount,
        tags: p.tags || [],
        deskripsi_topping: p.deskripsi_topping,
        wholesaleKembung: p.wholesaleKembung,
        wholesaleLumpia: p.wholesaleLumpia,
        wholesaleKrispy: p.wholesaleKrispy,
        rating: agg?._avg.rating ? Math.round(agg._avg.rating * 10) / 10 : undefined,
        reviewCount: agg?._count.rating > 0 ? agg._count.rating : undefined,
        isActive: p.isActive
      }
    })

    // Data cadangan sementara jika DB masih kosong (Mock data)
    if (products.length === 0) {
      return [
        {
          id: '1',
          flavorName: 'Cokelat',
          priceKembung: 10000,
          priceLumpia: 12000,
          priceKrispy: 14000,
          imageUrl: '',
          isAvailable: true,
          stock: 999,
          tags: ['Manis', 'Best Seller'],
          wholesaleKembung: 0,
          wholesaleLumpia: 0,
          wholesaleKrispy: 0,
          isActive: true
        },
        {
          id: '2',
          flavorName: 'Keju',
          priceKembung: 10000,
          priceLumpia: 12000,
          priceKrispy: 15000,
          imageUrl: null,
          isAvailable: true,
          stock: 999,
          tags: [],
          wholesaleKembung: 0,
          wholesaleLumpia: 0,
          wholesaleKrispy: 0,
          isActive: true
        },
        {
          id: '3',
          flavorName: 'Susu',
          priceKembung: 10000,
          priceLumpia: 12000,
          priceKrispy: 15000,
          imageUrl: null,
          isAvailable: true,
          stock: 999,
          tags: [],
          wholesaleKembung: 0,
          wholesaleLumpia: 0,
          wholesaleKrispy: 0,
          isActive: true
        }
      ]
    }

    return products
  },
  ['home-menu-data'],
  { revalidate: 60, tags: ['menu'] }
)

const getCachedMenu = async (): Promise<ProductType[]> => {
  try {
    return await getCachedMenuRaw()
  } catch {
    console.warn('[Safe Log] Database connection error during menu fetch')
    return [
      {
        id: '1',
        flavorName: 'Cokelat (Mock)',
        priceKembung: 10000,
        priceLumpia: 12000,
        priceKrispy: 15000,
        imageUrl: null,
        isAvailable: true,
        stock: 999,
        tags: [],
        wholesaleKembung: 0,
        wholesaleLumpia: 0,
        wholesaleKrispy: 0,
        isActive: true
      }
    ]
  }
}

// 🛡️ CISO FIX: Absolute Quarantine & DoS Protection
// Jangan biarkan kueri Prisma telanjang di halaman publik. Bungkus dengan cache dan try-catch di wrapper.
const getCachedBannerRaw = unstable_cache(
  async () => {
    return await prisma.banner.findFirst({
      where: { isActive: true },
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        title: true,
        subtitle: true,
        badge: true,
        imageUrl: true,
        linkUrl: true
      }
    })
  },
  ['home-active-banner'],
  { revalidate: 300, tags: ['banner'] }
)

const getCachedBanner = async () => {
  try {
    return await getCachedBannerRaw()
  } catch {
    console.warn('[Safe Log] Database connection error during banner fetch')
    return null
  }
}

const getCachedReviewsRaw = unstable_cache(
  async () => {
    return await prisma.review.aggregate({
      _avg: { rating: true },
      _count: { rating: true }
    })
  },
  ['home-review-aggregates'],
  { revalidate: 3600, tags: ['reviews'] }
)

const getCachedReviews = async () => {
  try {
    return await getCachedReviewsRaw()
  } catch {
    console.warn('[Safe Log] Database connection error during review aggregate fetch')
    return { _avg: { rating: null }, _count: { rating: 0 } }
  }
}

export default async function HomePage() {
  const products = await getCachedMenu()
  const homeProducts = products.slice(0, 3) // Hanya tampilkan 3 menu teratas

  // Fetch active banner (Now Cached & Fail-Safe)
  const activeBanner = await getCachedBanner()

  // Fetch aggregate review data for Hero Rating Indicator (Now Cached & Fail-Safe)
  const reviewAggregates = await getCachedReviews()

  const averageRating = reviewAggregates._avg.rating
    ? Number(reviewAggregates._avg.rating.toFixed(1))
    : 0
  const totalReviews = reviewAggregates._count.rating || 0

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Restaurant',
    name: 'Pisang Goreng Van Java',
    image: activeBanner?.imageUrl || 'https://pisangvanjava.com/kitchen.png',
    '@id': 'https://pisangvanjava.com',
    url: 'https://pisangvanjava.com',
    telephone: '+628123456789',
    priceRange: '$$',
    address: {
      '@type': 'PostalAddress',
      streetAddress: 'Jl. Kaliurang No. 12',
      addressLocality: 'Sleman',
      addressRegion: 'Yogyakarta',
      postalCode: '55281',
      addressCountry: 'ID'
    },
    openingHoursSpecification: {
      '@type': 'OpeningHoursSpecification',
      dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
      opens: '10:00',
      closes: '21:00'
    },
    servesCuisine: 'Indonesian F&B',
    aggregateRating:
      totalReviews >= 5
        ? {
          '@type': 'AggregateRating',
          ratingValue: averageRating,
          reviewCount: totalReviews
        }
        : undefined
  }

  return (
    <main className="flex min-h-screen flex-col justify-start w-full">
      {/* H1 Tunggal Wajib untuk SEO & Aksesibilitas (Disembunyikan secara visual) */}
      <h1 className="sr-only">Pisang Van Java - Pisang Goreng Premium Jakarta</h1>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <Hero banner={activeBanner} averageRating={averageRating} totalReviews={totalReviews} />
      {/* PERF/CRO: MenuCards dipindah ke sini, langsung setelah Hero — menu yang
          bisa dipesan sebelumnya berada di urutan ke-4 (setelah About+Gallery),
          memaksa scroll panjang sebelum pengunjung lihat produk. MenuCards juga
          sudah di-import statis (bukan next/dynamic seperti About/Gallery di
          bawah), jadi urutan render ini konsisten dengan prioritas loading-nya. */}
      <MenuCards products={homeProducts} />
      <About />
      <Gallery
        products={products.slice(0, 6).map((p) => ({
          id: p.id,
          flavorName: p.flavorName,
          imageUrl: p.imageUrl
        }))}
      />
      <LocationMap />
      <Footer />
    </main>
  )
}