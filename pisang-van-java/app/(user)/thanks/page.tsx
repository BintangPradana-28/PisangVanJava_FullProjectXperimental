'use client'

import {
  Calendar,
  CheckSquare,
  Clock,
  Home,
  Loader2,
  MapPin,
  Receipt
} from 'lucide-react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useEffect, useState } from 'react'
import Lottie from 'lottie-react'
import successAnimation from '@/public/animations/success.json'
import ConfettiCanvas from '@/components/user/ConfettiCanvas'
import { useLanguage } from '@/context/LanguageContext'
import { getOrderSummary } from '@/src/features/checkout/actions'

const formatPrice = (price: number): string =>
  new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0
  }).format(price)

export default function ThanksPage() {
  const { t, locale } = useLanguage()
  const searchParams = useSearchParams()
  const orderId = searchParams.get('orderId')

  const [order, setOrder] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!orderId) return
    setLoading(true)
    getOrderSummary(orderId)
      .then((res) => {
        if (res.success && res.data) {
          setOrder(res.data)
        } else {
          setError(res.error || 'Gagal memuat detail pesanan')
        }
      })
      .catch((err) => {
        console.error(err)
        setError('Gagal memuat detail pesanan')
      })
      .finally(() => setLoading(false))
  }, [orderId])

  return (
    <section className="min-h-[90vh] flex flex-col items-center justify-center bg-zinc-50 px-4 py-16 dark:bg-zinc-950">
      <ConfettiCanvas />
      <div className="w-full max-w-lg rounded-2xl bg-white p-6 sm:p-8 text-center shadow-md dark:bg-zinc-900 border border-zinc-200/50 dark:border-zinc-800/80">
        <div className="mx-auto mb-5 flex h-24 w-24 items-center justify-center">
          <Lottie
            animationData={successAnimation}
            loop={false}
            className="w-24 h-24"
          />
        </div>

        <h1 className="mb-2 font-serif text-2xl sm:text-3xl font-bold text-zinc-900 dark:text-white">
          {t('thanks_title') || 'Pembayaran Berhasil! 🎉'}
        </h1>

        <p className="mb-6 text-zinc-500 dark:text-zinc-400 text-xs sm:text-sm max-w-sm mx-auto leading-relaxed">
          {t('thanks_desc') ||
            'Terima kasih telah melakukan pembayaran pesanan Anda. Kami sedang memprosesnya!'}
        </p>

        {/* ── Order Receipt Box ── */}
        {loading && (
          <div className="mb-6 py-8 border border-dashed border-zinc-200 dark:border-zinc-800 rounded-xl flex flex-col items-center justify-center gap-2">
            <Loader2 className="w-6 h-6 text-amber-500 animate-spin" />
            <span className="text-xs text-zinc-400">
              {locale === 'en' ? 'Loading your order details...' : 'Memuat rincian belanja Anda...'}
            </span>
          </div>
        )}

        {order && !loading && (
          <div className="mb-6 text-left border border-zinc-150 dark:border-zinc-800 rounded-xl overflow-hidden bg-zinc-50/50 dark:bg-zinc-900/50">
            <div className="bg-zinc-100/70 dark:bg-zinc-800/50 px-4 py-3 border-b border-zinc-200/50 dark:border-zinc-800 flex justify-between items-center text-xs">
              <span className="font-bold text-zinc-800 dark:text-zinc-200 flex items-center gap-1.5 font-mono">
                <Receipt className="w-3.5 h-3.5 text-zinc-400" />#{order.id.slice(-8).toUpperCase()}
              </span>
              <span className="text-zinc-500 font-mono">
                {new Date(order.createdAt).toLocaleDateString(locale === 'en' ? 'en-US' : 'id-ID', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric'
                })}
              </span>
            </div>

            <div className="p-4 space-y-4">
              {/* Customer Info */}
              <div className="text-xs text-zinc-500 dark:text-zinc-400 grid grid-cols-2 gap-2 pb-3 border-b border-zinc-200/40 dark:border-zinc-800/50">
                <div>
                  <span className="block font-semibold text-zinc-400 text-[10px] uppercase tracking-wider">
                    {locale === 'en' ? 'Customer' : 'Pelanggan'}
                  </span>
                  <span className="text-zinc-850 dark:text-zinc-200 font-medium">
                    {order.customerName}
                  </span>
                </div>
                <div>
                  <span className="block font-semibold text-zinc-400 text-[10px] uppercase tracking-wider">
                    {locale === 'en' ? 'Method' : 'Metode'}
                  </span>
                  <span className="text-zinc-850 dark:text-zinc-200 font-medium flex items-center gap-1">
                    {order.deliveryMethod === 'DELIVERY' ? <>🛵 Delivery</> : <>{locale === 'en' ? '🛍️ Pickup' : '🛍️ Ambil Sendiri'}</>}
                  </span>
                </div>
              </div>

              {/* Items List */}
              <div className="space-y-3">
                <span className="block font-semibold text-zinc-400 text-[10px] uppercase tracking-wider">
                  {locale === 'en' ? 'Item Details' : 'Detail Item'}
                </span>
                {order.items.map((item: any) => (
                  <div key={item.id} className="flex justify-between items-start text-xs">
                    <div className="max-w-[70%]">
                      <span className="font-bold text-zinc-800 dark:text-zinc-200">
                        {item.quantity}x
                      </span>{' '}
                      <span className="text-zinc-700 dark:text-zinc-300 font-medium">
                        {item.variant?.flavorName || item.variant?.nama_varian || 'Pisang Goreng'}
                      </span>{' '}
                      <span className="text-[10px] text-zinc-400 dark:text-zinc-500">
                        ({item.baseType})
                      </span>
                      {item.toppings && item.toppings.length > 0 && (
                        <span className="block text-[10px] text-amber-600 mt-0.5 pl-5">
                          + Topping: {item.toppings.map((t: any) => t.topping?.name).join(', ')}
                        </span>
                      )}
                    </div>
                    <span className="font-bold font-mono text-zinc-800 dark:text-zinc-200">
                      {formatPrice(item.subtotal)}
                    </span>
                  </div>
                ))}
              </div>

              {/* Total Calculation */}
              <div className="pt-3 border-t border-zinc-200/40 dark:border-zinc-800/50 space-y-1.5 text-xs">
                {order.deliveryFee > 0 && (
                  <div className="flex justify-between text-zinc-600 dark:text-zinc-400">
                    <span>{locale === 'en' ? 'Shipping Fee' : 'Ongkos Kirim'}</span>
                    <span className="font-mono">{formatPrice(order.deliveryFee)}</span>
                  </div>
                )}
                {order.discountAmount > 0 && (
                  <div className="flex justify-between text-emerald-600 dark:text-emerald-400 font-semibold">
                    <span>{locale === 'en' ? 'Discount / Promo' : 'Diskon / Potongan'}</span>
                    <span className="font-mono">-{formatPrice(order.discountAmount)}</span>
                  </div>
                )}
                <div className="flex justify-between items-center text-sm pt-1 font-bold text-zinc-900 dark:text-white border-t border-dashed border-zinc-200/50 dark:border-zinc-800">
                  <span>Grand Total</span>
                  <span className="font-mono text-base text-[#D4802A]">
                    {formatPrice(order.totalPrice)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="flex flex-col gap-3">
          <Link
            href="/"
            className="flex w-full items-center justify-center gap-2 rounded-[4px] bg-[#D4802A] px-4 py-3.5 text-sm font-bold text-white transition-colors hover:bg-amber-600 shadow-sm active:scale-[0.98]"
          >
            <Home className="h-4 w-4" aria-hidden="true" />
            {t('thanks_btn_home') || 'Kembali ke Beranda'}
          </Link>

          <Link
            href="/track-order"
            className="flex w-full items-center justify-center gap-2 rounded-[4px] bg-zinc-100 px-4 py-3.5 text-sm font-bold text-zinc-700 transition-colors hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700 active:scale-[0.98]"
          >
            {t('thanks_btn_track') || 'Pantau Status Pesanan'}
          </Link>
        </div>
      </div>
    </section>
  )
}
