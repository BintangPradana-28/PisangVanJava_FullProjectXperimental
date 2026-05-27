// app/(user)/page.tsx
import { prisma } from "@/lib/prisma";
import Hero from "@/components/user/Hero";
import MenuCards, {
  ProductType,
} from "@/src/features/menu/components/MenuCards";
import nextDynamic from 'next/dynamic';
import { unstable_cache } from 'next/cache';

export const dynamic = 'force-dynamic'

const About = nextDynamic(() => import('@/components/user/About'), { ssr: true });
const Gallery = nextDynamic(() => import('@/components/user/Gallery'), { ssr: true });
const LocationMap = nextDynamic(() => import('@/src/features/settings/components/LocationMap'), { ssr: true });
const Footer = nextDynamic(() => import('@/components/user/Footer'), { ssr: true });

// Server Component — fetches data at request time using SWR Caching
const getCachedMenu = unstable_cache(
  async (): Promise<ProductType[]> => {
    try {
      // Zero Trust & Flawless DB: Mengambil produk yang belum dihapus (Soft Delete)
      const dbProducts = await prisma.menuVariant.findMany({
        where: { isDeleted: false, isActive: true },
        orderBy: { createdAt: "desc" },
      });

      // THE CISO FIX: Aggregation Queries Instead of Massive Joins
      const reviewAggregates = await prisma.review.groupBy({
        by: ['variantId'],
        _avg: { rating: true },
        _count: { rating: true },
      });
      const aggregateMap = new Map(reviewAggregates.map(r => [r.variantId, r]));

      const products: ProductType[] = dbProducts.map((p) => {
        const agg = aggregateMap.get(p.id);
        return {
          id: p.id,
          flavorName: p.flavorName,
          priceKembung: p.priceKembung,
          priceLumpia: p.priceLumpia,
          priceKrispy: p.priceKrispy,
          imageUrl: p.imageUrl,
          isAvailable: p.isAvailable,
          tags: p.tags || [],
          deskripsi_topping: p.deskripsi_topping,
          wholesaleKembung: p.wholesaleKembung,
          wholesaleLumpia: p.wholesaleLumpia,
          wholesaleKrispy: p.wholesaleKrispy,
          rating: agg && agg._avg.rating ? Math.round(agg._avg.rating * 10) / 10 : undefined,
          reviewCount: agg && agg._count.rating > 0 ? agg._count.rating : undefined,
        };
      });

      // Data cadangan sementara jika DB masih kosong (Mock data)
      if (products.length === 0) {
        return [
          {
            id: "1",
            flavorName: "Cokelat",
            priceKembung: 10000,
            priceLumpia: 12000,
            priceKrispy: 14000,
            imageUrl: "",
            isAvailable: true,
            tags: ["Manis", "Best Seller"],
            wholesaleKembung: 0,
            wholesaleLumpia: 0,
            wholesaleKrispy: 0,
          },
          {
            id: "2",
            flavorName: "Keju",
            priceKembung: 10000,
            priceLumpia: 12000,
            priceKrispy: 15000,
            imageUrl: null,
            isAvailable: true,
            tags: [],
            wholesaleKembung: 0,
            wholesaleLumpia: 0,
            wholesaleKrispy: 0,
          },
          {
            id: "3",
            flavorName: "Susu",
            priceKembung: 10000,
            priceLumpia: 12000,
            priceKrispy: 15000,
            imageUrl: null,
            isAvailable: true,
            tags: [],
            wholesaleKembung: 0,
            wholesaleLumpia: 0,
            wholesaleKrispy: 0,
          },
        ];
      }

      return products;
    } catch (error) {
      // Global Error Handling: Jika terjadi gagal koneksi, tampilkan mock data saja agar tidak crash (Graceful Degradation)
      console.error("[Safe Log] Database connection error during menu fetch");
      return [
        {
          id: "1",
          flavorName: "Cokelat (Mock)",
          priceKembung: 10000,
          priceLumpia: 12000,
          priceKrispy: 15000,
          imageUrl: null,
          isAvailable: true,
          tags: [],
          wholesaleKembung: 0,
          wholesaleLumpia: 0,
          wholesaleKrispy: 0,
        },
      ];
    }
  },
  ['home-menu-data'],
  { revalidate: 60, tags: ['menu'] }
);

// 🛡️ CISO FIX: Absolute Quarantine & DoS Protection
// Jangan biarkan kueri Prisma telanjang di halaman publik. Bungkus dengan cache dan try-catch.
const getCachedBanner = unstable_cache(
  async () => {
    try {
      return await prisma.banner.findFirst({
        where: { isActive: true },
        orderBy: { updatedAt: "desc" },
        select: {
          id: true,
          title: true,
          subtitle: true,
          badge: true,
          imageUrl: true,
          linkUrl: true,
        }
      });
    } catch (error) {
      console.error("[Safe Log] Database connection error during banner fetch");
      return null;
    }
  },
  ['home-active-banner'],
  { revalidate: 300, tags: ['banner'] }
);

const getCachedReviews = unstable_cache(
  async () => {
    try {
      return await prisma.review.aggregate({
        _avg: { rating: true },
        _count: { rating: true },
      });
    } catch (error) {
      console.error("[Safe Log] Database connection error during review aggregate fetch");
      return { _avg: { rating: null }, _count: { rating: 0 } };
    }
  },
  ['home-review-aggregates'],
  { revalidate: 3600, tags: ['reviews'] }
);

export default async function HomePage() {
  const products = await getCachedMenu();
  const homeProducts = products.slice(0, 3); // Hanya tampilkan 3 menu teratas

  // Fetch active banner (Now Cached & Fail-Safe)
  const activeBanner = await getCachedBanner();

  // Fetch aggregate review data for Hero Rating Indicator (Now Cached & Fail-Safe)
  const reviewAggregates = await getCachedReviews();

  const averageRating = reviewAggregates._avg.rating ? Number(reviewAggregates._avg.rating.toFixed(1)) : 0;
  const totalReviews = reviewAggregates._count.rating || 0;

  return (
    <>
      <Hero banner={activeBanner} averageRating={averageRating} totalReviews={totalReviews} />
      <About />
      <MenuCards products={homeProducts} />
      {/* Gallery bisa disembunyikan atau dipertahankan tergantung kebutuhan */}
      <LocationMap />
      <Footer />
    </>
  );
}
