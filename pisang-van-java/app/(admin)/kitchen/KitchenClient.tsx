'use client'

// app/(admin)/kitchen/KitchenClient.tsx
// Kitchen Display System (KDS) — Real-time order queue for kitchen staff
// RAG Source: app/(user)/track-order/page.tsx (Supabase Realtime pattern)
// RAG Source: app/api/orders/[id]/route.ts (PATCH status update)
// RAG Source: prisma/schema.prisma (OrderStatus enum)

import { AnimatePresence, motion } from 'framer-motion'
import { useCallback, useEffect, useRef, useState } from 'react'
import toast, { Toaster } from 'react-hot-toast'
import { supabaseBrowserClient } from '@/src/lib/supabase-client'

// ── Types ──────────────────────────────────────────────────────────────────────

interface OrderItem {
  id: string
  baseType: string
  quantity: number
  variant: { flavorName: string } | null
  toppings: { name: string; emoji: string | null }[]
}

interface KitchenOrder {
  id: string
  customerName: string
  status: string
  notes: string | null
  source: string
  deliveryMethod: string
  createdAt: string
  items: OrderItem[]
}

interface KitchenClientProps {
  initialOrders: KitchenOrder[]
}

// ── Status Transitions (allowed by kitchen staff) ──────────────────────────────

const STATUS_FLOW: Record<string, string> = {
  PENDING_PAYMENT: 'PROCESSING',
  PROCESSING: 'READY',
  READY: 'COMPLETED'
}

const STATUS_LABELS: Record<string, string> = {
  PENDING_PAYMENT: '⏳ Menunggu Bayar',
  PROCESSING: '🔥 Sedang Dimasak',
  READY: '✅ Siap Diambil',
  COMPLETED: '🎉 Selesai'
}

const STATUS_COLORS: Record<string, string> = {
  PENDING_PAYMENT: 'border-yellow-400 bg-yellow-50',
  PROCESSING: 'border-orange-500 bg-orange-50',
  READY: 'border-green-500 bg-green-50'
}

const BUTTON_LABELS: Record<string, string> = {
  PENDING_PAYMENT: 'Mulai Masak 🍳',
  PROCESSING: 'Tandai Siap ✅',
  READY: 'Selesai 🎉'
}

// ── Audio notification helper ──────────────────────────────────────────────────

function playNotificationSound(): void {
  try {
    const audioCtx = new AudioContext()
    const oscillator = audioCtx.createOscillator()
    const gainNode = audioCtx.createGain()
    oscillator.connect(gainNode)
    gainNode.connect(audioCtx.destination)
    oscillator.frequency.value = 880
    oscillator.type = 'sine'
    gainNode.gain.value = 0.3
    oscillator.start()
    oscillator.stop(audioCtx.currentTime + 0.2)
  } catch {
    // Audio API unavailable — fail silently
  }
}

// ── Time helper ────────────────────────────────────────────────────────────────

function getElapsedMinutes(createdAt: string): number {
  return Math.floor((Date.now() - new Date(createdAt).getTime()) / 60000)
}

function formatElapsed(minutes: number): string {
  if (minutes < 1) return 'Baru saja'
  if (minutes < 60) return `${minutes} mnt lalu`
  return `${Math.floor(minutes / 60)} jam ${minutes % 60} mnt lalu`
}

// ── Main Component ─────────────────────────────────────────────────────────────

export default function KitchenClient({ initialOrders }: KitchenClientProps) {
  const [orders, setOrders] = useState<KitchenOrder[]>(initialOrders)
  const [connectionStatus, setConnectionStatus] = useState<
    'connecting' | 'connected' | 'disconnected'
  >('disconnected')
  const [updatingIds, setUpdatingIds] = useState<Set<string>>(new Set())
  const [, forceRender] = useState(0)
  const prevOrderIdsRef = useRef<Set<string>>(new Set(initialOrders.map((o) => o.id)))

  // Force re-render every 30s to keep elapsed times fresh
  useEffect(() => {
    const interval = setInterval(() => forceRender((c) => c + 1), 30000)
    return () => clearInterval(interval)
  }, [])

  // ── Supabase Realtime Subscription ───────────────────────────────────────────
  useEffect(() => {
    if (!supabaseBrowserClient) return

    setConnectionStatus('connecting')

    const channel = supabaseBrowserClient
      .channel('kitchen-orders')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'Order' },
        (payload) => {
          const record = (payload.new || payload.old) as {
            id: string
            customerName?: string
            status?: string
            notes?: string
            source?: string
            deliveryMethod?: string
            createdAt?: string
          }

          if (!record?.id) return

          if (payload.eventType === 'INSERT') {
            // New order arrived — refetch full order data from API
            handleNewOrder(record.id)
          } else if (payload.eventType === 'UPDATE' && record.status) {
            const activeStatuses = ['PENDING_PAYMENT', 'PROCESSING', 'READY']

            if (activeStatuses.includes(record.status)) {
              // Update status in local state
              setOrders((prev) =>
                prev.map((o) => (o.id === record.id ? { ...o, status: record.status! } : o))
              )
            } else {
              // Order completed/cancelled — remove from display
              setOrders((prev) => prev.filter((o) => o.id !== record.id))
            }
          } else if (payload.eventType === 'DELETE') {
            setOrders((prev) => prev.filter((o) => o.id !== record.id))
          }
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') setConnectionStatus('connected')
        else if (status === 'CLOSED' || status === 'CHANNEL_ERROR' || status === 'TIMED_OUT')
          setConnectionStatus('disconnected')
      })

    return () => {
      setConnectionStatus('disconnected')
      supabaseBrowserClient?.removeChannel(channel)
    }
  }, [])

  // Detect new orders and play notification sound
  useEffect(() => {
    const currentIds = new Set(orders.map((o) => o.id))
    const prevIds = prevOrderIdsRef.current

    for (const id of currentIds) {
      if (!prevIds.has(id)) {
        playNotificationSound()
        toast('🆕 Pesanan baru masuk!', {
          icon: '🍌',
          duration: 4000,
          style: { fontWeight: 'bold' }
        })
        break // Only one notification per batch
      }
    }

    prevOrderIdsRef.current = currentIds
  }, [orders])

  // ── Fetch new order data ─────────────────────────────────────────────────────

  const handleNewOrder = useCallback(async (orderId: string) => {
    try {
      const res = await fetch(`/api/orders/${orderId}`, {
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' }
      })

      if (!res.ok) return

      const json = await res.json()
      if (json.success && json.data) {
        const newOrder: KitchenOrder = {
          id: json.data.id,
          customerName: json.data.customerName,
          status: json.data.status,
          notes: json.data.notes,
          source: json.data.source,
          deliveryMethod: json.data.deliveryMethod,
          createdAt: json.data.createdAt,
          items: json.data.items?.map((item: Record<string, unknown>) => ({
            id: item.id,
            baseType: item.baseType,
            quantity: item.quantity,
            variant: item.variant,
            toppings: item.toppings || []
          })) || []
        }

        const activeStatuses = ['PENDING_PAYMENT', 'PROCESSING', 'READY']
        if (activeStatuses.includes(newOrder.status)) {
          setOrders((prev) => {
            // Prevent duplicates
            if (prev.some((o) => o.id === newOrder.id)) return prev
            return [...prev, newOrder]
          })
        }
      }
    } catch (error) {
      console.error('[KDS] Failed to fetch new order:', error)
    }
  }, [])

  // ── Update Order Status ──────────────────────────────────────────────────────

  const handleStatusUpdate = useCallback(async (orderId: string, currentStatus: string) => {
    const nextStatus = STATUS_FLOW[currentStatus]
    if (!nextStatus) return

    setUpdatingIds((prev) => new Set(prev).add(orderId))

    try {
      const res = await fetch(`/api/orders/${orderId}`, {
        method: 'PATCH',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus })
      })

      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        throw new Error(json.error || 'Gagal update status')
      }

      // Optimistic update — Supabase Realtime will confirm
      if (nextStatus === 'COMPLETED' || nextStatus === 'CANCELED') {
        setOrders((prev) => prev.filter((o) => o.id !== orderId))
      } else {
        setOrders((prev) =>
          prev.map((o) => (o.id === orderId ? { ...o, status: nextStatus } : o))
        )
      }

      toast.success(`Status diperbarui: ${STATUS_LABELS[nextStatus] || nextStatus}`)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Gagal update status'
      toast.error(message)
    } finally {
      setUpdatingIds((prev) => {
        const next = new Set(prev)
        next.delete(orderId)
        return next
      })
    }
  }, [])

  // ── Group orders by status ───────────────────────────────────────────────────

  const processingOrders = orders.filter((o) => o.status === 'PROCESSING')
  const readyOrders = orders.filter((o) => o.status === 'READY')
  const pendingOrders = orders.filter((o) => o.status === 'PENDING_PAYMENT')

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <Toaster position="top-center" />

      {/* Header Bar */}
      <header className="bg-gray-800 border-b border-gray-700 px-6 py-4 flex items-center justify-between sticky top-0 z-10">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-amber-400">
            🍌 KITCHEN DISPLAY
          </h1>
          <p className="text-xs text-gray-400 font-medium uppercase tracking-widest">
            Pisang Van Java — Dapur
          </p>
        </div>

        <div className="flex items-center gap-4">
          {/* Connection indicator */}
          <div className="flex items-center gap-2 text-xs">
            <span className="relative flex h-2.5 w-2.5">
              {connectionStatus === 'connected' && (
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
              )}
              <span
                className={`relative inline-flex rounded-full h-2.5 w-2.5 ${
                  connectionStatus === 'connected'
                    ? 'bg-green-500'
                    : connectionStatus === 'connecting'
                      ? 'bg-amber-400'
                      : 'bg-red-500'
                }`}
              />
            </span>
            <span className="text-gray-400 font-medium">
              {connectionStatus === 'connected'
                ? 'Live'
                : connectionStatus === 'connecting'
                  ? 'Menghubungkan...'
                  : 'Terputus'}
            </span>
          </div>

          {/* Order count badge */}
          <div className="bg-amber-500/20 text-amber-400 px-3 py-1.5 rounded-lg text-sm font-bold">
            {orders.length} Pesanan Aktif
          </div>
        </div>
      </header>

      {/* Main Grid */}
      <main className="p-4 md:p-6">
        {orders.length === 0 ? (
          <div className="flex flex-col items-center justify-center min-h-[60vh] text-gray-500">
            <div className="text-6xl mb-4">🍳</div>
            <p className="text-xl font-semibold">Tidak ada pesanan aktif</p>
            <p className="text-sm mt-2">Pesanan baru akan muncul otomatis di sini</p>
          </div>
        ) : (
          <div className="space-y-8">
            {/* Pending Payment */}
            {pendingOrders.length > 0 && (
              <OrderSection
                title="⏳ Menunggu Pembayaran"
                orders={pendingOrders}
                updatingIds={updatingIds}
                onStatusUpdate={handleStatusUpdate}
              />
            )}

            {/* Processing */}
            {processingOrders.length > 0 && (
              <OrderSection
                title="🔥 Sedang Dimasak"
                orders={processingOrders}
                updatingIds={updatingIds}
                onStatusUpdate={handleStatusUpdate}
              />
            )}

            {/* Ready */}
            {readyOrders.length > 0 && (
              <OrderSection
                title="✅ Siap Diambil"
                orders={readyOrders}
                updatingIds={updatingIds}
                onStatusUpdate={handleStatusUpdate}
              />
            )}
          </div>
        )}
      </main>
    </div>
  )
}

// ── Order Section Component ────────────────────────────────────────────────────

function OrderSection({
  title,
  orders,
  updatingIds,
  onStatusUpdate
}: {
  title: string
  orders: KitchenOrder[]
  updatingIds: Set<string>
  onStatusUpdate: (orderId: string, currentStatus: string) => void
}) {
  return (
    <section>
      <h2 className="text-lg font-bold text-gray-300 mb-3">{title} ({orders.length})</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        <AnimatePresence mode="popLayout">
          {orders.map((order) => (
            <OrderCard
              key={order.id}
              order={order}
              isUpdating={updatingIds.has(order.id)}
              onStatusUpdate={onStatusUpdate}
            />
          ))}
        </AnimatePresence>
      </div>
    </section>
  )
}

// ── Order Card Component ───────────────────────────────────────────────────────

function OrderCard({
  order,
  isUpdating,
  onStatusUpdate
}: {
  order: KitchenOrder
  isUpdating: boolean
  onStatusUpdate: (orderId: string, currentStatus: string) => void
}) {
  const elapsed = getElapsedMinutes(order.createdAt)
  const isUrgent = elapsed > 15 && order.status === 'PROCESSING'
  const statusColor = STATUS_COLORS[order.status] || 'border-gray-600 bg-gray-800'
  const nextAction = BUTTON_LABELS[order.status]

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.9, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.8, y: -20 }}
      transition={{ type: 'spring', stiffness: 300, damping: 25 }}
      className={`rounded-2xl border-2 ${statusColor} ${
        isUrgent ? 'ring-2 ring-red-500 animate-pulse' : ''
      } shadow-lg overflow-hidden`}
    >
      {/* Card Header */}
      <div className="px-4 py-3 flex items-center justify-between border-b border-gray-200/30">
        <div>
          <p className="text-sm font-bold text-gray-800">
            #{order.id.slice(-5).toUpperCase()}
          </p>
          <p className="text-xs text-gray-600 font-medium">{order.customerName}</p>
        </div>
        <div className="text-right">
          <p className={`text-xs font-bold ${isUrgent ? 'text-red-600' : 'text-gray-500'}`}>
            {formatElapsed(elapsed)}
          </p>
          <p className="text-[10px] text-gray-400 uppercase">
            {order.source} · {order.deliveryMethod === 'DELIVERY' ? '🛵' : '🏪'}
          </p>
        </div>
      </div>

      {/* Items List */}
      <div className="px-4 py-3 space-y-2">
        {order.items.map((item) => (
          <div key={item.id} className="flex items-start gap-2">
            <span className="bg-amber-100 text-amber-800 text-xs font-black rounded-full w-6 h-6 flex items-center justify-center shrink-0">
              {item.quantity}
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-800 truncate">
                {item.variant?.flavorName || 'Varian'} ({item.baseType})
              </p>
              {item.toppings.length > 0 && (
                <p className="text-xs text-gray-500 truncate">
                  + {item.toppings.map((t) => `${t.emoji || ''} ${t.name}`).join(', ')}
                </p>
              )}
            </div>
          </div>
        ))}

        {/* Notes */}
        {order.notes && (
          <div className="bg-yellow-100 text-yellow-800 text-xs px-3 py-2 rounded-lg font-medium mt-2">
            📝 {order.notes}
          </div>
        )}
      </div>

      {/* Action Button */}
      {nextAction && (
        <div className="px-4 pb-4">
          <button
            onClick={() => onStatusUpdate(order.id, order.status)}
            disabled={isUpdating}
            className={`w-full py-3 rounded-xl font-bold text-sm transition-all active:scale-95 disabled:opacity-50 disabled:cursor-wait ${
              order.status === 'READY'
                ? 'bg-green-600 hover:bg-green-700 text-white'
                : 'bg-amber-500 hover:bg-amber-600 text-white'
            }`}
          >
            {isUpdating ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                  />
                </svg>
                Memproses...
              </span>
            ) : (
              nextAction
            )}
          </button>
        </div>
      )}
    </motion.div>
  )
}
