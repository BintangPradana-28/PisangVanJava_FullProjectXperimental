'use client'

import { motion } from 'framer-motion'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import type React from 'react'
import { useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { Drawer } from 'vaul'
import { useLanguage } from '@/context/LanguageContext'
import { useSettings } from '@/context/SettingsContext'
import type { ProductType } from '@/src/features/menu/components/MenuCards'
import { animateFlyToCart } from '@/src/lib/animations'
import { isStoreOpen as checkStoreOpen } from '@/src/lib/time'
import { type CartTopping, useCartStore } from '@/src/stores/cart.store'

interface QuickViewModalProps {
  product: ProductType | null
  allProducts?: ProductType[]
  onClose: () => void
}

interface Topping {
  id: string
  name: string
  price: number
  emoji: string | null
  isActive: boolean
}

const AVAILABLE_TYPES = ['Kembung', 'Lumpia', 'Krispy']

export default function QuickViewModal({
  product,
  allProducts = [],
  onClose
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
      setSelectedType(AVAILABLE_TYPES[0])
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

  const handleToppingToggle = (toppingId: string) => {
    setSelectedToppings((prev) =>
      prev.includes(toppingId) ? prev.filter((id) => id !== toppingId) : [...prev, toppingId]
    )
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
      notes
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
        <Drawer.Content className="fixed inset-x-0 bottom-0 z-50 flex flex-col w-full max-w-lg mx-auto h-[70vh] md:h-auto md:max-h-[85vh] md:top-0 md:bottom-0 md:my-auto md:!transform-none bg-white dark:bg-zinc-900 rounded-t-3xl md:rounded-[4px] overflow-hidden outline-none shadow-[0_-10px_40px_rgba(0,0,0,0.15)] md:animate-in md:fade-in md:zoom-in-95">
          {/* RAG Source: vaul library (Drawer.Handle)
              FIX: The previous implementation was a purely cosmetic div with no drag event
              listeners. vaul's <Drawer.Handle /> wires the correct touch/pointer events for
              actual bottom-sheet dragging on mobile. */}
          <Drawer.Handle className="md:hidden mx-auto mt-3 mb-2 h-1.5 w-12 flex-shrink-0 rounded-full bg-zinc-300 dark:bg-zinc-600" />

          {/* Header Modal (Text Only - 60% viewport design) */}
          <div className="px-6 pb-4 pt-1 flex justify-between items-start border-b border-zinc-100 dark:border-zinc-800 shrink-0">
            <div>
              <Drawer.Title className="font-serif font-bold text-xl text-zinc-900 dark:text-zinc-100 leading-tight mb-1">
                {dynamicTitle}
              </Drawer.Title>
              <Drawer.Description className="sr-only">
                Sesuaikan opsi untuk {dynamicTitle}
              </Drawer.Description>
              <div className="flex flex-wrap items-center gap-3">
                <p className="text-[#D4802A] font-bold text-lg">{formatPrice(basePrice)}</p>
                {matchedProduct && matchedProduct.stock <= 5 && matchedProduct.stock > 0 && (
                  <div className="flex items-center gap-1.5 animate-shake infinite [animation-duration:1.5s]">
                    <span className="w-2 h-2 rounded-[4px] bg-amber-500 animate-pulse"></span>
                    <span className="text-xs font-bold text-amber-600 dark:text-amber-400">
                      ⚠️ Stok Terbatas: Sisa {matchedProduct.stock} porsi!
                    </span>
                  </div>
                )}
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-[4px] bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 text-zinc-600 dark:text-zinc-300 flex items-center justify-center transition-colors focus:outline-none shrink-0 ml-4 mt-1"
              aria-label="Tutup modal"
            >
              ✕
            </button>
          </div>

          {/* Body (Bisa di-Scroll) */}
          <div className="flex-1 overflow-y-auto p-6 bg-zinc-50 dark:bg-zinc-900/50 overscroll-contain [-webkit-overflow-scrolling:touch]">
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
                  return (
                    <button
                      key={type}
                      onClick={() => setSelectedType(type)}
                      className={`py-2.5 px-2 rounded-[4px] border-2 text-sm font-bold transition-all ${
                        isSelected
                          ? 'border-[#D4802A] bg-[#D4802A]/10 text-[#D4802A]'
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
                onClick={() => setQuantity((q) => q + 1)}
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
