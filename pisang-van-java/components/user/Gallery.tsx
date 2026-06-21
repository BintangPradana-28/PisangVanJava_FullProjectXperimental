'use client'

import { motion, useReducedMotion } from 'framer-motion'
import Image from 'next/image'
import Link from 'next/link'
import { useState } from 'react'
import { useLanguage } from '@/context/LanguageContext'

export type GalleryItem = {
  id: string
  label: string
  imageUrl?: string | null
  gradient: string
  emoji: string
  href?: string
}

const DEFAULT_GALLERY: Omit<GalleryItem, 'id'>[] = [
  {
    label: 'Kembung Original',
    gradient: 'from-amber-700 to-amber-brand',
    emoji: '🍌',
    href: '/menu-spesial'
  },
  {
    label: 'Matcha Milky',
    gradient: 'from-green-800 to-green-500',
    emoji: '🌿',
    href: '/menu-spesial'
  },
  {
    label: 'Strawberry Milky',
    gradient: 'from-rose-800 to-pink-400',
    emoji: '🍓',
    href: '/menu-spesial'
  },
  {
    label: 'Blueberry Lumpia',
    gradient: 'from-blue-900 to-blue-500',
    emoji: '🫐',
    href: '/menu-spesial'
  },
  {
    label: 'Taro Krispy',
    gradient: 'from-purple-900 to-purple-500',
    emoji: '💜',
    href: '/menu-spesial'
  },
  {
    label: 'Cokelat Milky',
    gradient: 'from-orange-950 to-orange-600',
    emoji: '🍫',
    href: '/menu-spesial'
  }
]

const getFallbackImageUrl = (name: string): string => {
  const lower = name.toLowerCase()
  if (lower.includes('matcha')) return '/images/flavors/matcha.png'
  if (lower.includes('strawberry') || lower.includes('stroberi'))
    return '/images/flavors/strawberry.png'
  if (lower.includes('blueberry') || lower.includes('bluberi'))
    return '/images/flavors/blueberry.png'
  if (lower.includes('taro')) return '/images/flavors/taro.png'
  if (lower.includes('cokelat') || lower.includes('coklat')) return '/images/flavors/chocolate.png'
  if (lower.includes('keju')) return '/images/flavors/cheese.png'
  if (lower.includes('vanilla') || lower.includes('vanila')) return '/images/flavors/vanilla.png'
  return '/kitchen.png'
}

function GalleryCard({
  item,
  index,
  reduceMotion,
  viewDetailLabel
}: {
  item: GalleryItem
  index: number
  reduceMotion: boolean
  viewDetailLabel: string
}) {
  const [imgSrc, setImgSrc] = useState(
    item.imageUrl?.trim() ? item.imageUrl : getFallbackImageUrl(item.label)
  )
  const href = item.href || '/menu-spesial'

  return (
    <motion.div
      initial={reduceMotion ? false : { opacity: 0, y: 20, scale: 0.96 }}
      whileInView={reduceMotion ? undefined : { opacity: 1, y: 0, scale: 1 }}
      viewport={{ once: true, margin: '-40px' }}
      transition={{
        duration: 0.35,
        delay: reduceMotion ? 0 : index * 0.07,
        ease: [0.25, 0.46, 0.45, 0.94]
      }}
    >
      <Link
        href={href}
        className="group relative block aspect-square rounded-[4px] overflow-hidden border border-outline-variant/20 dark:border-zinc-800 shadow-sm focus:outline-none focus-visible:ring-4 focus-visible:ring-amber-brand/40"
        aria-label={`${item.label} — ${viewDetailLabel}`}
      >
        <div
          className={`absolute inset-0 bg-gradient-to-br ${item.gradient} transition-transform duration-300 ease-out group-hover:scale-[1.04]`}
        >
          <Image
            src={imgSrc}
            alt={item.label}
            fill
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 360px"
            quality={70}
            loading="lazy"
            className="object-cover mix-blend-overlay opacity-90 transition-transform duration-300 ease-out group-hover:scale-105"
            onError={() => setImgSrc('/kitchen.png')}
          />
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <span
              className="text-6xl sm:text-7xl filter drop-shadow-md transition-transform duration-300 ease-out group-hover:scale-110 group-hover:-translate-y-1"
              aria-hidden="true"
            >
              {item.emoji}
            </span>
          </div>
        </div>
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 p-4 translate-y-1 transition-transform duration-300 ease-out group-hover:translate-y-0">
          <p className="text-white font-serif font-bold text-sm sm:text-base drop-shadow">
            {item.label}
          </p>
          <span className="inline-flex items-center gap-1 text-xs text-white/70 mt-1 opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100 transition-opacity duration-300">
            {viewDetailLabel} →
          </span>
        </div>
      </Link>
    </motion.div>
  )
}

interface GalleryProps {
  products?: Array<{ id: string; flavorName: string; imageUrl?: string | null }>
  compact?: boolean
}

export default function Gallery({ products, compact = false }: GalleryProps) {
  const { t } = useLanguage()
  const reduceMotion = useReducedMotion()

  const items: GalleryItem[] =
    products && products.length > 0
      ? products.slice(0, 6).map((p, i) => {
          const fallback = DEFAULT_GALLERY[i % DEFAULT_GALLERY.length]
          return {
            id: p.id,
            label: p.flavorName,
            imageUrl: p.imageUrl,
            gradient: fallback.gradient,
            emoji: fallback.emoji,
            href: '/menu-spesial'
          }
        })
      : DEFAULT_GALLERY.map((item, i) => ({ ...item, id: String(i + 1) }))

  return (
    <section
      id="gallery"
      aria-labelledby="gallery-heading"
      className={`${compact ? 'py-16' : 'py-20'} bg-surface-container-low dark:bg-zinc-950 border-y border-outline-variant/20 dark:border-zinc-900`}
    >
      <div className="max-w-[1200px] mx-auto px-6">
        <motion.div
          initial={reduceMotion ? false : { opacity: 0, y: 18 }}
          whileInView={reduceMotion ? undefined : { opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
          className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-6 mb-10"
        >
          <div>
            <div className="inline-block bg-secondary/10 text-secondary text-xs font-bold tracking-[0.2em] uppercase px-4 py-1 rounded-[4px] mb-3">
              {t('gallery_badge')}
            </div>
            <h2
              id="gallery-heading"
              className="font-serif text-3xl sm:text-4xl font-bold text-primary dark:text-zinc-100"
            >
              {t('gallery_title')}{' '}
              <span className="text-amber-brand italic font-normal">
                {t('gallery_title_accent')}
              </span>
            </h2>
            <p className="text-on-surface-variant dark:text-zinc-400 text-sm sm:text-base mt-3 max-w-xl leading-relaxed">
              {t('gallery_desc')}
            </p>
          </div>
          <Link
            href="/menu-spesial"
            className="inline-flex items-center justify-center gap-2 shrink-0 font-bold text-sm px-6 py-3 rounded-[4px] bg-amber-brand hover:bg-amber-brand/90 text-white shadow-sm transition-all duration-200 active:scale-95 hover:-translate-y-0.5 focus:outline-none focus-visible:ring-4 focus-visible:ring-amber-brand/40"
          >
            {t('gallery_view_menu')} →
          </Link>
        </motion.div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          {items.map((item, i) => (
            <GalleryCard
              key={item.id}
              item={item}
              index={i}
              reduceMotion={!!reduceMotion}
              viewDetailLabel={t('gallery_view_detail')}
            />
          ))}
        </div>
      </div>
    </section>
  )
}
