'use client'

import { motion } from 'framer-motion'
import nextDynamic from 'next/dynamic'
import Image from 'next/image'
import Link from 'next/link'
import { useState } from 'react'

const QuickViewModal = nextDynamic(() => import('@/components/user/QuickViewModal'), { ssr: false })

import { useSession } from 'next-auth/react'
import { useLanguage } from '@/context/LanguageContext'
import { formatPrice, getFallbackImage, getFlavorDescriptionKey } from '@/lib/utils'

// ARCHITECTURE FIX: ProductType moved to ../types.ts (see that file's comment
// for why) — re-exported here so every other existing consumer's
// `import type { ProductType } from '@/src/features/menu/components/MenuCards'`
// keeps working unchanged.
import type { ProductType } from '../types'

export type { ProductType } from '../types'

interface Props {
  products: ProductType[]
}

const ProductImage = ({
  src,
  alt,
  available
}: {
  src: string
  alt: string
  available: boolean
}) => {
  const [imgSrc, setImgSrc] = useState(src)

  return (
    <div className="relative w-full aspect-[4/3] bg-zinc-100 dark:bg-zinc-950 overflow-hidden">
      <Image
        src={imgSrc}
        alt={alt}
        fill
        sizes="(max-width: 640px) 360px, 360px"
        quality={70}
        loading="lazy"
        className="object-cover group-hover:scale-105 transition-transform duration-500 ease-out"
        onError={() => setImgSrc('/kitchen.png')}
        placeholder="blur"
        blurDataURL="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII="
      />
      {available ? (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-white/90 dark:bg-zinc-900/90 backdrop-blur-sm border border-outline-variant/35 dark:border-zinc-800 rounded-[6px] px-2.5 py-0.5 text-[10px] font-mono font-semibold tracking-wider uppercase text-primary dark:text-zinc-350 shadow-sm">
          Freshly Fried
        </div>
      ) : (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-red-600/90 backdrop-blur-sm border border-red-700/80 rounded-[6px] px-2.5 py-0.5 text-[10px] font-mono font-semibold tracking-wider uppercase text-white shadow-sm">
          Sold Out
        </div>
      )}
    </div>
  )
}

const getSalesMagnetTag = (flavorName: string): string => {
  const lower = flavorName.toLowerCase()
  if (lower.includes('original') || lower.includes('cokelat') || lower.includes('coklat')) {
    return '🔥 Terlaris'
  }
  // The user requested 'Rekomendasi Chef' to be changed to 'Baru' like the other cards
  return '⭐ Baru'
}

export default function MenuCards({ products }: Props) {
  const { t } = useLanguage()
  const { data: session } = useSession()
  const isReseller = (session?.user as { role?: string })?.role === 'RESELLER'
  const [selectedProduct, setSelectedProduct] = useState<ProductType | null>(null)
  const [activeTag, setActiveTag] = useState<string>('ALL')

  const baseTags = ['Kembung', 'Lumpia', 'Krispy']
  const dbTags = Array.from(new Set(products.flatMap((p) => p.tags || [])))
  const allTags = ['ALL', ...baseTags, ...dbTags].filter(Boolean)

  const filteredProducts =
    activeTag === 'ALL'
      ? products
      : baseTags.includes(activeTag)
        ? products.filter((p) => {
            if (activeTag === 'Kembung') return p.priceKembung > 0 || p.wholesaleKembung > 0
            if (activeTag === 'Lumpia') return p.priceLumpia > 0 || p.wholesaleLumpia > 0
            if (activeTag === 'Krispy') return p.priceKrispy > 0 || p.wholesaleKrispy > 0
            return true
          })
        : products.filter((p) => p.tags?.includes(activeTag))

  return (
    <section
      id="menu"
      className="py-24 bg-surface-container-low border-b border-outline-variant/20 dark:bg-zinc-900/40"
    >
      <div className="max-w-[1200px] mx-auto px-6">
        {/* Section Title */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center mb-16"
        >
          <div className="text-secondary text-[11px] font-semibold tracking-wider font-mono uppercase mb-3">
            {t('menu_badge')}
          </div>
          <h2 className="font-sans text-3xl sm:text-4xl font-extrabold text-primary dark:text-zinc-100 tracking-[-0.03em] sm:tracking-[-0.04em]">
            {t('menu_title').split('Van Java')[0]}
            <span className="text-secondary font-medium">Van Java</span>
            {t('menu_title').split('Van Java')[1]}.
          </h2>
        </motion.div>

        {/* Filter Chips */}
        {allTags.length > 1 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="flex flex-wrap justify-center gap-2 mb-10"
          >
            {allTags.map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => setActiveTag(tag)}
                className={`px-4 py-1.5 rounded-full text-xs font-semibold tracking-wide transition-all active:scale-95 border ${
                  activeTag === tag
                    ? 'bg-amber-brand text-white border-amber-brand shadow-sm'
                    : 'bg-white dark:bg-zinc-900 border-outline-variant/35 dark:border-zinc-800 text-zinc-650 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800'
                }`}
              >
                {tag === 'ALL' ? t('menu_filter_all') : tag}
              </button>
            ))}
          </motion.div>
        )}

        {/* Product Cards Grid / Skeleton Loader */}
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-8">
          {filteredProducts.length === 0 ? (
            <div className="col-span-full text-center py-12 text-zinc-500">
              {t('menu_empty_tag')} "{activeTag === 'ALL' ? t('menu_filter_all') : activeTag}"
            </div>
          ) : (
            filteredProducts.map((product, i) => {
              const image = product.imageUrl || getFallbackImage(product.flavorName)
              const available = product.isAvailable && product.stock > 0

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
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: i * 0.05 }}
                  className={`bg-white dark:bg-zinc-900 rounded-[6px] overflow-hidden border border-outline-variant/35 dark:border-zinc-850 hover:border-secondary/40 shadow-sm hover:shadow-md transition-all duration-300 flex flex-col group ${!available ? 'opacity-80 grayscale-[50%]' : ''}`}
                >
                  {/* Image Container */}
                  <Link
                    href={`/menu-spesial/${product.id}`}
                    className="focus:outline-none block overflow-hidden"
                  >
                    <ProductImage src={image} alt={product.flavorName} available={available} />
                  </Link>

                  {/* Card Content */}
                  <div className="p-3.5 sm:p-6.5 flex flex-col items-center text-center flex-grow">
                    <Link
                      href={`/menu-spesial/${product.id}`}
                      className="focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 rounded-[6px] block mb-1"
                    >
                      <h3
                        className={`font-sans text-base sm:text-xl font-bold tracking-tight text-primary dark:text-zinc-100 w-full text-center transition-colors hover:text-amber-brand ${!available ? 'text-zinc-500' : ''}`}
                      >
                        {product.flavorName}
                      </h3>
                    </Link>

                    {/* Stock Indicator */}
                    <div className="flex items-center justify-center gap-1.5 mb-2 mt-1 w-full">
                      {product.stock > 0 ? (
                        <>
                          <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>
                          <span className="text-[10px] font-sans font-semibold text-green-600 dark:text-green-400 tracking-wider uppercase">
                            {t('menu_stock_available')}:{' '}
                            <span className="font-bold font-sans">{product.stock}</span>{' '}
                            {t('menu_portion')}
                          </span>
                        </>
                      ) : (
                        <>
                          <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span>
                          <span className="text-[10px] font-sans font-semibold text-red-600 dark:text-red-400 tracking-wider uppercase">
                            {t('menu_sold_out_badge')}
                          </span>
                        </>
                      )}
                    </div>

                    {/* Rating UI / Sales Magnet */}
                    <div className="flex items-center gap-3 mb-3 w-full justify-center">
                      <Link
                        href="/ulasan"
                        className="flex items-center gap-1 text-xs text-zinc-500 hover:text-[#D4802A] transition-colors cursor-pointer active:scale-95"
                      >
                        {product.rating ? (
                          <>
                            <span className="text-amber-400">⭐</span>
                            <span className="font-semibold text-zinc-700 dark:text-zinc-300 font-mono">
                              {product.rating}
                            </span>
                            {product.reviewCount ? (
                              <span className="text-[10px] font-mono">({product.reviewCount})</span>
                            ) : null}
                          </>
                        ) : (
                          <span className="font-bold text-[#D4802A] bg-[#D4802A]/10 px-2 py-0.5 rounded-[6px] text-[10px] font-mono tracking-wider uppercase">
                            {getSalesMagnetTag(product.flavorName)}
                          </span>
                        )}
                      </Link>

                      {product.soldCount !== undefined && product.soldCount > 0 && (
                        <div className="flex items-center gap-1 text-[10px] font-sans font-semibold text-zinc-500 bg-zinc-100 dark:bg-zinc-800/50 px-2 py-0.5 rounded-[6px] tracking-wider uppercase">
                          {product.soldCount > 50 && <span className="text-orange-500">🔥</span>}
                          <span>
                            {product.soldCount >= 1000
                              ? `${(product.soldCount / 1000).toFixed(1)}k+`
                              : product.soldCount}{' '}
                            {t('menu_sold')}
                          </span>
                        </div>
                      )}
                    </div>

                    <p className="text-zinc-600 dark:text-zinc-400 text-xs leading-relaxed mb-6 flex-grow font-sans w-full text-center">
                      {product.deskripsi_topping ||
                        (() => {
                          const key = getFlavorDescriptionKey(product.flavorName)
                          return key ? t(key) : t('menu_default_desc')
                        })()}
                    </p>

                    {/* Action row */}
                    <div className="flex flex-col items-center gap-3 pt-4 pb-6 border-t border-outline-variant/30 dark:border-zinc-800/80 mt-auto w-full">
                      <div className="text-center">
                        <div className="text-[10px] text-zinc-400 uppercase tracking-wider font-semibold font-mono mb-0.5">
                          {isReseller ? 'Harga Grosir (Mulai)' : t('menu_price')}
                        </div>
                        <div
                          className={`font-mono text-base font-bold text-primary dark:text-amber-400 ${!available ? 'text-zinc-500' : ''}`}
                        >
                          {isReseller && defaultWholesale > 0 ? (
                            <div className="flex flex-col items-center leading-tight">
                              <span className="text-xs line-through text-zinc-400 font-normal">
                                {formatPrice(defaultPrice)}
                              </span>
                              <span className="text-[#D4802A]">
                                {formatPrice(defaultWholesale)}
                              </span>
                            </div>
                          ) : (
                            formatPrice(defaultPrice)
                          )}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => available && setSelectedProduct(product)}
                        disabled={!available}
                        className={
                          available
                            ? 'bg-amber-brand hover:bg-amber-brand/95 text-white font-bold text-xs px-6 py-2.5 rounded-full shadow-sm transition-all duration-200 focus:outline-none flex items-center justify-center gap-1.5 active:scale-95'
                            : 'bg-zinc-200 text-zinc-400 cursor-not-allowed font-bold text-xs px-6 py-2.5 rounded-full flex items-center justify-center gap-1.5 opacity-70'
                        }
                      >
                        <span>{available ? t('menu_btn_order') : 'Habis Terjual'}</span>
                      </button>
                    </div>
                  </div>
                </motion.div>
              )
            })
          )}
        </div>

        {/* Read More — Lihat Semua Menu */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="text-center mt-12"
        >
          <Link
            href="/menu-spesial"
            className="inline-flex items-center gap-2 font-bold text-sm px-8 py-3.5 rounded-full transition-all active:scale-95 bg-amber-brand text-white shadow-sm"
          >
            🍌 Lihat Semua Menu &amp; Varian →
          </Link>
        </motion.div>
      </div>

      {/* Quick View Modal */}
      <QuickViewModal
        product={selectedProduct}
        allProducts={products}
        onClose={() => setSelectedProduct(null)}
      />
    </section>
  )
}
