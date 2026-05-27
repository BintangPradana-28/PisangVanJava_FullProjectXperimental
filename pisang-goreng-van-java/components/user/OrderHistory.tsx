'use client'
// components/user/OrderHistory.tsx — Riwayat Pesanan Pelanggan
import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Link from 'next/link'

interface OrderItem {
  id: string
  baseType: string
  quantity: number
  subtotal: number
  variant: { flavorName: string }
  topping?: { name: string; emoji: string | null } | null
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
  pending:   { label: 'Menunggu',      color: 'text-yellow-700',  bg: 'bg-yellow-50 dark:bg-yellow-950/20',   icon: '⏳' },
  paid:      { label: 'Dibayar',       color: 'text-emerald-700', bg: 'bg-emerald-50 dark:bg-emerald-950/20', icon: '💳' },
  confirmed: { label: 'Dikonfirmasi', color: 'text-blue-700',    bg: 'bg-blue-50 dark:bg-blue-950/20',       icon: '✅' },
  ready:     { label: 'Siap Diambil', color: 'text-purple-700',  bg: 'bg-purple-50 dark:bg-purple-950/20',   icon: '📦' },
  done:      { label: 'Selesai',       color: 'text-green-700',   bg: 'bg-green-50 dark:bg-green-950/20',     icon: '🎉' },
  cancelled: { label: 'Dibatalkan',   color: 'text-red-700',     bg: 'bg-red-50 dark:bg-red-950/20',         icon: '❌' },
}

const formatPrice = (n: number) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(n)

interface Props {
  phone: string
}

export default function OrderHistory({ phone }: Props) {
  const [orders, setOrders]     = useState<Order[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [error, setError]       = useState<string | null>(null)

  const fetchOrders = useCallback(async () => {
    if (!phone) { setIsLoading(false); return }
    setIsLoading(true)
    setError(null)
    try {
      const encodedPhone = encodeURIComponent(phone)
      const res  = await fetch(`/api/orders/track?phone=${encodedPhone}`, { credentials: 'include', cache: 'no-store' })
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

  useEffect(() => { fetchOrders() }, [fetchOrders])

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-20 rounded-2xl bg-zinc-100 dark:bg-zinc-800 animate-pulse" />
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/50 rounded-2xl p-6 text-center">
        <p className="text-red-600 dark:text-red-400 font-medium text-sm mb-3">{error}</p>
        <button onClick={fetchOrders} className="text-xs font-bold text-red-600 hover:underline">Coba Lagi</button>
      </div>
    )
  }

  if (orders.length === 0) {
    return (
      <div className="bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-12 text-center">
        <div className="text-5xl mb-4">📋</div>
        <h3 className="font-bold text-zinc-700 dark:text-zinc-300 mb-2">Belum Ada Pesanan</h3>
        <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-5">
          Yuk, mulai pesan Pisang Van Java kesukaan Anda!
        </p>
        <Link href="/menu-spesial"
          className="inline-flex items-center gap-2 bg-[#D4802A] hover:bg-[#b56d24] text-white font-bold text-sm px-6 py-3 rounded-xl transition-all active:scale-95">
          🍌 Lihat Menu
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {orders.map(order => {
        const cfg   = STATUS_CONFIG[order.status] ?? STATUS_CONFIG.pending
        const isEx  = expandedId === order.id
        const date  = new Date(order.createdAt)

        return (
          <motion.div
            key={order.id} layout
            initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
            className="bg-white dark:bg-zinc-900 border border-zinc-200/60 dark:border-zinc-800 rounded-2xl overflow-hidden hover:border-zinc-300 dark:hover:border-zinc-700 transition-all shadow-sm hover:shadow-md"
          >
            {/* Header Row */}
            <div
              className="flex items-center gap-4 p-4 cursor-pointer"
              onClick={() => setExpandedId(isEx ? null : order.id)}
            >
              {/* Status badge */}
              <div className={`flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center text-lg ${cfg.bg}`}>
                {cfg.icon}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-mono text-zinc-400 dark:text-zinc-500">#{order.id.slice(-8)}</span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${cfg.bg} ${cfg.color}`}>
                    {cfg.label}
                  </span>
                </div>
                <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">
                  {order.items.length} item •
                  {date.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>

              {/* Price + chevron */}
              <div className="text-right flex-shrink-0 flex items-center gap-2">
                <span className="font-bold text-zinc-900 dark:text-zinc-100 text-sm">{formatPrice(order.totalPrice)}</span>
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
                    <div className="space-y-2 bg-zinc-50 dark:bg-zinc-800/40 rounded-xl p-3">
                      {order.items.map(item => (
                        <div key={item.id} className="flex justify-between text-sm gap-2">
                          <span className="text-zinc-600 dark:text-zinc-400">
                            {item.variant.flavorName}
                            <span className="text-xs text-zinc-400 ml-1">({item.baseType})</span>
                            {item.topping && <span className="text-xs text-amber-500 ml-1">+ {item.topping.emoji} {item.topping.name}</span>}
                            {item.quantity > 1 && <span className="text-xs text-zinc-400 ml-1">×{item.quantity}</span>}
                          </span>
                          <span className="font-semibold text-zinc-700 dark:text-zinc-300 shrink-0">{formatPrice(item.subtotal)}</span>
                        </div>
                      ))}
                      <div className="pt-2 border-t border-zinc-200 dark:border-zinc-700 flex justify-between font-bold text-zinc-800 dark:text-zinc-200">
                        <span>Total</span>
                        <span>{formatPrice(order.totalPrice)}</span>
                      </div>
                    </div>

                    {/* Action for done orders → review CTA */}
                    {order.status === 'done' && (
                      <div className="mt-3 p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900/40 rounded-xl flex items-center justify-between">
                        <p className="text-xs text-amber-700 dark:text-amber-400 font-medium">
                          🌟 Pesanan selesai! Bagikan pengalaman Anda.
                        </p>
                        <Link href="/ulasan"
                          className="text-xs font-bold bg-amber-500 hover:bg-amber-600 text-white px-3 py-1.5 rounded-lg transition-all shrink-0 ml-2">
                          Tulis Ulasan
                        </Link>
                      </div>
                    )}

                    {/* Pending → reminder */}
                    {(order.status === 'pending' || order.status === 'confirmed' || order.status === 'ready') && (
                      <p className="mt-3 text-xs text-center text-zinc-400">
                        Pesanan Anda sedang diproses. Kami akan segera menghubungi Anda.
                      </p>
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
