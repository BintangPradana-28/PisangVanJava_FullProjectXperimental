import { unstable_cache } from 'next/cache'
import { cookies } from 'next/headers'
import Link from 'next/link'
import Footer from '@/components/user/Footer'
import MenuGrid from '@/components/user/MenuGrid'
import SearchFilterBar from '@/components/user/SearchFilterBar'
import { prisma } from '@/lib/prisma'
import HeroBanner from './HeroBanner' // We'll extract the hero part to a small component or just inline it

// Removing force-dynamic to allow Next.js optimizations
export const dynamic = 'force-dynamic'

const getCachedProducts = unstable_cache(
  async () => {
    try {
      return await prisma.menuVariant.findMany({
        where: { isDeleted: false },
        orderBy: { flavorName: 'asc' },
        include: {
          reviews: { select: { rating: true } }
        }
      })
    } catch (e) {
      console.warn(
        '[Safe Log] DB fetch failed for menu-spesial',
        e instanceof Error ? e.message : String(e)
      )
      return []
    }
  },
  ['menu-spesial-all-products'],
  { revalidate: 3600, tags: ['menu'] }
)

export default async function MenuSpesialPage(props: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const searchParams = await props.searchParams
  const q = typeof searchParams.q === 'string' ? searchParams.q : ''
  const filter = typeof searchParams.filter === 'string' ? searchParams.filter : 'all'
  const flavor = typeof searchParams.flavor === 'string' ? searchParams.flavor : 'all'

  // Module 4: Edge Middleware Personalization Context
  const cookieStore = await cookies()
  const menuContextCookie = cookieStore.get('x-menu-context')?.value
  let promoContext = {
    earlyMorning: false,
    lunch: false,
    lateAfternoon: false,
    evening: false,
    isLateNight: false
  }

  if (menuContextCookie) {
    try {
      promoContext = JSON.parse(menuContextCookie)
    } catch (e) {}
  }

  // Fetch all active products with review aggregates (Cached)
  const dbProducts = await getCachedProducts()

  // Compute rating & reviewCount per variant
  const products = dbProducts.map((p: any) => ({
    id: p.id,
    flavorName: p.flavorName,
    priceKembung: p.priceKembung,
    priceLumpia: p.priceLumpia,
    priceKrispy: p.priceKrispy,
    wholesaleKembung: p.wholesaleKembung,
    wholesaleLumpia: p.wholesaleLumpia,
    wholesaleKrispy: p.wholesaleKrispy,
    imageUrl: p.imageUrl,
    isAvailable: p.isAvailable,
    stock: p.stock,
    tags: p.tags || [],
    rating:
      p.reviews.length > 0
        ? Math.round(
            (p.reviews.reduce((s: any, r: any) => s + r.rating, 0) / p.reviews.length) * 10
          ) / 10
        : undefined,
    reviewCount: p.reviews.length > 0 ? p.reviews.length : undefined,
    isActive: p.isActive
  }))

  // Two-pass filter: base-type tab → flavor-family chip → search query
  const filtered = products.filter((p: any) => {
    const name = p.flavorName.toLowerCase()
    const matchSearch = q === '' || name.includes(q.toLowerCase())

    // Check if the base type has a price > 0
    const fLower = filter.toLowerCase()
    const matchBase =
      filter === 'all' ||
      (fLower === 'kembung' && p.priceKembung > 0) ||
      (fLower === 'lumpia' && p.priceLumpia > 0) ||
      (fLower === 'krispy' && p.priceKrispy > 0)

    const matchFlavor = flavor === 'all' || name.includes(flavor.toLowerCase())

    return matchSearch && matchBase && matchFlavor
  })

  // Module 4: Reorder based on Edge Time-of-Day Context (Cookie)
  if (promoContext.evening || promoContext.lateAfternoon) {
    filtered.sort((a: any, b: any) => {
      const aHasKembung = a.priceKembung > 0 ? 1 : 0
      const bHasKembung = b.priceKembung > 0 ? 1 : 0
      return bHasKembung - aHasKembung
    })
  } else if (promoContext.earlyMorning) {
    filtered.sort((a: any, b: any) => {
      const aHasKrispy = a.priceKrispy > 0 ? 1 : 0
      const bHasKrispy = b.priceKrispy > 0 ? 1 : 0
      return bHasKrispy - aHasKrispy
    })
  } else if (promoContext.isLateNight) {
    filtered.sort((a: any, b: any) => {
      const isMilky = (name: string) =>
        name.toLowerCase().includes('susu') ||
        name.toLowerCase().includes('milky') ||
        name.toLowerCase().includes('coklat')
          ? 1
          : 0
      return isMilky(b.flavorName) - isMilky(a.flavorName)
    })
  } else if (promoContext.lunch) {
    filtered.sort((a: any, b: any) => {
      const aHasLumpia = a.priceLumpia > 0 ? 1 : 0
      const bHasLumpia = b.priceLumpia > 0 ? 1 : 0
      return bHasLumpia - aHasLumpia
    })
  }

  const menuJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Menu',
    'name': 'Menu Spesial Pisang Goreng Van Java',
    'description': 'Pilihan varian rasa premium pisang kembung, lumpia, dan krispy',
    'numberOfItems': filtered.length,
    'hasMenuItem': filtered.map((p: any) => ({
      '@type': 'MenuItem',
      'name': p.flavorName,
      'description': p.deskripsi_topping || `${p.flavorName} premium`,
      'offers': {
        '@type': 'Offer',
        'priceCurrency': 'IDR',
        'price': p.priceKembung || p.priceLumpia || p.priceKrispy,
        'availability': p.isAvailable && p.stock > 0 ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock'
      }
    }))
  }

  return (
    <div
      className="min-h-screen"
      style={{ background: 'var(--background-custom)', color: 'var(--text-custom)' }}
    >
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(menuJsonLd) }}
      />
      {/* ── Hero ── */}
      <HeroBanner />

      {/* ── Search & Filter bar (Client Component with Debouncing) ── */}
      <SearchFilterBar totalItems={filtered.length} />

      {/* ── Grid & Favorites (Client Component for Animations) ── */}
      <MenuGrid products={filtered} />

      {/* ── Info Banner ── */}
      <section
        className="py-16 text-white"
        style={{ background: 'linear-gradient(135deg, #3D1C02 0%, #5a2e0a 100%)' }}
      >
        <div className="max-w-[1200px] mx-auto px-6 text-center">
          <div className="text-4xl mb-4">📍</div>
          <h2 className="font-serif text-2xl sm:text-3xl font-bold mb-3">
            Tersedia Juga di Outlet Kami
          </h2>
          <p className="text-white/70 mb-6">
            Kunjungi gerai Pisang Goreng Van Java terdekat untuk mencicipi langsung saat masih
            panas.
          </p>
          <Link
            href="/lokasi-kontak"
            className="inline-block px-8 py-3.5 rounded-[4px] font-bold text-sm transition-all active:scale-95"
            style={{ background: '#D4802A', color: 'white' }}
          >
            Lihat Lokasi Outlet
          </Link>
        </div>
      </section>

      <Footer />
    </div>
  )
}
