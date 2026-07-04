'use client'

// components/user/SearchFilterBar.tsx
// Upgraded: Debounced search + Sticky swipeable category tabs (mobile-first)
// Uses URL search params as the single source of truth — no hydration mismatch.

import { useRouter, useSearchParams } from 'next/navigation'
import { useQueryState } from 'nuqs'
import { useEffect, useRef, useState } from 'react'
import { useLanguage } from '@/context/LanguageContext'

// ── Tipe Adonan (Base Type) — shown as primary sticky tabs ──────────────────
const BASE_TABS = [
  { key: 'all', label: '🍌 Semua', emoji: '' },
  { key: 'Kembung', label: '🥟 Kembung', emoji: '🥟' },
  { key: 'Lumpia', label: '🌯 Lumpia', emoji: '🌯' },
  { key: 'Krispy', label: '🥨 Krispy', emoji: '🥨' }
]

// ── Kategori Rasa — shown as secondary swipeable chips ───────────────────────
const FLAVOR_CHIPS = [
  { key: 'all', label: 'Semua Rasa' },
  { key: 'Coklat', label: '🍫 Cokelat' },
  { key: 'Matcha', label: '🍵 Matcha' },
  { key: 'Tiramisu', label: '☕ Tiramisu' },
  { key: 'Strawberry', label: '🍓 Strawberry' },
  { key: 'Blueberry', label: '🫐 Blueberry' },
  { key: 'Milky', label: '🥛 Milky' },
  { key: 'Taro', label: '🟣 Taro' },
  { key: 'Original', label: '✨ Original' },
  { key: 'Keju', label: '🧀 Keju' },
  { key: 'vanila', label: '🍦 Vanila' }
]

// ── Sort — "default" doubles as the label for the existing time-of-day
// personalization (Edge Middleware reorder), so picking it surfaces that
// feature instead of leaving it silent ─────────────────────────────────────
const SORT_OPTIONS = [
  { key: 'default', label: 'Rekomendasi' },
  { key: 'terlaris', label: 'Paling Laris' },
  { key: 'harga-rendah', label: 'Harga Terendah' },
  { key: 'terbaru', label: 'Terbaru' }
]

interface SearchFilterBarProps {
  totalItems: number
}

export default function SearchFilterBar({ totalItems }: SearchFilterBarProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { t } = useLanguage()
  const chipRowRef = useRef<HTMLDivElement>(null)

  // RAG Source: components/user/SearchFilterBar.tsx
  const [search, setSearch] = useQueryState('q', {
    defaultValue: '',
    shallow: false
  })
  const [localSearch, setLocalSearch] = useState(search)

  const [baseFilter, setBaseFilter] = useQueryState('filter', {
    defaultValue: 'all',
    shallow: false
  })
  const [flavorFilter, setFlavorFilter] = useQueryState('flavor', {
    defaultValue: 'all',
    shallow: false
  })
  const [sortBy, setSortBy] = useQueryState('sort', {
    defaultValue: 'default',
    shallow: false
  })
  const [availableOnlyStr, setAvailableOnlyStr] = useQueryState('available', {
    defaultValue: 'false',
    shallow: false
  })

  const availableOnly = availableOnlyStr === 'true'
  const setAvailableOnly = (val: boolean | ((prev: boolean) => boolean)) => {
    const nextVal = typeof val === 'function' ? val(availableOnly) : val
    setAvailableOnlyStr(nextVal ? 'true' : 'false')
  }

  // Debounce input search to url param 'q'
  useEffect(() => {
    const timer = setTimeout(() => {
      if (localSearch !== search) {
        setSearch(localSearch || null)
      }
    }, 400)
    return () => clearTimeout(timer)
  }, [localSearch, search, setSearch])

  // Sync external search param changes back to local input
  useEffect(() => {
    setLocalSearch(search)
  }, [search])

  const [isDragging, setIsDragging] = useState(false)
  const dragStart = useRef<{ x: number; scrollLeft: number }>({ x: 0, scrollLeft: 0 })
  // Mobile-only: tabs/chips collapse behind the filter icon button (mirrors the
  // reference's search+filter pairing). Desktop always shows them — there's room.
  const [isFilterOpen, setIsFilterOpen] = useState(false)
  const activeFilterCount =
    (baseFilter !== 'all' ? 1 : 0) + (flavorFilter !== 'all' ? 1 : 0) + (availableOnly ? 1 : 0)

  // ── Mouse drag-to-scroll for flavor chip row (desktop UX) ───────────────────
  const onMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = chipRowRef.current
    if (!el) return
    setIsDragging(true)
    dragStart.current = { x: e.pageX - el.offsetLeft, scrollLeft: el.scrollLeft }
    el.style.cursor = 'grabbing'
  }
  const onMouseLeave = () => {
    setIsDragging(false)
    if (chipRowRef.current) chipRowRef.current.style.cursor = 'grab'
  }
  const onMouseUp = () => {
    setIsDragging(false)
    if (chipRowRef.current) chipRowRef.current.style.cursor = 'grab'
  }
  const onMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDragging || !chipRowRef.current) return
    e.preventDefault()
    const x = e.pageX - chipRowRef.current.offsetLeft
    const walk = (x - dragStart.current.x) * 1.4
    chipRowRef.current.scrollLeft = dragStart.current.scrollLeft - walk
  }

  return (
    <div className="sticky top-16 z-30 shadow-sm bg-[var(--background-custom)] border-b border-[var(--border-custom)]">
      {/* ── Row 1: Search pill + Filter toggle + Sort ───────────────────────── */}
      <div className="max-w-[1200px] mx-auto px-4 sm:px-6 pt-4 pb-3 flex items-center gap-2.5">
        {/* Search input — rounded-full pill, echoes reference's search bar */}
        <div className="relative flex-1 max-w-sm">
          <svg
            className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none text-[var(--text-custom)] opacity-50"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          <input
            type="text"
            value={localSearch}
            onChange={(e) => setLocalSearch(e.target.value)}
            placeholder={t('menu_search_placeholder')}
            aria-label="Cari varian menu"
            className="w-full pl-11 pr-4 py-3 text-sm rounded-full outline-none transition-all bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 focus-visible:ring-2 focus-visible:ring-amber-400"
          />
          {localSearch && (
            <button
              onClick={() => {
                setLocalSearch('')
                setSearch(null)
              }}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 transition-colors"
              aria-label="Hapus pencarian"
            >
              ✕
            </button>
          )}
        </div>

        {/* Toggle Tersedia Saja (Desktop) */}
        <label className="hidden md:flex items-center gap-1.5 cursor-pointer text-xs font-semibold select-none text-zinc-700 dark:text-zinc-300">
          <input
            type="checkbox"
            checked={availableOnly}
            onChange={(e) => setAvailableOnly(e.target.checked)}
            className="w-4 h-4 accent-[#D4802A] rounded border-zinc-300 dark:border-zinc-700"
          />
          <span>{t('menu_filter_available') || 'Tersedia Saja'}</span>
        </label>

        {/* Filter toggle — circular icon button (reference's "sliders" icon),
            controls tabs/chips visibility on mobile only; badge shows active count */}
        <button
          type="button"
          onClick={() => setIsFilterOpen((v) => !v)}
          {...{ 'aria-expanded': isFilterOpen }}
          aria-label="Buka filter"
          className={`md:hidden relative shrink-0 w-11 h-11 rounded-full flex items-center justify-center transition-all active:scale-95 border ${
            isFilterOpen || activeFilterCount > 0
              ? 'bg-[#D4802A] border-[#D4802A] text-white'
              : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-300'
          }`}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M3 4h18M6 8h12M9 12h6M11 16h2"
            />
          </svg>
          {activeFilterCount > 0 && (
            <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-amber-900 text-white text-[9px] font-bold flex items-center justify-center border border-white dark:border-zinc-950">
              {activeFilterCount}
            </span>
          )}
        </button>

        {/* Sort dropdown — native <select> for built-in keyboard/screen-reader support */}
        <div className="relative shrink-0 hidden sm:block">
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            aria-label="Urutkan menu"
            className="appearance-none text-xs font-semibold pl-3.5 pr-7 py-3 rounded-full outline-none transition-all bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 cursor-pointer focus-visible:ring-2 focus-visible:ring-amber-400"
          >
            {SORT_OPTIONS.map((opt) => (
              <option key={opt.key} value={opt.key}>
                {opt.label}
              </option>
            ))}
          </select>
          <svg
            className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3 h-3 pointer-events-none text-zinc-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>

        <span className="text-xs shrink-0 font-medium tabular-nums text-[var(--text-custom)] opacity-55 hidden sm:inline">
          {totalItems} {t('menu_count_suffix')}
        </span>
      </div>

      {/* ── Row 1b: Sort + count for mobile (search row above is cramped) ──── */}
      <div className="sm:hidden max-w-[1200px] mx-auto px-4 pb-3 flex items-center justify-between gap-2.5">
        <div className="flex items-center gap-3">
          <div className="relative shrink-0">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              aria-label="Urutkan menu"
              className="appearance-none text-xs font-semibold pl-3.5 pr-7 py-2 rounded-full outline-none transition-all bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300"
            >
              {SORT_OPTIONS.map((opt) => (
                <option key={opt.key} value={opt.key}>
                  {opt.label}
                </option>
              ))}
            </select>
            <svg
              className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3 h-3 pointer-events-none text-zinc-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </div>
          {/* Toggle Tersedia Saja (Mobile) */}
          <label className="flex items-center gap-1 cursor-pointer text-[11px] font-semibold select-none text-zinc-700 dark:text-zinc-300">
            <input
              type="checkbox"
              checked={availableOnly}
              onChange={(e) => setAvailableOnly(e.target.checked)}
              className="w-3.5 h-3.5 accent-[#D4802A] rounded border-zinc-300 dark:border-zinc-700"
            />
            <span>Tersedia</span>
          </label>
        </div>
        <span className="text-xs font-medium tabular-nums text-[var(--text-custom)] opacity-55">
          {totalItems} {t('menu_count_suffix')}
        </span>
      </div>

      {/* ── Row 2 & 3: Tabs + Chips — collapsed on mobile until filter toggle is tapped, always visible on desktop ── */}
      <div className={`${isFilterOpen ? 'block' : 'hidden'} md:block`}>
        {/* Row 2: Base Type Tabs (pill-style) */}
        <div className="max-w-[1200px] mx-auto px-4 sm:px-6 pb-4 flex gap-2 overflow-x-auto scrollbar-none">
          {BASE_TABS.map((tab) => {
            const active = baseFilter === tab.key
            return (
              <button
                key={tab.key}
                onClick={() => setBaseFilter(tab.key)}
                {...{ 'aria-pressed': active }}
                className={`flex-shrink-0 text-xs font-bold px-4 py-2 rounded-full transition-all duration-200 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-amber-400 ${
                  active
                    ? 'bg-[#D4802A] text-white shadow-[0_4px_14px_rgba(212,128,42,0.35)]'
                    : 'bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300'
                }`}
              >
                {tab.label}
              </button>
            )
          })}
        </div>

        {/* Row 3: Flavor Family Chips (drag-scrollable, pill-style) */}
        <div
          ref={chipRowRef}
          className="max-w-[1200px] mx-auto px-4 sm:px-6 pb-4 pt-1 flex gap-2 overflow-x-auto scrollbar-none select-none cursor-grab"
          onMouseDown={onMouseDown}
          onMouseLeave={onMouseLeave}
          onMouseUp={onMouseUp}
          onMouseMove={onMouseMove}
          role="group"
          aria-label="Filter berdasarkan rasa"
        >
          {FLAVOR_CHIPS.map((chip) => {
            const active = flavorFilter === chip.key
            return (
              <button
                key={chip.key}
                onClick={() => !isDragging && setFlavorFilter(chip.key)}
                {...{ 'aria-pressed': active }}
                className={`flex-shrink-0 text-[11px] font-semibold px-3.5 py-1.5 rounded-full transition-all duration-200 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ${
                  active
                    ? 'bg-amber-500/15 border-[1.5px] border-[#D4802A] text-[#D4802A]'
                    : 'bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 opacity-75'
                }`}
              >
                {chip.label}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
