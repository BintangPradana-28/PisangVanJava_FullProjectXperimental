'use client'

import { useMutation } from '@tanstack/react-query'
import { Heart, ShoppingCart } from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'
import { useState } from 'react'
import toast from 'react-hot-toast'

interface FavoriteItem {
  favoriteId: string
  variantId: string
  flavorName: string
  imageUrl: string | null
  priceKembung: number
  priceLumpia: number
  priceKrispy: number
  isActive: boolean
  isAvailable: boolean
  tags: string[]
  createdAt: string
}

function formatPrice(price: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0
  }).format(price)
}

export default function FavoritesClient({
  initialFavorites
}: {
  initialFavorites: FavoriteItem[]
}) {
  const [favorites, setFavorites] = useState<FavoriteItem[]>(initialFavorites)

  const unfavoriteMutation = useMutation({
    mutationFn: async (variantId: string) => {
      const res = await fetch('/api/favorites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ variantId })
      })
      return res.json()
    },
    onSuccess: (_data, variantId) => {
      toast.success('Dihapus dari favorit')
      setFavorites((prev) => prev.filter((f) => f.variantId !== variantId))
    },
    onError: () => toast.error('Gagal menghapus favorit')
  })

  if (favorites.length === 0) {
    return (
      <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
        <div>
          <h1 className="text-2xl font-bold font-serif text-zinc-900 dark:text-zinc-100 flex items-center gap-3">
            <Heart className="w-7 h-7 text-[#D4802A] fill-[#D4802A]" />
            Favorit Saya
          </h1>
          <p className="text-zinc-500 dark:text-zinc-400 mt-1">
            Menu pisang goreng yang sudah kamu simpan.
          </p>
        </div>

        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-20 h-20 rounded-full bg-orange-50 dark:bg-orange-900/20 flex items-center justify-center mb-5">
            <Heart className="w-10 h-10 text-orange-300 dark:text-orange-500" />
          </div>
          <h3 className="text-lg font-bold text-zinc-800 dark:text-zinc-200 mb-2">
            Belum ada favorit
          </h3>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 max-w-xs mb-6">
            Tekan ikon hati ❤️ pada menu-menu favoritmu di halaman Menu Spesial untuk menyimpannya di
            sini.
          </p>
          <Link
            href="/menu-spesial"
            className="px-6 py-3 bg-[#D4802A] text-white font-bold rounded-[4px] hover:bg-[#b86f24] transition-all text-sm"
          >
            Jelajahi Menu
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold font-serif text-zinc-900 dark:text-zinc-100 flex items-center gap-3">
          <Heart className="w-7 h-7 text-[#D4802A] fill-[#D4802A]" />
          Favorit Saya
        </h1>
        <p className="text-zinc-500 dark:text-zinc-400 mt-1">
          {favorites.length} menu tersimpan sebagai favorit.
        </p>
      </div>

      {/* Favorites Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {favorites.map((item) => (
          <div
            key={item.variantId}
            className="bg-white dark:bg-zinc-900 border border-zinc-200/50 dark:border-zinc-800/80 rounded-[4px] shadow-sm hover:shadow-md transition-all overflow-hidden group"
          >
            {/* Image */}
            <div className="relative h-44 bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
              {item.imageUrl ? (
                <Image
                  src={item.imageUrl}
                  alt={item.flavorName}
                  fill
                  sizes="(max-width: 640px) 100vw, (max-width: 1280px) 50vw, 33vw"
                  className="object-cover group-hover:scale-105 transition-transform duration-300"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-5xl">🍌</div>
              )}
              {/* Badges */}
              {!item.isAvailable && (
                <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                  <span className="text-white font-bold text-sm bg-red-600 px-3 py-1 rounded-[4px]">
                    Habis
                  </span>
                </div>
              )}
              {/* Unfavorite Button */}
              <button
                type="button"
                onClick={() => unfavoriteMutation.mutate(item.variantId)}
                disabled={unfavoriteMutation.isPending}
                title="Hapus dari favorit"
                className="absolute top-2 right-2 w-8 h-8 rounded-full bg-white/90 dark:bg-zinc-900/90 flex items-center justify-center shadow-sm hover:bg-white dark:hover:bg-zinc-800 transition-all disabled:opacity-50"
              >
                <Heart className="w-4 h-4 text-red-500 fill-red-500" />
              </button>
            </div>

            {/* Info */}
            <div className="p-4">
              <h3 className="font-bold text-zinc-900 dark:text-zinc-100 mb-1 truncate">
                {item.flavorName}
              </h3>

              {/* Tags */}
              {item.tags.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-2">
                  {item.tags.slice(0, 3).map((tag) => (
                    <span
                      key={tag}
                      className="text-[10px] px-1.5 py-0.5 rounded-full bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-400 font-medium"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}

              {/* Price */}
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-3">
                Mulai dari{' '}
                <span className="text-[#D4802A] font-bold">
                  {formatPrice(Math.min(item.priceKembung, item.priceLumpia, item.priceKrispy))}
                </span>
              </p>

              {/* Action */}
              <Link
                href="/menu-spesial"
                className="flex items-center justify-center gap-2 w-full py-2.5 bg-[#D4802A] hover:bg-[#b86f24] text-white text-xs font-bold rounded-[4px] transition-all"
              >
                <ShoppingCart className="w-3.5 h-3.5" />
                Pesan Sekarang
              </Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
