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
  PENDING_PAYMENT: 'border-yellow-500 bg-zinc-900/90 text-zinc-100 shadow-yellow-950/20',
  PROCESSING: 'border-orange-500 bg-zinc-900/90 text-zinc-100 shadow-orange-950/20',
  READY: 'border-emerald-500 bg-zinc-900/90 text-zinc-100 shadow-emerald-950/20'
}

const BUTTON_LABELS: Record<string, string> = {
  PENDING_PAYMENT: 'Mulai Masak 🍳',
  PROCESSING: 'Tandai Siap ✅',
  READY: 'Selesai 🎉'
}

// ── Audio notification helper ──────────────────────────────────────────────────

let sharedAudioCtx: AudioContext | null = null

function getSharedAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null
  if (!sharedAudioCtx) {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext
    if (AudioContextClass) {
      sharedAudioCtx = new AudioContextClass()
    }
  }
  return sharedAudioCtx
}

function playNotificationSound(): void {
  try {
    const ctx = getSharedAudioContext()
    if (!ctx) return
    if (ctx.state === 'suspended') {
      console.warn('[KDS] AudioContext is suspended. Notification sound skipped.')
      return
    }
    const oscillator = ctx.createOscillator()
    const gainNode = ctx.createGain()
    oscillator.connect(gainNode)
    gainNode.connect(ctx.destination)
    oscillator.frequency.value = 880
    oscillator.type = 'sine'
    gainNode.gain.value = 0.3
    oscillator.start()
    oscillator.stop(ctx.currentTime + 0.2)
  } catch (error) {
    console.error('[KDS] Failed to play notification sound:', error)
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
  const [reconnectTrigger, setReconnectTrigger] = useState(0)
  const [updatingIds, setUpdatingIds] = useState<Set<string>>(new Set())
  const [, forceRender] = useState(0)
  const prevOrderIdsRef = useRef<Set<string>>(new Set(initialOrders.map((o) => o.id)))

  const handleReconnect = () => {
    setReconnectTrigger((prev) => prev + 1)
    toast.success('Mencoba menyambungkan kembali...')
  }

  // Audio Context state
  const [isAudioUnlocked, setIsAudioUnlocked] = useState(false)

  // WakeLock state and refs
  const wakeLockRef = useRef<any>(null)
  const [isWakeLockActive, setIsWakeLockActive] = useState(false)

  const requestWakeLock = useCallback(async () => {
    if (typeof window === 'undefined' || !('wakeLock' in navigator)) return
    try {
      if (wakeLockRef.current) {
        await wakeLockRef.current.release()
        wakeLockRef.current = null
      }
      const sentinel = await (navigator as any).wakeLock.request('screen')
      wakeLockRef.current = sentinel
      setIsWakeLockActive(true)
      console.log('[KDS] Wake Lock successfully acquired.')
    } catch (err) {
      console.error('[KDS] Failed to acquire Wake Lock:', err)
      setIsWakeLockActive(false)
    }
  }, [])

  const releaseWakeLock = useCallback(async () => {
    if (wakeLockRef.current) {
      try {
        await wakeLockRef.current.release()
      } catch (err) {
        console.error('[KDS] Failed to release Wake Lock:', err)
      }
      wakeLockRef.current = null
      setIsWakeLockActive(false)
    }
  }, [])

  // Force re-render every 30s to keep elapsed times fresh
  useEffect(() => {
    const interval = setInterval(() => forceRender((c) => c + 1), 30000)
    return () => clearInterval(interval)
  }, [])

  // Request screen wake lock on mount and visibility changes
  useEffect(() => {
    requestWakeLock()

    const handleVisibilityChange = async () => {
      if (document.visibilityState === 'visible') {
        await requestWakeLock()
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      releaseWakeLock()
    }
  }, [requestWakeLock, releaseWakeLock])

  // Monitor AudioContext state on mount (in case it's already unlocked)
  useEffect(() => {
    const ctx = getSharedAudioContext()
    if (ctx) {
      if (ctx.state === 'running') {
        setIsAudioUnlocked(true)
      } else {
        const checkState = () => {
          if (ctx.state === 'running') {
            setIsAudioUnlocked(true)
            ctx.removeEventListener('statechange', checkState)
          }
        }
        ctx.addEventListener('statechange', checkState)
        return () => ctx.removeEventListener('statechange', checkState)
      }
    }
  }, [])

  // Audio unlock click handler
  const handleUnlockAudio = async () => {
    try {
      const ctx = getSharedAudioContext()
      if (ctx) {
        await ctx.resume()
        // Play a short chime to verify sound is active
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.connect(gain)
        gain.connect(ctx.destination)
        osc.frequency.value = 880
        osc.type = 'sine'
        gain.gain.value = 0.2
        osc.start()
        osc.stop(ctx.currentTime + 0.15)
        setIsAudioUnlocked(true)
        toast.success('Suara dapur diaktifkan 🔔')
      }
    } catch (err) {
      console.error('[KDS] Failed to resume AudioContext:', err)
      toast.error('Gagal mengaktifkan suara')
    }
  }

  // ── Supabase Realtime Subscription ───────────────────────────────────────────
  useEffect(() => {
    if (!supabaseBrowserClient) {
      setConnectionStatus('disconnected')
      return
    }

    setConnectionStatus('connecting')

    const channel = supabaseBrowserClient
      .channel('kitchen-orders')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'Order' }, (payload) => {
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
            // Order completed/cancelled/expired — remove from display
            setOrders((prev) => prev.filter((o) => o.id !== record.id))
          }
        } else if (payload.eventType === 'DELETE') {
          setOrders((prev) => prev.filter((o) => o.id !== record.id))
        }
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
  }, [reconnectTrigger])

  // ── Polling Fallback ──────────────────────────────────────────────────────────
  useEffect(() => {
    let timer: NodeJS.Timeout

    const pollActiveOrders = async () => {
      try {
        const res = await fetch('/api/orders?limit=40', {
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' }
        })
        if (!res.ok) return
        const json = await res.json()
        if (json.success && json.data?.orders) {
          const fetchedOrders: KitchenOrder[] = json.data.orders.map((o: any) => ({
            id: o.id,
            customerName: o.customerName,
            status: o.status,
            notes: o.notes,
            source: o.source,
            deliveryMethod: o.deliveryMethod,
            createdAt: o.createdAt,
            items: o.items.map((item: any) => ({
              id: item.id,
              baseType: item.baseType,
              quantity: item.quantity,
              variant: item.variant,
              toppings: item.toppings || []
            }))
          }))

          const activeStatuses = ['PENDING_PAYMENT', 'PROCESSING', 'READY']
          const activeFetched = fetchedOrders.filter((o) => activeStatuses.includes(o.status))

          setOrders((prev) => {
            const merged = [...prev]

            activeFetched.forEach((newOrd) => {
              const idx = merged.findIndex((o) => o.id === newOrd.id)
              if (idx !== -1) {
                if (updatingIds.has(newOrd.id)) {
                  merged[idx] = { ...newOrd, status: merged[idx].status }
                } else {
                  merged[idx] = newOrd
                }
              } else {
                merged.push(newOrd)
              }
            })

            return merged.filter((o) => {
              if (updatingIds.has(o.id)) return true
              return activeFetched.some((newO) => newO.id === o.id)
            })
          })
        }
      } catch (err) {
        console.error('[KDS] Polling error:', err)
      }
    }

    // Trigger polling immediately if disconnected
    if (connectionStatus !== 'connected') {
      pollActiveOrders()
    }

    const intervalMs = connectionStatus === 'connected' ? 60000 : 10000
    timer = setInterval(pollActiveOrders, intervalMs)

    return () => clearInterval(timer)
  }, [connectionStatus, updatingIds])

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
          items:
            json.data.items?.map((item: Record<string, unknown>) => ({
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

    // Take a snapshot for optimistic UI rollback
    let snapshot: KitchenOrder[] = []
    setOrders((prev) => {
      snapshot = prev
      if (nextStatus === 'COMPLETED' || nextStatus === 'CANCELED') {
        return prev.filter((o) => o.id !== orderId)
      } else {
        return prev.map((o) => (o.id === orderId ? { ...o, status: nextStatus } : o))
      }
    })

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

      toast.success(`Status diperbarui: ${STATUS_LABELS[nextStatus] || nextStatus}`)
    } catch (error) {
      // Revert change if API fails
      setOrders(snapshot)
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
  const pendingOrders = orders.filter((o) => o.status === 'PENDING_PAYMENT')
  const processingOrders = orders.filter((o) => o.status === 'PROCESSING')
  const readyOrders = orders.filter((o) => o.status === 'READY')

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col h-[100dvh] overflow-hidden overscroll-none font-sans select-none">
      <Toaster position="top-center" />

      {/* Header Bar */}
      <header className="bg-zinc-900 border-b border-zinc-800 px-6 py-4 flex flex-col sm:flex-row items-center justify-between shrink-0 gap-4">
        <div>
          <h1 className="text-2xl font-black tracking-wider text-amber-400 flex items-center gap-2">
            <span>🍌</span> KITCHEN DISPLAY SYSTEM
          </h1>
          <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mt-0.5">
            Ekosistem F&B Pisang Van Java
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          {/* Audio Unlock control */}
          <button
            onClick={handleUnlockAudio}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${
              isAudioUnlocked
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                : 'bg-rose-500/20 text-rose-400 border-rose-500/40 animate-pulse hover:bg-rose-500/30'
            }`}
          >
            <span>{isAudioUnlocked ? '🔔 Suara Aktif' : '🔕 Aktifkan Suara'}</span>
          </button>

          {/* Wake Lock Status */}
          <div
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold border ${
              isWakeLockActive
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                : 'bg-zinc-800 text-zinc-400 border-zinc-700'
            }`}
          >
            <span>{isWakeLockActive ? '🔒 Layar Siaga' : '🔓 Layar Normal'}</span>
          </div>

          {/* Connection indicator */}
          <div className="flex items-center gap-2 text-xs bg-zinc-900 border border-zinc-800 px-3 py-1.5 rounded-lg">
            <span className="relative flex h-2 w-2">
              {connectionStatus === 'connected' && (
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              )}
              <span
                className={`relative inline-flex rounded-full h-2 w-2 ${
                  connectionStatus === 'connected'
                    ? 'bg-emerald-500'
                    : connectionStatus === 'connecting'
                      ? 'bg-amber-400'
                      : 'bg-rose-500'
                }`}
              />
            </span>
            <span className="text-zinc-400 font-bold">
              {connectionStatus === 'connected'
                ? 'Terhubung (Realtime)'
                : connectionStatus === 'connecting'
                  ? 'Menghubungkan...'
                  : 'Terputus (Cadangan Polling Aktif)'}
            </span>
            {connectionStatus !== 'connected' && (
              <button
                onClick={handleReconnect}
                className="text-[10px] bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold px-2.5 py-1 rounded transition-colors ml-1 active:scale-95 border border-amber-600/30"
              >
                Hubungkan 🔄
              </button>
            )}
          </div>

          {/* Order count badge */}
          <div className="bg-amber-500 text-zinc-950 px-3.5 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider">
            {orders.length} Pesanan
          </div>
        </div>
      </header>

      {/* Main Kanban Board Area */}
      <main className="flex-1 p-4 md:p-6 overflow-hidden">
        {orders.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-zinc-650 bg-zinc-900/10 border border-zinc-900/50 rounded-2xl">
            <div className="text-6xl mb-4 animate-bounce">🍳</div>
            <p className="text-lg font-bold text-zinc-400">Dapur Sedang Santai</p>
            <p className="text-xs text-zinc-600 mt-1 uppercase tracking-widest">
              Tidak ada pesanan aktif saat ini
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 h-full overflow-hidden">
            {/* Column 1: PENDING_PAYMENT */}
            <OrderColumn
              title="⏳ Menunggu Bayar"
              orders={pendingOrders}
              updatingIds={updatingIds}
              onStatusUpdate={handleStatusUpdate}
              headerColorClass="border-t-4 border-yellow-500"
            />

            {/* Column 2: PROCESSING */}
            <OrderColumn
              title="🍳 Sedang Dimasak"
              orders={processingOrders}
              updatingIds={updatingIds}
              onStatusUpdate={handleStatusUpdate}
              headerColorClass="border-t-4 border-orange-500"
            />

            {/* Column 3: READY */}
            <OrderColumn
              title="✅ Siap Diambil"
              orders={readyOrders}
              updatingIds={updatingIds}
              onStatusUpdate={handleStatusUpdate}
              headerColorClass="border-t-4 border-emerald-500"
            />
          </div>
        )}
      </main>
    </div>
  )
}

// ── Order Section (Kanban Column) Component ─────────────────────────────────────

function OrderColumn({
  title,
  orders,
  updatingIds,
  onStatusUpdate,
  headerColorClass
}: {
  title: string
  orders: KitchenOrder[]
  updatingIds: Set<string>
  onStatusUpdate: (orderId: string, currentStatus: string) => void
  headerColorClass: string
}) {
  return (
    <div
      className={`flex flex-col bg-zinc-900/30 border border-zinc-805 rounded-xl h-full overflow-hidden ${headerColorClass}`}
    >
      {/* Column Header */}
      <div className="px-4 py-3.5 bg-zinc-900/80 border-b border-zinc-800 flex items-center justify-between shrink-0">
        <h2 className="text-sm font-black text-zinc-300 tracking-wider uppercase flex items-center gap-2">
          {title}
        </h2>
        <span className="bg-zinc-850 text-zinc-400 font-extrabold text-xs px-2.5 py-1 rounded-full border border-zinc-800">
          {orders.length}
        </span>
      </div>

      {/* Column Scrollable Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 pr-2 pb-12 scrollbar-thin scrollbar-thumb-zinc-800 scrollbar-track-transparent">
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
        {orders.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-zinc-605 text-xs uppercase tracking-widest font-bold">
            ✨ Kosong
          </div>
        )}
      </div>
    </div>
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
  const nextAction = BUTTON_LABELS[order.status]

  // Decide card background & border style
  const cardStyle = isUrgent
    ? 'border-2 border-red-600 bg-red-950/20 text-zinc-100 ring-2 ring-red-500 ring-offset-2 ring-offset-zinc-950 shadow-lg shadow-red-950/30'
    : `${STATUS_COLORS[order.status] || 'border-zinc-800 bg-zinc-900'} border-2`

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.95, y: 10 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.9, y: -10 }}
      transition={{ duration: 0.15 }}
      className={`rounded-xl ${cardStyle} shadow-sm overflow-hidden flex flex-col`}
    >
      {/* Card Header */}
      <div className="px-4 py-3 flex items-center justify-between border-b border-zinc-800/80 bg-zinc-900/50">
        <div>
          <p className="text-sm font-black text-amber-400">#{order.id.slice(-5).toUpperCase()}</p>
          <p className="text-sm text-zinc-200 font-bold tracking-wide mt-0.5">
            {order.customerName}
          </p>
        </div>
        <div className="text-right">
          <p
            className={`text-xs font-black tracking-wide ${isUrgent ? 'text-red-400 font-black animate-pulse' : 'text-zinc-400'}`}
          >
            {isUrgent ? '🚨 ' : ''}
            {formatElapsed(elapsed)}
          </p>
          <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider mt-0.5">
            {order.source} · {order.deliveryMethod === 'DELIVERY' ? '🛵 Antar' : '🏪 Ambil'}
          </p>
        </div>
      </div>

      {/* Items List */}
      <div className="px-4 py-3.5 space-y-3 flex-1">
        {order.items.map((item) => (
          <div key={item.id} className="flex items-start gap-2.5">
            <span className="bg-zinc-850 border border-zinc-750 text-amber-400 text-xs font-black rounded-lg w-7 h-7 flex items-center justify-center shrink-0">
              {item.quantity}x
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-zinc-100 leading-tight">
                {item.variant?.flavorName || 'Varian'} ({item.baseType})
              </p>
              {item.toppings.length > 0 && (
                <p className="text-xs text-zinc-400 mt-1 leading-snug">
                  + {item.toppings.map((t) => `${t.emoji || ''} ${t.name}`).join(', ')}
                </p>
              )}
            </div>
          </div>
        ))}

        {/* Notes */}
        {order.notes && (
          <div className="bg-yellow-950/20 border border-yellow-800/30 text-yellow-400 text-xs px-3 py-2.5 rounded-lg font-bold tracking-wide mt-2 leading-relaxed">
            📝 Catatan: {order.notes}
          </div>
        )}

        {/* SLA Warning Badge */}
        {isUrgent && (
          <div className="bg-red-950/60 border border-red-800 text-red-200 text-xs px-3 py-2 rounded-lg font-black tracking-wide text-center uppercase animate-pulse mt-2">
            ⚠️ SLA LEWAT! &gt;15 Menit
          </div>
        )}
      </div>

      {/* Action Button */}
      {nextAction && (
        <div className="px-4 pb-4 shrink-0">
          <button
            onClick={() => onStatusUpdate(order.id, order.status)}
            disabled={isUpdating}
            className={`w-full py-3.5 rounded-lg font-black text-sm uppercase tracking-wider transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-wait shadow-sm ${
              order.status === 'READY'
                ? 'bg-emerald-600 hover:bg-emerald-500 text-white border border-emerald-500/30'
                : 'bg-amber-500 hover:bg-amber-400 text-zinc-950 border border-amber-400/30'
            }`}
          >
            {isUpdating ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="w-4 h-4 animate-spin text-zinc-950" fill="none" viewBox="0 0 24 24">
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
                MEMPROSES...
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
