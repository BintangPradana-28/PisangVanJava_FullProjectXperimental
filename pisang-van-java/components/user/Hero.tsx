'use client'

import { ChevronRight, Clock, Star } from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'
import { useLanguage } from '@/context/LanguageContext'

// Tiny 16x16 preview generated from public/kitchen.png — paints instantly while
// the full hero image streams in, instead of a blank flash on slow connections.
// Still a reasonable fallback when a CMS banner image is active instead, since
// the hero already sits on a dark background with a heavy gradient overlay on top.
const HERO_BG_BLUR_DATA_URL =
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
  totalReviews = 0
}: {
  banner?: { imageUrl?: string | null; linkUrl?: string | null } | null
  averageRating?: number
  totalReviews?: number
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
      // PERBAIKAN: Mengunci background utama menjadi gelap dan full width
      // PERF: Tinggi dikurangi di mobile/tablet (85vh, bukan 100vh) — memperkecil
      // area LCP image yang harus dirender di koneksi lambat, dan membawa section
      // berikutnya sedikit lebih dekat ke atas tanpa mengubah tampilan desktop.
      className="relative w-full min-h-[85vh] lg:min-h-screen flex items-center justify-center overflow-hidden bg-[#1a0f0a]"
    >
      {/* Background Image with Overlay */}
      <div className="absolute inset-0 z-0" aria-hidden="true">
        <Image
          src={bgImage}
          alt="Banner Promosi Van Java"
          fill
          priority
          fetchPriority="high"
          placeholder="blur"
          blurDataURL={HERO_BG_BLUR_DATA_URL}
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 80vw, 1200px"
          // PERF: quality diturunkan dari 70 — gambar ini berada di belakang
          // opacity-40 + gradient gelap berlapis, jadi detail kompresi nyaris
          // tak terlihat, sementara ukuran file turun cukup besar untuk LCP.
          quality={45}
          className="object-cover opacity-40"
        />
        {/* PERBAIKAN: Gradient hitam pekat yang dikunci mati (tidak terpengaruh tema) */}
        <div
          className="absolute inset-0 bg-gradient-to-t from-[#1a0f0a] via-[#1a0f0a]/80 to-black/30"
          aria-hidden="true"
        />
      </div>

      <div className="relative z-10 max-w-[1200px] w-full mx-auto px-6 py-24 md:py-32 grid lg:grid-cols-[3fr_2fr] gap-12 items-center">
        {/* Text Area */}
        <div className="text-left">
          {badge && (
            <div className="inline-flex items-center gap-2 mb-6">
              <span className="bg-amber-500/20 border border-amber-500/40 text-amber-400 text-xs font-semibold tracking-[0.25em] uppercase px-4 py-1.5 rounded-[4px]">
                {badge}
              </span>
            </div>
          )}

          <h1
            // PERBAIKAN: Pastikan text selalu white
            className="font-serif text-5xl sm:text-6xl lg:text-7xl font-bold text-white leading-[1.1] tracking-tight mb-4 drop-shadow-sm"
          >
            {renderTitle()}
          </h1>

          <div className="flex flex-wrap items-center gap-3 mb-6">
            {totalReviews >= 5 && (
              <>
                <Link href="/ulasan" className="group">
                  <div className="flex items-center gap-1.5 bg-amber-500/10 border border-amber-500/20 px-3 py-1.5 rounded-[4px] backdrop-blur-sm transition-all duration-200 hover:bg-amber-500/20">
                    <div className="flex gap-0.5">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star
                          // biome-ignore lint/suspicious/noArrayIndexKey: Static array for rendering stars
                          key={i}
                          className={`w-3.5 h-3.5 ${i < Math.round(averageRating) ? 'fill-amber-400 text-amber-400' : 'text-amber-400/30'}`}
                        />
                      ))}
                    </div>
                    <span className="text-sm font-bold text-amber-400 ml-1">
                      {averageRating.toFixed(1)}
                    </span>
                    <span className="text-sm text-gray-300 font-medium">
                      (
                      {totalReviews > 1000 ? `${(totalReviews / 1000).toFixed(1)}RB` : totalReviews}{' '}
                      Penilaian)
                    </span>
                    <ChevronRight className="w-4 h-4 text-gray-400 ml-1 group-hover:text-amber-400 transition-colors" />
                  </div>
                </Link>
                <span className="text-gray-500 text-lg leading-none">•</span>
              </>
            )}

            <div className="flex items-center gap-1.5 text-gray-300 text-sm font-medium">
              <Clock className="w-4 h-4 opacity-70" />
              <span>10.00 - 21.00 WIB</span>
            </div>

            <span className="text-gray-500 text-lg leading-none hidden sm:block">•</span>

            <div className="hidden sm:flex items-center gap-1 text-gray-300 text-sm font-medium">
              <span>{t('hero_location')}</span>
            </div>
          </div>

          <p className="text-gray-200 text-lg leading-relaxed max-w-lg mb-8 font-sans drop-shadow-md">
            {subtitle}
          </p>

          <div className="flex flex-wrap gap-4 items-center">
            <Link
              href={ctaLink}
              className="inline-flex items-center gap-3 bg-amber-brand hover:bg-amber-brand/90 text-[#1a0f0a] font-bold text-base px-10 py-4 rounded-[4px] shadow-sbx-card hover:shadow-sm transition-all duration-200 active:scale-95 group focus:outline-none focus:ring-4 focus:ring-amber-brand/40"
            >
              <ShoppingBagIcon />
              <span>{t('hero_order_btn')}</span>
            </Link>
          </div>

          <div className="grid grid-cols-3 gap-6 max-w-sm mt-12 pt-8 border-t border-white/10">
            {[
              { num: '12+', label: t('hero_stat_topping') },
              { num: '3', label: t('hero_stat_type') },
              { num: '100%', label: t('hero_stat_local') }
            ].map(({ num, label }) => (
              <div key={label}>
                <div className="font-serif text-3xl font-bold text-amber-500">{num}</div>
                <div className="text-xs text-gray-400 tracking-wider uppercase mt-1 font-medium">
                  {label}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Visual Element */}
        <div className="hidden lg:flex justify-end">
          <div className="relative w-full aspect-[4/3] rounded-[12px] overflow-hidden shadow-sbx-card border-8 border-white/10 bg-black/50">
            <Image
              src={banner?.imageUrl || '/kitchen.png'}
              alt="Visual Promosi"
              fill
              sizes="(max-width: 1024px) 1px, 450px"
              quality={70}
              className="object-cover"
            />
            {badge && (
              <div className="absolute top-5 right-5 bg-amber-800 text-amber-50 text-xs font-bold px-4 py-2 rounded-[4px] shadow-md">
                {badge}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Floating Scroll Indicator */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 hidden md:block z-20">
        <div className="flex flex-col items-center gap-1 cursor-pointer animate-bounce">
          <span className="text-xs text-gray-400 uppercase tracking-widest font-medium">
            Scroll Down
          </span>
          <span className="text-amber-500 text-sm">↓</span>
        </div>
      </div>
    </section>
  )
}