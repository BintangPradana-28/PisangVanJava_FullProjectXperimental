'use client'

import { AnimatePresence, motion } from 'framer-motion'
import { Search, Star, X } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { useLanguage } from '@/context/LanguageContext'

interface Variant {
  id: string
  flavorName: string
  priceKembung: number
  priceLumpia: number
  priceKrispy: number
  isAvailable: boolean
  imageUrl: string | null
  rating?: number
  reviewCount?: number
}

interface SearchDialogProps {
  isOpen: boolean
  onClose: () => void
}

let menuCache: Variant[] | null = null
let menuCacheFetchedAt = 0
const MENU_CACHE_TTL_MS = 90_000 // 90s — matches /api/menu's own ISR window (60s) + buffer

export default function SearchDialog({ isOpen, onClose }: SearchDialogProps) {
  const { t } = useLanguage()
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [variants, setVariants] = useState<Variant[]>([])
  const [loading, setLoading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  // Listen to Escape key to close the dialog
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown)
      // Focus input when modal opens
      setTimeout(() => inputRef.current?.focus(), 100)
    }
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  // Fetch menu variants from /api/menu when dialog is opened with memory cache fallback
  useEffect(() => {
    if (!isOpen) return

    const isCacheFresh = menuCache && Date.now() - menuCacheFetchedAt < MENU_CACHE_TTL_MS
    if (isCacheFresh) {
      setVariants(menuCache as Variant[])
      return
    }

    const fetchMenu = async () => {
      setLoading(true)
      try {
        const res = await fetch('/api/menu')
        const json = await res.json()
        if (json.success && json.data?.variants) {
          menuCache = json.data.variants
          menuCacheFetchedAt = Date.now()
          setVariants(json.data.variants)
        }
      } catch (err) {
        console.error('Failed to fetch menu for search:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchMenu()
  }, [isOpen])

  // Filter variants based on query
  const filteredVariants = query.trim()
    ? variants.filter((v) => v.flavorName.toLowerCase().includes(query.toLowerCase()))
    : variants.slice(0, 4) // Show top/first 4 items as suggestions when empty query

  const formatPrice = (n: number) =>
    new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0
    }).format(n)

  const handleSelectResult = (flavorName: string) => {
    onClose()
    router.push(`/menu-spesial?q=${encodeURIComponent(flavorName)}`)
  }

  const getLowestPrice = (v: Variant) => {
    const prices = [v.priceKembung, v.priceLumpia, v.priceKrispy].filter((p) => p > 0)
    return prices.length > 0 ? Math.min(...prices) : 0
  }

  const getFallbackImageUrl = (name: string): string => {
    const lower = name.toLowerCase()
    if (lower.includes('matcha')) return '/images/flavors/matcha.png'
    if (lower.includes('strawberry') || lower.includes('stroberi'))
      return '/images/flavors/strawberry.png'
    if (lower.includes('blueberry') || lower.includes('bluberi'))
      return '/images/flavors/blueberry.png'
    if (lower.includes('taro')) return '/images/flavors/taro.png'
    if (lower.includes('cokelat') || lower.includes('coklat'))
      return '/images/flavors/chocolate.png'
    if (lower.includes('keju')) return '/images/flavors/cheese.png'
    if (lower.includes('vanilla') || lower.includes('vanila')) return '/images/flavors/vanilla.png'
    return '/kitchen.png'
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] overflow-y-auto">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-zinc-950/60 backdrop-blur-sm transition-opacity"
          />

          {/* Dialog Container */}
          <div className="flex min-h-full items-start justify-center p-4 sm:p-6 md:p-20">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: -10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -10 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              className="relative w-full max-w-2xl transform overflow-hidden rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200/50 dark:border-zinc-800/80 shadow-2xl transition-all"
            >
              {/* Header Search Input */}
              <div className="flex items-center gap-3 px-4 py-4 border-b border-zinc-100 dark:border-zinc-800/80">
                <Search className="w-5 h-5 text-zinc-400 shrink-0" />
                <input
                  ref={inputRef}
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={t('search_placeholder') || 'Cari pisang goreng...'}
                  className="w-full bg-transparent text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 text-base outline-none border-none py-1 focus:ring-0"
                />
                {query && (
                  <button
                    type="button"
                    onClick={() => setQuery('')}
                    title="Bersihkan pencarian"
                    aria-label="Bersihkan pencarian"
                    className="p-1 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-850 text-zinc-400 hover:text-zinc-650 transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
                <button
                  onClick={onClose}
                  className="text-xs font-bold text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 border border-zinc-200 dark:border-zinc-700 rounded-[4px] px-2.5 py-1 transition-all"
                >
                  ESC
                </button>
              </div>

              {/* Suggestions / Results area */}
              <div className="max-h-[350px] overflow-y-auto p-4 space-y-4">
                {loading ? (
                  <div className="flex flex-col items-center justify-center py-12 gap-3">
                    <div className="w-8 h-8 rounded-full border-2 border-amber-brand border-t-transparent animate-spin" />
                    <span className="text-sm text-zinc-400 font-medium">Memuat menu...</span>
                  </div>
                ) : filteredVariants.length === 0 ? (
                  <div className="text-center py-12 text-zinc-400 text-sm">
                    {t('search_empty') || 'Tidak ada rasa yang cocok.'}
                  </div>
                ) : (
                  <div>
                    <h3 className="text-xs font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest px-2 mb-3">
                      {query ? 'Hasil Pencarian' : 'Rekomendasi Rasa'}
                    </h3>
                    <div className="grid gap-2">
                      {filteredVariants.map((variant) => {
                        const lowestPrice = getLowestPrice(variant)
                        const imageSrc = variant.imageUrl?.trim()
                          ? variant.imageUrl
                          : getFallbackImageUrl(variant.flavorName)

                        return (
                          <button
                            key={variant.id}
                            onClick={() => handleSelectResult(variant.flavorName)}
                            className="w-full flex items-center justify-between p-3 rounded-lg border border-zinc-100 dark:border-zinc-800/40 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 hover:border-amber-400 dark:hover:border-amber-500/50 transition-all text-left group"
                          >
                            <div className="flex items-center gap-3">
                              {/* Thumbnail image */}
                              <div className="w-12 h-12 rounded-lg bg-zinc-100 dark:bg-zinc-800 overflow-hidden relative border border-zinc-200/50 dark:border-zinc-800/80 shrink-0">
                                <img
                                  src={imageSrc}
                                  alt={variant.flavorName}
                                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                                />
                              </div>

                              <div>
                                <h4 className="font-bold text-zinc-800 dark:text-zinc-200 font-serif">
                                  {variant.flavorName}
                                </h4>
                                <div className="flex items-center gap-2 mt-1">
                                  {variant.rating && variant.rating > 0 ? (
                                    <span className="flex items-center gap-0.5 text-amber-500 text-xs font-bold">
                                      <Star className="w-3.5 h-3.5 fill-current" />
                                      {variant.rating}
                                    </span>
                                  ) : (
                                    <span className="text-[10px] text-zinc-400 font-bold bg-zinc-100 dark:bg-zinc-850 px-1.5 py-0.5 rounded">
                                      NEW
                                    </span>
                                  )}
                                  <span className="text-xs text-zinc-500">
                                    Mulai {formatPrice(lowestPrice)}
                                  </span>
                                </div>
                              </div>
                            </div>

                            <span className="text-xs font-bold text-amber-600 dark:text-amber-500 opacity-0 group-hover:opacity-100 transition-opacity group-focus:opacity-100">
                              Lihat →
                            </span>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Footer Guidance */}
              <div className="bg-zinc-50 dark:bg-zinc-850 px-4 py-3 border-t border-zinc-100 dark:border-zinc-800/80 text-xs text-zinc-400 flex items-center justify-between">
                <span>
                  Tekan{' '}
                  <kbd className="font-sans font-bold bg-white dark:bg-zinc-900 border px-1 rounded">
                    ↵
                  </kbd>{' '}
                  untuk memilih.
                </span>
                <span>Pisang Goreng Premium Van Java</span>
              </div>
            </motion.div>
          </div>
        </div>
      )}
    </AnimatePresence>
  )
}
