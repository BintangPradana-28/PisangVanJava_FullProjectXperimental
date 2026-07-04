'use client'

import { AnimatePresence, motion } from 'framer-motion'
import { ArrowLeft, Minus, Plus, Trash2 } from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import Lottie from 'lottie-react'
import emptyCartAnimation from '@/public/animations/empty-cart.json'
import toast, { Toaster } from 'react-hot-toast'
import { useLanguage } from '@/context/LanguageContext'
import { useSettings } from '@/context/SettingsContext'
import {
  selectCartItemCount,
  selectCartItems,
  selectCartDisplayTotal as selectCartTotal,
  selectItemSubtotal,
  useCartStore
} from '@/src/features/cart/stores/cart.store'
import { generateWaCartLink } from '@/src/lib/wa-link-client'
import { formatPrice, getFallbackImage } from '@/lib/utils'


export default function KeranjangPage() {
  const router = useRouter()
  const { t } = useLanguage()
  const { data: session } = useSession()
  const { getSetting } = useSettings()

  const cartItems = useCartStore(selectCartItems)
  const updateQuantity = useCartStore((s) => s.updateQuantity)
  const removeItem = useCartStore((s) => s.removeItem)
  const clearCart = useCartStore((s) => s.clearCart)
  const cartTotal = useCartStore(selectCartTotal)
  const cartCount = useCartStore(selectCartItemCount)

  const handleClearCart = () => {
    clearCart()
    toast.success(t('cart_toast_cleared') || 'Keranjang dikosongkan')
  }

  const handleWhatsAppOrder = () => {
    const resolveBaseType = (name: string): string => {
      const normalized = name.toLowerCase()
      if (normalized.includes('kembung')) return 'kembung'
      if (normalized.includes('lumpia')) return 'lumpia'
      if (normalized.includes('krispy')) return 'krispy'
      return 'kembung'
    }

    const waItems = cartItems.map((item) => ({
      name: item.variantName.split('(')[0].trim(),
      baseType: resolveBaseType(item.variantName),
      quantity: item.quantity,
      toppings: item.toppings ? item.toppings.map((t) => t.name) : []
    }))

    const phone = getSetting('kontak_whatsapp', '6285773728748')
    const name = session?.user?.name || 'Pelanggan'
    const link = generateWaCartLink(phone, name, waItems)

    if (link && link !== '#') {
      window.open(link, '_blank', 'noopener,noreferrer')
    } else {
      toast.error(
        t('cart_toast_wa_error') || 'Gagal membuat link WhatsApp. Periksa item keranjang Anda.'
      )
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-white to-orange-50 dark:from-zinc-950 dark:via-zinc-900 dark:to-zinc-950 pt-24 pb-16">
      <Toaster position="top-center" toastOptions={{ className: '!rounded-[4px] !text-sm' }} />
      <div className="max-w-3xl mx-auto px-4 sm:px-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <Link
              href="/menu-spesial"
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200 transition-colors mb-2"
            >
              <ArrowLeft className="h-4 w-4" /> {t('cart_continue_shopping')}
            </Link>
            <h1 className="font-serif text-3xl font-bold text-zinc-900 dark:text-zinc-100">
              🛒 {t('cart_title')}
            </h1>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
              {cartCount} {t('cart_item_unit')} · {formatPrice(cartTotal)}
            </p>
          </div>
          {cartItems.length > 0 && (
            <button
              onClick={handleClearCart}
              className="text-xs font-semibold text-red-500 hover:text-red-755 px-3 py-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/30 transition-all"
            >
              {t('cart_clear_btn')}
            </button>
          )}
        </div>

        {/* Empty State */}
        {cartItems.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center py-20"
          >
            <div className="w-32 h-32 mx-auto mb-6 flex items-center justify-center">
              <Lottie
                animationData={emptyCartAnimation}
                loop={true}
                className="w-32 h-32"
              />
            </div>
            <h2 className="font-serif text-xl font-bold text-zinc-800 dark:text-zinc-200 mb-2">
              {t('cart_empty_title')}
            </h2>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-6">{t('cart_empty_desc')}</p>
            <Link
              href="/menu-spesial"
              className="inline-flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-white font-bold py-3 px-8 rounded-[4px] transition-all active:scale-95 shadow-md shadow-amber-200"
            >
              🍌 {t('hero_menu_btn')}
            </Link>
          </motion.div>
        ) : (
          <>
            {/* Cart Items */}
            <div className="space-y-3 mb-8">
              <AnimatePresence mode="popLayout">
                {cartItems.map((item) => (
                  <motion.div
                    key={item.cartItemId}
                    layout
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20, height: 0 }}
                    transition={{ duration: 0.2 }}
                    className="bg-white dark:bg-zinc-900 rounded-[4px] border border-zinc-100 dark:border-zinc-800 p-4 sm:p-5 shadow-sm"
                  >
                    <div className="flex items-start gap-4">
                      {/* Thumbnail Image */}
                      <div className="relative w-16 h-16 rounded-[4px] overflow-hidden bg-zinc-100 dark:bg-zinc-800 shrink-0">
                        <Image
                          src={item.imageUrl || getFallbackImage(item.variantName)}
                          alt={item.variantName}
                          fill
                          sizes="64px"
                          className="object-cover"
                        />
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 truncate">
                          {item.variantName}
                        </h3>
                        {item.toppings && item.toppings.length > 0 && (
                          <span className="text-xs text-secondary font-medium block mt-0.5">
                            + {item.toppings.map((t: any) => t.name).join(', ')}
                          </span>
                        )}
                        {item.notes && (
                          <p className="text-xs text-zinc-400 italic mt-0.5">
                            &quot;{item.notes}&quot;
                          </p>
                        )}
                        <p className="text-xs text-zinc-400 mt-1">{item.quantity} pcs</p>
                      </div>

                      {/* Qty + Price */}
                      <div className="flex flex-col items-end gap-2 shrink-0">
                        <p className="text-sm font-bold text-amber-600 dark:text-amber-400">
                          <CartItemSubtotal
                            cartItemId={item.cartItemId}
                            formatPrice={formatPrice}
                          />
                        </p>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              const newQty = item.quantity - 1
                              updateQuantity(item.cartItemId, newQty)
                              if (newQty <= 0) {
                                toast.success(t('cart_toast_removed') || 'Item dihapus')
                              }
                            }}
                            className="w-7 h-7 rounded-lg bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors active:scale-90"
                            aria-label={t('cart_minus_label') || 'Kurangi kuantitas'}
                            title={t('cart_minus_title') || 'Kurangi'}
                          >
                            <Minus className="h-3.5 w-3.5" />
                          </button>
                          <span className="w-8 text-center text-sm font-bold text-zinc-800 dark:text-zinc-100">
                            {item.quantity}
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              const limit = item.stock ?? 999
                              if (item.quantity >= limit) {
                                toast.error(t('cart_toast_qty_limit') || 'Stok terbatas!')
                              } else {
                                updateQuantity(item.cartItemId, item.quantity + 1)
                              }
                            }}
                            className="w-7 h-7 rounded-lg bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors active:scale-90"
                            aria-label={t('cart_plus_label') || 'Tambah kuantitas'}
                            title={t('cart_plus_title') || 'Tambah'}
                          >
                            <Plus className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              removeItem(item.cartItemId)
                              toast.success(t('cart_toast_removed') || 'Item dihapus')
                            }}
                            className="w-7 h-7 rounded-lg bg-red-50 dark:bg-red-950/30 flex items-center justify-center text-red-500 hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors active:scale-90 ml-1"
                            aria-label={t('cart_remove_label') || 'Hapus item'}
                            title={t('cart_remove_title') || 'Hapus'}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>

            {/* Summary + CTA */}
            <div className="bg-white dark:bg-zinc-900 rounded-[4px] border border-zinc-100 dark:border-zinc-800 shadow-sm p-6 mt-8">
              <div className="flex justify-between items-center mb-4">
                <span className="text-sm text-zinc-500">
                  {t('cart_subtotal_label')} ({cartCount} {t('cart_item_unit')})
                </span>
                <span className="font-serif text-2xl font-bold text-amber-600 dark:text-amber-400">
                  {formatPrice(cartTotal)}
                </span>
              </div>
              <div className="space-y-2">
                <button
                  onClick={() => router.push('/checkout')}
                  className="w-full bg-amber-500 hover:bg-amber-600 text-white font-bold py-3.5 rounded-[4px] transition-all active:scale-[0.98] shadow-sm shadow-amber-200 dark:shadow-amber-900/30 text-sm"
                >
                  {t('cart_btn_checkout')}
                </button>
                <button
                  onClick={handleWhatsAppOrder}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3.5 rounded-[4px] transition-all active:scale-[0.98] shadow-sm shadow-emerald-200 dark:shadow-emerald-900/30 text-sm flex items-center justify-center gap-2"
                >
                  <span>💬</span> {t('cart_btn_whatsapp')}
                </button>
              </div>

              {!session && (
                <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/50 rounded-[4px] p-3 text-center mt-3 text-xs text-amber-800 dark:text-amber-300">
                  💡 Mau hemat lebih banyak?{' '}
                  <Link
                    href="/member-login?callbackUrl=/keranjang"
                    className="font-bold underline hover:text-amber-900 dark:hover:text-amber-200"
                  >
                    Yuk masuk/daftar member
                  </Link>{' '}
                  untuk kumpulkan Koin Pisang dan gunakan voucher diskon di halaman checkout!
                </div>
              )}
              {session && (
                <p className="text-[10px] text-zinc-500 dark:text-zinc-400 text-center mt-2 leading-relaxed">
                  *Catatan: Pemesanan via WhatsApp tidak mendukung redeem Koin Pisang atau voucher
                  promo. Gunakan tombol <strong>Lanjut ke Checkout</strong> untuk menggunakannya.
                </p>
              )}
              <p className="text-[10px] text-zinc-400 text-center mt-3">
                {t('cart_security_notice')}
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function CartItemSubtotal({
  cartItemId,
  formatPrice
}: {
  cartItemId: string
  formatPrice: (n: number) => string
}) {
  const subtotal = useCartStore(selectItemSubtotal(cartItemId))
  return <>{formatPrice(subtotal)}</>
}
