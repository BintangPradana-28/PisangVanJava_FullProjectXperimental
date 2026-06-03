'use client'

import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import Image from 'next/image'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { useCartStore, useCartTotal, useCartCount } from '@/src/lib/store/useCartStore'
import { useLanguage } from '@/context/LanguageContext'
import { Minus, Plus, Trash2, ShoppingBag, ArrowLeft } from 'lucide-react'

const formatPrice = (n: number): string =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(n)

export default function KeranjangPage() {
  const router = useRouter()
  const { t } = useLanguage()

  const cartItems = useCartStore((s) => s.items)
  const updateQuantity = useCartStore((s) => s.updateQuantity)
  const removeItem = useCartStore((s) => s.removeItem)
  const clearCart = useCartStore((s) => s.clearCart)
  const cartTotal = useCartTotal()
  const cartCount = useCartCount()

  const handleClearCart = () => {
    clearCart()
    toast.success('Keranjang dikosongkan')
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-white to-orange-50 dark:from-zinc-950 dark:via-zinc-900 dark:to-zinc-950 pt-24 pb-16">
      <div className="max-w-3xl mx-auto px-4 sm:px-6">

        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <Link
              href="/menu-spesial"
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200 transition-colors mb-2"
            >
              <ArrowLeft className="h-4 w-4" /> Lanjut Belanja
            </Link>
            <h1 className="font-serif text-3xl font-bold text-zinc-900 dark:text-zinc-100">
              🛒 Keranjang Anda
            </h1>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
              {cartCount} item · {formatPrice(cartTotal)}
            </p>
          </div>
          {cartItems.length > 0 && (
            <button
              onClick={handleClearCart}
              className="text-xs font-semibold text-red-500 hover:text-red-700 px-3 py-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/30 transition-all"
            >
              Kosongkan
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
            <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-amber-100 dark:bg-amber-900/20 flex items-center justify-center">
              <ShoppingBag className="h-10 w-10 text-amber-500" />
            </div>
            <h2 className="font-serif text-xl font-bold text-zinc-800 dark:text-zinc-200 mb-2">
              Keranjang Kosong
            </h2>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-6">
              Yuk pilih pisang goreng favorit Anda!
            </p>
            <Link
              href="/menu-spesial"
              className="inline-flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-white font-bold py-3 px-8 rounded-2xl transition-all active:scale-95 shadow-md shadow-amber-200"
            >
              🍌 Lihat Menu
            </Link>
          </motion.div>
        ) : (
          <>
            {/* Cart Items */}
            <div className="space-y-3 mb-8">
              <AnimatePresence mode="popLayout">
                {cartItems.map((item, i) => (
                  <motion.div
                    key={`${item.productId}-${item.toppingName}-${item.notes}-${i}`}
                    layout
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20, height: 0 }}
                    transition={{ duration: 0.2 }}
                    className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-100 dark:border-zinc-800 p-4 sm:p-5 shadow-sm"
                  >
                    <div className="flex items-start gap-4">
                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 truncate">
                          {item.name}
                        </h3>
                        {item.toppingName && (
                          <p className="text-xs text-amber-600 mt-0.5">+ {item.toppingName}</p>
                        )}
                        {item.notes && (
                          <p className="text-xs text-zinc-400 italic mt-0.5">&quot;{item.notes}&quot;</p>
                        )}
                        <p className="text-xs text-zinc-400 mt-1">
                          {formatPrice(item.basePrice + item.toppingPrice)} / pcs
                        </p>
                      </div>

                      {/* Qty + Price */}
                      <div className="flex flex-col items-end gap-2 shrink-0">
                        <p className="text-sm font-bold text-amber-600 dark:text-amber-400">
                          {formatPrice(item.totalPrice)}
                        </p>
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => updateQuantity(item.productId, item.toppingName, item.notes, item.quantity - 1)}
                            className="w-7 h-7 rounded-lg bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors active:scale-90"
                          >
                            <Minus className="h-3.5 w-3.5" />
                          </button>
                          <span className="w-8 text-center text-sm font-bold text-zinc-800 dark:text-zinc-100">
                            {item.quantity}
                          </span>
                          <button
                            onClick={() => updateQuantity(item.productId, item.toppingName, item.notes, item.quantity + 1)}
                            className="w-7 h-7 rounded-lg bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors active:scale-90"
                          >
                            <Plus className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => {
                              removeItem(item.productId, item.toppingName, item.notes)
                              toast.success('Item dihapus')
                            }}
                            className="w-7 h-7 rounded-lg bg-red-50 dark:bg-red-950/30 flex items-center justify-center text-red-500 hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors active:scale-90 ml-1"
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
            <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-100 dark:border-zinc-800 shadow-sm p-6 sticky bottom-4">
              <div className="flex justify-between items-center mb-4">
                <span className="text-sm text-zinc-500">Subtotal ({cartCount} item)</span>
                <span className="font-serif text-2xl font-bold text-amber-600 dark:text-amber-400">
                  {formatPrice(cartTotal)}
                </span>
              </div>
              <button
                onClick={() => router.push('/checkout')}
                className="w-full bg-amber-500 hover:bg-amber-600 text-white font-bold py-3.5 rounded-2xl transition-all active:scale-[0.98] shadow-lg shadow-amber-200 dark:shadow-amber-900/30 text-sm"
              >
                Lanjut ke Checkout →
              </button>
              <p className="text-[10px] text-zinc-400 text-center mt-3">
                🔒 Data Anda terenkripsi. Harga dikunci server.
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
