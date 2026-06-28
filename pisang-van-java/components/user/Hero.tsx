'use client'

import { ChevronRight, Clock, Star } from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'
import { useLanguage } from '@/context/LanguageContext'

// Tiny 16x16 preview generated from public/kitchen.png — paints instantly while
// the full hero image streams in, instead of a blank flash on slow connections.
// Still a reasonable fallback when a CMS banner image is active instead, since
// the hero already sits on a dark background with a heavy gradient overlay on top.
const _HERO_BG_BLUR_DATA_URL =
  'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDABQODxIPDRQSEBIXFRQYHjIhHhwcHj0sLiQySUBMS0dARkVQWnNiUFVtVkVGZIhlbXd7gYKBTmCNl4x9lnN+gXz/2wBDARUXFx4aHjshITt8U0ZTfHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHz/wAARCAAQABADASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwDNRVjCKG43bkIAB6etWb+Ut+8DHLqMk1RW8WQfZ1RcdR7n+lNvbhifKZfLVOAofPNZJM0dj//Z'

const ShoppingBagIcon = () => (
  <svg
    className="w-5 h-5"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    role="img"
    aria-label="Shopping Bag"
  >
    <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"></path>
    <line x1="3" y1="6" x2="21" y2="6"></line>
    <path d="M16 10a4 4 0 0 1-8 0"></path>
  </svg>
)

export default function Hero({
  banner,
  averageRating = 0,
  totalReviews = 0,
  activeToppingsCount = 12,
  activeFlavorsCount = 3
}: {
  banner?: { imageUrl?: string | null; linkUrl?: string | null } | null
  averageRating?: number
  totalReviews?: number
  activeToppingsCount?: number
  activeFlavorsCount?: number
}) {
  const { t } = useLanguage()

  const title = t('hero_title')
  const subtitle = t('hero_desc')
  const badge = t('hero_badge')
  // RAG Source: components/user/Hero.tsx, next.config.js (images.minimumCacheTTL)
  // FIX: Removed ?v=hero query string — Next.js 16 requires `images.localPatterns` config
  // to serve local images with query strings. The ?v= suffix is also redundant:
  // next.config.js already sets minimumCacheTTL: 31536000 for all optimized images.
  const bgImage = banner?.imageUrl || '/kitchen.png'
  const ctaLink = banner?.linkUrl || '/menu-spesial'

  // REMOVED LEAK 2: Manual preload(bgImage) removed because it forces a direct download of unoptimized external assets (bypassing /_next/image). Next.js <Image priority /> handles this automatically.

  const renderTitle = () => {
    if (title.includes('Van Java')) {
      const parts = title.split('Van Java')
      return (
        <>
          {parts[0]} <br className="hidden sm:block" />
          <span className="text-amber-500 italic font-normal">Van Java</span>
          {parts[1]}
        </>
      )
    }
    return title
  }

  return (
    <section
      id="hero"
      className="relative w-full min-h-[85vh] lg:min-h-screen flex items-center justify-center overflow-hidden bg-surface-container-low dark:bg-zinc-950/40"
    >
      {/* Warm Mesh Gradient Backdrop */}
      <div
        className="absolute inset-0 z-0 overflow-hidden opacity-45 dark:opacity-30 pointer-events-none"
        aria-hidden="true"
      >
        <div className="absolute -top-[30%] -left-[10%] w-[70%] h-[70%] rounded-full bg-gradient-to-br from-amber-300/40 via-amber-400/20 to-amber-brand/10 blur-[120px]" />
        <div className="absolute -top-[20%] -right-[10%] w-[60%] h-[60%] rounded-full bg-gradient-to-br from-yellow-200/40 via-amber-100/20 to-rose-300/10 blur-[100px]" />
        <div className="absolute top-[20%] left-[10%] w-[50%] h-[50%] rounded-full bg-gradient-to-br from-amber-200/20 to-transparent blur-[90px]" />
      </div>

      <div className="relative z-10 max-w-[1200px] w-full mx-auto px-6 py-20 md:py-28 grid lg:grid-cols-[3fr_2fr] gap-12 items-center">
        {/* Text Area */}
        <div className="text-left">
          {badge && (
            <div className="inline-flex items-center gap-2 mb-5">
              <span className="bg-secondary/15 border border-secondary/25 text-secondary dark:text-amber-400 font-sans text-[11px] font-semibold tracking-wider uppercase px-3 py-1 rounded-[6px]">
                {badge}
              </span>
            </div>
          )}

          <h1 className="font-sans text-4xl sm:text-5xl lg:text-6xl font-extrabold text-primary dark:text-zinc-100 leading-[1.08] tracking-[-0.03em] sm:tracking-[-0.05em] mb-4">
            {renderTitle()}.
          </h1>

          <div className="flex flex-wrap items-center gap-3 mb-6">
            {totalReviews >= 5 && (
              <>
                <Link href="/ulasan" className="group">
                  <div className="flex items-center gap-1.5 bg-secondary/10 border border-secondary/20 dark:border-zinc-800 px-3 py-1.5 rounded-[6px] backdrop-blur-sm transition-all duration-200 hover:bg-secondary/20">
                    <div className="flex gap-0.5">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star
                          // biome-ignore lint/suspicious/noArrayIndexKey: Static array for rendering stars
                          key={i}
                          className={`w-3 h-3 ${i < Math.round(averageRating) ? 'fill-amber-brand text-amber-brand' : 'text-zinc-300 dark:text-zinc-700'}`}
                        />
                      ))}
                    </div>
                    <span className="text-xs font-bold text-secondary dark:text-amber-400 ml-1">
                      {averageRating.toFixed(1)}
                    </span>
                    <span className="text-xs text-zinc-550 dark:text-zinc-400 font-medium">
                      (
                      {totalReviews > 1000 ? `${(totalReviews / 1000).toFixed(1)}RB` : totalReviews}{' '}
                      Penilaian)
                    </span>
                    <ChevronRight className="w-3.5 h-3.5 text-zinc-400 ml-1 group-hover:text-amber-brand transition-colors" />
                  </div>
                </Link>
                <span className="text-zinc-300 dark:text-zinc-700 text-lg leading-none">•</span>
              </>
            )}

            <div className="flex items-center gap-1.5 text-zinc-550 dark:text-zinc-400 text-xs font-semibold font-sans">
              <Clock className="w-3.5 h-3.5 opacity-70 text-secondary" />
              <span>10.00 - 21.00 WIB</span>
            </div>

            <span className="text-zinc-300 dark:text-zinc-700 text-lg leading-none hidden sm:block">
              •
            </span>

            <div className="hidden sm:flex items-center gap-1 text-zinc-550 dark:text-zinc-400 text-xs font-semibold font-sans">
              <span>{t('hero_location')}</span>
            </div>
          </div>

          <p className="text-zinc-650 dark:text-zinc-400 text-base sm:text-lg leading-relaxed max-w-lg mb-8 font-sans">
            {subtitle}
          </p>

          <div className="flex flex-wrap gap-3 items-center">
            <Link
              href={ctaLink}
              className="inline-flex items-center gap-2 bg-amber-brand hover:bg-amber-brand/95 text-white font-bold text-sm px-8 py-3.5 rounded-full shadow-md transition-all duration-200 active:scale-95 group focus:outline-none focus:ring-4 focus:ring-amber-brand/40"
            >
              <ShoppingBagIcon />
              <span>{t('hero_order_btn')}</span>
            </Link>
            <Link
              href="/track-order"
              className="inline-flex items-center gap-2 bg-white dark:bg-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-800/80 border border-outline-variant/35 dark:border-zinc-800 text-primary dark:text-zinc-200 font-bold text-sm px-6 py-3.5 rounded-full shadow-sm transition-all duration-200 active:scale-95 focus:outline-none focus:ring-4 focus:ring-zinc-300/30"
            >
              <span>📦 {t('hero_sec_cta')}</span>
            </Link>
          </div>

          <div className="grid grid-cols-3 gap-6 max-w-sm mt-12 pt-8 border-t border-outline-variant/20 dark:border-zinc-800">
            {[
              {
                num: activeToppingsCount > 0 ? `${activeToppingsCount}+` : '12+',
                label: t('hero_stat_topping')
              },
              {
                num: activeFlavorsCount > 0 ? `${activeFlavorsCount}` : '3',
                label: t('hero_stat_type')
              },
              { num: '100%', label: t('hero_stat_local') }
            ].map(({ num, label }) => (
              <div key={label}>
                <div className="font-sans text-2xl font-bold text-secondary dark:text-amber-400">
                  {num}
                </div>
                <div className="text-[10px] text-zinc-450 dark:text-zinc-500 tracking-wider uppercase mt-1 font-semibold">
                  {label}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Visual Element */}
        <div className="hidden lg:flex justify-end">
          <div className="relative w-full aspect-[4/3] rounded-[8px] overflow-hidden shadow-md border border-outline-variant/35 dark:border-zinc-800 bg-white dark:bg-zinc-900">
            <Image
              src={bgImage}
              alt="Visual Promosi"
              fill
              sizes="(max-width: 1024px) 1px, 450px"
              quality={70}
              className="object-cover"
            />
            {badge && (
              <div className="absolute top-5 right-5 bg-secondary text-white text-[10px] font-bold px-3 py-1.5 rounded-[4px] shadow-sm font-sans uppercase tracking-wider">
                {badge}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Floating Scroll Indicator */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 hidden md:block z-20">
        <div className="flex flex-col items-center gap-1 cursor-pointer animate-bounce">
          <span className="text-[10px] text-zinc-450 dark:text-zinc-550 uppercase tracking-widest font-semibold font-sans">
            {t('hero_scroll_down')}
          </span>
          <span className="text-secondary dark:text-amber-brand text-sm">↓</span>
        </div>
      </div>
    </section>
  )
}
