'use client'

import { motion } from 'framer-motion'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import type React from 'react'
import { useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { Drawer } from 'vaul'
import { useLanguage } from '@/context/LanguageContext'
import { useSettings } from '@/context/SettingsContext'
import { type CartTopping, useCartStore } from '@/src/features/cart/stores/cart.store'
import type { ProductType } from '@/src/features/menu/components/MenuCards'
import { animateFlyToCart } from '@/src/lib/animations'
import { isStoreOpen as checkStoreOpen } from '@/src/lib/time'

interface QuickViewModalProps {
  product: ProductType | null
  allProducts?: ProductType[]
  onClose: () => void
  // Optional: lets the parent (MenuGrid) wire in its existing favorites state/handler
  // instead of this modal duplicating that logic. Heart button only renders when both
  // are provided, so omitting them is safe — no half-working affordance.
  isFavorite?: boolean
  onToggleFavorite?: (e: React.MouseEvent, variantId: string) => void
}

interface Topping {
  id: string
  name: string
  price: number
  emoji: string | null
  isActive: boolean
}

const AVAILABLE_TYPES = ['Kembung', 'Lumpia', 'Krispy']

// Same fallback-image + description-key logic as components/user/MenuGrid.tsx —
// kept local (not extracted to a shared util) since formatPrice below already
// follows this exact duplication precedent in this codebase; both are small,
// pure, presentation-only helpers, not domain/business logic.
const getFallbackImage = (name: string) => {
  const n = name.toLowerCase()
  if (n.includes('matcha')) return '/images/flavors/matcha.png'
  if (n.includes('taro')) return '/images/flavors/taro.png'
  if (n.includes('blueberry') || n.includes('bluberi')) return '/images/flavors/blueberry.png'
  if (n.includes('strawberry') || n.includes('stroberi')) return '/images/flavors/strawberry.png'
  if (n.includes('cokelat') || n.includes('coklat')) return '/images/flavors/chocolate.png'
  if (n.includes('keju')) return '/images/flavors/cheese.png'
  if (n.includes('vanilla') || n.includes('vanila')) return '/images/flavors/vanilla.png'
  return '/kitchen.png'
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

const TYPE_EMOJI: Record<string, string> = { Kembung: '🥟', Lumpia: '🌯', Krispy: '🥨' }

export default function QuickViewModal({
  product,
  allProducts = [],
  onClose,
  isFavorite = false,
  onToggleFavorite
}: QuickViewModalProps) {
  const addToCart = useCartStore((s) => s.addItem)
  const { t } = useLanguage()
  const { getSetting } = useSettings()
  const jamOperasional = getSetting('jam_operasional', '10.00–21.00')
  const storeMode = getSetting('store_status', 'AUTO')
  const { isOpen: isStoreOpen } = checkStoreOpen(jamOperasional, storeMode)
  const { data: session } = useSession()
  const isReseller = session?.user.role === 'RESELLER'
  const router = useRouter()

  // State Management sesuai instruksi
  const [selectedType, setSelectedType] = useState<string>('')
  const [selectedFlavor, setSelectedFlavor] = useState<string>('')
  const [selectedToppings, setSelectedToppings] = useState<string[]>([])
  const [quantity, setQuantity] = useState<number>(1)
  const [notes, setNotes] = useState<string>('')
  const [showOtherToppings, setShowOtherToppings] = useState<boolean>(false)

  const [toppingsData, setToppingsData] = useState<Topping[]>([])

  // Init state saat product berubah
  useEffect(() => {
    if (product) {
      setSelectedFlavor(product.flavorName)
      const defaultType =
        ['Kembung', 'Lumpia', 'Krispy'].find((t) => {
          if (t === 'Kembung') return product.priceKembung > 0
          if (t === 'Lumpia') return product.priceLumpia > 0
          if (t === 'Krispy') return product.priceKrispy > 0
          return false
        }) || 'Kembung'
      setSelectedType(defaultType)
      setQuantity(1)
      if (toppingsData.length > 0) {
        setSelectedToppings([toppingsData[0].id])
      } else {
        setSelectedToppings([])
      }
      setNotes('')
      setShowOtherToppings(false)
    }
  }, [product, toppingsData])

  // Fetch toppings
  useEffect(() => {
    fetch('/api/toppings')
      .then(async (res) => {
        if (!res.ok) return { success: false, data: [] }
        return res.json().catch(() => ({ success: false, data: [] }))
      })
      .then((res) => {
        if (res.success && Array.isArray(res.data)) {
          const activeToppings = res.data.filter((top: Topping) => top.isActive)
          setToppingsData(activeToppings)
          if (activeToppings.length > 0 && selectedToppings.length === 0) {
            setSelectedToppings([activeToppings[0].id])
          }
        }
      })
      .catch((err) => console.error('Failed to fetch toppings', err))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const availableFlavors = useMemo(() => {
    return Array.from(new Set(allProducts.map((p) => p.flavorName)))
  }, [allProducts])

  const matchedProduct = useMemo(() => {
    if (!selectedFlavor) return null
    return (
      allProducts.find((p) => p.flavorName.toLowerCase() === selectedFlavor.toLowerCase()) || null
    )
  }, [selectedFlavor, allProducts])

  if (!product) return null

  // The currently-displayed product (live-selected flavor, falls back to the
  // originally-clicked card) — used by both pricing logic below and the new
  // image-hero/stat-row section.
  const displayProduct = matchedProduct || product
  const heroImage = displayProduct.imageUrl || getFallbackImage(displayProduct.flavorName)

  // Logika Harga
  const getProductPrice = (p: ProductType | null, type: string) => {
    if (!p) return 0
    if (type === 'Kembung')
      return isReseller && p.wholesaleKembung > 0 ? p.wholesaleKembung : p.priceKembung
    if (type === 'Lumpia')
      return isReseller && p.wholesaleLumpia > 0 ? p.wholesaleLumpia : p.priceLumpia
    if (type === 'Krispy')
      return isReseller && p.wholesaleKrispy > 0 ? p.wholesaleKrispy : p.priceKrispy
    return isReseller && p.wholesaleKembung > 0 ? p.wholesaleKembung : p.priceKembung
  }

  const basePrice = getProductPrice(matchedProduct || product, selectedType)
  const toppingsPrice = selectedToppings.reduce((total, tId) => {
    const topping = toppingsData.find((t) => t.id === tId)
    return total + (topping?.price || 0)
  }, 0)

  const unitPrice = basePrice + toppingsPrice
  const totalPrice = unitPrice * quantity

  const formatPrice = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0
    }).format(amount)
  }

  // RAG Source:
  // src/features/checkout/schemas.ts
  // Enforce the maximum limit of 5 toppings per product
  const handleToppingToggle = (toppingId: string) => {
    setSelectedToppings((prev) => {
      if (prev.includes(toppingId)) {
        return prev.filter((id) => id !== toppingId)
      }
      if (prev.length >= 5) {
        toast.error('Maksimal 5 topping per porsi.', {
          style: {
            background: '#ef4444',
            color: '#fff',
            borderRadius: '16px'
          }
        })
        return prev
      }
      return [...prev, toppingId]
    })
  }

  const isFormValid = !!selectedType && !!selectedFlavor

  const handleAddToCart = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (!isFormValid || !isStoreOpen) return

    const finalToppings: CartTopping[] = selectedToppings
      .map((tId) => toppingsData.find((t) => t.id === tId))
      .filter((t): t is Topping => t !== undefined)
      .map((t) => ({
        toppingId: t.id,
        name: t.name,
        priceAdd: t.price
      }))

    const finalProductId = matchedProduct ? matchedProduct.id : product.id
    const finalProductName = `${selectedFlavor} (${selectedType})`

    animateFlyToCart(e.currentTarget)

    addToCart({
      menuVariantId: finalProductId,
      variantName: finalProductName,
      basePrice: basePrice,
      toppings: finalToppings,
      quantity,
      notes,
      stock: displayProduct.stock
    })

    toast.success(t('toast_added'), {
      style: {
        background: 'var(--primary-custom)',
        color: '#fff',
        borderRadius: '16px'
      }
    })
    onClose()
  }

  const dynamicTitle =
    selectedFlavor && selectedType ? `${selectedFlavor} (${selectedType})` : product.flavorName

  return (
    <Drawer.Root
      open={!!product}
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
      shouldScaleBackground={false}
    >
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-50 bg-black/40 backdrop-blur-[2px] animate-fade-in" />
        <Drawer.Content className="fixed inset-x-0 bottom-0 z-50 flex flex-col w-full max-w-lg mx-auto h-[88vh] md:h-auto md:max-h-[90vh] md:top-0 md:bottom-0 md:my-auto md:!transform-none bg-white dark:bg-zinc-900 rounded-t-3xl md:rounded-[4px] overflow-hidden outline-none shadow-[0_-10px_40px_rgba(0,0,0,0.15)] md:animate-in md:fade-in md:zoom-in-95">
          {/* RAG Source: vaul library (Drawer.Handle)
              FIX: The previous implementation was a purely cosmetic div with no drag event
              listeners. vaul's <Drawer.Handle /> wires the correct touch/pointer events for
              actual bottom-sheet dragging on mobile. */}
          <Drawer.Handle className="md:hidden absolute left-1/2 -translate-x-1/2 top-2 z-20 h-1.5 w-12 flex-shrink-0 rounded-full bg-white/70" />

          {/* Header: image hero + overlay icon buttons (back/favorite) + name + stat row */}
          <div className="shrink-0">
            <div className="relative w-full aspect-[4/3] bg-zinc-100 dark:bg-zinc-800">
              <Image
                src={heroImage}
                alt={displayProduct.flavorName}
                fill
                sizes="(max-width: 640px) 512px, 512px"
                quality={75}
                className="object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/35 via-transparent to-black/10" />

              <button
                onClick={onClose}
                className="absolute top-4 left-4 z-10 w-10 h-10 rounded-full flex items-center justify-center bg-white/85 backdrop-blur-md shadow-sm hover:scale-105 active:scale-95 transition-all text-zinc-700"
                aria-label="Tutup, kembali ke menu"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2.5}
                    d="M15 19l-7-7 7-7"
                  />
                </svg>
              </button>

              {onToggleFavorite && (
                <button
                  onClick={(e) => onToggleFavorite(e, displayProduct.id)}
                  className="absolute top-4 right-4 z-10 w-10 h-10 rounded-full flex items-center justify-center bg-white/85 backdrop-blur-md shadow-sm hover:scale-105 active:scale-95 transition-all"
                  aria-label="Toggle Favorite"
                >
                  <svg
                    className={`w-5 h-5 transition-colors ${isFavorite ? 'text-red-500 fill-current' : 'text-zinc-600'}`}
                    fill={isFavorite ? 'currentColor' : 'none'}
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={isFavorite ? 0 : 2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
                    />
                  </svg>
                </button>
              )}
            </div>

            <Drawer.Description className="sr-only">
              Sesuaikan opsi untuk {dynamicTitle}
            </Drawer.Description>
            <Drawer.Title className="font-serif font-bold text-2xl text-center text-zinc-900 dark:text-zinc-100 pt-4 px-6">
              {selectedFlavor || product.flavorName}
            </Drawer.Title>

            {matchedProduct && matchedProduct.stock <= 5 && matchedProduct.stock > 0 && (
              <div className="flex items-center justify-center gap-1.5 mt-1.5 animate-shake infinite [animation-duration:1.5s]">
                <span className="w-2 h-2 rounded-[4px] bg-amber-500 animate-pulse" />
                <span className="text-xs font-bold text-amber-600 dark:text-amber-400">
                  ⚠️ Stok Terbatas: Sisa {matchedProduct.stock} porsi!
                </span>
              </div>
            )}

            {/* Stat row — real data only. Reference shows calories/prep-time/weight,
                none of which exist in our schema; substituted with soldCount, stock,
                rating, and the live-selected type instead of fabricating numbers. */}
            <div className="flex items-center justify-center gap-5 px-6 py-4 border-b border-zinc-100 dark:border-zinc-800">
              <div className="flex flex-col items-center gap-0.5">
                <span className="text-base">🔥</span>
                <span className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
                  {displayProduct.soldCount && displayProduct.soldCount >= 1000
                    ? `${(displayProduct.soldCount / 1000).toFixed(1)}k+`
                    : (displayProduct.soldCount ?? 0)}
                </span>
                <span className="text-[10px] text-zinc-400">Terjual</span>
              </div>
              <div className="w-px h-8 bg-zinc-200 dark:bg-zinc-700" />
              <div className="flex flex-col items-center gap-0.5">
                <span className="text-base">📦</span>
                <span className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
                  {displayProduct.stock}
                </span>
                <span className="text-[10px] text-zinc-400">Sisa Stok</span>
              </div>
              <div className="w-px h-8 bg-zinc-200 dark:bg-zinc-700" />
              <div className="flex flex-col items-center gap-0.5">
                <span className="text-base">⭐</span>
                <span className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
                  {displayProduct.rating ? displayProduct.rating : 'Baru'}
                </span>
                <span className="text-[10px] text-zinc-400">
                  {displayProduct.reviewCount ? `${displayProduct.reviewCount} Ulasan` : 'Rating'}
                </span>
              </div>
              <div className="w-px h-8 bg-zinc-200 dark:bg-zinc-700" />
              <div className="flex flex-col items-center gap-0.5">
                <span className="text-base">{TYPE_EMOJI[selectedType] ?? '🍌'}</span>
                <span className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
                  {selectedType || '—'}
                </span>
                <span className="text-[10px] text-zinc-400">Tipe Dipilih</span>
              </div>
            </div>
          </div>

          {/* Body (Bisa di-Scroll) */}
          <div className="flex-1 overflow-y-auto p-6 bg-zinc-50 dark:bg-zinc-900/50 overscroll-contain [-webkit-overflow-scrolling:touch]">
            {/* Description — reuses the exact same copy source as the menu grid card,
                so the text customers see here matches what they saw before opening */}
            <div className="mb-8">
              <h4 className="font-bold text-zinc-800 dark:text-zinc-100 text-lg mb-2">Deskripsi</h4>
              <p className="text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
                {displayProduct.deskripsi_topping ||
                  (() => {
                    const key = getFlavorDescriptionKey(displayProduct.flavorName)
                    return key ? t(key) : t('menu_default_desc')
                  })()}
              </p>
            </div>

            {/* Section Tipe (Grid 3 kolom) */}
            <div className="mb-8">
              <div className="flex justify-between items-end mb-3">
                <h4 className="font-bold text-zinc-800 dark:text-zinc-100 text-lg">
                  Pilih Tipe <span className="text-red-500">*</span>
                </h4>
              </div>
              <div className="grid grid-cols-3 gap-3">
                {AVAILABLE_TYPES.map((type) => {
                  const isSelected = selectedType === type
                  const isTypeDisabled = (() => {
                    const p = displayProduct
                    if (!p) return true
                    if (type === 'Kembung') return p.priceKembung <= 0
                    if (type === 'Lumpia') return p.priceLumpia <= 0
                    if (type === 'Krispy') return p.priceKrispy <= 0
                    return false
                  })()

                  return (
                    <button
                      key={type}
                      type="button"
                      disabled={isTypeDisabled}
                      onClick={() => !isTypeDisabled && setSelectedType(type)}
                      className={`py-2.5 px-2 rounded-[4px] border-2 text-sm font-bold transition-all ${
                        isSelected
                          ? 'border-[#D4802A] bg-[#D4802A]/10 text-[#D4802A]'
                          : isTypeDisabled
                            ? 'border-zinc-100 dark:border-zinc-800 text-zinc-300 dark:text-zinc-700 cursor-not-allowed opacity-50 bg-zinc-50 dark:bg-zinc-800/20'
                            : 'border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:border-zinc-300'
                      }`}
                    >
                      {type}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Section Topping (Social Proof by Default) */}
            {toppingsData.length > 0 && (
              <div className="mb-8">
                <div className="mb-3">
                  <h4 className="font-bold text-zinc-800 dark:text-zinc-100 text-lg">
                    Topping Rekomendasi
                  </h4>
                </div>
                <div className="grid grid-cols-1 gap-3 mb-4">
                  {toppingsData.slice(0, 1).map((topping) => {
                    const isSelected = selectedToppings.includes(topping.id)
                    return (
                      <label
                        key={topping.id}
                        className={`flex flex-col p-3.5 min-h-[44px] min-w-[44px] border-2 rounded-[4px] cursor-pointer transition-all select-none active:scale-[0.97] ${
                          isSelected
                            ? 'border-[#D4802A] bg-[#D4802A]/5'
                            : 'border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800/50'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 mb-1">
                          <input
                            type="checkbox"
                            name="topping"
                            checked={isSelected}
                            onChange={() => handleToppingToggle(topping.id)}
                            className="accent-[#D4802A] w-5 h-5 rounded-[4px] cursor-pointer shrink-0"
                          />
                          <span className="text-sm font-bold text-zinc-800 dark:text-zinc-200 truncate flex items-center gap-1.5">
                            ⭐ {topping.emoji} {topping.name}{' '}
                            <span className="text-xs text-zinc-500 font-normal hidden sm:inline">
                              (Paling Populer)
                            </span>
                          </span>
                        </div>
                        <span className="text-xs font-bold text-green-600 dark:text-green-400 pl-[30px]">
                          +{formatPrice(topping.price)}
                        </span>
                      </label>
                    )
                  })}
                </div>

                {toppingsData.length > 1 && (
                  <div>
                    <button
                      onClick={() => setShowOtherToppings(!showOtherToppings)}
                      className="flex items-center gap-2 text-sm font-bold text-zinc-500 dark:text-zinc-400 mb-3 hover:text-[#D4802A] transition-colors focus:outline-none"
                    >
                      Topping Lainnya{' '}
                      <span className="text-[10px]">{showOtherToppings ? '▲' : '▼'}</span>
                    </button>
                    {showOtherToppings && (
                      <div className="grid grid-cols-2 gap-3">
                        {toppingsData.slice(1).map((topping) => {
                          const isSelected = selectedToppings.includes(topping.id)
                          return (
                            <label
                              key={topping.id}
                              className={`flex flex-col p-3.5 min-h-[44px] min-w-[44px] border-2 rounded-[4px] cursor-pointer transition-all select-none active:scale-[0.97] ${
                                isSelected
                                  ? 'border-[#D4802A] bg-[#D4802A]/5'
                                  : 'border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800/50'
                              }`}
                            >
                              <div className="flex items-center gap-2.5 mb-1">
                                <input
                                  type="checkbox"
                                  name="topping"
                                  checked={isSelected}
                                  onChange={() => handleToppingToggle(topping.id)}
                                  className="accent-[#D4802A] w-5 h-5 rounded-[4px] cursor-pointer shrink-0"
                                />
                                <span className="text-sm font-bold text-zinc-800 dark:text-zinc-200 truncate">
                                  {topping.emoji} {topping.name}
                                </span>
                              </div>
                              <span className="text-xs font-bold text-green-600 dark:text-green-400 pl-[30px]">
                                +{formatPrice(topping.price)}
                              </span>
                            </label>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Catatan Khusus & Predefined Modifiers (Cognitive Load 12/100) */}
            <div className="mb-2">
              <h4 className="font-bold text-zinc-800 dark:text-zinc-100 text-lg mb-2">
                Catatan Khusus
              </h4>

              {/* Predefined Tags */}
              <div className="flex flex-wrap gap-2 mb-3">
                {['Garing', 'Pisah Topping', 'Sedikit Manis'].map((tag) => {
                  const isSelected = notes.includes(`[${tag}]`)
                  return (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => {
                        if (isSelected) {
                          setNotes(notes.replace(`[${tag}] `, '').replace(`[${tag}]`, '').trim())
                        } else {
                          setNotes((prev) => (prev ? `${prev} [${tag}]` : `[${tag}]`).trim())
                        }
                      }}
                      className={`px-3 py-1.5 rounded-[4px] text-xs font-bold border transition-colors ${
                        isSelected
                          ? 'bg-[#D4802A]/10 text-[#D4802A] border-[#D4802A]'
                          : 'bg-white dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700 hover:border-[#D4802A]/50'
                      }`}
                    >
                      {isSelected ? '✓ ' : '+ '}
                      {tag}
                    </button>
                  )
                })}
              </div>

              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Tambahan khusus lainnya (opsional)..."
                className="w-full p-4 border-2 border-zinc-200 dark:border-zinc-800 rounded-[4px] text-sm bg-white dark:bg-zinc-900 text-zinc-800 dark:text-zinc-200 focus:outline-none focus:border-[#D4802A] transition-colors min-h-[80px]"
              />
            </div>
          </div>

          {/* Footer (Sticky Bottom) */}
          <div className="p-4 shrink-0 bg-white dark:bg-zinc-900 border-t border-zinc-200 dark:border-zinc-800 flex items-center justify-between gap-4 w-full shadow-[0_-4px_15px_rgba(0,0,0,0.05)]">
            {/* Kontrol Kuantitas */}
            <div className="flex items-center gap-3 bg-zinc-100 dark:bg-zinc-800 rounded-[4px] p-1 border border-zinc-200 dark:border-zinc-700">
              <button
                type="button"
                onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                className="w-10 h-10 rounded-[4px] bg-white dark:bg-zinc-700 shadow-sm flex items-center justify-center font-bold text-zinc-600 dark:text-zinc-300 hover:text-[#D4802A] transition-colors active:scale-95"
              >
                -
              </button>
              <motion.span
                key={quantity}
                initial={{ scaleY: 1.35, scaleX: 0.75 }}
                animate={{ scaleY: 1, scaleX: 1 }}
                transition={{ type: 'spring', stiffness: 500, damping: 15 }}
                className="w-6 text-center font-bold text-zinc-800 dark:text-zinc-100 text-lg inline-block"
              >
                {quantity}
              </motion.span>
              <button
                type="button"
                onClick={() => {
                  if (quantity >= displayProduct.stock) {
                    toast.error(t('cart_toast_qty_limit') || 'Stok terbatas!')
                  } else {
                    setQuantity((q) => q + 1)
                  }
                }}
                className="w-10 h-10 rounded-[4px] bg-white dark:bg-zinc-700 shadow-sm flex items-center justify-center font-bold text-zinc-600 dark:text-zinc-300 hover:text-[#D4802A] transition-colors active:scale-95"
              >
                +
              </button>
            </div>

            {/* Tombol Add to Cart */}
            <button
              onClick={(e) => handleAddToCart(e)}
              disabled={!isFormValid || !isStoreOpen}
              className={`flex-1 py-3.5 px-4 rounded-[4px] font-bold text-sm transition-all duration-200 shadow-md flex items-center justify-center gap-2 ${
                isFormValid && isStoreOpen
                  ? 'bg-[#D4802A] hover:bg-[#b56d24] text-white active:scale-95 shadow-[#D4802A]/30'
                  : 'bg-zinc-300 dark:bg-zinc-800 text-zinc-500 cursor-not-allowed shadow-none'
              }`}
            >
              {!isStoreOpen ? (
                <>Toko Sedang Tutup</>
              ) : isFormValid ? (
                <>Tambah • {formatPrice(totalPrice)}</>
              ) : (
                <>Pilih Tipe & Rasa</>
              )}
            </button>
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  )
}
