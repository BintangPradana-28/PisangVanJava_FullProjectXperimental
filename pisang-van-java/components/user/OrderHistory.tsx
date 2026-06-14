'use client'
import { AnimatePresence, motion } from 'framer-motion'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
// components/user/OrderHistory.tsx — Riwayat Pesanan Pelanggan
import { useCallback, useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { useCartStore } from '@/src/features/cart/stores/cart.store'

interface OrderItem {
  id: string
  baseType: string
  quantity: number
  subtotal: number
  variant: {
    id: string
    flavorName: string
    priceKembung: number
    priceLumpia: number
    priceKrispy: number
  }
  toppings?: { id: string; name: string; emoji: string | null; price: number }[] | null
}

interface Order {
  id: string
  customerName: string
  status: string
  totalPrice: number
  createdAt: string
  deliveryMethod?: string
  items: OrderItem[]
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: string }> = {
  pending: {
    label: 'Menunggu',
    color: 'text-yellow-700',
    bg: 'bg-yellow-50 dark:bg-yellow-950/20',
    icon: '⏳'
  },
  paid: {
    label: 'Dibayar',
    color: 'text-emerald-700',
    bg: 'bg-emerald-50 dark:bg-emerald-950/20',
    icon: '💳'
  },
  confirmed: {
    label: 'Dikonfirmasi',
    color: 'text-blue-700',
    bg: 'bg-blue-50 dark:bg-blue-950/20',
    icon: '✅'
  },
  ready: {
    label: 'Siap Diambil',
    color: 'text-purple-700',
    bg: 'bg-purple-50 dark:bg-purple-950/20',
    icon: '📦'
  },
  done: {
    label: 'Selesai',
    color: 'text-green-700',
    bg: 'bg-green-50 dark:bg-green-950/20',
    icon: '🎉'
  },
  cancelled: {
    label: 'Dibatalkan',
    color: 'text-red-700',
    bg: 'bg-red-50 dark:bg-red-950/20',
    icon: '❌'
  }
}

const formatPrice = (n: number) =>
  new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0
  }).format(n)

interface Props {
  phone?: string
  useAuth?: boolean
}

export default function OrderHistory({ phone = '', useAuth = false }: Props) {
  const [orders, setOrders] = useState<Order[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const router = useRouter()
  const addToCart = useCartStore((s) => s.addItem)

  const handleReorder = (order: Order) => {
    order.items.forEach((item) => {
      let basePrice = item.variant.priceKembung
      if (item.baseType === 'Lumpia') basePrice = item.variant.priceLumpia
      if (item.baseType === 'Krispy') basePrice = item.variant.priceKrispy

      addToCart({
        menuVariantId: item.variant.id,
        variantName: `${item.variant.flavorName} (${item.baseType})`,
        basePrice,
        toppings: item.toppings
          ? item.toppings.map((t: any) => ({ toppingId: t.id, name: t.name, priceAdd: t.price }))
          : [],
        quantity: item.quantity,
        notes: ''
      })
    })
    toast.success('Pesanan ditambahkan ke keranjang')
    router.push('/keranjang')
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
        const encodedPhone = encodeURIComponent(phone)
        res = await fetch(`/api/orders/track?phone=${encodedPhone}`, {
          credentials: 'include',
          cache: 'no-store'
        })
      }
      const data = await res.json()
      if (data.success) {
        setOrders(data.data)
      } else {
        setError('Gagal memuat riwayat pesanan.')
      }
    } catch {
      setError('Koneksi bermasalah. Coba refresh halaman.')
    } finally {
      setIsLoading(false)
    }
  }, [phone])

  useEffect(() => {
    fetchOrders()
  }, [fetchOrders])

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-20 rounded-[4px] bg-zinc-100 dark:bg-zinc-800 animate-pulse" />
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/50 rounded-[4px] p-6 text-center">
        <p className="text-red-600 dark:text-red-400 font-medium text-sm mb-3">{error}</p>
        <button onClick={fetchOrders} className="text-xs font-bold text-red-600 hover:underline">
          Coba Lagi
        </button>
      </div>
    )
  }

  if (orders.length === 0) {
    return (
      <div className="bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded-[4px] p-8 sm:p-12 text-center">
        <div className="text-5xl mb-4">📋</div>
        <h3 className="font-bold text-zinc-800 dark:text-zinc-200 mb-2 text-lg">
          Belum Ada Pesanan
        </h3>
        <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-6 max-w-sm mx-auto">
          Yuk, mulai pesan Pisang Van Java kesukaan Anda!
        </p>

        {/* Sprint 5: Visual loyalty progress placeholder */}
        <div className="max-w-xs mx-auto mb-8 p-4 bg-white dark:bg-zinc-800 rounded-[4px] border border-zinc-100 dark:border-zinc-700 shadow-sm text-left">
          <div className="flex justify-between items-center mb-2">
            <span className="text-xs font-bold text-zinc-700 dark:text-zinc-300">Member Emas</span>
            <span className="text-[10px] font-medium text-zinc-400 dark:text-zinc-500">
              0/3 Pesanan
            </span>
          </div>
          <div className="h-2 w-full bg-zinc-100 dark:bg-zinc-700 rounded-[4px] overflow-hidden">
            <div className="h-full bg-amber-400 w-[5%]" />
          </div>
          <p className="text-[10px] text-zinc-500 mt-2">Pesan 3x lagi untuk membuka Member Emas!</p>
        </div>

        {/* Sprint 5: Popular products suggestion */}
        <div className="mb-8">
          <p className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-4">
            🔥 Coba yang populer minggu ini
          </p>
          <div className="flex justify-center gap-3 flex-wrap">
            {['Coklat Keju (Kembung)', 'Matcha (Krispy)', 'Tiramisu (Lumpia)'].map((item) => (
              <div
                key={item}
                className="px-3 py-1.5 text-xs font-medium bg-amber-50 dark:bg-amber-950/20 text-amber-700 dark:text-amber-400 border border-amber-100 dark:border-amber-900/40 rounded-lg"
              >
                {item}
              </div>
            ))}
          </div>
        </div>

        <Link
          href="/menu-spesial"
          className="inline-flex items-center gap-2 bg-[#D4802A] hover:bg-[#b56d24] text-white font-bold text-sm px-8 py-3.5 rounded-[4px] transition-all active:scale-95 shadow-md shadow-[#D4802A]/20"
        >
          🍌 Pesan Sekarang
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {orders.map((order) => {
        const cfg = STATUS_CONFIG[order.status] ?? STATUS_CONFIG.pending
        const isEx = expandedId === order.id
        const date = new Date(order.createdAt)

        return (
          <motion.div
            key={order.id}
            layout
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white dark:bg-zinc-900 border border-zinc-200/60 dark:border-zinc-800 rounded-[4px] overflow-hidden hover:border-zinc-300 dark:hover:border-zinc-700 transition-all shadow-sm hover:shadow-md"
          >
            {/* Header Row */}
            <div
              className="flex items-center gap-4 p-4 cursor-pointer"
              onClick={() => setExpandedId(isEx ? null : order.id)}
            >
              {/* Status badge */}
              <div
                className={`flex-shrink-0 w-10 h-10 rounded-[4px] flex items-center justify-center text-lg ${cfg.bg}`}
              >
                {cfg.icon}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-mono text-zinc-400 dark:text-zinc-500">
                    #{order.id.slice(-8)}
                  </span>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-[4px] ${cfg.bg} ${cfg.color}`}
                  >
                    {cfg.label}
                  </span>
                </div>
                <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">
                  {order.items.length} item •
                  {date.toLocaleDateString('id-ID', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </p>
              </div>

              {/* Price + chevron */}
              <div className="text-right flex-shrink-0 flex items-center gap-2">
                <span className="font-bold text-zinc-900 dark:text-zinc-100 text-sm">
                  {formatPrice(order.totalPrice)}
                </span>
                <span className="text-zinc-300 dark:text-zinc-600 text-xs">{isEx ? '▲' : '▼'}</span>
              </div>
            </div>

            {/* Expanded items */}
            <AnimatePresence>
              {isEx && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <div className="border-t border-zinc-100 dark:border-zinc-800 px-4 pt-3 pb-4">
                    <div className="space-y-2 bg-zinc-50 dark:bg-zinc-800/40 rounded-[4px] p-3">
                      {order.items.map((item) => (
                        <div key={item.id} className="flex justify-between text-sm gap-2">
                          <span className="text-zinc-600 dark:text-zinc-400">
                            {item.variant.flavorName}
                            <span className="text-xs text-zinc-400 ml-1">({item.baseType})</span>
                            {item.toppings && item.toppings.length > 0 && (
                              <span className="text-xs text-amber-500 ml-1">
                                +{' '}
                                {item.toppings
                                  .map((t: any) => `${t.emoji || ''} ${t.name}`)
                                  .join(', ')}
                              </span>
                            )}
                            {item.quantity > 1 && (
                              <span className="text-xs text-zinc-400 ml-1">×{item.quantity}</span>
                            )}
                          </span>
                          <span className="font-semibold text-zinc-700 dark:text-zinc-300 shrink-0">
                            {formatPrice(item.subtotal)}
                          </span>
                        </div>
                      ))}
                      <div className="pt-2 border-t border-zinc-200 dark:border-zinc-700 flex justify-between font-bold text-zinc-800 dark:text-zinc-200">
                        <span>Total</span>
                        <span>{formatPrice(order.totalPrice)}</span>
                      </div>
                    </div>

                    {/* Action for done orders → review CTA */}
                    {order.status === 'done' && (
                      <div className="mt-3 p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900/40 rounded-[4px] flex flex-col sm:flex-row items-center justify-between gap-3">
                        <p className="text-xs text-amber-700 dark:text-amber-400 font-medium">
                          🌟 Pesanan selesai! Bagikan pengalaman atau pesan lagi.
                        </p>
                        <div className="flex gap-2 w-full sm:w-auto">
                          <Link
                            href="/ulasan"
                            className="flex-1 sm:flex-none text-center text-xs font-bold border border-amber-500 text-amber-600 hover:bg-amber-100 dark:hover:bg-amber-900/50 px-3 py-1.5 rounded-lg transition-all"
                          >
                            Ulas
                          </Link>
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              handleReorder(order)
                            }}
                            className="flex-1 sm:flex-none text-center text-xs font-bold bg-[#D4802A] hover:bg-[#b56d24] text-white px-3 py-1.5 rounded-lg transition-all shadow-sm"
                          >
                            Pesan Lagi
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Pending → reminder & ETA */}
                    {(order.status === 'pending' ||
                      order.status === 'confirmed' ||
                      order.status === 'ready' ||
                      order.status === 'processing' ||
                      order.status === 'paid') && (
                      <div className="mt-3 bg-amber-50/50 dark:bg-amber-950/10 border border-amber-100/50 dark:border-amber-900/30 rounded-[4px] p-3 text-center">
                        <p className="text-xs text-zinc-500 mb-1">
                          Pesanan Anda sedang diproses. Kami akan segera menghubungi Anda.
                        </p>
                        <span className="text-xs font-bold text-amber-700 bg-amber-100/50 dark:bg-amber-900/30 px-2 py-1 rounded-md inline-flex items-center gap-1 mt-1">
                          ⏱️ Estimasi tiba: 30-45 menit
                        </span>
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )
      })}

      <p className="text-center text-xs text-zinc-400 pt-2">
        Menampilkan {orders.length} pesanan terakhir
      </p>
    </div>
  )
}
