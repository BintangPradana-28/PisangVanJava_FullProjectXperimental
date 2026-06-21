'use client'

import { motion } from 'framer-motion'
import { ArrowLeft, Clock, Info, ShoppingBag, Star } from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import type React from 'react'
import { useEffect, useMemo, useState } from 'react'
import toast, { Toaster } from 'react-hot-toast'
import { useLanguage } from '@/context/LanguageContext'
import { useSettings } from '@/context/SettingsContext'
import { type CartTopping, useCartStore } from '@/src/features/cart/stores/cart.store'
import type { ProductType } from '@/src/features/menu/components/MenuCards'
import { animateFlyToCart } from '@/src/lib/animations'
import { isStoreOpen as checkStoreOpen } from '@/src/lib/time'

interface Topping {
  id: string
  name: string
  price: number
  emoji: string | null
  isActive: boolean
}

interface ReviewType {
  id: string
  rating: number
  comment: string | null
  imageUrl: string | null
  createdAt: Date | string
  isVerifiedBuyer: boolean
  user: {
    name: string
  }
}

interface ProductDetailClientProps {
  product: ProductType
  otherProducts: ProductType[]
  toppings: Topping[]
  reviews: ReviewType[]
}

const AVAILABLE_TYPES = ['Kembung', 'Lumpia', 'Krispy']

const TAG_ICONS: Record<string, string> = {
  Baru: '✨',
  'Best Seller': '🏆',
  Premium: '👑',
  Rekomendasi: '💎',
  Manis: '🍯',
  Gurih: '🧂'
}

const getFallbackImage = (name: string) => {
  const n = name.toLowerCase()
  if (n.includes('matcha')) return '/images/flavors/matcha.png'
  if (n.includes('taro')) return '/images/flavors/taro.png'
  if (n.includes('blueberry') || n.includes('bluberi')) return '/images/flavors/blueberry.png'
  if (n.includes('strawberry') || n.includes('stroberi')) return '/images/flavors/strawberry.png'
  if (n.includes('cokelat') || n.includes('coklat')) return '/images/flavors/blueberry.png'
  if (n.includes('keju')) return '/images/flavors/strawberry.png'
  return '/kitchen.png'
}

export default function ProductDetailClient({
  product,
  otherProducts,
  toppings,
  reviews
}: ProductDetailClientProps) {
  const addToCart = useCartStore((s) => s.addItem)
  const { t } = useLanguage()
  const { getSetting } = useSettings()
  const router = useRouter()
  const { data: session } = useSession()
  const isReseller = session?.user?.role === 'RESELLER'

  const jamOperasional = getSetting('jam_operasional', '10.00–21.00')
  const storeMode = getSetting('store_status', 'AUTO')
  const { isOpen: isStoreOpen } = checkStoreOpen(jamOperasional, storeMode)

  // Initialize selected type to first type with price > 0
  const initialType = useMemo(() => {
    if (product.priceKembung > 0) return 'Kembung'
    if (product.priceLumpia > 0) return 'Lumpia'
    if (product.priceKrispy > 0) return 'Krispy'
    return 'Kembung'
  }, [product])

  const [selectedType, setSelectedType] = useState<string>(initialType)
  const [selectedToppings, setSelectedToppings] = useState<string[]>([])
  const [quantity, setQuantity] = useState<number>(1)
  const [notes, setNotes] = useState<string>('')
  const [showOtherToppings, setShowOtherToppings] = useState<boolean>(false)

  // Default select first topping if active exists
  useEffect(() => {
    if (toppings.length > 0 && selectedToppings.length === 0) {
      setSelectedToppings([toppings[0].id])
    }
  }, [toppings, selectedToppings])

  const getProductPrice = (p: ProductType, type: string) => {
    if (type === 'Kembung')
      return isReseller && p.wholesaleKembung > 0 ? p.wholesaleKembung : p.priceKembung
    if (type === 'Lumpia')
      return isReseller && p.wholesaleLumpia > 0 ? p.wholesaleLumpia : p.priceLumpia
    if (type === 'Krispy')
      return isReseller && p.wholesaleKrispy > 0 ? p.wholesaleKrispy : p.priceKrispy
    return isReseller && p.wholesaleKembung > 0 ? p.wholesaleKembung : p.priceKembung
  }

  const basePrice = getProductPrice(product, selectedType)
  const toppingsPrice = selectedToppings.reduce((total, tId) => {
    const topping = toppings.find((t) => t.id === tId)
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
    setSelectedToppings((prev) => {
      if (prev.includes(toppingId)) {
        return prev.filter((id) => id !== toppingId)
      }
      if (prev.length >= 5) {
        toast.error('Maksimal 5 topping per porsi.', {
          style: {
            background: '#ef4444',
            color: '#fff',
            borderRadius: '4px'
          }
        })
        return prev
      }
      return [...prev, toppingId]
    })
  }

  const handleAddToCart = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (!selectedType || !isStoreOpen || product.stock <= 0) return

    const finalToppings: CartTopping[] = selectedToppings
      .map((tId) => toppings.find((t) => t.id === tId))
      .filter((t): t is Topping => t !== undefined)
      .map((t) => ({
        toppingId: t.id,
        name: t.name,
        priceAdd: t.price
      }))

    const finalProductName = `${product.flavorName} (${selectedType})`

    animateFlyToCart(e.currentTarget)

    addToCart({
      menuVariantId: product.id,
      variantName: finalProductName,
      basePrice: basePrice,
      toppings: finalToppings,
      quantity,
      notes
    })

    toast.success(t('toast_added') || 'Berhasil ditambahkan ke keranjang!', {
      style: {
        background: 'var(--primary-custom, #32170d)',
        color: '#fff',
        borderRadius: '4px'
      }
    })
  }

  const available = product.isAvailable && product.stock > 0
  const averageRating = useMemo(() => {
    if (reviews.length === 0) return 0
    return Math.round((reviews.reduce((acc, r) => acc + r.rating, 0) / reviews.length) * 10) / 10
  }, [reviews])

  return (
    <div className="max-w-[1200px] mx-auto px-6 py-8">
      <Toaster position="top-center" toastOptions={{ className: '!rounded-[4px] !text-sm' }} />

      {/* Back Button */}
      <button
        type="button"
        onClick={() => router.push('/menu-spesial')}
        className="inline-flex items-center gap-2 text-zinc-500 hover:text-amber-brand font-bold text-sm mb-8 transition-colors active:scale-95"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Kembali ke Menu</span>
      </button>

      {/* Main Grid */}
      <div className="grid lg:grid-cols-2 gap-12 items-start mb-16">
        {/* Left Column: Image Card */}
        <div className="space-y-6">
          <div className="relative aspect-[4/3] rounded-[4px] overflow-hidden border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-md group">
            <Image
              src={product.imageUrl || getFallbackImage(product.flavorName)}
              alt={product.flavorName}
              fill
              sizes="(max-width: 1024px) 100vw, 550px;"
              priority
              className="object-cover group-hover:scale-105 transition-transform duration-500"
            />
            {/* Tag Overlay */}
            {product.tags && product.tags.length > 0 && (
              <div className="absolute top-4 left-4 flex flex-wrap gap-2 z-10">
                {product.tags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1 text-[10px] font-bold px-3 py-1 rounded-[4px] backdrop-blur-md bg-white/90 dark:bg-zinc-900/90 text-amber-brand border border-amber-brand/30 shadow-sm"
                  >
                    <span>{TAG_ICONS[tag] ?? '🏷️'}</span>
                    {tag}
                  </span>
                ))}
              </div>
            )}
            {/* Stock Overlay */}
            {!available && (
              <div className="absolute inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center">
                <span className="bg-red-600 text-white font-bold text-lg px-6 py-2 rounded-[4px] shadow-lg">
                  Habis Terjual
                </span>
              </div>
            )}
          </div>

          {/* Cooking process card */}
          <div className="rounded-[4px] p-5 bg-cream-50 dark:bg-zinc-900/50 border border-cream-200/50 dark:border-zinc-800 flex gap-4 items-start shadow-sm">
            <div className="p-3 bg-amber-brand/10 text-amber-brand rounded-[4px]">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-serif font-bold text-sm text-zinc-900 dark:text-zinc-100 mb-1">
                Dibuat Segar Setiap Hari
              </h4>
              <p className="text-xs text-zinc-500 leading-relaxed">
                Setiap porsi pisang goreng disiapkan panas dan renyah sesuai pesanan Anda,
                menggunakan bahan-bahan terbaik dari petani lokal.
              </p>
            </div>
          </div>
        </div>

        {/* Right Column: Configurations */}
        <div className="space-y-8">
          <div>
            <h1 className="font-serif text-4xl sm:text-5xl font-bold text-zinc-900 dark:text-zinc-150 mb-2">
              {product.flavorName}
            </h1>
            <div className="flex flex-wrap items-center gap-4 text-sm text-zinc-500">
              {reviews.length > 0 && (
                <div className="flex items-center gap-1 text-zinc-700 dark:text-zinc-350">
                  <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
                  <span className="font-bold">{averageRating.toFixed(1)}</span>
                  <span>({reviews.length} Ulasan)</span>
                </div>
              )}
              {product.soldCount !== undefined && product.soldCount > 0 && (
                <div className="flex items-center gap-1.5 bg-zinc-100 dark:bg-zinc-800 px-2.5 py-1 rounded-[4px]">
                  <span className="text-orange-500">🔥</span>
                  <span className="font-medium text-zinc-700 dark:text-zinc-300">
                    {product.soldCount} Terjual
                  </span>
                </div>
              )}
              <div className="flex items-center gap-1.5 text-zinc-500">
                <span
                  className={`w-2 h-2 rounded-[4px] ${product.stock > 0 ? 'bg-green-500' : 'bg-red-500'}`}
                />
                <span>Stok: {product.stock} porsi</span>
              </div>
            </div>
          </div>

          <div className="p-6 rounded-[4px] bg-cream-50 dark:bg-zinc-900 border border-cream-200/50 dark:border-zinc-800 shadow-sm space-y-6">
            {/* Price display */}
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 block mb-1">
                {isReseller ? 'Harga Grosir (Mulai)' : 'Harga Per Porsi'}
              </span>
              <div className="text-3xl font-bold text-amber-brand">{formatPrice(basePrice)}</div>
            </div>

            {/* Base Type Selector */}
            <div>
              <h4 className="font-bold text-zinc-800 dark:text-zinc-200 text-sm mb-3">
                Pilih Tipe Pisang <span className="text-red-500">*</span>
              </h4>
              <div className="grid grid-cols-3 gap-3">
                {AVAILABLE_TYPES.map((type) => {
                  const isSelected = selectedType === type
                  // Get price of this type
                  let typePrice = 0
                  if (type === 'Kembung') typePrice = product.priceKembung
                  if (type === 'Lumpia') typePrice = product.priceLumpia
                  if (type === 'Krispy') typePrice = product.priceKrispy

                  const isTypeAvailable = typePrice > 0

                  return (
                    <button
                      key={type}
                      type="button"
                      disabled={!isTypeAvailable}
                      onClick={() => setSelectedType(type)}
                      className={`py-3 px-2 rounded-[4px] border-2 text-sm font-bold transition-all flex flex-col items-center gap-0.5 ${
                        isSelected
                          ? 'border-amber-brand bg-amber-brand/10 text-amber-brand'
                          : isTypeAvailable
                            ? 'border-zinc-200 dark:border-zinc-850 text-zinc-650 dark:text-zinc-400 hover:border-zinc-300'
                            : 'border-zinc-100 dark:border-zinc-900 text-zinc-400 dark:text-zinc-600 bg-zinc-100/50 dark:bg-zinc-900/30 cursor-not-allowed'
                      }`}
                    >
                      <span>{type}</span>
                      {isTypeAvailable && (
                        <span className="text-[10px] font-normal opacity-80">
                          {formatPrice(getProductPrice(product, type))}
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Toppings Selector */}
            {toppings.length > 0 && (
              <div>
                <h4 className="font-bold text-zinc-800 dark:text-zinc-200 text-sm mb-3">
                  Pilih Topping Tambahan (Maksimal 5)
                </h4>
                <div className="grid grid-cols-1 gap-2.5 mb-4">
                  {toppings.slice(0, 2).map((topping) => {
                    const isSelected = selectedToppings.includes(topping.id)
                    return (
                      <label
                        key={topping.id}
                        className={`flex items-center justify-between p-3.5 border-2 rounded-[4px] cursor-pointer transition-all select-none active:scale-[0.99] ${
                          isSelected
                            ? 'border-amber-brand bg-amber-brand/5'
                            : 'border-zinc-200 dark:border-zinc-850 hover:bg-zinc-100/50 dark:hover:bg-zinc-850/50'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => handleToppingToggle(topping.id)}
                            className="accent-amber-brand w-5 h-5 rounded-[4px] cursor-pointer shrink-0"
                          />
                          <span className="text-sm font-bold text-zinc-800 dark:text-zinc-200">
                            {topping.emoji} {topping.name}
                          </span>
                        </div>
                        <span className="text-xs font-bold text-green-600 dark:text-green-400">
                          +{formatPrice(topping.price)}
                        </span>
                      </label>
                    )
                  })}
                </div>

                {toppings.length > 2 && (
                  <div>
                    <button
                      type="button"
                      onClick={() => setShowOtherToppings(!showOtherToppings)}
                      className="flex items-center gap-2 text-xs font-bold text-zinc-500 dark:text-zinc-400 mb-3 hover:text-amber-brand transition-colors focus:outline-none"
                    >
                      <span>{showOtherToppings ? 'Sembunyikan' : 'Tampilkan'} Topping Lainnya</span>
                      <span className="text-[9px]">{showOtherToppings ? '▲' : '▼'}</span>
                    </button>
                    {showOtherToppings && (
                      <div className="grid sm:grid-cols-2 gap-3 animate-fade-in">
                        {toppings.slice(2).map((topping) => {
                          const isSelected = selectedToppings.includes(topping.id)
                          return (
                            <label
                              key={topping.id}
                              className={`flex flex-col justify-between p-3 border-2 rounded-[4px] cursor-pointer transition-all select-none active:scale-[0.99] ${
                                isSelected
                                  ? 'border-amber-brand bg-amber-brand/5'
                                  : 'border-zinc-200 dark:border-zinc-850 hover:bg-zinc-100/50 dark:hover:bg-zinc-850/50'
                              }`}
                            >
                              <div className="flex items-center gap-2.5 mb-1.5">
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={() => handleToppingToggle(topping.id)}
                                  className="accent-amber-brand w-4 h-4 rounded-[4px] cursor-pointer shrink-0"
                                />
                                <span className="text-sm font-bold text-zinc-800 dark:text-zinc-200 truncate">
                                  {topping.emoji} {topping.name}
                                </span>
                              </div>
                              <span className="text-xs font-bold text-green-600 dark:text-green-400 pl-[26px]">
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

            {/* Special Notes */}
            <div className="space-y-3">
              <h4 className="font-bold text-zinc-800 dark:text-zinc-200 text-sm">Catatan Khusus</h4>
              <div className="flex flex-wrap gap-2">
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
                          ? 'bg-amber-brand/10 text-amber-brand border-amber-brand'
                          : 'bg-white dark:bg-zinc-850 text-zinc-650 dark:text-zinc-450 border-zinc-200 dark:border-zinc-800 hover:border-amber-brand/50'
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
                placeholder="Tambahan catatan untuk dapur (misal: kurangi susu)..."
                className="w-full p-4 border-2 border-zinc-200 dark:border-zinc-800 rounded-[4px] text-sm bg-white dark:bg-zinc-950 text-zinc-800 dark:text-zinc-200 focus:outline-none focus:border-amber-brand transition-colors min-h-[80px] resize-none"
              />
            </div>

            {/* Quantity and Actions */}
            <div className="flex flex-col sm:flex-row items-center gap-4 pt-4 border-t border-zinc-200 dark:border-zinc-800">
              {/* Quantity */}
              <div className="flex items-center gap-3 bg-zinc-100 dark:bg-zinc-800 rounded-[4px] p-1 border border-zinc-200 dark:border-zinc-750">
                <button
                  type="button"
                  onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                  className="w-10 h-10 rounded-[4px] bg-white dark:bg-zinc-700 shadow-sm flex items-center justify-center font-bold text-zinc-600 dark:text-zinc-300 hover:text-amber-brand transition-colors active:scale-95"
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
                  className="w-10 h-10 rounded-[4px] bg-white dark:bg-zinc-700 shadow-sm flex items-center justify-center font-bold text-zinc-600 dark:text-zinc-300 hover:text-amber-brand transition-colors active:scale-95"
                >
                  +
                </button>
              </div>

              {/* Add to Cart button */}
              <button
                type="button"
                onClick={handleAddToCart}
                disabled={!selectedType || !isStoreOpen || !available}
                className={`flex-1 w-full py-4 px-6 rounded-[4px] font-bold text-sm transition-all duration-200 shadow-md flex items-center justify-center gap-2 ${
                  selectedType && isStoreOpen && available
                    ? 'bg-amber-brand hover:bg-amber-brand/90 text-white active:scale-95 shadow-amber-brand/20'
                    : 'bg-zinc-300 dark:bg-zinc-800 text-zinc-500 cursor-not-allowed shadow-none'
                }`}
              >
                <ShoppingBag className="w-4 h-4" />
                {!isStoreOpen ? (
                  <>Toko Sedang Tutup</>
                ) : !available ? (
                  <>Habis Terjual</>
                ) : (
                  <>Tambah ke Keranjang • {formatPrice(totalPrice)}</>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Reviews Section */}
      <div className="border-t border-zinc-200 dark:border-zinc-800 pt-16 mb-16">
        <h2 className="font-serif text-3xl font-bold text-zinc-900 dark:text-zinc-150 mb-8">
          Ulasan Pelanggan ({reviews.length})
        </h2>
        {reviews.length === 0 ? (
          <div className="rounded-[4px] p-8 text-center bg-cream-50/50 dark:bg-zinc-900/30 border border-zinc-200/50 dark:border-zinc-800">
            <Info className="w-8 h-8 text-zinc-400 mx-auto mb-3" />
            <p className="text-zinc-500 text-sm">
              Varian ini belum memiliki ulasan dari pembeli. Jadilah yang pertama memberikan ulasan!
            </p>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 gap-6">
            {reviews.map((review) => (
              <div
                key={review.id}
                className="rounded-[4px] p-5 bg-white dark:bg-zinc-900 border border-zinc-250/60 dark:border-zinc-800 shadow-sm space-y-3"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="font-bold text-sm text-zinc-800 dark:text-zinc-200 truncate max-w-[150px]">
                      {review.user.name}
                    </h4>
                    <span className="text-[10px] text-zinc-500">
                      {new Date(review.createdAt).toLocaleDateString('id-ID', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                      })}
                    </span>
                  </div>
                  <div className="flex gap-0.5">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star
                        // biome-ignore lint/suspicious/noArrayIndexKey: Static array for stars rendering
                        key={i}
                        className={`w-3.5 h-3.5 ${i < review.rating ? 'fill-amber-400 text-amber-400' : 'text-zinc-200 dark:text-zinc-700'}`}
                      />
                    ))}
                  </div>
                </div>
                {review.isVerifiedBuyer && (
                  <span className="inline-flex text-[9px] font-semibold text-green-600 bg-green-500/10 px-1.5 py-0.5 rounded-[4px]">
                    Verified Buyer
                  </span>
                )}
                {review.comment && (
                  <p className="text-sm leading-relaxed text-zinc-650 dark:text-zinc-400 font-sans">
                    {review.comment}
                  </p>
                )}
                {review.imageUrl && (
                  <div className="relative w-20 h-20 rounded-[4px] overflow-hidden border border-zinc-200 dark:border-zinc-800 mt-2">
                    <Image src={review.imageUrl} alt="Foto Ulasan" fill className="object-cover" />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Recommendations Section */}
      {otherProducts.length > 0 && (
        <div className="border-t border-zinc-200 dark:border-zinc-800 pt-16">
          <h2 className="font-serif text-3xl font-bold text-zinc-900 dark:text-zinc-150 mb-8 text-center sm:text-left">
            Rekomendasi Varian Lain
          </h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {otherProducts.map((p) => {
              const image = p.imageUrl || getFallbackImage(p.flavorName)
              return (
                <Link
                  key={p.id}
                  href={`/menu-spesial/${p.id}`}
                  className="rounded-[4px] overflow-hidden bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 hover:shadow-md hover:-translate-y-1 transition-all duration-300 flex flex-col group"
                >
                  <div className="relative aspect-[16/9] w-full overflow-hidden bg-zinc-100 dark:bg-zinc-800">
                    <Image
                      src={image}
                      alt={p.flavorName}
                      fill
                      className="object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                  </div>
                  <div className="p-4 flex flex-col flex-grow justify-between gap-3">
                    <h3 className="font-serif font-bold text-lg text-zinc-950 dark:text-zinc-100 truncate group-hover:text-[#D4802A] transition-colors">
                      {p.flavorName}
                    </h3>
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-zinc-500 font-medium">Mulai dari</span>
                      <span className="font-bold text-sm text-[#D4802A]">
                        {formatPrice(
                          Math.min(
                            ...[p.priceKembung, p.priceLumpia, p.priceKrispy].filter((pr) => pr > 0)
                          )
                        )}
                      </span>
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
