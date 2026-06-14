'use client'

import { motion } from 'framer-motion'
import nextDynamic from 'next/dynamic'
import Image from 'next/image'
import Link from 'next/link'
import { useEffect, useState } from 'react'

const QuickViewModal = nextDynamic(() => import('@/components/user/QuickViewModal'), { ssr: false })

import { useSession } from 'next-auth/react'
import { useLanguage } from '@/context/LanguageContext'

export interface ProductType {
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
  tags: string[]
  deskripsi_topping?: string | null
  rating?: number
  reviewCount?: number
  stock: number
  soldCount?: number
  isActive: boolean
}

interface Props {
  products: ProductType[]
}

const formatPrice = (price: number): string => {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0
  }).format(price)
}

const getFallbackImageUrl = (name: string): string => {
  const lowercaseName = name.toLowerCase()
  if (lowercaseName.includes('matcha')) return '/images/flavors/matcha.png'
  if (lowercaseName.includes('strawberry') || lowercaseName.includes('stroberi'))
    return '/images/flavors/strawberry.png'
  if (lowercaseName.includes('blueberry') || lowercaseName.includes('bluberi'))
    return '/images/flavors/blueberry.png'
  if (lowercaseName.includes('taro')) return '/images/flavors/taro.png'
  if (lowercaseName.includes('cokelat') || lowercaseName.includes('coklat'))
    return '/images/flavors/taro.png'
  if (lowercaseName.includes('keju')) return '/images/flavors/matcha.png'
  return '/kitchen.png'
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
        <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-white/90 dark:bg-zinc-900/90 backdrop-blur-sm border border-zinc-100 dark:border-zinc-800 rounded-[4px] px-3 py-1 text-xs font-bold text-primary dark:text-zinc-300">
          Freshly Fried
        </div>
      ) : (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-red-600/90 backdrop-blur-sm border border-red-700 rounded-[4px] px-3 py-1 text-xs font-bold text-white shadow-md">
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

const getFlavorDescriptionKey = (flavorName: string): string | null => {
  const lower = flavorName.toLowerCase()
  if (lower.includes('cokelat') || lower.includes('coklat')) return 'menu_desc_cokelat'
  if (lower.includes('matcha')) return 'menu_desc_matcha'
  if (lower.includes('strawberry') || lower.includes('stroberi')) return 'menu_desc_strawberry'
  if (lower.includes('blueberry') || lower.includes('bluberi')) return 'menu_desc_blueberry'
  if (lower.includes('taro')) return 'menu_desc_taro'
  if (lower.includes('tiramisu')) return 'menu_desc_tiramisu'
  if (lower.includes('keju')) return 'menu_desc_keju'
  if (lower.includes('susu')) return 'menu_desc_susu'
  if (lower.includes('original')) return 'menu_desc_original'
  if (lower.includes('milky')) return 'menu_desc_milky'
  return null
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
          <div className="text-secondary text-xs font-bold tracking-[0.2em] uppercase mb-3">
            {t('menu_badge')}
          </div>
          <h2 className="font-serif text-4xl sm:text-5xl font-bold text-primary dark:text-zinc-100">
            {t('menu_title').split('Van Java')[0]}
            <span className="text-secondary italic font-normal">Van Java</span>
            {t('menu_title').split('Van Java')[1]}
          </h2>
        </motion.div>

        {/* Filter Chips */}
        {allTags.length > 1 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="flex flex-wrap justify-center gap-3 mb-10"
          >
            {allTags.map((tag) => (
              <button
                key={tag}
                onClick={() => setActiveTag(tag)}
                className={`px-5 py-2 rounded-[4px] text-sm font-medium transition-all active:scale-95 ${
                  activeTag === tag
                    ? 'bg-amber-brand text-white shadow-sbx-card'
                    : 'bg-surface-container hover:bg-surface-container-high text-on-surface-variant border border-outline-variant/30'
                }`}
              >
                {tag === 'ALL' ? t('menu_filter_all') : tag}
              </button>
            ))}
          </motion.div>
        )}

        {/* Product Cards Grid / Skeleton Loader */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-8">
          {filteredProducts.length === 0 ? (
            <div className="col-span-full text-center py-12 text-zinc-500">
              {t('menu_empty_tag')} "{activeTag === 'ALL' ? t('menu_filter_all') : activeTag}"
            </div>
          ) : (
            filteredProducts.map((product, i) => {
              const image = product.imageUrl || getFallbackImageUrl(product.flavorName)
              const available = product.isAvailable && product.stock > 0
              return (
                <motion.div
                  key={product.id}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: i * 0.05 }}
                  className={`bg-white dark:bg-zinc-900 rounded-[4px] overflow-hidden border border-outline-variant/30 dark:border-zinc-800/60 hover:border-secondary/40 shadow-sbx-card transition-all duration-300 flex flex-col group ${!available ? 'opacity-80 grayscale-[50%]' : ''}`}
                >
                  {/* Image Container */}
                  <ProductImage src={image} alt={product.flavorName} available={available} />

                  {/* Card Content */}
                  <div className="p-6.5 flex flex-col items-center text-center flex-grow">
                    <h3
                      className={`font-serif text-2xl font-bold text-primary dark:text-zinc-100 mb-1 w-full text-center ${!available ? 'text-zinc-500' : ''}`}
                    >
                      {product.flavorName}
                    </h3>

                    {/* Stock Indicator */}
                    <div className="flex items-center justify-center gap-1.5 mb-2 mt-1 w-full">
                      {product.stock > 0 ? (
                        <>
                          <span className="w-2 h-2 rounded-[4px] bg-green-500"></span>
                          <span className="text-xs font-semibold text-green-600 dark:text-green-400 tracking-wide">
                            Tersedia: <span className="font-bold">{product.stock}</span> porsi
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

                    {/* Rating UI / Sales Magnet */}
                    <div className="flex items-center gap-3 mb-3 w-full justify-center">
                      <Link
                        href="/ulasan"
                        className="flex items-center gap-1.5 text-sm text-zinc-500 hover:text-[#D4802A] transition-colors cursor-pointer active:scale-95"
                      >
                        {product.rating ? (
                          <>
                            <span className="text-amber-400">⭐</span>
                            <span className="font-semibold text-zinc-700 dark:text-zinc-300">
                              {product.rating}
                            </span>
                            {product.reviewCount ? (
                              <span className="text-xs">({product.reviewCount})</span>
                            ) : null}
                          </>
                        ) : (
                          <span className="font-bold text-[#D4802A] bg-[#D4802A]/10 px-2 py-0.5 rounded-[4px] text-xs">
                            {getSalesMagnetTag(product.flavorName)}
                          </span>
                        )}
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

                    <p className="text-on-surface-variant dark:text-zinc-400 text-sm leading-relaxed mb-6 flex-grow font-sans w-full text-center">
                      {product.deskripsi_topping ||
                        (() => {
                          const key = getFlavorDescriptionKey(product.flavorName)
                          return key ? t(key) : t('menu_default_desc')
                        })()}
                    </p>

                    {/* Action row */}
                    <div className="flex flex-col items-center gap-3 pt-6 pb-8 border-t border-outline-variant/20 dark:border-zinc-800 mt-auto w-full">
                      <div className="text-center">
                        <div className="text-[10px] text-zinc-400 uppercase tracking-wider font-semibold mb-0.5">
                          {isReseller ? 'Harga Grosir (Mulai)' : t('menu_price')}
                        </div>
                        <div
                          className={`font-sans text-lg font-bold text-primary dark:text-amber-400 ${!available ? 'text-zinc-500' : ''}`}
                        >
                          {isReseller && product.wholesaleKembung > 0 ? (
                            <div className="flex flex-col items-center leading-tight">
                              <span className="text-xs line-through text-zinc-400 font-normal">
                                {formatPrice(product.priceKembung)}
                              </span>
                              <span className="text-[#D4802A]">
                                {formatPrice(product.wholesaleKembung)}
                              </span>
                            </div>
                          ) : (
                            formatPrice(product.priceKembung)
                          )}
                        </div>
                      </div>

                      <button
                        onClick={() => available && setSelectedProduct(product)}
                        disabled={!available}
                        className={
                          available
                            ? 'bg-amber-brand hover:bg-amber-brand/90 text-white font-bold text-sm px-8 py-3 rounded-[4px] shadow-sbx-card transition-all duration-200 focus:outline-none flex items-center justify-center gap-1.5 active:scale-95'
                            : 'bg-zinc-300 text-zinc-500 cursor-not-allowed font-bold text-sm px-8 py-3 rounded-[4px] flex items-center justify-center gap-1.5 opacity-70'
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
            className="inline-flex items-center gap-2 font-bold text-sm px-8 py-3.5 rounded-[4px] transition-all active:scale-95 bg-amber-brand text-white shadow-sbx-card"
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
