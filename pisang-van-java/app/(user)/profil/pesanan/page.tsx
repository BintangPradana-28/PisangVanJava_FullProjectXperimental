'use client'

import React, { useEffect, useState } from 'react'
import { Receipt, Search, ChevronDown, ChevronUp, Package, Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { useCartStore } from '@/src/lib/store/useCartStore'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

interface OrderItem {
  id: string
  baseType: string
  quantity: number
  price: number
  toppingName?: string | null
  toppingPrice?: number | null
  topping?: { name: string, price: number } | null
  notes?: string | null
  variantId: string
  toppingId?: string | null
}

interface Order {
  id: string
  createdAt: string
  status: string
  totalPrice: number
  items: OrderItem[]
  deliveryMethod: string
  deliveryFee: number
  discountAmount: number
  voucherCode?: string | null
}

// Reorder Logic (Mirip dengan track-order)
function ReorderButton({ order }: { order: Order }) {
  const [loading, setLoading] = useState(false)
  const addToCart = useCartStore((s) => s.addItem)
  const router = useRouter()

  const handleReorder = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/menu')
      const menuData = await res.json()
      if (!menuData.success) throw new Error('Failed to fetch menu')
      const availableVariants = menuData.data

      let addedCount = 0
      for (const item of order.items) {
        // Cari varian dari DB yang sesuai dengan variantId lama pesanan ini
        const variant = availableVariants.find((v: any) => v.id === item.variantId)
        if (!variant) continue // Menu sudah tidak ada

        const baseTypeFormatted = item.baseType.charAt(0).toUpperCase() + item.baseType.slice(1).toLowerCase()
        const fullName = `${variant.flavorName} (${baseTypeFormatted})`
        
        // Asumsi topping menggunakan ID dari item.toppingId jika ada
        const finalToppingId = item.toppingId || undefined
        const finalToppingName = item.topping?.name || undefined
        const finalToppingPrice = item.topping?.price || 0

        addToCart({
          productId: variant.id,
          name: fullName,
          basePrice: variant.price,
          quantity: item.quantity,
          baseType: item.baseType as any,
          toppingId: finalToppingId,
          toppingName: finalToppingName,
          toppingPrice: finalToppingPrice,
          notes: item.notes || '',
        })
        addedCount++
      }

      if (addedCount > 0) {
        toast.success(`${addedCount} item ditambahkan ke keranjang!`)
        router.push('/checkout') // Redirect ke checkout
      } else {
        toast.error('Semua item dalam pesanan ini sedang tidak tersedia.')
      }
    } catch {
      toast.error('Gagal memuat data menu. Coba lagi.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={handleReorder}
      disabled={loading || order.status === 'cancelled'}
      className="flex items-center gap-1.5 text-xs font-bold px-4 py-2 rounded-full transition-all duration-200 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed text-white"
      style={{
        background: order.status === 'cancelled' ? '#f4f4f5' : '#D4802A',
        color: order.status === 'cancelled' ? '#71717a' : 'white',
      }}
    >
      {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : '🛒'}
      {loading ? 'Memproses...' : 'Pesan Lagi'}
    </button>
  )
}

export default function PesananPage() {
  const [orders, setOrders] = useState<Order[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  useEffect(() => {
    fetchOrders()
  }, [])

  const fetchOrders = async () => {
    setIsLoading(true)
    try {
      const res = await fetch('/api/user/orders')
      const data = await res.json()
      if (data.success) {
        setOrders(data.data)
      }
    } catch (error) {
      toast.error('Gagal mengambil riwayat pesanan')
    } finally {
      setIsLoading(false)
    }
  }

  const formatPrice = (amount: number) =>
    new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(amount)

  const STATUS_LABELS: Record<string, { label: string, color: string }> = {
    pending: { label: 'Menunggu Pembayaran', color: 'text-amber-600 bg-amber-50 border-amber-200' },
    paid: { label: 'Dibayar', color: 'text-blue-600 bg-blue-50 border-blue-200' },
    processing: { label: 'Sedang Diproses', color: 'text-purple-600 bg-purple-50 border-purple-200' },
    ready: { label: 'Siap Dikirim / Diambil', color: 'text-indigo-600 bg-indigo-50 border-indigo-200' },
    done: { label: 'Selesai', color: 'text-green-600 bg-green-50 border-green-200' },
    cancelled: { label: 'Dibatalkan', color: 'text-red-600 bg-red-50 border-red-200' },
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-white mb-1">Riwayat Pesanan</h1>
        <p className="text-sm text-zinc-500">Daftar semua pesanan yang pernah Anda buat</p>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {[1,2,3].map(i => (
            <div key={i} className="animate-pulse bg-zinc-50 dark:bg-zinc-800/50 rounded-2xl h-32" />
          ))}
        </div>
      ) : orders.length === 0 ? (
        <div className="text-center py-16 border-2 border-dashed border-zinc-200 dark:border-zinc-800 rounded-3xl">
          <Receipt className="w-12 h-12 text-zinc-300 mx-auto mb-4" />
          <h3 className="text-lg font-bold text-zinc-700 dark:text-zinc-300">Belum ada pesanan</h3>
          <p className="text-sm text-zinc-500 mb-6">Mulai belanja menu spesial kami sekarang juga!</p>
          <Link href="/menu-spesial" className="px-6 py-2 bg-[#D4802A] text-white rounded-full text-sm font-semibold hover:bg-[#b56d24] transition-colors">
            Lihat Menu
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {orders.map(order => {
            const statusInfo = STATUS_LABELS[order.status] || { label: order.status, color: 'text-zinc-600 bg-zinc-50 border-zinc-200' }
            const isExpanded = expandedId === order.id

            return (
              <div key={order.id} className="border border-zinc-200 dark:border-zinc-800 rounded-2xl overflow-hidden bg-white dark:bg-zinc-900 transition-all">
                {/* Header Pesanan */}
                <div 
                  className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors"
                  onClick={() => setExpandedId(isExpanded ? null : order.id)}
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-zinc-100 dark:bg-zinc-800 rounded-xl flex items-center justify-center shrink-0">
                      <Package className="w-6 h-6 text-zinc-500" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-bold text-sm text-zinc-900 dark:text-white">Order #{order.id.slice(0, 8)}</span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${statusInfo.color}`}>
                          {statusInfo.label}
                        </span>
                      </div>
                      <p className="text-xs text-zinc-500">
                        {new Date(order.createdAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between md:justify-end gap-6 w-full md:w-auto">
                    <div className="text-left md:text-right">
                      <p className="text-xs text-zinc-500 mb-0.5">Total Belanja</p>
                      <p className="font-bold text-[#D4802A]">{formatPrice(order.totalPrice)}</p>
                    </div>
                    {isExpanded ? <ChevronUp className="w-5 h-5 text-zinc-400" /> : <ChevronDown className="w-5 h-5 text-zinc-400" />}
                  </div>
                </div>

                {/* Detail Pesanan (Expanded) */}
                {isExpanded && (
                  <div className="px-5 pb-5 pt-2 border-t border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/20">
                    <div className="py-4 space-y-4">
                      
                      {/* Items */}
                      <div className="space-y-3">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-500">Detail Item</h4>
                        {order.items.map((item, idx) => {
                          const itemTotal = (item.price + (item.toppingPrice || 0)) * item.quantity
                          return (
                            <div key={idx} className="flex justify-between items-start text-sm">
                              <div>
                                <p className="font-semibold text-zinc-800 dark:text-zinc-200">
                                  {item.quantity}x {item.baseType}
                                </p>
                                {item.topping?.name && <p className="text-xs text-[#D4802A]">+ {item.topping.name}</p>}
                                {item.notes && <p className="text-xs text-zinc-500 italic mt-0.5">Catatan: {item.notes}</p>}
                              </div>
                              <p className="font-semibold text-zinc-800 dark:text-zinc-200">{formatPrice(itemTotal)}</p>
                            </div>
                          )
                        })}
                      </div>

                      <hr className="border-dashed border-zinc-200 dark:border-zinc-700" />

                      {/* Summary */}
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between text-zinc-600 dark:text-zinc-400">
                          <span>Subtotal Item</span>
                          <span>{formatPrice(order.totalPrice - order.deliveryFee + order.discountAmount)}</span>
                        </div>
                        {order.deliveryFee > 0 && (
                          <div className="flex justify-between text-zinc-600 dark:text-zinc-400">
                            <span>Ongkos Kirim ({order.deliveryMethod})</span>
                            <span>{formatPrice(order.deliveryFee)}</span>
                          </div>
                        )}
                        {order.discountAmount > 0 && (
                          <div className="flex justify-between text-green-600 dark:text-green-400">
                            <span>Diskon Voucher {order.voucherCode ? `(${order.voucherCode})` : ''}</span>
                            <span>-{formatPrice(order.discountAmount)}</span>
                          </div>
                        )}
                      </div>

                    </div>
                    
                    {/* Actions */}
                    <div className="flex flex-wrap items-center justify-between gap-4 mt-2 pt-4 border-t border-zinc-200 dark:border-zinc-700">
                      <div className="flex gap-2">
                        {order.status === 'done' && (
                          <Link href="/ulasan" className="text-xs font-bold text-amber-600 hover:text-amber-700 px-3 py-1.5 rounded-lg border border-amber-200 bg-amber-50">
                            ⭐ Beri Ulasan
                          </Link>
                        )}
                        {order.status !== 'cancelled' && (
                          <a 
                            href={`/api/orders/${order.id}/invoice`} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-xs font-bold text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 transition-colors flex items-center gap-1.5"
                          >
                            📄 Invoice
                          </a>
                        )}
                      </div>
                      <ReorderButton order={order} />
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
