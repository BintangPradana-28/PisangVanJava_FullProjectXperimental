import { unstable_cache } from 'next/cache'
import { cookies } from 'next/headers'
import Link from 'next/link'
import Footer from '@/components/user/Footer'
import MenuGrid from '@/components/user/MenuGrid'
import SearchFilterBar from '@/components/user/SearchFilterBar'
import { prisma } from '@/lib/prisma'
import { safeJsonLdScript } from '@/lib/sanitize'
import HeroBanner from './HeroBanner'

// Removing force-dynamic to allow Next.js optimizations
export const dynamic = 'force-dynamic'

const getCachedProductsRaw = unstable_cache(
  async () => {
    return await prisma.menuVariant.findMany({
      where: { isDeleted: false },
      orderBy: { flavorName: 'asc' },
      include: {
        reviews: { select: { rating: true } }
      }
    })
  },
  ['menu-spesial-all-products'],
  { revalidate: 3600, tags: ['menu'] }
)

const getCachedProducts = async () => {
  try {
    return await getCachedProductsRaw()
  } catch (e) {
    console.warn(
      '[Safe Log] DB fetch failed for menu-spesial',
      e instanceof Error ? e.message : String(e)
    )
    return []
  }
}

type MappedProduct = {
  id: string
  flavorName: string
  priceKembung: number
  priceLumpia: number
  priceKrispy: number
  wholesaleKembung: number
  wholesaleLumpia: number
  wholesaleKrispy: number
  imageUrl: string | null
  isAvailable: boolean
  stock: number
  soldCount: number
  tags: string[]
  createdAt: Date
  rating: number | undefined
  reviewCount: number | undefined
  isActive: boolean
}

// "Harga Terendah" sort: a variant may not offer all 3 base types (e.g. priceKembung
// can legitimately be 0 for a Krispy-only flavor — see matchBase filter below), so
// sorting by priceKembung alone would wrongly rank those as "cheapest". This takes
// the lowest *non-zero* price across the 3 base types instead.
const getStartingPrice = (p: {
  priceKembung: number
  priceLumpia: number
  priceKrispy: number
}) => {
  const prices = [p.priceKembung, p.priceLumpia, p.priceKrispy].filter((price) => price > 0)
  return prices.length > 0 ? Math.min(...prices) : Infinity // no price set → sort to the end
}

export default async function MenuSpesialPage(props: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const searchParams = await props.searchParams
  const q = typeof searchParams.q === 'string' ? searchParams.q : ''
  const filter = typeof searchParams.filter === 'string' ? searchParams.filter : 'all'
  const flavor = typeof searchParams.flavor === 'string' ? searchParams.flavor : 'all'
  const sort = typeof searchParams.sort === 'string' ? searchParams.sort : 'default'
  const available =
    typeof searchParams.available === 'string' ? searchParams.available === 'true' : false

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
    } catch {}
  }

  // Fetch all active products with review aggregates (Cached)
  const dbProducts = (await getCachedProducts()) as any[]

  // Compute rating & reviewCount per variant
  const products: MappedProduct[] = dbProducts.map((p) => ({
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
    soldCount: p.soldCount,
    tags: p.tags || [],
    createdAt: p.createdAt,
    rating:
      p.reviews.length > 0
        ? Math.round(
            (p.reviews.reduce((s: number, r: { rating: number }) => s + r.rating, 0) /
              p.reviews.length) *
              10
          ) / 10
        : undefined,
    reviewCount: p.reviews.length > 0 ? p.reviews.length : undefined,
    isActive: p.isActive
  }))

  // Two-pass filter: base-type tab → flavor-family chip → search query
  const filtered = products.filter((p) => {
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

    const matchAvailable = !available || (p.isAvailable && p.stock > 0)

    return matchSearch && matchBase && matchFlavor && matchAvailable
  })

  // Explicit sort (user-selected) takes priority over the implicit time-of-day
  // personalization below — if someone picks "Harga Terendah", that's a direct
  // intent and shouldn't get silently re-ordered by the edge context. When sort
  // is left at "default", behavior is unchanged from before (falls through to
  // the original Module 4 reorder, including doing nothing if no context applies).
  if (sort === 'terlaris') {
    filtered.sort((a, b) => (b.soldCount || 0) - (a.soldCount || 0))
  } else if (sort === 'harga-rendah') {
    filtered.sort((a, b) => getStartingPrice(a) - getStartingPrice(b))
  } else if (sort === 'terbaru') {
    filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  } else if (promoContext.evening || promoContext.lateAfternoon) {
    filtered.sort((a, b) => {
      const aHasKembung = a.priceKembung > 0 ? 1 : 0
      const bHasKembung = b.priceKembung > 0 ? 1 : 0
      return bHasKembung - aHasKembung
    })
  } else if (promoContext.earlyMorning) {
    filtered.sort((a, b) => {
      const aHasKrispy = a.priceKrispy > 0 ? 1 : 0
      const bHasKrispy = b.priceKrispy > 0 ? 1 : 0
      return bHasKrispy - aHasKrispy
    })
  } else if (promoContext.isLateNight) {
    filtered.sort((a, b) => {
      const isMilky = (name: string) =>
        name.toLowerCase().includes('susu') ||
        name.toLowerCase().includes('milky') ||
        name.toLowerCase().includes('coklat')
          ? 1
          : 0
      return isMilky(b.flavorName) - isMilky(a.flavorName)
    })
  } else if (promoContext.lunch) {
    filtered.sort((a, b) => {
      const aHasLumpia = a.priceLumpia > 0 ? 1 : 0
      const bHasLumpia = b.priceLumpia > 0 ? 1 : 0
      return bHasLumpia - aHasLumpia
    })
  }

  const menuJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Menu',
    name: 'Menu Spesial Pisang Goreng Van Java',
    description: 'Pilihan varian rasa premium pisang kembung, lumpia, dan krispy',
    numberOfItems: filtered.length,
    hasMenuItem: filtered.map((p) => ({
      '@type': 'MenuItem',
      name: p.flavorName,
      description: `${p.flavorName} premium`,
      offers: {
        '@type': 'Offer',
        priceCurrency: 'IDR',
        price: p.priceKembung || p.priceLumpia || p.priceKrispy,
        availability:
          p.isAvailable && p.stock > 0
            ? 'https://schema.org/InStock'
            : 'https://schema.org/OutOfStock'
      }
    }))
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100">
      <script
        type="application/ld+json"
        // biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LD schema requires raw HTML injection
        dangerouslySetInnerHTML={{ __html: safeJsonLdScript(menuJsonLd) }}
      />
      {/* ── Hero ── */}
      <HeroBanner />

      {/* ── Search & Filter bar (Client Component with Debouncing) ── */}
      <SearchFilterBar totalItems={filtered.length} />

      {/* ── Grid & Favorites (Client Component for Animations) ── */}
      <MenuGrid products={filtered} />

      {/* ── Info Banner ── */}
      <section className="py-16 text-white bg-gradient-to-br from-[#3D1C02] to-[#5a2e0a]">
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
            className="inline-block px-8 py-3.5 rounded-[4px] font-bold text-sm bg-amber-brand text-white transition-all hover:bg-amber-brand/90 active:scale-95"
          >
            Lihat Lokasi Outlet
          </Link>
        </div>
      </section>

      <Footer />
    </div>
  )
}
