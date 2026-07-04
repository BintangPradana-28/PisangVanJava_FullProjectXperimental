'use client'
import { AnimatePresence, motion } from 'framer-motion'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useSession } from 'next-auth/react'
// src/features/reviews/components/ReviewSystem.tsx — v2 with Verified Buyer Form
import { useOptimistic, useState, useTransition } from 'react'
import { useInfiniteQuery } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { useLanguage } from '@/context/LanguageContext'

type ReviewData = {
  id: string
  userId: string
  userName: string
  variantName: string
  rating: number
  comment: string | null
  imageUrl?: string | null
  isVerifiedBuyer?: boolean
  createdAt: string
}

type Aggregates = {
  average: number
  total: number
  starCounts: { 1: number; 2: number; 3: number; 4: number; 5: number }
}

interface ReviewSystemProps {
  initialReviews: ReviewData[]
  initialAggregates: Aggregates
  currentFilter: string
  variantName?: string
  variantId?: string
}

// ── Star Picker ─────────────────────────────────────────────────────────────
function StarPicker({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [hovered, setHovered] = useState(0)
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          onClick={() => onChange(star)}
          onMouseEnter={() => setHovered(star)}
          onMouseLeave={() => setHovered(0)}
          className="text-3xl transition-transform hover:scale-110 active:scale-95 focus:outline-none"
          aria-label={`Beri ${star} bintang`}
        >
          <span
            className={
              star <= (hovered || value) ? 'text-amber-400' : 'text-zinc-200 dark:text-zinc-700'
            }
          >
            ★
          </span>
        </button>
      ))}
    </div>
  )
}

const STAR_LABELS: Record<number, string> = {
  1: 'Sangat Buruk 😞',
  2: 'Kurang Bagus 😐',
  3: 'Biasa Saja 🙂',
  4: 'Bagus! 😊',
  5: 'Luar Biasa! 🤩'
}

const FILTERS = ['Semua', '5', '4', '3', '2', '1', 'Dengan Komentar'] as const

export default function ReviewSystem({
  initialReviews,
  initialAggregates,
  currentFilter,
  variantName,
  variantId: initialVariantId
}: ReviewSystemProps) {
  const { t } = useLanguage()
  const { data: session } = useSession()
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()

  // RAG Source: src/features/reviews/components/ReviewSystem.tsx
  const fetchReviews = async ({ pageParam = 1 }) => {
    const params = new URLSearchParams()
    params.set('page', String(pageParam))
    params.set('limit', '10')
    if (initialVariantId) params.set('variantId', initialVariantId)
    if (currentFilter !== 'Semua') {
      if (currentFilter === 'Dengan Komentar') {
        params.set('hasComment', 'true')
      } else {
        params.set('rating', currentFilter)
      }
    }
    const res = await fetch(`/api/reviews?${params.toString()}`)
    const json = await res.json()
    if (!json.success) throw new Error(json.error || 'Failed to fetch reviews')
    return json.data as ReviewData[]
  }

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage
  } = useInfiniteQuery({
    queryKey: ['reviews', currentFilter, initialVariantId],
    queryFn: ({ pageParam }) => fetchReviews({ pageParam }),
    initialPageParam: 1,
    getNextPageParam: (lastPage, allPages) => {
      if (lastPage.length < 10) return undefined
      return allPages.length + 1
    },
    initialData: {
      pages: [initialReviews],
      pageParams: [1]
    }
  })

  const allReviews = data ? data.pages.flat() : initialReviews

  // Review form state
  const [showForm, setShowForm] = useState(false)
  const [rating, setRating] = useState(0)
  const [comment, setComment] = useState('')
  const [variantId, setVariantId] = useState(initialVariantId || '')
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Optimistic filter
  const [optimisticFilter, setOptimisticFilter] = useOptimistic(
    currentFilter,
    (_state, newFilter: string) => newFilter
  )

  const handleFilterClick = (newFilter: string) => {
    startTransition(() => {
      setOptimisticFilter(newFilter)
      const params = new URLSearchParams(searchParams.toString())
      newFilter === 'Semua' ? params.delete('filter') : params.set('filter', newFilter)
      router.replace(`${pathname}?${params.toString()}`, { scroll: false })
    })
  }

  // ── Submit review ──────────────────────────────────────────────────────────
  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!session) {
      toast.error('Login dahulu untuk memberikan ulasan')
      return
    }
    if (rating === 0) {
      toast.error('Pilih bintang rating terlebih dahulu')
      return
    }
    if (!variantId) {
      toast.error('Pilih varian menu yang ingin diulas')
      return
    }

    setIsSubmitting(true)
    try {
      const res = await fetch('/api/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ variantId, rating, comment: comment.trim() || undefined })
      })
      const data = await res.json()
      if (data.success) {
        toast.success('✅ Ulasan berhasil dikirim! Terima kasih.')
        setShowForm(false)
        setRating(0)
        setComment('')
        setVariantId('')
        router.refresh()
      } else {
        toast.error(data.error || 'Gagal mengirim ulasan')
      }
    } catch {
      toast.error('Koneksi bermasalah. Coba lagi.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="max-w-4xl mx-auto py-12 px-4 sm:px-6">
      {/* ── Hero Title ── */}
      <div className="max-w-[1200px] mx-auto mb-8 text-center">
        <div className="text-secondary text-xs font-bold tracking-[0.2em] uppercase mb-3">
          {t('review_subtitle')}
        </div>
        <h1 className="font-serif text-4xl sm:text-5xl font-bold text-primary dark:text-zinc-100">
          {t('review_title')}{' '}
          <span className="text-secondary italic font-normal">{t('review_title_highlight')}</span>
        </h1>
        <p className="mt-4 text-zinc-600 dark:text-zinc-400 max-w-2xl mx-auto">
          {t('review_desc')}
        </p>
      </div>

      {variantName && (
        <div className="mb-6 p-4 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/50 rounded-2xl flex items-center justify-between gap-4 text-sm">
          <span className="text-zinc-700 dark:text-zinc-300">
            Menampilkan ulasan untuk varian <strong>{variantName}</strong>.
          </span>
          <Link
            href="/ulasan"
            className="text-amber-700 dark:text-amber-400 font-bold hover:underline shrink-0"
          >
            Tampilkan Semua
          </Link>
        </div>
      )}

      {/* ── Aggregate Summary ── */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 sm:p-8 mb-6 shadow-sm">
        <div className="flex flex-col sm:flex-row items-center gap-8">
          {/* Big Score */}
          <div className="flex flex-col items-center justify-center flex-shrink-0">
            <div className="text-6xl font-bold text-zinc-900 dark:text-zinc-100 mb-1 font-serif">
              {initialAggregates.average > 0 ? initialAggregates.average.toFixed(1) : '—'}
            </div>
            <div className="flex gap-1 text-amber-400 text-xl mb-1">
              {Array.from({ length: 5 }).map((_, i) => (
                <span key={i}>{i < Math.round(initialAggregates.average) ? '★' : '☆'}</span>
              ))}
            </div>
            <div className="text-sm text-zinc-500 font-medium">
              {initialAggregates.total.toLocaleString('id-ID')} {t('review_card_total')}
            </div>
          </div>

          {/* Distribution Bars */}
          <div className="flex-1 w-full space-y-2">
            {[5, 4, 3, 2, 1].map((star) => {
              const count =
                initialAggregates.starCounts[star as keyof typeof initialAggregates.starCounts] || 0
              const pct = initialAggregates.total > 0 ? (count / initialAggregates.total) * 100 : 0
              return (
                <button
                  key={star}
                  onClick={() => handleFilterClick(String(star))}
                  className="flex items-center gap-3 text-sm w-full hover:opacity-80 transition-opacity group"
                >
                  <div className="flex items-center gap-1 w-12 shrink-0 text-zinc-600 dark:text-zinc-400 group-hover:text-amber-500">
                    <span>{star}</span>
                    <span className="text-amber-400">★</span>
                  </div>
                  <div className="flex-1 h-2.5 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${pct}%` }}
                      transition={{ duration: 1, ease: 'easeOut' }}
                      className="h-full bg-amber-400 rounded-full"
                    />
                  </div>
                  <div className="w-10 shrink-0 text-right text-zinc-500 text-xs font-medium">
                    {count > 999 ? '999+' : count}
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {/* ── CTA: Write Review ── */}
      <div className="mb-6">
        {session ? (
          <motion.div layout>
            {!showForm ? (
              <motion.button
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                onClick={() => setShowForm(true)}
                className="w-full bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-bold py-4 px-6 rounded-2xl transition-all shadow-lg shadow-amber-200/50 dark:shadow-amber-900/30 active:scale-[0.98] flex items-center justify-center gap-2"
              >
                <span className="text-xl">✍️</span>
                <span>Tulis Ulasan Anda</span>
              </motion.button>
            ) : (
              <motion.form
                key="form"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                onSubmit={handleSubmitReview}
                className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 shadow-sm space-y-5"
              >
                <div className="flex justify-between items-center">
                  <h3 className="font-serif text-xl font-bold text-zinc-900 dark:text-zinc-100">
                    ✍️ Tulis Ulasan
                  </h3>
                  <button
                    type="button"
                    onClick={() => setShowForm(false)}
                    className="w-8 h-8 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-500 hover:bg-zinc-200 dark:hover:bg-zinc-700 flex items-center justify-center text-sm transition-colors"
                  >
                    ✕
                  </button>
                </div>

                {/* Rating stars */}
                <div>
                  <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2">
                    Rating *
                  </label>
                  <StarPicker value={rating} onChange={setRating} />
                  {rating > 0 && (
                    <motion.p
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="text-xs text-amber-600 font-semibold mt-1"
                    >
                      {STAR_LABELS[rating]}
                    </motion.p>
                  )}
                </div>

                {/* Variant selection */}
                <div>
                  <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2">
                    Varian yang Diulas *
                  </label>
                  <p className="text-xs text-zinc-400 mb-2">
                    Masukkan ID varian (dari riwayat pesanan Anda). Sistem akan memverifikasi
                    pembelian Anda.
                  </p>
                  <input
                    type="text"
                    value={variantId}
                    onChange={(e) => setVariantId(e.target.value.trim())}
                    placeholder="ID Varian (dari pesanan Anda)"
                    className="w-full px-4 py-3 rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-100 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-amber-400 transition-all"
                  />
                  <p className="text-xs text-zinc-400 mt-1">
                    💡 Tip: Buka{' '}
                    <Link
                      href="/track-order"
                      className="text-amber-500 hover:underline font-medium"
                    >
                      Riwayat Pesanan
                    </Link>{' '}
                    untuk menemukan ID varian menu yang pernah Anda beli.
                  </p>
                </div>

                {/* Comment */}
                <div>
                  <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2">
                    Komentar (Opsional)
                  </label>
                  <textarea
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    rows={4}
                    placeholder="Ceritakan pengalaman Anda... (gorengnya garing, rasanya pas, pelayanannya ramah?)"
                    className="w-full px-4 py-3 rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-100 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 transition-all resize-none"
                    maxLength={1000}
                  />
                  <p className="text-xs text-zinc-400 text-right mt-1">{comment.length}/1000</p>
                </div>

                {/* Verified buyer note */}
                <div className="flex items-start gap-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/50 rounded-2xl p-4">
                  <span className="text-amber-500 text-lg shrink-0">🛡️</span>
                  <p className="text-xs text-amber-700 dark:text-amber-400 leading-relaxed">
                    <strong>Verified Buyer Check:</strong> Sistem kami akan otomatis memverifikasi
                    apakah Anda pernah membeli varian ini. Jika ya, ulasan Anda akan mendapat badge{' '}
                    <strong>✅ Pembeli Terverifikasi</strong>.
                  </p>
                </div>

                <div className="flex gap-3 justify-end">
                  <button
                    type="button"
                    onClick={() => setShowForm(false)}
                    className="px-6 py-3 rounded-2xl border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 font-semibold text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-all"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting || rating === 0}
                    className="px-6 py-3 rounded-2xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-sm disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-95 shadow-md shadow-amber-200/50 flex items-center gap-2"
                  >
                    {isSubmitting ? (
                      <>
                        <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />{' '}
                        Mengirim...
                      </>
                    ) : (
                      '✅ Kirim Ulasan'
                    )}
                  </button>
                </div>
              </motion.form>
            )}
          </motion.div>
        ) : (
          <div className="bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 text-center">
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-3">
              Ingin berbagi pengalaman Anda?
            </p>
            <Link
              href="/member-login?callbackUrl=/ulasan"
              className="inline-flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-white font-bold px-6 py-3 rounded-xl transition-all text-sm"
            >
              🔐 Login untuk Menulis Ulasan
            </Link>
          </div>
        )}
      </div>

      {/* ── Filter Chips ── */}
      <div
        className="flex overflow-x-auto pb-4 mb-6 gap-3 border-b border-zinc-200 dark:border-zinc-800"
        style={{ scrollbarWidth: 'none' }}
      >
        {FILTERS.map((f) => {
          const isSelected = optimisticFilter === f
          const label =
            f === 'Semua'
              ? t('review_filter_all')
              : f === 'Dengan Komentar'
                ? t('review_filter_comment')
                : `${f} ${t('review_filter_stars')}`

          return (
            <button
              key={f}
              onClick={() => handleFilterClick(f)}
              className={`flex-shrink-0 px-5 py-2.5 rounded-full text-sm font-bold transition-all ${
                isSelected
                  ? 'bg-amber-100 dark:bg-amber-900/30 border-2 border-[#D4802A] text-[#D4802A]'
                  : 'bg-white dark:bg-zinc-900 border-2 border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 hover:border-zinc-300'
              }`}
            >
              {label}
            </button>
          )
        })}
      </div>

      {/* ── Review List ── */}
      <div
        className={`space-y-6 transition-opacity duration-300 ${isPending ? 'opacity-50' : 'opacity-100'}`}
      >
        {allReviews.length === 0 ? (
          <div className="text-center py-16 bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200 dark:border-zinc-800">
            <div className="text-5xl mb-4">📝</div>
            <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 mb-2">
              {t('review_empty_title')}
            </h3>
            <p className="text-zinc-500 text-sm">{t('review_empty_desc')}</p>
          </div>
        ) : (
          <>
            <AnimatePresence>
              {allReviews.map((review) => (
                <motion.div
                  key={review.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="p-6 bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-sm hover:shadow-md transition-shadow"
                >
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex items-center gap-3">
                      {/* Avatar */}
                      <div className="w-11 h-11 rounded-full bg-gradient-to-br from-amber-200 to-orange-400 flex items-center justify-center text-amber-900 font-bold text-sm shadow-sm">
                        {review.userName[0].toUpperCase()}
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-zinc-900 dark:text-zinc-100 text-sm">
                            {review.userName}
                          </span>
                          {review.isVerifiedBuyer && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-900/50">
                              ✅ Pembeli Terverifikasi
                            </span>
                          )}
                        </div>
                        <div className="flex gap-0.5 text-amber-400 text-sm mt-0.5">
                          {Array.from({ length: 5 }).map((_, i) => (
                            <span key={i}>{i < review.rating ? '★' : '☆'}</span>
                          ))}
                        </div>
                      </div>
                    </div>
                    <div className="text-xs text-zinc-400 font-medium shrink-0 ml-2">
                      {new Date(review.createdAt).toLocaleDateString('id-ID', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric'
                      })}
                    </div>
                  </div>

                  {review.comment && (
                    <p className="text-zinc-700 dark:text-zinc-300 text-sm leading-relaxed mb-4 whitespace-pre-wrap">
                      {review.comment}
                    </p>
                  )}

                  <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900/30 rounded-xl text-xs font-semibold text-amber-700 dark:text-amber-400">
                    <span>🍌</span>
                    <span>{t('review_menu_liked')}</span>
                    <span className="text-[#D4802A] uppercase tracking-wide">
                      {review.variantName}
                    </span>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>

            {hasNextPage && (
              <div className="flex justify-center mt-8">
                <button
                  onClick={() => fetchNextPage()}
                  disabled={isFetchingNextPage}
                  className="px-6 py-3 rounded-[4px] font-bold text-sm bg-zinc-150 hover:bg-zinc-200 text-zinc-800 transition-all dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700 disabled:opacity-50"
                >
                  {isFetchingNextPage ? 'Memuat...' : 'Tampilkan Lebih Banyak 🍌'}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
