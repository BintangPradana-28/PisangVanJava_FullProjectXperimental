import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { auth } from '@/src/auth'
import FavoritesClient from './FavoritesClient'

export const metadata = {
  title: 'Favorit Saya | Pisang Goreng Van Java'
}

export default async function FavoritesPage() {
  const session = await auth()
  if (!session?.user?.id) {
    redirect('/login?callbackUrl=/profile/favorit')
  }

  const favorites = await prisma.favorite.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: 'desc' },
    include: {
      variant: {
        select: {
          id: true,
          flavorName: true,
          imageUrl: true,
          priceKembung: true,
          priceLumpia: true,
          priceKrispy: true,
          isActive: true,
          isAvailable: true,
          tags: true
        }
      }
    }
  })

  const serialized = favorites.map((fav: (typeof favorites)[0]) => ({
    favoriteId: fav.id,
    variantId: fav.variantId,
    flavorName: fav.variant.flavorName,
    imageUrl: fav.variant.imageUrl ?? null,
    priceKembung: fav.variant.priceKembung,
    priceLumpia: fav.variant.priceLumpia,
    priceKrispy: fav.variant.priceKrispy,
    isActive: fav.variant.isActive,
    isAvailable: fav.variant.isAvailable,
    tags: fav.variant.tags,
    createdAt: fav.createdAt.toISOString()
  }))

  return <FavoritesClient initialFavorites={serialized} />
}
