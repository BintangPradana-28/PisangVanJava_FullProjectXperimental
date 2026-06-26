'use client'

import { AnimatePresence, motion } from 'framer-motion'
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  Clock,
  CreditCard,
  Download,
  Package,
  RefreshCw,
  Repeat,
  ShoppingBag,
  XCircle
} from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { useLanguage } from '@/context/LanguageContext'
import { useCartStore } from '@/src/features/cart/stores/cart.store'
import { cancelOrder } from '@/app/actions/orderHistory'

interface OrderItem {
  id: string
  baseType: string
  quantity: number
  subtotal: number
  unitPrice: number
  variant: {
    id: string
    flavorName: string
    imageUrl: string | null
    priceKembung: number
    priceLumpia: number
    priceKrispy: number
  }
  toppings?: { id: string; name: string; emoji: string | null; price: number }[] | null
}

interface Order {
  id: string
  customerName: string | null
  status: string
  totalPrice: number
  createdAt: string | Date
  deliveryMethod?: string
  deliveryFee: number
  discountAmount: number
  items: OrderItem[]
  payment?: {
    status: string
    paymentType: string | null
  } | null
}

const getStatusConfig = (status: string, t: any) => {
  switch (status) {
    case 'PENDING_PAYMENT':
      return {
        color:
          'bg-yellow-100 text-yellow-700 border-yellow-250 dark:bg-yellow-950/20 dark:text-yellow-400 dark:border-yellow-900/40',
        icon: Clock,
        label: t('status_pending') || 'Menunggu Pembayaran'
      }
    case 'PROCESSING':
      return {
        color:
          'bg-blue-100 text-blue-700 border-blue-250 dark:bg-blue-950/20 dark:text-blue-400 dark:border-blue-900/40',
        icon: RefreshCw,
        label: t('status_confirmed') || 'Sedang Diproses'
      }
    case 'READY':
      return {
        color:
          'bg-purple-100 text-purple-700 border-purple-250 dark:bg-purple-950/20 dark:text-purple-400 dark:border-purple-900/40',
        icon: Package,
        label: t('status_ready') || 'Siap Diambil/Dikirim'
      }
    case 'COMPLETED':
      return {
        color:
          'bg-green-100 text-green-700 border-green-250 dark:bg-green-950/20 dark:text-green-400 dark:border-green-900/40',
        icon: CheckCircle2,
        label: t('status_done') || 'Selesai'
      }
    case 'CANCELED':
      return {
        color:
          'bg-red-100 text-red-700 border-red-250 dark:bg-red-950/20 dark:text-red-400 dark:border-red-900/40',
        icon: XCircle,
        label: t('status_cancelled') || 'Dibatalkan'
      }
    default:
      return {
        color:
          'bg-zinc-100 text-zinc-700 border-zinc-250 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700',
        icon: AlertCircle,
        label: status
      }
  }
}

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

const OrderTimeline = ({ currentStatus, t }: { currentStatus: string; t: any }) => {
  if (currentStatus === 'CANCELED') {
    return (
      <div className="flex items-center gap-2 p-4 bg-red-50 dark:bg-red-900/10 rounded-[4px] border border-red-100 dark:border-red-900/30">
        <XCircle className="w-5 h-5 text-red-500 shrink-0" />
        <span className="text-sm font-bold text-red-700 dark:text-red-400">
          {t('status_cancelled') || 'Pesanan ini telah dibatalkan.'}
        </span>
      </div>
    )
  }

  const stages = [
    { id: 'PENDING_PAYMENT', label: t('status_pending') || 'Menunggu Pembayaran' },
    { id: 'PROCESSING', label: t('status_confirmed') || 'Sedang Diproses' },
    { id: 'READY', label: t('status_ready') || 'Siap Diambil/Dikirim' },
    { id: 'COMPLETED', label: t('status_done') || 'Selesai' }
  ]

  const currentIndex = stages.findIndex((s) => s.id === currentStatus)
  const activeIndex = currentIndex === -1 ? 0 : currentIndex

  return (
    <div className="py-6 px-2">
      <h4 className="text-sm font-bold text-zinc-800 dark:text-zinc-200 mb-6">
        {t('orders_detail_status') || 'Status Tiap Tahap'}
      </h4>
      <div className="relative flex justify-between items-center w-full">
        {/* Connecting Line Background */}
        <div className="absolute top-4 left-0 w-full h-1 bg-zinc-200 dark:bg-zinc-800 -z-10 rounded-[4px]"></div>
        {/* Connecting Line Active */}
        <div
          className="absolute top-4 left-0 h-1 bg-[#D4802A] -z-10 rounded-[4px] transition-all duration-500 ease-in-out"
          style={{ width: `${(activeIndex / (stages.length - 1)) * 100}%` }}
        ></div>

        {stages.map((stage, index) => {
          const isCompleted = index <= activeIndex
          const isActive = index === activeIndex

          return (
            <div key={stage.id} className="flex flex-col items-center relative z-10 w-24">
              <div
                className={`w-9 h-9 rounded-[4px] flex items-center justify-center transition-all duration-300 border-4 border-white dark:border-zinc-950 ${
                  isCompleted
                    ? 'bg-[#D4802A] text-white shadow-md scale-110'
                    : 'bg-zinc-200 dark:bg-zinc-800 text-zinc-400'
                }`}
              >
                {isCompleted ? (
                  <CheckCircle2 className="w-4 h-4" />
                ) : (
                  <span className="text-xs font-bold">{index + 1}</span>
                )}
              </div>
              <span
                className={`text-[10px] md:text-xs font-semibold mt-3 text-center transition-colors ${
                  isActive
                    ? 'text-[#D4802A]'
                    : isCompleted
                      ? 'text-zinc-700 dark:text-zinc-350'
                      : 'text-zinc-450 dark:text-zinc-500'
                }`}
              >
                {stage.label}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

interface Props {
  phone?: string
  useAuth?: boolean
}

export default function OrderHistory({ phone = '', useAuth = false }: Props) {
  const { t, locale } = useLanguage()
  const [orders, setOrders] = useState<Order[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isCanceling, setIsCanceling] = useState<string | null>(null)

  const router = useRouter()
  const addToCart = useCartStore((s) => s.addItem)

  const formatPrice = (n: number) =>
    new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0
    }).format(n)

  const handleReorder = async (order: Order) => {
    try {
      const res = await fetch('/api/menu')
      const json = await res.json()
      if (!json.success) throw new Error('Failed to load menu')

      const liveVariants = json.data.variants
      let addedCount = 0
      let skippedCount = 0

      order.items.forEach((item) => {
        const live = liveVariants.find((v: any) => v.id === item.variant.id)
        if (!live || !live.isAvailable) {
          skippedCount++
          return
        }

        let basePrice = live.priceKembung
        if (item.baseType === 'Lumpia') basePrice = live.priceLumpia
        if (item.baseType === 'Krispy') basePrice = live.priceKrispy

        addToCart({
          menuVariantId: item.variant.id,
          variantName: `${item.variant.flavorName} (${item.baseType})`,
          basePrice,
          toppings: item.toppings
            ? item.toppings.map((t: any) => ({
                toppingId: t.id || 'unknown',
                name: t.name,
                priceAdd: t.price
              }))
            : [],
          quantity: item.quantity,
          notes: ''
        })
        addedCount++
      })

      if (addedCount > 0) {
        if (skippedCount > 0) {
          toast.success(
            t('reorder_toast_some_skipped') ||
              `${addedCount} item ditambahkan, ${skippedCount} item habis/tidak tersedia.`,
            { icon: '🛒' }
          )
        } else {
          toast.success(
            t('reorder_toast_success') || 'Pesanan berhasil ditambahkan ke keranjang!',
            { icon: '🛒' }
          )
        }
        router.push('/keranjang')
      } else {
        toast.error(
          t('reorder_toast_none_available') || 'Semua item dalam pesanan ini sedang tidak tersedia.'
        )
      }
    } catch {
      toast.error('Gagal memproses pesanan ulang. Coba lagi.')
    }
  }

  const handleCancelOrder = async (orderId: string) => {
    if (
      !window.confirm(
        t('order_cancel_confirm') || 'Apakah Anda yakin ingin membatalkan pesanan ini?'
      )
    ) {
      return
    }

    setIsCanceling(orderId)
    try {
      const res = await cancelOrder(orderId)
      if (res.success) {
        toast.success(t('order_cancel_success') || 'Pesanan berhasil dibatalkan')
        fetchOrders()
      } else {
        toast.error(res.error || t('order_cancel_error') || 'Gagal membatalkan pesanan')
      }
    } catch {
      toast.error('Terjadi kesalahan koneksi saat membatalkan pesanan.')
    } finally {
      setIsCanceling(null)
    }
  }

  const fetchOrders = useCallback(async () => {
    if (!useAuth && !phone) {
      setIsLoading(false)
      return
    }
    setIsLoading(true)
    setError(null)
    try {
      let res
      if (useAuth) {
        res = await fetch(`/api/user/orders`, { credentials: 'include', cache: 'no-store' })
      } else {
        const encodedPhone = encodeURIComponent(phone.trim())
        res = await fetch(`/api/orders/track?phone=${encodedPhone}`, {
          credentials: 'include',
          cache: 'no-store'
        })
      }
      const data = await res.json()
      if (data.success) {
        setOrders(data.data)
      } else {
        setError(data.error || 'Gagal memuat riwayat pesanan.')
      }
    } catch {
      setError('Koneksi bermasalah. Coba refresh halaman.')
    } finally {
      setIsLoading(false)
    }
  }, [phone, useAuth])

  useEffect(() => {
    fetchOrders()
  }, [fetchOrders])

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-32 rounded-[4px] bg-zinc-100 dark:bg-zinc-800 animate-pulse border border-zinc-200/50 dark:border-zinc-800/80"
          />
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/50 rounded-[4px] p-6 text-center">
        <p className="text-red-650 dark:text-red-400 font-bold text-sm mb-3">⚠️ {error}</p>
        <button
          type="button"
          onClick={fetchOrders}
          className="text-xs font-bold text-red-600 dark:text-red-400 hover:underline px-4 py-2 border border-red-300 dark:border-red-900/50 rounded-[4px]"
        >
          Coba Lagi
        </button>
      </div>
    )
  }

  if (orders.length === 0) {
    return (
      <div className="bg-zinc-50 dark:bg-zinc-900/30 border border-dashed border-zinc-300 dark:border-zinc-800 rounded-[4px] p-10 text-center">
        <div className="text-5xl mb-4">📋</div>
        <h3 className="font-bold text-zinc-800 dark:text-zinc-250 mb-2 text-lg">
          {t('orders_empty') || 'Belum Ada Pesanan'}
        </h3>
        <p className="text-sm text-zinc-500 dark:text-zinc-450 mb-6 max-w-sm mx-auto">
          {t('orders_empty_desc') || 'Yuk, mulai pesan Pisang Van Java kesukaan Anda!'}
        </p>

        {/* Loyalty progress */}
        <div className="max-w-xs mx-auto mb-8 p-4 bg-white dark:bg-zinc-900 rounded-[4px] border border-zinc-200 dark:border-zinc-850 shadow-sm text-left">
          <div className="flex justify-between items-center mb-2">
            <span className="text-xs font-bold text-zinc-700 dark:text-zinc-350">Member Emas</span>
            <span className="text-[10px] font-medium text-zinc-400 dark:text-zinc-500">
              0/3 Pesanan
            </span>
          </div>
          <div className="h-2 w-full bg-zinc-100 dark:bg-zinc-800 rounded-[4px] overflow-hidden">
            <div className="h-full bg-amber-brand w-[5%]" />
          </div>
          <p className="text-[10px] text-zinc-500 dark:text-zinc-450 mt-2">
            Pesan 3x lagi untuk membuka Member Emas!
          </p>
        </div>

        <Link
          href="/menu-spesial"
          className="inline-flex items-center gap-2 bg-[#D4802A] hover:bg-[#b56d24] text-white font-bold text-sm px-8 py-3 rounded-[4px] transition-all active:scale-95 shadow-md shadow-[#D4802A]/20"
        >
          {t('orders_empty_btn') || '🍌 Pesan Sekarang'}
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {orders.map((order) => {
        const config = getStatusConfig(order.status, t)
        const StatusIcon = config.icon
        const isExpanded = expandedId === order.id
        const orderDate = new Date(order.createdAt)

        return (
          <motion.div
            key={order.id}
            layout
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className={`bg-white dark:bg-zinc-900 rounded-[4px] border transition-all overflow-hidden ${
              isExpanded
                ? 'border-[#D4802A] ring-1 ring-[#D4802A]/20 shadow-md'
                : 'border-zinc-200 dark:border-zinc-800 shadow-sm hover:border-zinc-300 dark:hover:border-zinc-700'
            }`}
          >
            {/* Card Header */}
            <div
              onClick={() => setExpandedId(isExpanded ? null : order.id)}
              className="p-5 cursor-pointer hover:bg-zinc-50/50 dark:hover:bg-zinc-800/30 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-4 select-none"
            >
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <span
                    className={`px-2.5 py-1 rounded-md text-xs font-bold border flex items-center gap-1.5 ${config.color}`}
                  >
                    <StatusIcon className="w-3.5 h-3.5" />
                    {config.label}
                  </span>
                  <span className="text-sm text-zinc-500 dark:text-zinc-400 font-medium">
                    {orderDate.toLocaleDateString(locale === 'id' ? 'id-ID' : 'en-US', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </span>
                </div>
                <p className="text-sm font-semibold text-zinc-750 dark:text-zinc-300">
                  {t('orders_id') || 'Order ID:'}{' '}
                  <span className="font-mono text-xs ml-1 bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded text-zinc-500 dark:text-zinc-400">
                    {order.id}
                  </span>
                </p>
              </div>

              <div className="flex items-center justify-between md:justify-end gap-6">
                <div className="text-left md:text-right">
                  <p className="text-xs text-zinc-500 dark:text-zinc-450 font-medium mb-0.5">
                    {t('orders_payment_total') || 'Total Pembayaran'}
                  </p>
                  <p className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
                    {formatPrice(order.totalPrice)}
                  </p>
                </div>
                <div
                  className={`transition-transform duration-350 ${
                    isExpanded ? 'rotate-180 text-[#D4802A]' : 'text-zinc-400'
                  }`}
                >
                  <ChevronDown className="w-5 h-5" />
                </div>
              </div>
            </div>

            {/* Card Body */}
            <AnimatePresence>
              {isExpanded && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="border-t border-zinc-100 dark:border-zinc-800 bg-zinc-50/30 dark:bg-zinc-950/20 overflow-hidden"
                >
                  <div className="p-5 md:p-7 space-y-6">
                    {/* Status Timeline */}
                    <OrderTimeline currentStatus={order.status} t={t} />

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                      {/* Left: Product breakdown */}
                      <div className="lg:col-span-2 space-y-4">
                        <h4 className="text-sm font-bold text-zinc-800 dark:text-zinc-200 border-b border-zinc-200 dark:border-zinc-800 pb-2">
                          {t('orders_detail_products') || 'Rincian Produk'}
                        </h4>
                        <div className="space-y-4">
                          {order.items.map((item) => (
                            <div key={item.id} className="flex items-start gap-4">
                              <div className="w-16 h-16 rounded-[4px] bg-zinc-200 dark:bg-zinc-800 overflow-hidden flex-shrink-0 shadow-sm relative">
                                {item.variant?.imageUrl ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img
                                    src={item.variant.imageUrl}
                                    alt={item.variant.flavorName}
                                    className="w-full h-full object-cover"
                                  />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center text-zinc-400 text-xs font-bold bg-zinc-100 dark:bg-zinc-800">
                                    🍌
                                  </div>
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex justify-between items-start gap-2">
                                  <p className="text-sm font-bold text-zinc-800 dark:text-zinc-200 truncate">
                                    {item.variant?.flavorName || 'Menu Terhapus'}
                                  </p>
                                  <p className="text-sm font-bold text-zinc-800 dark:text-zinc-200 shrink-0">
                                    {formatPrice(item.subtotal)}
                                  </p>
                                </div>
                                <p className="text-xs text-zinc-500 dark:text-zinc-450 mt-1">
                                  {item.quantity}x {item.baseType} @ {formatPrice(item.unitPrice)}
                                </p>
                                {item.toppings && item.toppings.length > 0 && (
                                  <div className="mt-2 flex flex-wrap gap-1">
                                    {item.toppings.map((tp) => (
                                      <span
                                        key={tp.name}
                                        className="px-2 py-0.5 bg-zinc-100 dark:bg-zinc-800 rounded text-[10px] font-medium text-zinc-650 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700/80"
                                      >
                                        + {tp.emoji || ''} {tp.name} ({formatPrice(tp.price)})
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Right: Payment & Summary details */}
                      <div className="space-y-6">
                        {/* Payment block */}
                        <div className="bg-white dark:bg-zinc-900 rounded-[4px] p-4 border border-zinc-200 dark:border-zinc-800 shadow-sm">
                          <h4 className="text-sm font-bold text-zinc-800 dark:text-zinc-200 mb-3 flex items-center gap-2">
                            <CreditCard className="w-4 h-4 text-blue-500" />{' '}
                            {t('orders_payment_method') || 'Metode Pembayaran'}
                          </h4>
                          <p className="text-sm font-semibold text-zinc-750 dark:text-zinc-300">
                            {formatPaymentMethod(order.payment?.paymentType || null)}
                          </p>
                          {order.payment?.status && (
                            <p
                              className={`text-xs font-bold mt-1.5 ${
                                order.payment.status === 'PAID'
                                  ? 'text-green-600 dark:text-green-400'
                                  : 'text-yellow-605 dark:text-yellow-400'
                              }`}
                            >
                              Status: {order.payment.status}
                            </p>
                          )}
                        </div>

                        {/* Summary bill block */}
                        <div className="bg-white dark:bg-zinc-900 rounded-[4px] p-4 border border-zinc-200 dark:border-zinc-800 shadow-sm space-y-3">
                          <h4 className="text-sm font-bold text-zinc-800 dark:text-zinc-200 mb-2">
                            {t('orders_summary') || 'Ringkasan Biaya'}
                          </h4>

                          <div className="flex justify-between text-xs text-zinc-600 dark:text-zinc-450">
                            <span>{t('orders_subtotal') || 'Subtotal Produk'}</span>
                            <span>
                              {formatPrice(
                                order.totalPrice - order.deliveryFee + order.discountAmount
                              )}
                            </span>
                          </div>

                          <div className="flex justify-between text-xs text-zinc-600 dark:text-zinc-450">
                            <span>
                              {t('orders_delivery') || 'Ongkos Kirim'}{' '}
                              {order.deliveryMethod ? `(${order.deliveryMethod})` : ''}
                            </span>
                            <span>{formatPrice(order.deliveryFee)}</span>
                          </div>

                          {order.discountAmount > 0 && (
                            <div className="flex justify-between text-xs text-green-650 dark:text-green-400 font-medium">
                              <span>{t('orders_discount') || 'Diskon Voucher'}</span>
                              <span>-{formatPrice(order.discountAmount)}</span>
                            </div>
                          )}

                          <div className="border-t border-zinc-150 dark:border-zinc-800 pt-3 flex justify-between items-center">
                            <span className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                              {t('orders_total') || 'Total Belanja'}
                            </span>
                            <span className="text-base font-bold text-[#D4802A]">
                              {formatPrice(order.totalPrice)}
                            </span>
                          </div>
                        </div>

                        {/* Payment action CTA */}
                        {order.status === 'PENDING_PAYMENT' && (
                          <div className="space-y-2 mb-3">
                            <Link
                              href={`/payment/${order.id}`}
                              className="block w-full bg-[#D4802A] hover:bg-[#b56d24] text-white px-6 py-3 rounded-[4px] font-bold text-sm text-center transition-all shadow-md active:scale-95"
                            >
                              {t('orders_payment_btn') || 'Selesaikan Pembayaran'}
                            </Link>
                            <button
                              type="button"
                              disabled={isCanceling === order.id}
                              onClick={() => handleCancelOrder(order.id)}
                              className="w-full flex items-center justify-center gap-2 border border-red-200 dark:border-red-900/50 hover:bg-red-50 dark:hover:bg-red-950/20 text-red-650 dark:text-red-400 px-6 py-3 rounded-[4px] font-bold text-sm transition-all shadow-sm active:scale-95 disabled:opacity-50"
                            >
                              <XCircle className="w-4 h-4 text-red-500" />
                              {isCanceling === order.id
                                ? 'Membatalkan...'
                                : t('order_cancel_btn') || 'Batalkan Pesanan'}
                            </button>
                          </div>
                        )}

                        {/* Invoice & Reorder buttons */}
                        <div className="flex flex-col gap-2.5">
                          {order.status !== 'CANCELED' && (
                            <a
                              href={`/api/orders/${order.id}/invoice`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="w-full flex items-center justify-center gap-2 border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800/80 text-zinc-700 dark:text-zinc-300 px-6 py-2.5 rounded-[4px] font-bold text-sm transition-all shadow-sm active:scale-95 text-center"
                            >
                              <Download className="w-4 h-4" />{' '}
                              {t('orders_invoice_btn') || 'Unduh Invoice (PDF)'}
                            </a>
                          )}

                          <button
                            type="button"
                            onClick={() => handleReorder(order)}
                            className="w-full flex items-center justify-center gap-2 bg-[#D4802A] hover:bg-[#b56d24] text-white px-6 py-2.5 rounded-[4px] font-bold text-sm transition-all shadow-md active:scale-95"
                          >
                            <Repeat className="w-4 h-4" /> {t('orders_reorder_btn') || 'Pesan Lagi'}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )
      })}

      <p className="text-center text-xs text-zinc-400 dark:text-zinc-500 pt-2">
        Menampilkan {orders.length} pesanan terakhir
      </p>
    </div>
  )
}
