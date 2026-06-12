'use client'

// app/(user)/profile/orders/[id]/ProfileOrderDetailClient.tsx
// RAG Source: app/(user)/profile/pesanan/page.tsx (Reorder logic & timeline builder)

import { motion } from 'framer-motion'
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  CreditCard,
  Download,
  Package,
  Repeat,
  XCircle
} from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'react-hot-toast'
import { useCartStore } from '@/src/stores/cart.store'
import { formatPrice } from '@/lib/utils'

interface ProfileOrderDetailClientProps {
  order: {
    id: string
    status: string
    totalPrice: number
    createdAt: string
    deliveryMethod: string
    deliveryFee: number
    discountAmount: number
    customerName: string
    customerPhone: string
    notes: string | null
    user: { email: string | null; name: string | null } | null
    payment: { status: string; paymentType: string | null } | null
    items: Array<{
      id: string
      baseType: string
      quantity: number
      unitPrice: number
      subtotal: number
      variant: { id: string; flavorName: string; imageUrl: string | null } | null
      toppings: Array<{ id: string; name: string; price: number }>
    }>
  }
}

const ORDER_STAGES = [
  { id: 'PENDING_PAYMENT', label: 'Menunggu Pembayaran' },
  { id: 'PROCESSING', label: 'Sedang Diproses' },
  { id: 'READY', label: 'Siap Diambil/Dikirim' },
  { id: 'COMPLETED', label: 'Selesai' }
]

const formatPaymentMethod = (paymentType: string | null) => {
  if (!paymentType) return 'Belum dipilih'
  const maps: Record<string, string> = {
    bank_transfer: 'Transfer Bank (VA)',
    qris: 'QRIS',
    gopay: 'GoPay',
    shopeepay: 'ShopeePay',
    echannel: 'Mandiri Bill',
    cash: 'Bayar di Tempat (Tunai)'
  }
  return maps[paymentType] || paymentType.toUpperCase()
}

export default function ProfileOrderDetailClient({
  order
}: ProfileOrderDetailClientProps) {
  const router = useRouter()
  const addItemToCart = useCartStore((state) => state.addItem)

  const handleReorder = () => {
    let itemsAdded = 0
    order.items.forEach((item) => {
      if (!item.variant?.id) return
      addItemToCart({
        menuVariantId: item.variant.id,
        variantName: `${item.variant.flavorName} (${item.baseType})`,
        basePrice: item.unitPrice,
        toppings:
          item.toppings?.map((t) => ({
            toppingId: t.id,
            name: t.name,
            priceAdd: t.price
          })) || [],
        quantity: item.quantity,
        notes: '',
        imageUrl: item.variant.imageUrl || undefined
      })
      itemsAdded++
    })

    if (itemsAdded > 0) {
      toast.success('Pesanan ditambahkan ke keranjang!')
      router.push('/cart')
    } else {
      toast.error('Gagal menambahkan item. Varian mungkin sudah tidak tersedia.')
    }
  }

  const activeIndex = ORDER_STAGES.findIndex((s) => s.id === order.status)
  const isCanceled = order.status === 'CANCELED'

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6 max-w-4xl mx-auto"
    >
      {/* Navigation Header */}
      <div className="flex items-center gap-3">
        <Link
          href="/profile/pesanan"
          className="p-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 transition-colors shadow-sm"
        >
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div>
          <h2 className="text-xl font-bold font-serif text-zinc-900 dark:text-zinc-100">
            Invoice Detail
          </h2>
          <p className="text-xs text-zinc-400 font-mono">#{order.id}</p>
        </div>
      </div>

      {/* Stepper Timeline Card */}
      <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200/50 dark:border-zinc-850 p-6 shadow-sm">
        {isCanceled ? (
          <div className="flex items-center gap-3 p-4 bg-rose-50 dark:bg-rose-950/20 rounded-lg border border-rose-100 dark:border-rose-900/30">
            <XCircle className="w-5 h-5 text-rose-500" />
            <span className="text-sm font-bold text-rose-700 dark:text-rose-450">
              Pesanan ini telah dibatalkan oleh dapur/kasir.
            </span>
          </div>
        ) : (
          <div className="py-2">
            <h4 className="text-xs font-black text-zinc-400 dark:text-zinc-500 uppercase tracking-wider mb-6">
              Status Alur Pesanan
            </h4>
            <div className="relative flex justify-between items-center w-full">
              {/* Connecting Line Background */}
              <div className="absolute top-4 left-0 w-full h-1 bg-zinc-100 dark:bg-zinc-800 -z-10 rounded-full"></div>
              {/* Connecting Line Active */}
              <div
                className="absolute top-4 left-0 h-1 bg-amber-500 -z-10 rounded-full transition-all duration-500 ease-in-out"
                style={{
                  width: `${activeIndex === -1 ? 0 : (activeIndex / (ORDER_STAGES.length - 1)) * 100}%`
                }}
              ></div>

              {ORDER_STAGES.map((stage, index) => {
                const isCompleted = index <= activeIndex
                const isActive = index === activeIndex

                return (
                  <div key={stage.id} className="flex flex-col items-center relative z-10 w-24">
                    <div
                      className={`w-9 h-9 rounded-full flex items-center justify-center transition-all duration-300 border-4 border-white dark:border-zinc-900 ${
                        isCompleted
                          ? 'bg-amber-500 text-white shadow-sm scale-110'
                          : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-400'
                      }`}
                    >
                      {isCompleted ? (
                        <CheckCircle2 className="w-4 h-4" />
                      ) : (
                        <span className="text-xs font-black">{index + 1}</span>
                      )}
                    </div>
                    <span
                      className={`text-[10px] md:text-xs font-bold mt-3 text-center transition-colors ${
                        isActive
                          ? 'text-amber-600 dark:text-amber-400'
                          : isCompleted
                            ? 'text-zinc-700 dark:text-zinc-300'
                            : 'text-zinc-450'
                      }`}
                    >
                      {stage.label}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Products Breakdown */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200/50 dark:border-zinc-850 p-6 shadow-sm space-y-4">
            <h4 className="text-xs font-black text-zinc-450 dark:text-zinc-500 border-b border-zinc-100 dark:border-zinc-800 pb-2.5 uppercase tracking-wider">
              Rincian Item Pembelian
            </h4>
            <div className="space-y-4">
              {order.items.map((item) => (
                <div key={item.id} className="flex items-start gap-4">
                  <div className="w-16 h-16 rounded-lg bg-zinc-100 dark:bg-zinc-800 overflow-hidden flex-shrink-0 shadow-sm border border-zinc-200/10">
                    {item.variant?.imageUrl ? (
                      <img
                        src={item.variant.imageUrl}
                        alt={item.variant.flavorName}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-zinc-400 text-xs font-bold">
                        Menu
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start gap-2">
                      <p className="text-sm font-bold text-zinc-800 dark:text-zinc-200 truncate">
                        {item.variant?.flavorName || 'Menu Terhapus'}
                      </p>
                      <p className="text-sm font-bold text-zinc-800 dark:text-zinc-200 whitespace-nowrap">
                        {formatPrice(item.subtotal)}
                      </p>
                    </div>
                    <p className="text-xs text-zinc-455 dark:text-zinc-500 mt-1">
                      {item.quantity}x {item.baseType} @ {formatPrice(item.unitPrice)}
                    </p>
                    {item.toppings && item.toppings.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {item.toppings.map((t) => (
                          <span
                            key={t.name}
                            className="px-2 py-0.5 bg-zinc-50 dark:bg-zinc-850 rounded text-[10px] font-bold text-zinc-605 dark:text-zinc-400 border border-zinc-200/50 dark:border-zinc-800"
                          >
                            + {t.name} ({formatPrice(t.price)})
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {order.notes && (
              <div className="bg-yellow-950/20 border border-yellow-800/30 text-yellow-400 text-xs px-3.5 py-3 rounded-lg font-bold mt-4">
                📝 Catatan Dapur: {order.notes}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Invoicing Info & Actions */}
        <div className="space-y-6">
          
          {/* Customer Metadata Block */}
          <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200/50 dark:border-zinc-850 p-5 shadow-sm space-y-3">
            <h4 className="text-xs font-black text-zinc-450 dark:text-zinc-500 border-b border-zinc-100 dark:border-zinc-800 pb-2.5 uppercase tracking-wider">
              Kontak Pelanggan
            </h4>
            <div className="space-y-1">
              <p className="text-xs text-zinc-400 font-bold uppercase">NAMA PENERIMA</p>
              <p className="text-sm font-bold text-zinc-800 dark:text-zinc-200">{order.customerName}</p>
            </div>
            <div className="space-y-1 pt-1.5">
              <p className="text-xs text-zinc-400 font-bold uppercase">NOMOR WHATSAPP</p>
              <p className="text-sm font-mono text-zinc-800 dark:text-zinc-200">{order.customerPhone}</p>
            </div>
          </div>

          {/* Payment Method Block */}
          <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200/50 dark:border-zinc-850 p-5 shadow-sm space-y-2">
            <h4 className="text-xs font-black text-zinc-450 dark:text-zinc-500 border-b border-zinc-100 dark:border-zinc-800 pb-2.5 uppercase tracking-wider flex items-center gap-2">
              <CreditCard className="w-3.5 h-3.5 text-blue-500" /> Metode Pembayaran
            </h4>
            <p className="text-sm font-bold text-zinc-800 dark:text-zinc-250 mt-1">
              {formatPaymentMethod(order.payment?.paymentType || null)}
            </p>
            {order.payment?.status && (
              <p className={`text-xs font-black uppercase tracking-wider ${order.payment.status === 'PAID' ? 'text-green-600' : 'text-yellow-600'}`}>
                Status: {order.payment.status}
              </p>
            )}
          </div>

          {/* Pricing Breakdown Block */}
          <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200/50 dark:border-zinc-850 p-5 shadow-sm space-y-3">
            <h4 className="text-xs font-black text-zinc-455 dark:text-zinc-500 uppercase tracking-wider">
              Ringkasan Tagihan
            </h4>

            <div className="flex justify-between text-xs text-zinc-500 dark:text-zinc-400 font-medium">
              <span>Subtotal Menu</span>
              <span>
                {formatPrice(
                  order.totalPrice - order.deliveryFee + order.discountAmount
                )}
              </span>
            </div>

            <div className="flex justify-between text-xs text-zinc-500 dark:text-zinc-400 font-medium">
              <span>Biaya Pengiriman ({order.deliveryMethod})</span>
              <span>{formatPrice(order.deliveryFee)}</span>
            </div>

            {order.discountAmount > 0 && (
              <div className="flex justify-between text-xs text-green-600 dark:text-green-400 font-bold">
                <span>Diskon Kupon</span>
                <span>- {formatPrice(order.discountAmount)}</span>
              </div>
            )}

            <div className="border-t border-zinc-100 dark:border-zinc-800 pt-3 flex justify-between items-center">
              <span className="text-xs font-black text-zinc-800 dark:text-zinc-200 uppercase">
                TOTAL BAYAR
              </span>
              <span className="text-base font-black text-amber-600 dark:text-amber-450">
                {formatPrice(order.totalPrice)}
              </span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="space-y-2.5">
            {order.status === 'PENDING_PAYMENT' && (
              <Link
                href={`/payment/${order.id}`}
                className="block w-full bg-[#D4802A] hover:bg-[#b56d24] text-white py-3.5 rounded-xl text-xs font-black text-center uppercase tracking-wider transition-all active:scale-[0.98] shadow-md"
              >
                Bayar Pesanan
              </Link>
            )}

            <a
              href={`/api/orders/${order.id}/invoice`}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full flex items-center justify-center gap-2 border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 py-3 rounded-xl text-xs font-black uppercase tracking-wider transition-all active:scale-[0.98] text-center shadow-sm"
            >
              <Download className="w-4 h-4" /> Download PDF Invoice
            </a>

            <button
              onClick={handleReorder}
              className="w-full flex items-center justify-center gap-2 bg-[#D4802A] hover:bg-[#b56d24] text-white py-3 rounded-xl text-xs font-black uppercase tracking-wider transition-all active:scale-[0.98] shadow-md"
            >
              <Repeat className="w-4 h-4" /> Ulangi Pemesanan
            </button>
          </div>

        </div>
      </div>
    </motion.div>
  )
}
