import type { MenuVariant, Review, Topping } from '@prisma/client'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import ProductDetailClient from '@/components/user/ProductDetailClient'
import { prisma } from '@/lib/prisma'
import { safeJsonLdScript } from '@/lib/sanitize'
import type { ProductType } from '@/src/features/menu/components/MenuCards'

// Disable static generation since search params or user context can change things,
// matching Next.js force-dynamic for this sub-page if desired, or let Next.js handle it dynamically.
export const dynamic = 'force-dynamic'

interface PageProps {
  params: Promise<{ id: string }>
}

interface ReviewWithUser extends Review {
  user: {
    name: string
  }
}

interface MenuVariantWithReviews extends MenuVariant {
  reviews: ReviewWithUser[]
}

async function getProductData(id: string): Promise<MenuVariantWithReviews | null> {
  try {
    const product = await prisma.menuVariant.findUnique({
      where: { id, isDeleted: false },
      include: {
        reviews: {
          orderBy: { createdAt: 'desc' },
          include: {
            user: { select: { name: true } }
          }
        }
      }
    })
    return product as MenuVariantWithReviews | null
  } catch (error) {
    console.error('[Safe Log] Failed to fetch product details', error)
    return null
  }
}

async function getOtherProducts(currentId: string): Promise<MenuVariant[]> {
  try {
    const otherProducts = await prisma.menuVariant.findMany({
      where: {
        isDeleted: false,
        isActive: true,
        NOT: { id: currentId }
      },
      take: 4,
      orderBy: { soldCount: 'desc' }
    })
    return otherProducts
  } catch (error) {
    console.error('[Safe Log] Failed to fetch recommendations', error)
    return []
  }
}

async function getActiveToppings(): Promise<Topping[]> {
  try {
    const toppings = await prisma.topping.findMany({
      where: { isActive: true },
      orderBy: { price: 'asc' }
    })
    return toppings
  } catch (error) {
    console.error('[Safe Log] Failed to fetch toppings', error)
    return []
  }
}

export async function generateMetadata(props: PageProps): Promise<Metadata> {
  const params = await props.params
  const product = await getProductData(params.id)

  if (!product) {
    return {
      title: 'Varian Tidak Ditemukan | Pisang Van Java',
      description: 'Mohon maaf, varian rasa pisang goreng yang Anda cari tidak ditemukan.'
    }
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://pisanggorengvanjava.com'
  const title = `${product.flavorName} - Pisang Goreng Premium | Pisang Van Java`
  const description =
    product.deskripsi_topping ||
    `Nikmati lezatnya pisang goreng varian ${product.flavorName} premium dengan aneka topping melimpah.`

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url: `${baseUrl}/menu-spesial/${params.id}`,
      siteName: 'Pisang Van Java',
      locale: 'id_ID',
      type: 'website',
      images: [
        {
          url: product.imageUrl || `${baseUrl}/kitchen.png`,
          width: 1200,
          height: 630,
          alt: `Pisang Goreng Van Java - ${product.flavorName}`
        }
      ]
    }
  }
}

export default async function ProductDetailPage(props: PageProps) {
  const params = await props.params
  const product = await getProductData(params.id)

  if (!product) {
    notFound()
  }

  // Load other variants and toppings
  const [otherProductsData, toppingsData] = await Promise.all([
    getOtherProducts(product.id),
    getActiveToppings()
  ])

  // Map to ProductType expected by client components
  const mappedProduct: ProductType = {
    id: product.id,
    flavorName: product.flavorName,
    priceKembung: product.priceKembung,
    priceLumpia: product.priceLumpia,
    priceKrispy: product.priceKrispy,
    wholesaleKembung: product.wholesaleKembung,
    wholesaleLumpia: product.wholesaleLumpia,
    wholesaleKrispy: product.wholesaleKrispy,
    imageUrl: product.imageUrl,
    isAvailable: product.isAvailable,
    tags: product.tags || [],
    deskripsi_topping: product.deskripsi_topping,
    stock: product.stock,
    soldCount: product.soldCount,
    isActive: product.isActive
  }

  const mappedOtherProducts: ProductType[] = otherProductsData.map((p: MenuVariant) => ({
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
    tags: p.tags || [],
    deskripsi_topping: p.deskripsi_topping,
    stock: p.stock,
    soldCount: p.soldCount,
    isActive: p.isActive
  }))

  const mappedReviews = product.reviews.map((r: ReviewWithUser) => ({
    id: r.id,
    rating: r.rating,
    comment: r.comment,
    imageUrl: r.imageUrl,
    createdAt: r.createdAt.toISOString(),
    isVerifiedBuyer: r.isVerifiedBuyer,
    user: {
      name: r.user.name
    }
  }))

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://pisanggorengvanjava.com'
  const activePrices = [product.priceKembung, product.priceLumpia, product.priceKrispy].filter(
    (p) => p > 0
  )
  const lowPrice = activePrices.length > 0 ? Math.min(...activePrices) : 0
  const highPrice = activePrices.length > 0 ? Math.max(...activePrices) : 0

  const averageRating =
    product.reviews.length > 0
      ? product.reviews.reduce((acc, r) => acc + r.rating, 0) / product.reviews.length
      : null

  // SEO Product JSON-LD schema
  const productJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.flavorName,
    image: product.imageUrl || `${baseUrl}/kitchen.png`,
    description: product.deskripsi_topping || `${product.flavorName} Premium`,
    offers: {
      '@type': 'AggregateOffer',
      priceCurrency: 'IDR',
      lowPrice: lowPrice,
      highPrice: highPrice,
      offerCount: activePrices.length,
      availability:
        product.isAvailable && product.stock > 0
          ? 'https://schema.org/InStock'
          : 'https://schema.org/OutOfStock'
    },
    ...(averageRating
      ? {
        aggregateRating: {
          '@type': 'AggregateRating',
          ratingValue: averageRating,
          reviewCount: product.reviews.length
        }
      }
      : {})
  }

  return (
    <main className="min-h-screen bg-zinc-50 dark:bg-zinc-950 pt-20">
      <script
        type="application/ld+json"
        // nosemgrep: typescript.react.security.audit.react-dangerouslysetinnerhtml.react-dangerouslysetinnerhtml
        // JSON-LD structured data for SEO (Product schema). Not raw HTML — content type
        // is application/ld+json, so the browser never executes it as markup or script.
        // safeJsonLdScript() escapes "<" to block "</script>" breakout from free-text
        // fields (flavorName, deskripsi_topping are admin-entered, not user-submitted).
        dangerouslySetInnerHTML={{ __html: safeJsonLdScript(productJsonLd) }}
      />
      <ProductDetailClient
        product={mappedProduct}
        otherProducts={mappedOtherProducts}
        toppings={toppingsData}
        reviews={mappedReviews}
      />
    </main>
  )
}