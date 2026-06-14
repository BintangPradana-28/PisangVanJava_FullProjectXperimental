'use client'

import dayjs from 'dayjs'
import { AnimatePresence, motion } from 'framer-motion'
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  CreditCard,
  Download,
  Package,
  RefreshCw,
  Repeat,
  ShoppingBag,
  XCircle
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { toast } from 'react-hot-toast'
import { getUserOrders } from '@/app/actions/orderHistory'
import { useCartStore } from '@/src/features/cart/stores/cart.store'
import 'dayjs/locale/id'
import Link from 'next/link'
import { useLanguage } from '@/context/LanguageContext'

dayjs.locale('id')

type OrderItemType = {
  id: string
  quantity: number
  baseType: string
  unitPrice: number
  subtotal: number
  variant: {
    id: string
    flavorName: string
    imageUrl: string | null
  }
  toppings: Array<{ id: string; name: string; price: number }>
}

type OrderType = {
  id: string
  status: string
  totalPrice: number
  createdAt: Date
  deliveryMethod: string
  deliveryFee: number
  discountAmount: number
  customerName: string | null
  customerPhone: string | null
  items: OrderItemType[]
  payment: {
    status: string
    paymentType: string | null
  } | null
}

const getStatusConfig = (status: string, t: any) => {
  switch (status) {
    case 'PENDING_PAYMENT':
      return {
        color: 'bg-yellow-100 text-yellow-700 border-yellow-200',
        icon: Clock,
        label: t('status_pending') || 'Menunggu Pembayaran'
      }
    case 'PROCESSING':
      return {
        color: 'bg-blue-100 text-blue-700 border-blue-200',
        icon: RefreshCw,
        label: t('status_confirmed') || 'Sedang Diproses'
      }
    case 'READY':
      return {
        color: 'bg-purple-100 text-purple-700 border-purple-200',
        icon: Package,
        label: t('status_ready') || 'Siap Diambil/Dikirim'
      }
    case 'COMPLETED':
      return {
        color: 'bg-green-100 text-green-700 border-green-200',
        icon: CheckCircle2,
        label: t('status_done') || 'Selesai'
      }
    case 'CANCELED':
      return {
        color: 'bg-red-100 text-red-700 border-red-200',
        icon: XCircle,
        label: t('status_cancelled') || 'Dibatalkan'
      }
    default:
      return {
        color: 'bg-zinc-100 text-zinc-700 border-zinc-200',
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

// Order Timeline Component
const OrderTimeline = ({ currentStatus, t }: { currentStatus: string; t: any }) => {
  if (currentStatus === 'CANCELED') {
    return (
      <div className="flex items-center gap-2 p-4 bg-red-50 dark:bg-red-900/10 rounded-[4px] border border-red-100 dark:border-red-900/30">
        <XCircle className="w-5 h-5 text-red-500" />
        <span className="text-sm font-bold text-red-700 dark:text-red-400">
          Pesanan ini telah dibatalkan.
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
        {t('orders_detail_status')}
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
                className={`w-9 h-9 rounded-[4px] flex items-center justify-center transition-all duration-300 border-4 border-white dark:border-zinc-900 ${
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
                      ? 'text-zinc-700 dark:text-zinc-300'
                      : 'text-zinc-400'
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

export default function PesananPage() {
  const { t } = useLanguage()
  const [mounted, setMounted] = useState(false)
  const [orders, setOrders] = useState<OrderType[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null)
  const router = useRouter()
  const addItemToCart = useCartStore((state) => state.addItem)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    const fetchOrders = async () => {
      setLoading(true)
      const res = await getUserOrders()
      if (res.success && res.data) {
        setOrders(res.data as unknown as OrderType[]) // Handle date conversion correctly on client
      } else {
        toast.error(res.error || 'Gagal memuat riwayat pesanan')
      }
      setLoading(false)
    }
    fetchOrders()
  }, [])

  const toggleExpand = (id: string) => {
    setExpandedOrderId((prev) => (prev === id ? null : id))
  }

  const handleReorder = (order: OrderType) => {
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
      toast.success('Pesanan berhasil ditambahkan ke keranjang!')
      router.push('/cart')
    } else {
      toast.error('Gagal menambahkan item. Varian mungkin sudah tidak tersedia.')
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      {/* Header */}
      <div className="flex items-center gap-4 bg-white dark:bg-zinc-900 rounded-[4px] p-6 shadow-sm border border-zinc-200/50 dark:border-zinc-800/80">
        <div className="w-12 h-12 rounded-[4px] bg-orange-50 dark:bg-orange-900/20 flex items-center justify-center">
          <ShoppingBag className="w-6 h-6 text-[#D4802A]" />
        </div>
        <div>
          <h2 className="text-xl font-bold font-serif text-zinc-900 dark:text-zinc-100">
            {t('orders_title')}
          </h2>
          <p className="text-sm text-zinc-500">{t('orders_subtitle')}</p>
        </div>
      </div>

      {/* Order List */}
      <div className="space-y-4">
        {loading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="bg-zinc-100 dark:bg-zinc-800 animate-pulse h-32 rounded-[4px]"
            ></div>
          ))
        ) : orders.length === 0 ? (
          <div className="bg-white dark:bg-zinc-900 rounded-[4px] p-8 text-center border border-dashed border-zinc-300 dark:border-zinc-700">
            <Package className="w-12 h-12 text-zinc-300 mx-auto mb-3" />
            <p className="text-zinc-500 font-medium">{t('orders_empty')}</p>
            <p className="text-sm text-zinc-400 mt-1 mb-4">{t('orders_empty_desc')}</p>
            <Link href="/menu-spesial" className="text-[#D4802A] font-bold text-sm hover:underline">
              {t('orders_empty_btn')}
            </Link>
          </div>
        ) : (
          orders.map((order) => {
            const statusConfig = getStatusConfig(order.status, t)
            const StatusIcon = statusConfig.icon
            const isExpanded = expandedOrderId === order.id

            return (
              <div
                key={order.id}
                className={`bg-white dark:bg-zinc-900 rounded-[4px] border transition-all overflow-hidden ${isExpanded ? 'border-[#D4802A] ring-1 ring-[#D4802A]/20 shadow-md' : 'border-zinc-200 dark:border-zinc-800 shadow-sm'}`}
              >
                {/* Card Header (Always Visible) */}
                <div
                  onClick={() => toggleExpand(order.id)}
                  className="p-5 cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-4"
                >
                  <div className="space-y-2">
                    <div className="flex items-center gap-3">
                      <span
                        className={`px-2.5 py-1 rounded-md text-xs font-bold border flex items-center gap-1.5 ${statusConfig.color}`}
                      >
                        <StatusIcon className="w-3.5 h-3.5" />
                        {statusConfig.label}
                      </span>
                      <span className="text-sm text-zinc-500 dark:text-zinc-400 font-medium">
                        {mounted ? dayjs(order.createdAt).format('DD MMM YYYY, HH:mm') : ''}
                      </span>
                    </div>
                    <p className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
                      {t('orders_id')}{' '}
                      <span className="font-mono text-xs ml-1 bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded text-zinc-500">
                        {order.id}
                      </span>
                    </p>
                  </div>

                  <div className="flex items-center justify-between md:justify-end gap-6">
                    <div className="text-left md:text-right">
                      <p className="text-xs text-zinc-500 font-medium mb-0.5">
                        {t('orders_payment_total')}
                      </p>
                      <p className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
                        Rp {new Intl.NumberFormat('id-ID').format(order.totalPrice)}
                      </p>
                    </div>
                    <div
                      className={`transition-transform duration-300 ${isExpanded ? 'rotate-180 text-[#D4802A]' : 'text-zinc-400'}`}
                    >
                      <ChevronDown className="w-5 h-5" />
                    </div>
                  </div>
                </div>

                {/* Expanded Details (Rincian Pembelian & Timeline) */}
                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="border-t border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/30 overflow-hidden"
                    >
                      <div className="p-5 md:p-7 space-y-8">
                        {/* Status Timeline */}
                        <OrderTimeline currentStatus={order.status} t={t} />

                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                          {/* Left Column: Items Breakdown */}
                          <div className="lg:col-span-2 space-y-4">
                            <h4 className="text-sm font-bold text-zinc-800 dark:text-zinc-200 border-b border-zinc-200 dark:border-zinc-800 pb-2">
                              {t('orders_detail_products')}
                            </h4>
                            <div className="space-y-4">
                              {order.items.map((item) => (
                                <div key={item.id} className="flex items-start gap-4">
                                  <div className="w-16 h-16 rounded-[4px] bg-zinc-200 dark:bg-zinc-800 overflow-hidden flex-shrink-0 shadow-sm">
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
                                  <div className="flex-1">
                                    <div className="flex justify-between items-start">
                                      <p className="text-sm font-bold text-zinc-800 dark:text-zinc-200">
                                        {item.variant?.flavorName || 'Menu Terhapus'}
                                      </p>
                                      <p className="text-sm font-bold text-zinc-800 dark:text-zinc-200 whitespace-nowrap">
                                        Rp {new Intl.NumberFormat('id-ID').format(item.subtotal)}
                                      </p>
                                    </div>
                                    <p className="text-xs text-zinc-500 mt-1">
                                      {item.quantity}x {item.baseType} @ Rp{' '}
                                      {new Intl.NumberFormat('id-ID').format(item.unitPrice)}
                                    </p>
                                    {item.toppings && item.toppings.length > 0 && (
                                      <div className="mt-2 flex flex-wrap gap-1">
                                        {item.toppings.map((t) => (
                                          <span
                                            key={t.name}
                                            className="px-2 py-0.5 bg-zinc-100 dark:bg-zinc-800 rounded text-[10px] font-medium text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700"
                                          >
                                            + {t.name} (Rp{' '}
                                            {new Intl.NumberFormat('id-ID').format(t.price)})
                                          </span>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>

                          {/* Right Column: Payment & Shipping Summary */}
                          <div className="space-y-6">
                            {/* Payment Method Block */}
                            <div className="bg-white dark:bg-zinc-900 rounded-[4px] p-4 border border-zinc-200 dark:border-zinc-800 shadow-sm">
                              <h4 className="text-sm font-bold text-zinc-800 dark:text-zinc-200 mb-3 flex items-center gap-2">
                                <CreditCard className="w-4 h-4 text-blue-500" />{' '}
                                {t('orders_payment_method')}
                              </h4>
                              <p className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
                                {formatPaymentMethod(order.payment?.paymentType || null)}
                              </p>
                              {order.payment?.status && (
                                <p
                                  className={`text-xs font-bold mt-1 ${order.payment.status === 'PAID' ? 'text-green-600' : 'text-yellow-600'}`}
                                >
                                  Status: {order.payment.status}
                                </p>
                              )}
                            </div>

                            {/* Summary Block */}
                            <div className="bg-white dark:bg-zinc-900 rounded-[4px] p-4 border border-zinc-200 dark:border-zinc-800 shadow-sm space-y-3">
                              <h4 className="text-sm font-bold text-zinc-800 dark:text-zinc-200 mb-2">
                                {t('orders_summary')}
                              </h4>

                              <div className="flex justify-between text-xs text-zinc-600 dark:text-zinc-400">
                                <span>{t('orders_subtotal')}</span>
                                <span>
                                  Rp{' '}
                                  {new Intl.NumberFormat('id-ID').format(
                                    order.totalPrice - order.deliveryFee + order.discountAmount
                                  )}
                                </span>
                              </div>

                              <div className="flex justify-between text-xs text-zinc-600 dark:text-zinc-400">
                                <span>
                                  {t('orders_delivery')} ({order.deliveryMethod})
                                </span>
                                <span>
                                  Rp {new Intl.NumberFormat('id-ID').format(order.deliveryFee)}
                                </span>
                              </div>

                              {order.discountAmount > 0 && (
                                <div className="flex justify-between text-xs text-green-600 dark:text-green-400 font-medium">
                                  <span>{t('orders_discount')}</span>
                                  <span>
                                    -Rp{' '}
                                    {new Intl.NumberFormat('id-ID').format(order.discountAmount)}
                                  </span>
                                </div>
                              )}

                              <div className="border-t border-zinc-100 dark:border-zinc-800 pt-3 flex justify-between items-center">
                                <span className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                                  {t('orders_total')}
                                </span>
                                <span className="text-base font-bold text-[#D4802A]">
                                  Rp {new Intl.NumberFormat('id-ID').format(order.totalPrice)}
                                </span>
                              </div>
                            </div>

                            {/* Payment Action Button */}
                            {order.status === 'PENDING_PAYMENT' && (
                              <Link
                                href={`/payment/${order.id}`}
                                className="block w-full bg-[#D4802A] hover:bg-[#b56d24] text-white px-6 py-3 rounded-[4px] font-bold text-sm text-center transition-all shadow-md active:scale-95 mb-3"
                              >
                                {t('orders_payment_btn')}
                              </Link>
                            )}

                            {/* Action Buttons */}
                            <div className="flex flex-col gap-2.5">
                              <a
                                href={`/api/orders/${order.id}/invoice`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="w-full flex items-center justify-center gap-2 border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 px-6 py-2.5 rounded-[4px] font-bold text-sm transition-all shadow-sm active:scale-95 text-center"
                              >
                                <Download className="w-4 h-4" /> {t('orders_invoice_btn')}
                              </a>

                              <button
                                onClick={() => handleReorder(order)}
                                className="w-full flex items-center justify-center gap-2 bg-[#D4802A] hover:bg-[#b56d24] text-white px-6 py-2.5 rounded-[4px] font-bold text-sm transition-all shadow-md active:scale-95"
                              >
                                <Repeat className="w-4 h-4" /> {t('orders_reorder_btn')}
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )
          })
        )}
      </div>
    </motion.div>
  )
}
