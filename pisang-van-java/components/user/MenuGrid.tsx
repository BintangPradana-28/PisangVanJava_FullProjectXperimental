'use client'

import { AnimatePresence, motion } from 'framer-motion'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { useEffect, useOptimistic, useState, useTransition } from 'react'
import toast from 'react-hot-toast'
import QuickViewModal from '@/components/user/QuickViewModal'
import { useLanguage } from '@/context/LanguageContext'
import { useSettings } from '@/context/SettingsContext'
import type { ProductType } from '@/src/features/menu/components/MenuCards'
import { animateFlyHeart } from '@/src/lib/animations'
import { isStoreOpen as checkStoreOpen } from '@/src/lib/time'
import { formatPrice, getFallbackImage, getFlavorDescriptionKey } from '@/lib/utils'



// Maps tags set by admin (AdminMenuDashboard.tsx → Tags picker) to a small icon
// for the customer-facing badge. Distinct from the ⭐ rating and 🔥 sold-count
// icons already on the card, so they don't visually collide. Falls back to 🏷️
// for any tag value not in this list (tags is a free string[] in the schema),
// so adding a new tag option later never breaks rendering.
const TAG_ICONS: Record<string, string> = {
  Baru: '✨',
  'Best Seller': '🏆',
  Premium: '👑',
  Rekomendasi: '💎',
  Manis: '🍯',
  Gurih: '🧂'
}

const ProductImage = ({
  src,
  alt,
  available,
  priority = false
}: {
  src: string
  alt: string
  available: boolean
  priority?: boolean
}) => {
  const [imgSrc, setImgSrc] = useState(src)
  const { t } = useLanguage()

  return (
    <div className="relative w-full aspect-[16/9] overflow-hidden bg-zinc-100 dark:bg-zinc-800">
      <Image
        src={imgSrc}
        alt={alt}
        fill
        sizes="(max-width: 640px) 360px, 360px"
        priority={priority}
        quality={70}
        className="object-cover group-hover:scale-105 transition-transform duration-500"
        onError={() => setImgSrc('/kitchen.png')}
        placeholder="blur"
        blurDataURL="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII="
      />
      {available ? (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 rounded-[4px] px-3 py-1 text-xs font-bold backdrop-blur-sm bg-white/90 dark:bg-zinc-900/90 text-zinc-800 dark:text-zinc-200 border border-zinc-200 dark:border-zinc-700 shadow-sm">
          {t('menu_fresh_badge') || 'Baru'}
        </div>
      ) : (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 rounded-[4px] px-3 py-1 text-xs font-bold backdrop-blur-sm bg-red-600 text-white shadow-md">
          {t('menu_sold_out_badge') || 'Habis Terjual'}
        </div>
      )}
    </div>
  )
}



export default function MenuGrid({ products }: { products: ProductType[] }) {
  const { t } = useLanguage()
  const router = useRouter()
  const _searchParams = useSearchParams()
  const { getSetting } = useSettings()
  const jamOperasional = getSetting('jam_operasional', '10.00–21.00')
  const storeMode = getSetting('store_status', 'AUTO')
  const { isOpen: isStoreOpen } = checkStoreOpen(jamOperasional, storeMode)
  const [selected, setSelected] = useState<ProductType | null>(null)

  const { data: session } = useSession()
  const [favorites, setFavorites] = useState<string[]>([])
  const [isPending, startTransition] = useTransition()

  // RAG Source: components/user/MenuGrid.tsx
  const [optimisticFavorites, setOptimisticFavorites] = useOptimistic(
    favorites,
    (state, variantId: string) => {
      const isFav = state.includes(variantId)
      return isFav ? state.filter((id) => id !== variantId) : [...state, variantId]
    }
  )

  useEffect(() => {
    if (session?.user) {
      fetch('/api/favorites')
        .then(async (res) => {
          if (!res.ok) return { success: false, data: [] }
          return res.json().catch(() => ({ success: false, data: [] }))
        })
        .then((data) => {
          if (data.success) setFavorites(data.data)
        })
        .catch((err) => console.error('Failed to fetch favorites', err))
    }
  }, [session])

  const toggleFavorite = (e: React.MouseEvent, variantId: string) => {
    e.stopPropagation()
    if (!session?.user) {
      toast.error('Silakan login untuk menyimpan favorit')
      return
    }

    const isFav = favorites.includes(variantId)
    if (!isFav) {
      animateFlyHeart(e.currentTarget as HTMLElement)
    }

    startTransition(async () => {
      setOptimisticFavorites(variantId)

      try {
        const res = await fetch('/api/favorites', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ variantId })
        })
        const data = await res.json()
        if (!data.success) throw new Error(data.error)
        setFavorites((prev) => (isFav ? prev.filter((id) => id !== variantId) : [...prev, variantId]))
        toast.success(isFav ? 'Dihapus dari favorit' : 'Ditambahkan ke favorit', {
          id: `fav-${variantId}`
        })
      } catch (_err) {
        toast.error('Gagal memperbarui favorit', { id: `fav-err-${variantId}` })
      }
    })
  }

  return (
    <section className="py-16">
      <div className="max-w-[1200px] mx-auto px-6">
        {products.length === 0 ? (
          <div className="text-center py-24">
            <div className="text-6xl mb-4">🍌</div>
            <p className="text-lg font-serif font-bold mb-2 text-zinc-900 dark:text-zinc-100">
              {t('menu_empty_title')}
            </p>
            <p className="text-sm text-zinc-900 dark:text-zinc-100">{t('menu_empty_desc')}</p>
            <button
              onClick={() => router.push('?', { scroll: false })}
              className="mt-6 text-xs font-bold px-6 py-3 rounded-[4px] shadow-sm hover:shadow-md transition-all active:scale-95 flex items-center gap-1.5 focus:outline-none bg-[#D4802A] text-white"
            >
              {t('menu_reset_btn')}
            </button>
          </div>
        ) : (
          <AnimatePresence mode="popLayout">
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-8 items-stretch">
              {products.map((product, i) => {
                const img = product.imageUrl || getFallbackImage(product.flavorName)
                const available = product.isAvailable && product.stock > 0
                const isFav = optimisticFavorites.includes(product.id)

                const defaultPrice =
                  product.priceKembung > 0
                    ? product.priceKembung
                    : product.priceLumpia > 0
                      ? product.priceLumpia
                      : product.priceKrispy

                const defaultWholesale =
                  product.priceKembung > 0
                    ? product.wholesaleKembung
                    : product.priceLumpia > 0
                      ? product.wholesaleLumpia
                      : product.wholesaleKrispy

                return (
                  <motion.div
                    key={product.id}
                    layout
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ duration: 0.4, delay: i * 0.04 }}
                    className={`relative rounded-[4px] overflow-hidden flex flex-col group transition-all duration-300 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 ${available ? 'hover:shadow-sm hover:-translate-y-1' : 'opacity-80 grayscale-[50%]'}`}
                  >
                    {/* Image — inset as a rounded "photo chip" rather than bleeding to the card edge */}
                    <div className="relative p-3 pb-0">
                      <button
                        onClick={(e) => toggleFavorite(e, product.id)}
                        className="absolute top-6 right-6 z-20 w-10 h-10 rounded-[4px] flex items-center justify-center transition-all bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md shadow-sm hover:scale-110 active:scale-95 border border-zinc-200/50 dark:border-zinc-800"
                        aria-label="Toggle Favorite"
                      >
                        <svg
                          className={`w-5 h-5 transition-colors ${isFav ? 'text-red-500 fill-current' : 'text-zinc-500'}`}
                          fill={isFav ? 'currentColor' : 'none'}
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={isFav ? 0 : 2}
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
                          />
                        </svg>
                      </button>

                      <div className="rounded-[4px] overflow-hidden">
                        <ProductImage
                          src={img}
                          alt={product.flavorName}
                          available={available}
                          priority={i < 3}
                        />
                      </div>
                    </div>

                    {/* Content */}
                    <div className="p-5 pt-4 flex flex-col items-start text-left flex-grow">
                      <h3
                        className={`font-serif text-xl font-bold mb-1 ${available ? 'text-zinc-900 dark:text-zinc-100' : 'text-zinc-500'}`}
                      >
                        {product.flavorName}
                      </h3>

                      {/* Tag Badges — set by admin, shown regardless of stock status */}
                      {product.tags && product.tags.length > 0 && (
                        <div className="flex items-center justify-start gap-1.5 flex-wrap mb-1.5">
                          {product.tags.slice(0, 3).map((tag) => (
                            <span
                              key={tag}
                              className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-[4px] bg-amber-500/15 border border-[#D4802A]/40 text-[#D4802A]"
                            >
                              <span aria-hidden="true">{TAG_ICONS[tag] ?? '🏷️'}</span>
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Stock Indicator */}
                      <div className="flex items-center gap-1.5 mb-2 mt-1">
                        {product.stock > 5 ? (
                          <>
                            <span className="w-2 h-2 rounded-[4px] bg-green-500"></span>
                            <span className="text-xs font-semibold text-green-600 dark:text-green-400 tracking-wide">
                              Tersedia: <span className="font-bold">{product.stock}</span> porsi
                            </span>
                          </>
                        ) : product.stock > 0 ? (
                          <>
                            <span className="w-2.5 h-2.5 rounded-[4px] bg-amber-500 animate-pulse"></span>
                            <span className="text-xs font-bold text-amber-600 dark:text-amber-400 tracking-wide animate-shake infinite [animation-duration:1.5s]">
                              ⚠️ Stok Terbatas:{' '}
                              <span className="font-extrabold">{product.stock}</span> porsi!
                            </span>
                          </>
                        ) : (
                          <>
                            <span className="w-2 h-2 rounded-[4px] bg-red-500"></span>
                            <span className="text-xs font-semibold text-red-600 dark:text-red-400 tracking-wide">
                              Habis Terjual
                            </span>
                          </>
                        )}
                      </div>

                      {/* Rating & Sales UI */}
                      <div className="flex items-center gap-3 mb-3">
                        <Link
                          href={`/ulasan?variantId=${product.id}`}
                          className="flex items-center gap-1.5 text-sm text-zinc-500 hover:text-[#D4802A] transition-colors cursor-pointer active:scale-95"
                        >
                          <span className="text-amber-400">⭐</span>
                          <span className="font-semibold text-zinc-700 dark:text-zinc-300">
                            {product.rating ? product.rating : 'Baru'}
                          </span>
                          {product.reviewCount ? (
                            <span className="text-xs">({product.reviewCount})</span>
                          ) : null}
                        </Link>

                        {product.soldCount !== undefined && product.soldCount > 0 && (
                          <div className="flex items-center gap-1 text-xs font-medium text-zinc-500 bg-zinc-100 dark:bg-zinc-800/50 px-2 py-0.5 rounded-[4px]">
                            {product.soldCount > 50 && <span className="text-orange-500">🔥</span>}
                            <span>
                              {product.soldCount >= 1000
                                ? `${(product.soldCount / 1000).toFixed(1)}k+`
                                : product.soldCount}{' '}
                              Terjual
                            </span>
                          </div>
                        )}
                      </div>

                      <p className="text-sm leading-relaxed mb-4 flex-grow text-zinc-800 dark:text-zinc-300">
                        {product.deskripsi_topping ||
                          (() => {
                            const key = getFlavorDescriptionKey(product.flavorName)
                            return key ? t(key) : t('menu_default_desc')
                          })()}
                      </p>
                      <div className="w-full border-t border-zinc-200 dark:border-zinc-800 pt-4 flex items-center justify-between gap-3 mt-auto">
                        <div className="text-left">
                          <div className="text-[10px] uppercase tracking-wider font-semibold mb-0.5 text-zinc-500 dark:text-zinc-400">
                            {session?.user.role === 'RESELLER'
                              ? 'Harga Grosir (Mulai)'
                              : t('menu_price_label')}
                          </div>
                          <div
                            className={`font-sans text-lg font-bold ${available ? 'text-[#D4802A]' : 'text-zinc-500'}`}
                          >
                            {session?.user.role === 'RESELLER' && defaultWholesale > 0 ? (
                              <div className="flex flex-col items-start leading-tight">
                                <span className="text-xs line-through text-zinc-400 font-normal">
                                  {formatPrice(defaultPrice)}
                                </span>
                                <span>{formatPrice(defaultWholesale)}</span>
                              </div>
                            ) : (
                              formatPrice(defaultPrice)
                            )}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => available && isStoreOpen && setSelected(product)}
                          disabled={!available || !isStoreOpen}
                          className={
                            available && isStoreOpen
                              ? 'shrink-0 bg-[#D4802A] text-white font-bold text-sm px-5 py-2.5 rounded-full shadow-md transition-all duration-200 active:scale-95 hover:shadow-sm'
                              : 'shrink-0 bg-zinc-300 text-zinc-500 cursor-not-allowed font-bold text-xs px-4 py-2.5 rounded-full flex items-center justify-center gap-1.5 opacity-70'
                          }
                        >
                          {!isStoreOpen ? 'Tutup' : available ? t('menu_btn_order') : 'Habis'}
                        </button>
                      </div>
                    </div>
                  </motion.div>
                )
              })}
            </div>
          </AnimatePresence>
        )}
      </div>

      <QuickViewModal
        product={selected}
        allProducts={products}
        onClose={() => setSelected(null)}
        isFavorite={selected ? favorites.includes(selected.id) : false}
        onToggleFavorite={toggleFavorite}
      />
    </section>
  )
}
