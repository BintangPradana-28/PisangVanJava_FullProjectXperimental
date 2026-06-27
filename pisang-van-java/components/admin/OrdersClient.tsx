'use client'
import { AnimatePresence, motion } from 'framer-motion'
import { useRouter, useSearchParams } from 'next/navigation'
// components/admin/OrdersClient.tsx — COMMAND CENTER v2 (Real-time + Bulk + CSV)
import { useCallback, useEffect, useRef, useState } from 'react'
import toast from 'react-hot-toast'
import { formatPrice } from '@/lib/utils'
import { supabaseBrowserClient } from '@/src/lib/supabase-client'

type OrderStatus =
  | 'PENDING_PAYMENT'
  | 'PROCESSING'
  | 'READY'
  | 'OUT_FOR_DELIVERY'
  | 'DELIVERED'
  | 'COMPLETED'
  | 'CANCELED'

interface OrderItem {
  id: string
  baseType: string
  quantity: number
  unitPrice: number
  subtotal: number
  variant: { flavorName: string }
  toppings?: { name: string; emoji: string | null }[] | null
}

interface Order {
  id: string
  customerName: string
  customerPhone: string
  totalPrice: number
  status: string
  notes?: string | null
  source: string
  createdAt: string
  deliveryMethod: string
  deliveryFee: number
  items: OrderItem[]
  biteshipOrderId?: string | null
  waybillId?: string | null
}

const STATUS_CONFIG: Record<
  OrderStatus,
  { label: string; color: string; bg: string; next?: OrderStatus }
> = {
  PENDING_PAYMENT: {
    label: 'Pending',
    color: 'text-yellow-700',
    bg: 'bg-yellow-100',
    next: 'PROCESSING'
  },
  PROCESSING: { label: 'Diproses', color: 'text-blue-700', bg: 'bg-blue-100', next: 'READY' },
  READY: { label: 'Siap Antar', color: 'text-purple-700', bg: 'bg-purple-100' }, // Next status is determined dynamically based on deliveryMethod
  OUT_FOR_DELIVERY: {
    label: 'Dalam Pengiriman 🛵',
    color: 'text-orange-700',
    bg: 'bg-orange-100',
    next: 'DELIVERED'
  },
  DELIVERED: {
    label: 'Telah Tiba 📦',
    color: 'text-teal-700',
    bg: 'bg-teal-100',
    next: 'COMPLETED'
  },
  COMPLETED: { label: 'Selesai ✅', color: 'text-green-700', bg: 'bg-green-100' },
  CANCELED: { label: 'Dibatalkan ✕', color: 'text-red-700', bg: 'bg-red-100' }
}

const STATUS_ORDER: OrderStatus[] = [
  'PENDING_PAYMENT',
  'PROCESSING',
  'READY',
  'OUT_FOR_DELIVERY',
  'DELIVERED',
  'COMPLETED',
  'CANCELED'
]
const SOURCE_ICON: Record<string, string> = {
  whatsapp: '💬',
  online: '💳',
  'walk-in': '🚶',
  phone: '📞'
}

type DateFilter = 'today' | 'week' | 'month' | 'all'

function isOrderStatus(v: string): v is OrderStatus {
  return STATUS_ORDER.includes(v as OrderStatus)
}

function getDateRange(filter: DateFilter): Date | null {
  const now = new Date()
  if (filter === 'today') {
    const d = new Date(now)
    d.setHours(0, 0, 0, 0)
    return d
  }
  if (filter === 'week') {
    const d = new Date(now)
    d.setDate(now.getDate() - 7)
    return d
  }
  if (filter === 'month') {
    const d = new Date(now)
    d.setDate(now.getDate() - 30)
    return d
  }
  return null
}

function exportToCSV(orders: Order[]) {
  const header = ['ID', 'Nama', 'Phone', 'Total', 'Status', 'Sumber', 'Metode', 'Tanggal']
  const rows = orders.map((o) => [
    o.id.slice(-8),
    o.customerName,
    o.customerPhone,
    o.totalPrice,
    o.status,
    o.source,
    o.deliveryMethod,
    new Date(o.createdAt).toLocaleString('id-ID')
  ])
  const csv = [header, ...rows]
    .map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(','))
    .join('\n')
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `pesanan_${new Date().toISOString().slice(0, 10)}.csv`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
  toast.success('Data pesanan berhasil diunduh')
}

export default function OrdersClient({
  initialOrders,
  totalOrders,
  currentPage,
  limit
}: {
  initialOrders: Order[]
  totalOrders: number
  currentPage: number
  limit: number
}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [orders, setOrders] = useState<Order[]>(initialOrders)
  const [statusFilter, setStatusFilter] = useState<'all' | OrderStatus>('all')
  const [dateFilter, setDateFilter] = useState<DateFilter>('all')
  const [search, setSearch] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [updating, setUpdating] = useState<string | null>(null)
  const [bulkSelected, setBulkSelected] = useState<Set<string>>(new Set())
  const [bulkStatus, setBulkStatus] = useState<OrderStatus>('PROCESSING')
  const [isBulkUpdating, setIsBulkUpdating] = useState(false)
  const [lastRefresh, setLastRefresh] = useState(new Date())
  const [hasNewOrder, setHasNewOrder] = useState(false)
  const [connectionStatus, setConnectionStatus] = useState<
    'connecting' | 'connected' | 'disconnected'
  >('disconnected')
  const prevCountRef = useRef(initialOrders.length)

  const pageRef = useRef(currentPage)
  const limitRef = useRef(limit)

  useEffect(() => {
    pageRef.current = currentPage
    limitRef.current = limit
    setOrders(initialOrders)
  }, [currentPage, limit, initialOrders])

  const playNotificationSound = () => {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.type = 'sine'
      osc.frequency.setValueAtTime(880, ctx.currentTime) // A5 note
      gain.gain.setValueAtTime(0.1, ctx.currentTime)
      osc.start()
      gain.gain.exponentialRampToValueAtTime(0.00001, ctx.currentTime + 0.5)
      osc.stop(ctx.currentTime + 0.5)
    } catch (e) {
      console.warn('Audio playback not supported or blocked by browser')
    }
  }

  // ── Real-time polling ────────────────────────────────────────────────────
  const fetchOrders = useCallback(async (silent = false) => {
    try {
      const res = await fetch(`/api/orders?page=${pageRef.current}&limit=${limitRef.current}`, {
        cache: 'no-store',
        credentials: 'include'
      })
      const data = await res.json()
      if (data.success && Array.isArray(data.data?.orders)) {
        const fresh: Order[] = data.data.orders
        if (fresh.length > prevCountRef.current) {
          setHasNewOrder(true)
        }
        prevCountRef.current = fresh.length
        setOrders(fresh)
        setLastRefresh(new Date())
      }
    } catch {
      if (!silent) console.warn('[OrdersClient] Fetch failed silently')
    }
  }, [])

  // ── Supabase Realtime ────────────────────────────────────────────────────
  useEffect(() => {
    if (!supabaseBrowserClient) return

    setConnectionStatus('connecting')

    const channel = supabaseBrowserClient
      .channel('public:Order')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'Order' }, (payload) => {
        playNotificationSound()
        fetchOrders(true)
        toast.success(`🔔 Pesanan baru masuk!`, { duration: 5000, icon: '🎉' })
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'Order' }, (payload) => {
        const updatedOrder = payload.new as { id: string; status: string }
        setOrders((prev) =>
          prev.map((o) =>
            o.id === updatedOrder.id && isOrderStatus(updatedOrder.status)
              ? { ...o, status: updatedOrder.status as OrderStatus }
              : o
          )
        )
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') setConnectionStatus('connected')
        else if (status === 'CLOSED' || status === 'CHANNEL_ERROR' || status === 'TIMED_OUT')
          setConnectionStatus('disconnected')
      })

    return () => {
      setConnectionStatus('disconnected')
      supabaseBrowserClient?.removeChannel(channel)
    }
  }, [fetchOrders])

  // ── Fallback Polling ─────────────────────────────────────────────────────
  useEffect(() => {
    if (connectionStatus === 'connected') return
    // Jika websocket gagal terhubung atau terputus, fallback ke polling manual 30 detik
    const interval = setInterval(() => fetchOrders(true), 30_000)
    return () => clearInterval(interval)
  }, [connectionStatus, fetchOrders])

  // ── Derived: filtered orders ─────────────────────────────────────────────
  const filtered = orders.filter((o) => {
    const byStatus = statusFilter === 'all' || o.status === statusFilter
    const bySearch =
      search === '' ||
      o.customerName.toLowerCase().includes(search.toLowerCase()) ||
      o.customerPhone.includes(search) ||
      o.id.toLowerCase().includes(search.toLowerCase())
    const since = getDateRange(dateFilter)
    const byDate = since === null || new Date(o.createdAt) >= since
    return byStatus && bySearch && byDate
  })

  // ── Dispatch and Proof Modals States ──────────────────────────────────────
  const [dispatchingOrder, setDispatchingOrder] = useState<Order | null>(null)
  const [dispatchCourierPhone, setDispatchCourierPhone] = useState('')
  const [dispatchEtaMinutes, setDispatchEtaMinutes] = useState(30)
  const [dispatchLoading, setDispatchLoading] = useState(false)

  const [proofOrder, setProofOrder] = useState<Order | null>(null)
  const [proofFile, setProofFile] = useState<File | null>(null)
  const [proofPhotoUrlInput, setProofPhotoUrlInput] = useState('')
  const [proofLoading, setProofLoading] = useState(false)

  // ── Actions ──────────────────────────────────────────────────────────────
  const updateStatus = async (id: string, status: OrderStatus) => {
    const order = orders.find((o) => o.id === id)
    if (order && order.deliveryMethod === 'DELIVERY') {
      if (status === 'OUT_FOR_DELIVERY') {
        setDispatchingOrder(order)
        setDispatchCourierPhone('')
        setDispatchEtaMinutes(30)
        return
      }
      if (status === 'DELIVERED') {
        setProofOrder(order)
        setProofFile(null)
        setProofPhotoUrlInput('')
        return
      }
    }

    setUpdating(id)
    try {
      const res = await fetch(`/api/orders/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      })
      const data = await res.json()
      if (data.success) {
        setOrders((prev) => prev.map((o) => (o.id === id ? { ...o, status } : o)))
        toast.success(`✅ Status → ${STATUS_CONFIG[status].label}`)
      } else toast.error(data.error || 'Gagal update')
    } catch {
      toast.error('Koneksi bermasalah')
    } finally {
      setUpdating(null)
    }
  }

  const handleDispatchBiteship = async (orderId: string) => {
    setDispatchLoading(true)
    try {
      const res = await fetch(`/api/orders/${orderId}/dispatch-biteship`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      })
      const data = await res.json()
      if (data.success) {
        setOrders((prev) =>
          prev.map((o) =>
            o.id === orderId
              ? {
                  ...o,
                  status: 'OUT_FOR_DELIVERY',
                  biteshipOrderId: data.data.biteshipOrderId,
                  waybillId: data.data.waybillId
                }
              : o
          )
        )
        toast.success('🚚 Pengiriman via Biteship berhasil dipicu!')
        setDispatchingOrder(null)
      } else {
        toast.error(data.error || 'Gagal memicu Biteship')
      }
    } catch {
      toast.error('Gagal menghubungi server')
    } finally {
      setDispatchLoading(false)
    }
  }

  const handleDispatchManual = async (orderId: string) => {
    if (!dispatchCourierPhone.trim()) {
      toast.error('Nomor telepon kurir wajib diisi')
      return
    }
    setDispatchLoading(true)
    try {
      const res = await fetch(`/api/orders/${orderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'OUT_FOR_DELIVERY',
          courierPhone: dispatchCourierPhone,
          etaMinutes: dispatchEtaMinutes
        })
      })
      const data = await res.json()
      if (data.success) {
        setOrders((prev) =>
          prev.map((o) =>
            o.id === orderId
              ? {
                  ...o,
                  status: 'OUT_FOR_DELIVERY',
                  courierPhone: dispatchCourierPhone,
                  etaMinutes: dispatchEtaMinutes
                }
              : o
          )
        )
        toast.success('🛵 Status diubah ke Dalam Pengiriman (Manual)')
        setDispatchingOrder(null)
      } else {
        toast.error(data.error || 'Gagal update')
      }
    } catch {
      toast.error('Gagal menghubungi server')
    } finally {
      setDispatchLoading(false)
    }
  }

  const handleDeliverOrder = async (orderId: string) => {
    setProofLoading(true)
    try {
      let finalUrl = proofPhotoUrlInput.trim() || null

      if (proofFile) {
        const formData = new FormData()
        formData.append('file', proofFile)
        const uploadRes = await fetch('/api/upload', {
          method: 'POST',
          body: formData
        })
        const uploadData = await uploadRes.json()
        if (!uploadData.success) {
          toast.error(uploadData.error || 'Gagal mengunggah foto bukti')
          setProofLoading(false)
          return
        }
        finalUrl = uploadData.data.url
      }

      const res = await fetch(`/api/orders/${orderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'DELIVERED',
          proofPhotoUrl: finalUrl
        })
      })
      const data = await res.json()
      if (data.success) {
        setOrders((prev) =>
          prev.map((o) =>
            o.id === orderId
              ? {
                  ...o,
                  status: 'DELIVERED',
                  proofPhotoUrl: finalUrl
                }
              : o
          )
        )
        toast.success('📦 Status diubah ke Telah Tiba!')
        setProofOrder(null)
        setProofFile(null)
        setProofPhotoUrlInput('')
      } else {
        toast.error(data.error || 'Gagal update status')
      }
    } catch {
      toast.error('Gagal menghubungi server')
    } finally {
      setProofLoading(false)
    }
  }

  const deleteOrder = async (id: string) => {
    if (!confirm('Hapus pesanan ini secara permanen?')) return
    try {
      const res = await fetch(`/api/orders/${id}`, { method: 'DELETE' })
      const data = await res.json()
      if (data.success) {
        setOrders((prev) => prev.filter((o) => o.id !== id))
        toast.success('Pesanan dihapus')
      } else toast.error(data.error)
    } catch {
      toast.error('Gagal menghapus')
    }
  }

  const handleBulkUpdate = async () => {
    if (bulkSelected.size === 0) return
    setIsBulkUpdating(true)
    let success = 0
    for (const id of Array.from(bulkSelected)) {
      try {
        const res = await fetch(`/api/orders/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: bulkStatus })
        })
        const d = await res.json()
        if (d.success) {
          setOrders((prev) => prev.map((o) => (o.id === id ? { ...o, status: bulkStatus } : o)))
          success++
        }
      } catch {
        /* silent */
      }
    }
    toast.success(`${success} pesanan diupdate ke ${STATUS_CONFIG[bulkStatus].label}`)
    setBulkSelected(new Set())
    setIsBulkUpdating(false)
  }

  const openWhatsApp = (order: Order) => {
    const items = order.items
      .map(
        (i) =>
          `• ${i.variant.flavorName} (${i.baseType})${i.toppings && i.toppings.length > 0 ? ` + ${i.toppings.map((t: any) => `${t.emoji || ''} ${t.name}`).join(', ')}` : ''} ×${i.quantity} = ${formatPrice(i.subtotal)}`
      )
      .join('\n')
    const msg = encodeURIComponent(
      `Halo ${order.customerName}! 🍌\n\nKonfirmasi pesanan Anda:\n${items}\n\nTotal: ${formatPrice(order.totalPrice)}\n\nTerima kasih telah memesan di Pisang Van Java!`
    )
    window.open(`https://wa.me/${order.customerPhone}?text=${msg}`, '_blank')
  }

  const toggleBulkSelect = (id: string) => {
    setBulkSelected((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const selectAll = () => setBulkSelected(new Set(filtered.map((o) => o.id)))
  const clearSelection = () => setBulkSelected(new Set())

  // ── Summary stats ────────────────────────────────────────────────────────
  const stats = {
    total: orders.length,
    revenue: orders.filter((o) => o.status === 'COMPLETED').reduce((s, o) => s + o.totalPrice, 0),
    active: orders.filter((o) => ['PENDING_PAYMENT', 'PROCESSING', 'READY'].includes(o.status))
      .length,
    done: orders.filter((o) => o.status === 'COMPLETED').length,
    pending: orders.filter((o) => o.status === 'PENDING_PAYMENT').length
  }

  const totalPages = Math.ceil(totalOrders / limit)

  const handlePageChange = (newPage: number) => {
    if (newPage < 1 || newPage > totalPages) return
    const params = new URLSearchParams(searchParams.toString())
    params.set('page', newPage.toString())
    router.push(`/orders?${params.toString()}`)
  }

  const handleLimitChange = (newLimit: number) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set('limit', newLimit.toString())
    params.set('page', '1')
    router.push(`/orders?${params.toString()}`)
  }

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="font-serif text-2xl font-bold text-brown-700">Pusat Komando Pesanan</h1>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-xs text-brown-400">
              {stats.total} total • Diperbarui {lastRefresh.toLocaleTimeString('id-ID')}
            </span>
            {hasNewOrder && (
              <motion.span
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="text-[10px] font-bold bg-red-500 text-white px-2 py-0.5 rounded-[4px] cursor-pointer"
                onClick={() => {
                  setHasNewOrder(false)
                  setStatusFilter('PENDING_PAYMENT')
                }}
              >
                PESANAN BARU!
              </motion.span>
            )}
            {connectionStatus === 'connected' ? (
              <span className="flex items-center gap-1 text-[10px] font-bold bg-green-100 text-green-700 px-2 py-0.5 rounded-[4px]">
                <span className="w-2 h-2 bg-green-500 rounded-[4px] animate-pulse" /> LIVE
              </span>
            ) : (
              <span
                className="flex items-center gap-1 text-[10px] font-bold bg-amber-100 text-amber-700 px-2 py-0.5 rounded-[4px]"
                title="Real-time terputus. Beralih ke fallback polling tiap 30 detik."
              >
                <span className="w-2 h-2 bg-amber-500 rounded-[4px]" /> FALLBACK
              </span>
            )}
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => fetchOrders(false)}
            className="text-xs px-3 py-2 rounded-lg font-semibold bg-white border border-cream-200 text-brown-600 hover:bg-cream-50"
          >
            🔄 Refresh
          </button>
          <button
            onClick={() => exportToCSV(filtered)}
            className="text-xs px-3 py-2 rounded-lg font-semibold bg-white border border-cream-200 text-brown-600 hover:bg-cream-50"
          >
            ⬇ CSV
          </button>
        </div>
      </div>

      {/* ── Summary Cards ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          {
            label: 'Pendapatan Selesai',
            value: formatPrice(stats.revenue),
            icon: '💰',
            color: 'text-green-700'
          },
          { label: 'Pesanan Selesai', value: stats.done, icon: '✅', color: 'text-brown-700' },
          { label: 'Pesanan Aktif', value: stats.active, icon: '🔥', color: 'text-amber-700' },
          {
            label: 'Menunggu Konfirmasi',
            value: stats.pending,
            icon: '⏳',
            color: 'text-yellow-700'
          }
        ].map(({ label, value, icon, color }) => (
          <motion.div
            key={label}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-[4px] p-4 border border-cream-200 shadow-sm hover:shadow-md transition-shadow"
          >
            <div className="text-2xl mb-1">{icon}</div>
            <div className={`font-serif text-xl font-bold ${color}`}>{value}</div>
            <div className="text-xs text-brown-400 mt-0.5 leading-tight">{label}</div>
          </motion.div>
        ))}
      </div>

      {/* ── Filters Row ── */}
      <div className="bg-white rounded-[4px] border border-cream-200 p-4 space-y-3">
        {/* Search */}
        <div className="flex gap-2">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="🔍 Cari nama, nomor, atau ID pesanan..."
            className="flex-1 px-3 py-2 text-sm rounded-[4px] border border-cream-200 text-brown-700 focus:outline-none focus:ring-2 focus:ring-amber-300"
          />
        </div>

        {/* Status Tabs */}
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setStatusFilter('all')}
            className={`px-3 py-1.5 rounded-[4px] text-xs font-semibold transition-all border ${statusFilter === 'all' ? 'bg-brown-700 text-white border-brown-700' : 'bg-white text-brown-500 border-cream-200 hover:border-brown-300'}`}
          >
            Semua ({orders.length})
          </button>
          {STATUS_ORDER.map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 rounded-[4px] text-xs font-semibold transition-all border ${statusFilter === s ? `${STATUS_CONFIG[s].bg} ${STATUS_CONFIG[s].color} border-current` : 'bg-white text-brown-500 border-cream-200 hover:border-brown-300'}`}
            >
              {STATUS_CONFIG[s].label} ({orders.filter((o) => o.status === s).length})
            </button>
          ))}
        </div>

        {/* Date Filter */}
        <div className="flex gap-2 flex-wrap">
          {(['today', 'week', 'month', 'all'] as DateFilter[]).map((d) => (
            <button
              key={d}
              onClick={() => setDateFilter(d)}
              className={`px-3 py-1.5 rounded-[4px] text-xs font-semibold transition-all border ${dateFilter === d ? 'bg-amber-100 text-amber-800 border-amber-300' : 'bg-white text-brown-400 border-cream-200'}`}
            >
              {d === 'today'
                ? 'Hari ini'
                : d === 'week'
                  ? '7 Hari'
                  : d === 'month'
                    ? '30 Hari'
                    : 'Semua Waktu'}
            </button>
          ))}
        </div>
      </div>

      {/* ── Bulk Actions ── */}
      <AnimatePresence>
        {bulkSelected.size > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="bg-amber-50 border border-amber-200 rounded-[4px] p-4 flex flex-wrap items-center gap-3"
          >
            <span className="text-sm font-bold text-amber-800">
              {bulkSelected.size} pesanan dipilih
            </span>
            <select
              value={bulkStatus}
              onChange={(e) => setBulkStatus(e.target.value as OrderStatus)}
              className="text-xs px-3 py-2 rounded-[4px] border border-amber-300 bg-white text-brown-700 focus:outline-none"
              aria-label="Status Bulk Update"
              title="Status Bulk Update"
            >
              {STATUS_ORDER.map((s) => (
                <option key={s} value={s}>
                  {STATUS_CONFIG[s].label}
                </option>
              ))}
            </select>
            <button
              onClick={handleBulkUpdate}
              disabled={isBulkUpdating}
              className="text-xs px-4 py-2 rounded-[4px] bg-amber-600 text-white font-bold hover:bg-amber-700 disabled:opacity-50"
            >
              {isBulkUpdating ? 'Memproses...' : 'Update Semua'}
            </button>
            <button
              onClick={selectAll}
              className="text-xs px-3 py-2 rounded-[4px] border border-amber-300 text-amber-700 font-medium hover:bg-amber-100"
            >
              Pilih Semua ({filtered.length})
            </button>
            <button
              onClick={clearSelection}
              className="text-xs px-3 py-2 rounded-[4px] border border-amber-300 text-amber-700 font-medium hover:bg-amber-100"
            >
              Batalkan Pilihan
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Orders List ── */}
      <div className="space-y-3">
        {filtered.length === 0 ? (
          <div className="bg-white rounded-[4px] border border-cream-200 p-16 text-center text-brown-300">
            <div className="text-5xl mb-3">📋</div>
            <div className="font-semibold text-base">Tidak ada pesanan ditemukan</div>
            <p className="text-xs mt-1">Coba ubah filter atau kata kunci pencarian</p>
          </div>
        ) : (
          filtered.map((order) => {
            const cfg = isOrderStatus(order.status) ? STATUS_CONFIG[order.status] : null
            const isEx = expandedId === order.id
            let nextStatus = cfg?.next ?? null
            if (order.status === 'READY') {
              nextStatus = order.deliveryMethod === 'DELIVERY' ? 'OUT_FOR_DELIVERY' : 'COMPLETED'
            }
            const isSelected = bulkSelected.has(order.id)

            return (
              <motion.div
                key={order.id}
                layout
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                className={`bg-white rounded-[4px] border overflow-hidden shadow-sm transition-all duration-200 ${isSelected ? 'border-amber-400 shadow-amber-100' : 'border-cream-200 hover:border-cream-300 hover:shadow-md'}`}
              >
                {/* Card Header (always visible) */}
                <div className="flex items-center gap-3 p-4">
                  {/* Checkbox */}
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggleBulkSelect(order.id)}
                    className="w-4 h-4 accent-amber-600 shrink-0 cursor-pointer"
                    onClick={(e) => e.stopPropagation()}
                    aria-label={`Pilih pesanan ${order.customerName}`}
                    title={`Pilih pesanan ${order.customerName}`}
                  />

                  {/* Main info — click to expand */}
                  {/* biome-ignore lint/a11y/useSemanticElements: interactive div is preferred here to prevent button default alignment side effects */}
                  <div
                    className="flex-1 min-w-0 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 rounded"
                    onClick={() => setExpandedId(isEx ? null : order.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        setExpandedId(isEx ? null : order.id)
                      }
                    }}
                    role="button"
                    tabIndex={0}
                    aria-label={`Lihat detail pesanan ${order.customerName}`}
                  >
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-brown-700 text-sm">
                        {order.customerName}
                      </span>
                      <span className="text-xs text-brown-400">{order.customerPhone}</span>
                      <span title={order.source} className="text-sm">
                        {SOURCE_ICON[order.source] || '📦'}
                      </span>
                    </div>
                    <div className="text-xs text-brown-400 mt-0.5 flex items-center gap-2 flex-wrap">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${order.deliveryMethod === 'DELIVERY' ? 'bg-amber-100 text-amber-800' : 'bg-zinc-100 text-zinc-600'}`}
                      >
                        {order.deliveryMethod === 'DELIVERY' ? '🛵 DELIVERY' : '🏪 PICKUP'}
                      </span>
                      <span>
                        #{order.id.slice(-6)} • {order.items.length} item •{' '}
                        {formatPrice(order.totalPrice)}
                      </span>
                      <span className="text-zinc-400">
                        {new Date(order.createdAt).toLocaleDateString('id-ID', {
                          day: 'numeric',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </span>
                    </div>
                  </div>

                  {/* Status badge + expand chevron */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span
                      className={`text-xs font-bold px-2.5 py-1 rounded-[4px] ${cfg?.bg ?? 'bg-zinc-100'} ${cfg?.color ?? 'text-zinc-600'}`}
                    >
                      {cfg?.label ?? 'Unknown'}
                    </span>
                    <button
                      onClick={() => setExpandedId(isEx ? null : order.id)}
                      className="text-brown-300 text-sm p-1 hover:text-brown-500 transition-colors"
                    >
                      {isEx ? '▲' : '▼'}
                    </button>
                  </div>
                </div>

                {/* Expanded Detail */}
                <AnimatePresence>
                  {isEx && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.25, ease: 'easeInOut' }}
                      className="overflow-hidden"
                    >
                      <div className="border-t border-cream-200 px-4 pb-4 pt-3 space-y-4">
                        {/* Items breakdown */}
                        <div className="bg-cream-50 rounded-[4px] p-3 space-y-2">
                          {order.items.map((item) => (
                            <div key={item.id} className="flex justify-between text-sm">
                              <span className="text-brown-600">
                                {item.variant.flavorName}
                                <span className="text-xs text-brown-400 ml-1">
                                  ({item.baseType})
                                </span>
                                {item.toppings && item.toppings.length > 0 && (
                                  <span className="text-zinc-400 font-normal">
                                    {' '}
                                    +{' '}
                                    {item.toppings
                                      .map((t: any) => `${t.emoji || ''} ${t.name}`)
                                      .join(', ')}
                                  </span>
                                )}
                                {item.quantity > 1 && (
                                  <span className="text-xs text-brown-400 ml-1">
                                    ×{item.quantity}
                                  </span>
                                )}
                              </span>
                              <span className="font-semibold text-brown-700 shrink-0 ml-2">
                                {formatPrice(item.subtotal)}
                              </span>
                            </div>
                          ))}
                          {order.deliveryMethod === 'DELIVERY' && order.deliveryFee > 0 && (
                            <div className="flex justify-between text-sm text-brown-500 border-t border-cream-200 pt-2">
                              <span>🛵 Ongkir</span>
                              <span>{formatPrice(order.deliveryFee)}</span>
                            </div>
                          )}
                          {order.deliveryMethod === 'DELIVERY' && (
                            <div className="text-xs text-brown-500 border-t border-cream-200 pt-2 space-y-1">
                              {order.waybillId && (
                                <div className="flex justify-between">
                                  <span>No. Resi (Waybill ID)</span>
                                  <span className="font-mono font-semibold text-brown-700">{order.waybillId}</span>
                                </div>
                              )}
                              {order.biteshipOrderId && (
                                <div className="flex justify-between">
                                  <span>Biteship Order ID</span>
                                  <span className="font-mono text-brown-600">{order.biteshipOrderId}</span>
                                </div>
                              )}
                            </div>
                          )}
                          <div className="flex justify-between font-bold text-brown-700 border-t border-cream-200 pt-2">
                            <span>Total</span>
                            <span>{formatPrice(order.totalPrice)}</span>
                          </div>
                        </div>

                        {/* Catatan */}
                        {order.notes && (
                          <p className="text-xs text-brown-400 bg-cream-100 rounded-lg px-3 py-2">
                            📝 {order.notes}
                          </p>
                        )}

                        {/* Action Buttons */}
                        <div className="flex gap-2 flex-wrap pt-1">
                          {nextStatus && (
                            <button
                              onClick={() => updateStatus(order.id, nextStatus)}
                              disabled={updating === order.id}
                              className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold bg-brown-700 text-white rounded-[4px] hover:bg-brown-800 disabled:opacity-50 transition-all"
                            >
                              {updating === order.id ? (
                                <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                              ) : (
                                '→'
                              )}
                              {STATUS_CONFIG[nextStatus].label}
                            </button>
                          )}

                          {order.status !== 'CANCELED' && order.status !== 'COMPLETED' && (
                            <button
                              onClick={() => updateStatus(order.id, 'CANCELED')}
                              disabled={updating === order.id}
                              className="px-3 py-2 text-xs font-bold bg-red-50 text-red-600 rounded-[4px] hover:bg-red-100 disabled:opacity-50 transition-all"
                            >
                              ✕ Batalkan
                            </button>
                          )}

                          <button
                            onClick={() => openWhatsApp(order)}
                            className="flex items-center gap-1 px-3 py-2 text-xs font-bold bg-green-50 text-green-700 rounded-[4px] hover:bg-green-100 transition-all"
                          >
                            💬 WhatsApp
                          </button>

                          {/* Status Override Dropdown */}
                          <div className="flex items-center gap-1 ml-auto">
                            <select
                              defaultValue={order.status}
                              onChange={(e) =>
                                isOrderStatus(e.target.value) &&
                                updateStatus(order.id, e.target.value as OrderStatus)
                              }
                              className="text-xs px-2 py-2 rounded-[4px] border border-cream-200 text-brown-600 bg-white focus:outline-none"
                              onClick={(e) => e.stopPropagation()}
                              aria-label="Ubah Status Pesanan"
                              title="Ubah Status Pesanan"
                            >
                              {STATUS_ORDER.map((s) => (
                                <option key={s} value={s}>
                                  {STATUS_CONFIG[s].label}
                                </option>
                              ))}
                            </select>

                            <button
                              onClick={() => deleteOrder(order.id)}
                              className="p-2 text-xs text-red-400 rounded-[4px] hover:bg-red-50 transition-all"
                              title="Hapus pesanan"
                            >
                              🗑️
                            </button>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            )
          })
        )}
      </div>

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="flex flex-col sm:flex-row items-center justify-between border-t border-cream-200 pt-4 mt-6 gap-4">
          <div className="flex items-center gap-4 text-xs text-brown-500">
            <div>
              Menampilkan{' '}
              <span className="font-semibold">
                {Math.min((currentPage - 1) * limit + 1, totalOrders)}
              </span>{' '}
              - <span className="font-semibold">{Math.min(currentPage * limit, totalOrders)}</span>{' '}
              dari <span className="font-semibold">{totalOrders}</span> pesanan
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-brown-400">Tampilkan:</span>
              <select
                value={limit}
                onChange={(e) => handleLimitChange(Number(e.target.value))}
                className="text-xs px-2 py-1 rounded-[4px] border border-cream-200 text-brown-600 bg-white focus:outline-none"
                aria-label="Batas Tampilan Pesanan"
                title="Batas Tampilan Pesanan"
              >
                {[20, 50, 100].map((size) => (
                  <option key={size} value={size}>
                    {size}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage <= 1}
              className="px-3 py-1.5 rounded-[4px] text-xs font-semibold bg-white border border-cream-200 text-brown-700 hover:bg-cream-50 disabled:opacity-50 disabled:hover:bg-white transition-all"
            >
              Sebelumnya
            </button>

            {Array.from({ length: Math.min(5, totalPages) }).map((_, idx) => {
              let pageNum = idx + 1
              if (currentPage > 3 && totalPages > 5) {
                if (currentPage + 2 > totalPages) {
                  pageNum = totalPages - 4 + idx
                } else {
                  pageNum = currentPage - 2 + idx
                }
              }
              return (
                <button
                  key={pageNum}
                  onClick={() => handlePageChange(pageNum)}
                  className={`w-8 h-8 flex items-center justify-center rounded-[4px] text-xs font-bold transition-all border ${
                    currentPage === pageNum
                      ? 'bg-brown-700 text-white border-brown-700'
                      : 'bg-white text-brown-500 border-cream-200 hover:border-brown-300'
                  }`}
                >
                  {pageNum}
                </button>
              )
            })}

            <button
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage >= totalPages}
              className="px-3 py-1.5 rounded-[4px] text-xs font-semibold bg-white border border-cream-200 text-brown-700 hover:bg-cream-50 disabled:opacity-50 disabled:hover:bg-white transition-all"
            >
              Selanjutnya
            </button>
          </div>
        </div>
      )}

      {/* Results count (fallback if only 1 page) */}
      {totalPages <= 1 && filtered.length > 0 && (
        <p className="text-center text-xs text-brown-400 pb-4">
          Menampilkan {filtered.length} dari {orders.length} pesanan
        </p>
      )}

      {/* ── Modal: Dispatch Courier ── */}
      <AnimatePresence>
        {dispatchingOrder && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-[8px] border border-cream-200 max-w-md w-full overflow-hidden shadow-2xl"
            >
              <div className="bg-brown-700 text-white px-5 py-4 flex justify-between items-center">
                <h3 className="font-bold text-sm">🛵 Dispatch Kurir (Order #{dispatchingOrder.id.slice(-6)})</h3>
                <button
                  onClick={() => setDispatchingOrder(null)}
                  className="text-white/70 hover:text-white text-lg focus:outline-none"
                >
                  ✕
                </button>
              </div>

              <div className="p-5 space-y-4">
                <div className="text-xs text-brown-600 space-y-1">
                  <p><strong>Pelanggan:</strong> {dispatchingOrder.customerName}</p>
                  <p><strong>No. HP:</strong> {dispatchingOrder.customerPhone}</p>
                  <p><strong>Alamat:</strong> {dispatchingOrder.notes || '-'}</p>
                </div>

                <div className="border-t border-cream-200 pt-3">
                  <h4 className="text-xs font-bold text-brown-800 mb-2">PILIHAN 1: PENGIRIMAN BITESHIP (OTOMATIS)</h4>
                  <button
                    onClick={() => handleDispatchBiteship(dispatchingOrder.id)}
                    disabled={dispatchLoading}
                    className="w-full py-2.5 px-4 text-xs font-bold bg-amber-600 text-white rounded-[4px] hover:bg-amber-700 disabled:opacity-50 transition-all flex items-center justify-center gap-1.5"
                  >
                    {dispatchLoading ? (
                      <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      '⚡'
                    )}
                    Picu Kurir Biteship Sekarang
                  </button>
                  <p className="text-[10px] text-zinc-400 mt-1">
                    *Akan otomatis mencari driver instant/same-day terdekat menggunakan Biteship API.
                  </p>
                </div>

                <div className="border-t border-cream-200 pt-3 space-y-3">
                  <h4 className="text-xs font-bold text-brown-800">PILIHAN 2: PENGIRIMAN MANUAL</h4>
                  
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-brown-600 block">No. HP Kurir Manual</label>
                    <input
                      type="text"
                      placeholder="e.g. 08123456789"
                      value={dispatchCourierPhone}
                      onChange={(e) => setDispatchCourierPhone(e.target.value)}
                      className="w-full px-3 py-2 border border-cream-200 rounded-[4px] text-xs focus:outline-none focus:border-brown-400"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-brown-600 block">Estimasi Tiba (ETA dalam Menit)</label>
                    <input
                      type="number"
                      placeholder="30"
                      value={dispatchEtaMinutes}
                      onChange={(e) => setDispatchEtaMinutes(Number(e.target.value))}
                      className="w-full px-3 py-2 border border-cream-200 rounded-[4px] text-xs focus:outline-none focus:border-brown-400"
                    />
                  </div>

                  <button
                    onClick={() => handleDispatchManual(dispatchingOrder.id)}
                    disabled={dispatchLoading}
                    className="w-full py-2 px-4 text-xs font-bold bg-brown-700 text-white rounded-[4px] hover:bg-brown-800 disabled:opacity-50 transition-all"
                  >
                    Kirim via Kurir Manual
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── Modal: Delivery Proof ── */}
      <AnimatePresence>
        {proofOrder && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-[8px] border border-cream-200 max-w-md w-full overflow-hidden shadow-2xl"
            >
              <div className="bg-brown-700 text-white px-5 py-4 flex justify-between items-center">
                <h3 className="font-bold text-sm">📦 Unggah Bukti Pengiriman (Order #{proofOrder.id.slice(-6)})</h3>
                <button
                  onClick={() => setProofOrder(null)}
                  className="text-white/70 hover:text-white text-lg focus:outline-none"
                >
                  ✕
                </button>
              </div>

              <div className="p-5 space-y-4">
                <div className="space-y-1">
                  <label htmlFor="proof-photo-file" className="text-xs font-bold text-brown-600 block">Unggah Foto Bukti (JPG/PNG/WEBP)</label>
                  <input
                    id="proof-photo-file"
                    type="file"
                    accept="image/*"
                    onChange={(e) => setProofFile(e.target.files?.[0] || null)}
                    title="Unggah Foto Bukti"
                    className="w-full text-xs text-zinc-500 file:mr-3 file:py-2 file:px-4 file:rounded-[4px] file:border-0 file:text-xs file:font-semibold file:bg-amber-50 file:text-amber-700 hover:file:bg-amber-100 cursor-pointer"
                  />
                  <p className="text-[10px] text-zinc-400">Maksimal 2MB. Diunggah langsung ke CDN aman.</p>
                </div>

                <div className="text-center text-xs text-zinc-400 font-bold">— ATAU —</div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-brown-600 block">Masukkan URL Foto Bukti Langsung</label>
                  <input
                    type="text"
                    placeholder="https://example.com/proof.jpg"
                    value={proofPhotoUrlInput}
                    onChange={(e) => setProofPhotoUrlInput(e.target.value)}
                    className="w-full px-3 py-2 border border-cream-200 rounded-[4px] text-xs focus:outline-none focus:border-brown-400"
                  />
                </div>

                <div className="pt-2 flex gap-2">
                  <button
                    onClick={() => setProofOrder(null)}
                    className="flex-1 py-2 px-4 text-xs font-bold bg-cream-50 text-brown-600 rounded-[4px] hover:bg-cream-100 transition-all"
                  >
                    Batal
                  </button>
                  <button
                    onClick={() => handleDeliverOrder(proofOrder.id)}
                    disabled={proofLoading}
                    className="flex-1 py-2 px-4 text-xs font-bold bg-green-700 text-white rounded-[4px] hover:bg-green-800 disabled:opacity-50 transition-all flex items-center justify-center gap-1.5"
                  >
                    {proofLoading && (
                      <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    )}
                    Selesaikan Pengiriman
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}
