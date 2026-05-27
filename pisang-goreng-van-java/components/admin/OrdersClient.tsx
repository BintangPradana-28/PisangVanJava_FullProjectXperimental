'use client'
// components/admin/OrdersClient.tsx — COMMAND CENTER v2 (Real-time + Bulk + CSV)
import { useState, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import toast from 'react-hot-toast'
import { formatPrice } from '@/lib/utils'

type OrderStatus = 'pending' | 'paid' | 'confirmed' | 'ready' | 'done' | 'cancelled'

interface OrderItem {
  id: string
  baseType: string
  quantity: number
  unitPrice: number
  subtotal: number
  variant: { flavorName: string }
  topping?: { name: string; emoji: string | null } | null
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
}

const STATUS_CONFIG: Record<OrderStatus, { label: string; color: string; bg: string; next?: OrderStatus }> = {
  pending:   { label: 'Pending',       color: 'text-yellow-700', bg: 'bg-yellow-100',   next: 'confirmed' },
  paid:      { label: 'Dibayar',       color: 'text-emerald-700',bg: 'bg-emerald-100',  next: 'confirmed' },
  confirmed: { label: 'Dikonfirmasi', color: 'text-blue-700',    bg: 'bg-blue-100',     next: 'ready' },
  ready:     { label: 'Siap Antar',   color: 'text-purple-700',  bg: 'bg-purple-100',   next: 'done' },
  done:      { label: 'Selesai',       color: 'text-green-700',   bg: 'bg-green-100' },
  cancelled: { label: 'Dibatalkan',   color: 'text-red-700',     bg: 'bg-red-100' },
}

const STATUS_ORDER: OrderStatus[] = ['pending', 'paid', 'confirmed', 'ready', 'done', 'cancelled']
const SOURCE_ICON: Record<string, string> = { whatsapp: '💬', online: '💳', 'walk-in': '🚶', phone: '📞' }

type DateFilter = 'today' | 'week' | 'month' | 'all'

function isOrderStatus(v: string): v is OrderStatus {
  return STATUS_ORDER.includes(v as OrderStatus)
}

function getDateRange(filter: DateFilter): Date | null {
  const now = new Date()
  if (filter === 'today') { const d = new Date(now); d.setHours(0,0,0,0); return d }
  if (filter === 'week')  { const d = new Date(now); d.setDate(now.getDate() - 7); return d }
  if (filter === 'month') { const d = new Date(now); d.setDate(now.getDate() - 30); return d }
  return null
}

function exportToCSV(orders: Order[]) {
  const header = ['ID', 'Nama', 'Phone', 'Total', 'Status', 'Sumber', 'Metode', 'Tanggal']
  const rows = orders.map(o => [
    o.id.slice(-8),
    o.customerName,
    o.customerPhone,
    o.totalPrice,
    o.status,
    o.source,
    o.deliveryMethod,
    new Date(o.createdAt).toLocaleString('id-ID'),
  ])
  const csv = [header, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n')
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `pesanan_${new Date().toISOString().slice(0,10)}.csv`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
  toast.success('Data pesanan berhasil diunduh')
}

export default function OrdersClient({ initialOrders }: { initialOrders: Order[] }) {
  const [orders, setOrders]           = useState<Order[]>(initialOrders)
  const [statusFilter, setStatusFilter] = useState<'all' | OrderStatus>('all')
  const [dateFilter, setDateFilter]   = useState<DateFilter>('all')
  const [search, setSearch]           = useState('')
  const [expandedId, setExpandedId]   = useState<string | null>(null)
  const [updating, setUpdating]       = useState<string | null>(null)
  const [bulkSelected, setBulkSelected] = useState<Set<string>>(new Set())
  const [bulkStatus, setBulkStatus]   = useState<OrderStatus>('confirmed')
  const [isBulkUpdating, setIsBulkUpdating] = useState(false)
  const [lastRefresh, setLastRefresh] = useState(new Date())
  const [isPolling, setIsPolling]     = useState(true)
  const [hasNewOrder, setHasNewOrder] = useState(false)
  const prevCountRef = useRef(initialOrders.length)

  // ── Real-time polling ────────────────────────────────────────────────────
  const fetchOrders = useCallback(async (silent = false) => {
    try {
      const res = await fetch('/api/orders?limit=100', { cache: 'no-store', credentials: 'include' })
      const data = await res.json()
      if (data.success && Array.isArray(data.data?.orders)) {
        const fresh: Order[] = data.data.orders
        if (fresh.length > prevCountRef.current) {
          setHasNewOrder(true)
          if (!silent) toast.success(`🔔 ${fresh.length - prevCountRef.current} pesanan baru masuk!`, { duration: 4000 })
        }
        prevCountRef.current = fresh.length
        setOrders(fresh)
        setLastRefresh(new Date())
      }
    } catch {
      if (!silent) console.warn('[OrdersClient] Polling failed silently')
    }
  }, [])

  useEffect(() => {
    if (!isPolling) return
    const interval = setInterval(() => fetchOrders(true), 30_000)
    return () => clearInterval(interval)
  }, [isPolling, fetchOrders])

  // ── Derived: filtered orders ─────────────────────────────────────────────
  const filtered = orders.filter(o => {
    const byStatus = statusFilter === 'all' || o.status === statusFilter
    const bySearch = search === '' ||
      o.customerName.toLowerCase().includes(search.toLowerCase()) ||
      o.customerPhone.includes(search) ||
      o.id.toLowerCase().includes(search.toLowerCase())
    const since = getDateRange(dateFilter)
    const byDate = since === null || new Date(o.createdAt) >= since
    return byStatus && bySearch && byDate
  })

  // ── Actions ──────────────────────────────────────────────────────────────
  const updateStatus = async (id: string, status: OrderStatus) => {
    setUpdating(id)
    try {
      const res = await fetch(`/api/orders/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      const data = await res.json()
      if (data.success) {
        setOrders(prev => prev.map(o => o.id === id ? { ...o, status } : o))
        toast.success(`✅ Status → ${STATUS_CONFIG[status].label}`)
      } else toast.error(data.error || 'Gagal update')
    } catch { toast.error('Koneksi bermasalah') }
    finally { setUpdating(null) }
  }

  const deleteOrder = async (id: string) => {
    if (!confirm('Hapus pesanan ini secara permanen?')) return
    try {
      const res = await fetch(`/api/orders/${id}`, { method: 'DELETE' })
      const data = await res.json()
      if (data.success) { setOrders(prev => prev.filter(o => o.id !== id)); toast.success('Pesanan dihapus') }
      else toast.error(data.error)
    } catch { toast.error('Gagal menghapus') }
  }

  const handleBulkUpdate = async () => {
    if (bulkSelected.size === 0) return
    setIsBulkUpdating(true)
    let success = 0
    for (const id of Array.from(bulkSelected)) {
      try {
        const res = await fetch(`/api/orders/${id}`, {
          method: 'PATCH', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: bulkStatus }),
        })
        const d = await res.json()
        if (d.success) { setOrders(prev => prev.map(o => o.id === id ? { ...o, status: bulkStatus } : o)); success++ }
      } catch { /* silent */ }
    }
    toast.success(`${success} pesanan diupdate ke ${STATUS_CONFIG[bulkStatus].label}`)
    setBulkSelected(new Set())
    setIsBulkUpdating(false)
  }

  const openWhatsApp = (order: Order) => {
    const items = order.items.map(i =>
      `• ${i.variant.flavorName} (${i.baseType})${i.topping ? ` + ${i.topping.emoji || ''} ${i.topping.name}` : ''} ×${i.quantity} = ${formatPrice(i.subtotal)}`
    ).join('\n')
    const msg = encodeURIComponent(`Halo ${order.customerName}! 🍌\n\nKonfirmasi pesanan Anda:\n${items}\n\nTotal: ${formatPrice(order.totalPrice)}\n\nTerima kasih telah memesan di Pisang Van Java!`)
    window.open(`https://wa.me/${order.customerPhone}?text=${msg}`, '_blank')
  }

  const toggleBulkSelect = (id: string) => {
    setBulkSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const selectAll = () => setBulkSelected(new Set(filtered.map(o => o.id)))
  const clearSelection = () => setBulkSelected(new Set())

  // ── Summary stats ────────────────────────────────────────────────────────
  const stats = {
    total: orders.length,
    revenue: orders.filter(o => o.status === 'done').reduce((s, o) => s + o.totalPrice, 0),
    active: orders.filter(o => ['pending','paid','confirmed','ready'].includes(o.status)).length,
    done: orders.filter(o => o.status === 'done').length,
    pending: orders.filter(o => o.status === 'pending').length,
  }

  return (
    <div className="space-y-6">

      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="font-serif text-2xl font-bold text-brown-700">Pusat Komando Pesanan</h1>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-xs text-brown-400">{stats.total} total • Diperbarui {lastRefresh.toLocaleTimeString('id-ID')}</span>
            {hasNewOrder && (
              <motion.span
                initial={{ scale: 0 }} animate={{ scale: 1 }}
                className="text-[10px] font-bold bg-red-500 text-white px-2 py-0.5 rounded-full cursor-pointer"
                onClick={() => { setHasNewOrder(false); setStatusFilter('pending') }}
              >
                PESANAN BARU!
              </motion.span>
            )}
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => { setIsPolling(p => !p); toast(isPolling ? '⏸ Auto-refresh dimatikan' : '▶ Auto-refresh aktif') }}
            className={`text-xs px-3 py-2 rounded-lg font-semibold border transition-all ${isPolling ? 'bg-green-100 text-green-700 border-green-300' : 'bg-zinc-100 text-zinc-500 border-zinc-200'}`}
          >
            {isPolling ? '⏸ Auto' : '▶ Manual'}
          </button>
          <button onClick={() => fetchOrders(false)} className="text-xs px-3 py-2 rounded-lg font-semibold bg-white border border-cream-200 text-brown-600 hover:bg-cream-50">
            🔄 Refresh
          </button>
          <button onClick={() => exportToCSV(filtered)} className="text-xs px-3 py-2 rounded-lg font-semibold bg-white border border-cream-200 text-brown-600 hover:bg-cream-50">
            ⬇ CSV
          </button>
        </div>
      </div>

      {/* ── Summary Cards ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Pendapatan Selesai', value: formatPrice(stats.revenue),   icon: '💰', color: 'text-green-700' },
          { label: 'Pesanan Selesai',    value: stats.done,                   icon: '✅', color: 'text-brown-700' },
          { label: 'Pesanan Aktif',      value: stats.active,                 icon: '🔥', color: 'text-amber-700' },
          { label: 'Menunggu Konfirmasi',value: stats.pending,                icon: '⏳', color: 'text-yellow-700' },
        ].map(({ label, value, icon, color }) => (
          <motion.div
            key={label}
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-2xl p-4 border border-cream-200 shadow-sm hover:shadow-md transition-shadow"
          >
            <div className="text-2xl mb-1">{icon}</div>
            <div className={`font-serif text-xl font-bold ${color}`}>{value}</div>
            <div className="text-xs text-brown-400 mt-0.5 leading-tight">{label}</div>
          </motion.div>
        ))}
      </div>

      {/* ── Filters Row ── */}
      <div className="bg-white rounded-2xl border border-cream-200 p-4 space-y-3">
        {/* Search */}
        <div className="flex gap-2">
          <input
            type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="🔍 Cari nama, nomor, atau ID pesanan..."
            className="flex-1 px-3 py-2 text-sm rounded-xl border border-cream-200 text-brown-700 focus:outline-none focus:ring-2 focus:ring-amber-300"
          />
        </div>

        {/* Status Tabs */}
        <div className="flex gap-2 flex-wrap">
          <button onClick={() => setStatusFilter('all')}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all border ${statusFilter === 'all' ? 'bg-brown-700 text-white border-brown-700' : 'bg-white text-brown-500 border-cream-200 hover:border-brown-300'}`}>
            Semua ({orders.length})
          </button>
          {STATUS_ORDER.map(s => (
            <button key={s} onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all border ${statusFilter === s ? `${STATUS_CONFIG[s].bg} ${STATUS_CONFIG[s].color} border-current` : 'bg-white text-brown-500 border-cream-200 hover:border-brown-300'}`}>
              {STATUS_CONFIG[s].label} ({orders.filter(o => o.status === s).length})
            </button>
          ))}
        </div>

        {/* Date Filter */}
        <div className="flex gap-2 flex-wrap">
          {(['today','week','month','all'] as DateFilter[]).map(d => (
            <button key={d} onClick={() => setDateFilter(d)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all border ${dateFilter === d ? 'bg-amber-100 text-amber-800 border-amber-300' : 'bg-white text-brown-400 border-cream-200'}`}>
              {d === 'today' ? 'Hari ini' : d === 'week' ? '7 Hari' : d === 'month' ? '30 Hari' : 'Semua Waktu'}
            </button>
          ))}
        </div>
      </div>

      {/* ── Bulk Actions ── */}
      <AnimatePresence>
        {bulkSelected.size > 0 && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
            className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex flex-wrap items-center gap-3">
            <span className="text-sm font-bold text-amber-800">{bulkSelected.size} pesanan dipilih</span>
            <select value={bulkStatus} onChange={e => setBulkStatus(e.target.value as OrderStatus)}
              className="text-xs px-3 py-2 rounded-xl border border-amber-300 bg-white text-brown-700 focus:outline-none">
              {STATUS_ORDER.map(s => <option key={s} value={s}>{STATUS_CONFIG[s].label}</option>)}
            </select>
            <button onClick={handleBulkUpdate} disabled={isBulkUpdating}
              className="text-xs px-4 py-2 rounded-xl bg-amber-600 text-white font-bold hover:bg-amber-700 disabled:opacity-50">
              {isBulkUpdating ? 'Memproses...' : 'Update Semua'}
            </button>
            <button onClick={selectAll} className="text-xs px-3 py-2 rounded-xl border border-amber-300 text-amber-700 font-medium hover:bg-amber-100">
              Pilih Semua ({filtered.length})
            </button>
            <button onClick={clearSelection} className="text-xs px-3 py-2 rounded-xl border border-amber-300 text-amber-700 font-medium hover:bg-amber-100">
              Batalkan Pilihan
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Orders List ── */}
      <div className="space-y-3">
        {filtered.length === 0 ? (
          <div className="bg-white rounded-2xl border border-cream-200 p-16 text-center text-brown-300">
            <div className="text-5xl mb-3">📋</div>
            <div className="font-semibold text-base">Tidak ada pesanan ditemukan</div>
            <p className="text-xs mt-1">Coba ubah filter atau kata kunci pencarian</p>
          </div>
        ) : filtered.map(order => {
          const cfg = isOrderStatus(order.status) ? STATUS_CONFIG[order.status] : null
          const isEx = expandedId === order.id
          const nextStatus = cfg?.next ?? null
          const isSelected = bulkSelected.has(order.id)

          return (
            <motion.div
              key={order.id}
              layout
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              className={`bg-white rounded-2xl border overflow-hidden shadow-sm transition-all duration-200 ${isSelected ? 'border-amber-400 shadow-amber-100' : 'border-cream-200 hover:border-cream-300 hover:shadow-md'}`}
            >
              {/* Card Header (always visible) */}
              <div className="flex items-center gap-3 p-4">
                {/* Checkbox */}
                <input
                  type="checkbox" checked={isSelected}
                  onChange={() => toggleBulkSelect(order.id)}
                  className="w-4 h-4 accent-amber-600 shrink-0 cursor-pointer"
                  onClick={e => e.stopPropagation()}
                />

                {/* Main info — click to expand */}
                <div className="flex-1 min-w-0 cursor-pointer" onClick={() => setExpandedId(isEx ? null : order.id)}>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-brown-700 text-sm">{order.customerName}</span>
                    <span className="text-xs text-brown-400">{order.customerPhone}</span>
                    <span title={order.source} className="text-sm">{SOURCE_ICON[order.source] || '📦'}</span>
                  </div>
                  <div className="text-xs text-brown-400 mt-0.5 flex items-center gap-2 flex-wrap">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${order.deliveryMethod === 'DELIVERY' ? 'bg-amber-100 text-amber-800' : 'bg-zinc-100 text-zinc-600'}`}>
                      {order.deliveryMethod === 'DELIVERY' ? '🛵 DELIVERY' : '🏪 PICKUP'}
                    </span>
                    <span>#{order.id.slice(-6)} • {order.items.length} item • {formatPrice(order.totalPrice)}</span>
                    <span className="text-zinc-400">
                      {new Date(order.createdAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </div>

                {/* Status badge + expand chevron */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${cfg?.bg ?? 'bg-zinc-100'} ${cfg?.color ?? 'text-zinc-600'}`}>
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
                      <div className="bg-cream-50 rounded-xl p-3 space-y-2">
                        {order.items.map(item => (
                          <div key={item.id} className="flex justify-between text-sm">
                            <span className="text-brown-600">
                              {item.variant.flavorName}
                              <span className="text-xs text-brown-400 ml-1">({item.baseType})</span>
                              {item.topping && <span className="text-xs text-secondary ml-1">+ {item.topping.emoji} {item.topping.name}</span>}
                              {item.quantity > 1 && <span className="text-xs text-brown-400 ml-1">×{item.quantity}</span>}
                            </span>
                            <span className="font-semibold text-brown-700 shrink-0 ml-2">{formatPrice(item.subtotal)}</span>
                          </div>
                        ))}
                        {order.deliveryMethod === 'DELIVERY' && order.deliveryFee > 0 && (
                          <div className="flex justify-between text-sm text-brown-500 border-t border-cream-200 pt-2">
                            <span>🛵 Ongkir</span>
                            <span>{formatPrice(order.deliveryFee)}</span>
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
                            className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold bg-brown-700 text-white rounded-xl hover:bg-brown-800 disabled:opacity-50 transition-all"
                          >
                            {updating === order.id ? (
                              <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            ) : '→'}
                            {STATUS_CONFIG[nextStatus].label}
                          </button>
                        )}

                        {order.status !== 'cancelled' && order.status !== 'done' && (
                          <button
                            onClick={() => updateStatus(order.id, 'cancelled')}
                            disabled={updating === order.id}
                            className="px-3 py-2 text-xs font-bold bg-red-50 text-red-600 rounded-xl hover:bg-red-100 disabled:opacity-50 transition-all"
                          >
                            ✕ Batalkan
                          </button>
                        )}

                        <button
                          onClick={() => openWhatsApp(order)}
                          className="flex items-center gap-1 px-3 py-2 text-xs font-bold bg-green-50 text-green-700 rounded-xl hover:bg-green-100 transition-all"
                        >
                          💬 WhatsApp
                        </button>

                        {/* Status Override Dropdown */}
                        <div className="flex items-center gap-1 ml-auto">
                          <select
                            defaultValue={order.status}
                            onChange={e => isOrderStatus(e.target.value) && updateStatus(order.id, e.target.value as OrderStatus)}
                            className="text-xs px-2 py-2 rounded-xl border border-cream-200 text-brown-600 bg-white focus:outline-none"
                            onClick={e => e.stopPropagation()}
                          >
                            {STATUS_ORDER.map(s => <option key={s} value={s}>{STATUS_CONFIG[s].label}</option>)}
                          </select>

                          <button
                            onClick={() => deleteOrder(order.id)}
                            className="p-2 text-xs text-red-400 rounded-xl hover:bg-red-50 transition-all"
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
        })}
      </div>

      {/* Results count */}
      {filtered.length > 0 && (
        <p className="text-center text-xs text-brown-400 pb-4">
          Menampilkan {filtered.length} dari {orders.length} pesanan
        </p>
      )}
    </div>
  )
}
