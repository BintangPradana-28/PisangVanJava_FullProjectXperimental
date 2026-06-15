'use client'

// app/(user)/track-order/[id]/TrackOrderDetailClient.tsx
// RAG Source: app/(user)/track-order/page.tsx (Supabase Realtime subscription)
// RAG Source: app/(admin)/kitchen/KitchenClient.tsx (Sound chime & timestamp calculation)

import Link from 'next/link'
import { useEffect, useState } from 'react'
import toast, { Toaster } from 'react-hot-toast'
import { formatPrice } from '@/lib/utils'
import { supabaseBrowserClient } from '@/src/lib/supabase-client'

interface TrackOrderDetailClientProps {
  order: {
    id: string
    customerName: string
    status: string
    totalPrice: number
    createdAt: string
    confirmedAt: string | null
    updatedAt: string
    deliveryMethod: string
    source: string
    notes: string | null
    items: Array<{
      id: string
      baseType: string
      quantity: number
      subtotal: number
      variantName: string
      toppings: Array<{ name: string; emoji: string | null }>
    }>
  }
  storePhone: string
}

function getStatusIcon(status: string, deliveryMethod: string): string {
  const isPickup = deliveryMethod === 'PICKUP'
  if (status === 'READY') {
    return isPickup ? '🛍️' : '🛵'
  }
  const icons: Record<string, string> = {
    PENDING_PAYMENT: '⏳',
    PROCESSING: '🧑‍🍳',
    COMPLETED: '🎉',
    CANCELED: '❌'
  }
  return icons[status] || '🍌'
}

function getStatusLabel(status: string, deliveryMethod: string): string {
  const isPickup = deliveryMethod === 'PICKUP'
  if (status === 'READY') {
    return isPickup ? 'Siap Diambil' : 'Dalam Perjalanan / Siap Diantar'
  }
  if (status === 'COMPLETED') {
    return isPickup ? 'Selesai (Diambil)' : 'Selesai (Diterima)'
  }
  const labels: Record<string, string> = {
    PENDING_PAYMENT: 'Menunggu Pembayaran',
    PROCESSING: 'Sedang Dimasak',
    CANCELED: 'Pesanan Dibatalkan'
  }
  return labels[status] || status
}

// Play notification sound on client update (synthesized chime)
function playClientNotificationSound(): void {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext
    if (!AudioContextClass) return
    const ctx = new AudioContextClass()
    const oscillator = ctx.createOscillator()
    const gainNode = ctx.createGain()
    oscillator.connect(gainNode)
    gainNode.connect(ctx.destination)
    oscillator.frequency.value = 988 // B5 note
    oscillator.type = 'sine'
    gainNode.gain.value = 0.25
    oscillator.start()
    oscillator.stop(ctx.currentTime + 0.15)
  } catch {
    // Fail silently if context is blocked
  }
}

function formatTime(dateStr: string | null): string {
  if (!dateStr) return ''
  const formatted = new Date(dateStr).toLocaleTimeString('id-ID', {
    hour: '2-digit',
    minute: '2-digit'
  })
  return `${formatted} WIB`
}

export default function TrackOrderDetailClient({ order, storePhone }: TrackOrderDetailClientProps) {
  const [currentStatus, setCurrentStatus] = useState<string>(order.status)
  const [timestamps, setTimestamps] = useState<Record<string, string | null>>({
    PENDING_PAYMENT: order.createdAt,
    PROCESSING: order.confirmedAt || (order.status !== 'PENDING_PAYMENT' ? order.updatedAt : null),
    READY: order.status === 'READY' || order.status === 'COMPLETED' ? order.updatedAt : null,
    COMPLETED: order.status === 'COMPLETED' ? order.updatedAt : null
  })
  const [connectionStatus, setConnectionStatus] = useState<
    'connecting' | 'connected' | 'disconnected'
  >('disconnected')

  // Real-time status sync via Supabase Browser client
  useEffect(() => {
    if (!supabaseBrowserClient) return

    setConnectionStatus('connecting')

    const channel = supabaseBrowserClient
      .channel(`track-order-${order.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'Order',
          filter: `id=eq.${order.id}`
        },
        (payload) => {
          const newRecord = payload.new as {
            status: string
            confirmedAt?: string
            updatedAt: string
          }
          if (newRecord?.status) {
            setCurrentStatus(newRecord.status)
            playClientNotificationSound()
            toast.success(
              `Pesanan Anda diperbarui: ${getStatusLabel(newRecord.status, order.deliveryMethod)}`,
              {
                icon: '🔄',
                duration: 5000
              }
            )

            // Update timestamps dynamically on live event
            setTimestamps((prev) => ({
              ...prev,
              [newRecord.status]: newRecord.updatedAt,
              PROCESSING: ['PROCESSING', 'READY', 'COMPLETED'].includes(newRecord.status)
                ? newRecord.confirmedAt || newRecord.updatedAt
                : prev.PROCESSING,
              READY: ['READY', 'COMPLETED'].includes(newRecord.status)
                ? newRecord.updatedAt
                : prev.READY,
              COMPLETED: newRecord.status === 'COMPLETED' ? newRecord.updatedAt : prev.COMPLETED
            }))
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
  }, [order.id, order.deliveryMethod])

  // ── Fallback Polling ─────────────────────────────────────────────────────
  useEffect(() => {
    if (connectionStatus === 'connected') return

    const pollInterval = setInterval(async () => {
      try {
        const res = await fetch(`/api/orders/track?orderId=${order.id}`)
        if (!res.ok) return
        const json = await res.json()
        if (json.success && json.data) {
          const fresh = json.data as {
            status: string
            confirmedAt: string | null
            updatedAt: string
          }
          if (fresh.status !== currentStatus) {
            setCurrentStatus(fresh.status)
            playClientNotificationSound()
            toast.success(
              `Pesanan Anda diperbarui: ${getStatusLabel(fresh.status, order.deliveryMethod)}`,
              {
                icon: '🔄',
                duration: 5000
              }
            )

            // Update timestamps dynamically
            setTimestamps((prev) => ({
              ...prev,
              [fresh.status]: fresh.updatedAt,
              PROCESSING: ['PROCESSING', 'READY', 'COMPLETED'].includes(fresh.status)
                ? fresh.confirmedAt || fresh.updatedAt
                : prev.PROCESSING,
              READY: ['READY', 'COMPLETED'].includes(fresh.status) ? fresh.updatedAt : prev.READY,
              COMPLETED: fresh.status === 'COMPLETED' ? fresh.updatedAt : prev.COMPLETED
            }))
          }
        }
      } catch (e) {
        console.warn('Fallback polling failed', e)
      }
    }, 10000) // Poll every 10 seconds

    return () => clearInterval(pollInterval)
  }, [connectionStatus, currentStatus, order.id, order.deliveryMethod])

  const isPickup = order.deliveryMethod === 'PICKUP'
  const dynamicOrderSteps = [
    {
      status: 'PENDING_PAYMENT',
      label: 'Menunggu Pembayaran',
      description: 'Menunggu proses verifikasi pembayaran Anda.'
    },
    {
      status: 'PROCESSING',
      label: 'Sedang Dimasak',
      description: 'Koki sedang memasak pesanan spesial Anda di dapur.'
    },
    {
      status: 'READY',
      label: isPickup ? 'Siap Diambil' : 'Siap Diantar / Perjalanan',
      description: isPickup
        ? 'Pesanan Anda sudah siap! Silakan ambil di kedai kami.'
        : 'Pesanan siap dan kurir sedang mengantarkan ke alamat Anda.'
    },
    {
      status: 'COMPLETED',
      label: 'Selesai',
      description: isPickup
        ? 'Pesanan selesai diambil. Terima kasih atas kunjungan Anda!'
        : 'Pesanan selesai diantar dan diterima. Selamat menikmati!'
    }
  ]

  const stepIdx = dynamicOrderSteps.findIndex((s) => s.status === currentStatus)
  const isCanceled = currentStatus === 'CANCELED'
  const heightClassMap: Record<number, string> = {
    [-1]: 'h-0',
    0: 'h-0',
    1: 'h-[33.3%]',
    2: 'h-[66.6%]',
    3: 'h-full'
  }

  // Pre-filled WhatsApp link construction
  const maskedId = order.id.slice(-5).toUpperCase()
  const waMessage = `Halo Admin Pisang Van Java, saya ingin menanyakan status pesanan saya #${maskedId}.`
  const cleanPhone = storePhone.replace(/\D/g, '').replace(/^0/, '62')
  const waUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(waMessage)}`

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 py-12 px-4 md:py-20">
      <Toaster position="top-center" />
      <div className="max-w-xl mx-auto space-y-6">
        {/* Main Status Header Card */}
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200/60 dark:border-zinc-800 p-6 shadow-sm">
          <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-4 mb-4">
            <div>
              <span className="text-xs font-black text-zinc-400 dark:text-zinc-500 uppercase tracking-widest">
                ID PELACAKAN
              </span>
              <h1 className="text-lg font-mono font-bold text-amber-600 dark:text-amber-500 mt-0.5">
                #{order.id.slice(-8).toUpperCase()}
              </h1>
            </div>

            <div className="text-right">
              <span className="text-xs font-black text-zinc-400 dark:text-zinc-500 uppercase tracking-widest">
                PELANGGAN
              </span>
              <p className="text-sm font-bold text-zinc-800 dark:text-zinc-200 mt-0.5">
                {order.customerName}
              </p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="text-4xl shrink-0">
                {getStatusIcon(currentStatus, order.deliveryMethod)}
              </span>
              <div>
                <p className="text-xs text-zinc-400 font-bold uppercase tracking-wider">
                  STATUS SEKARANG
                </p>
                <p
                  className={`text-base font-black ${isCanceled ? 'text-rose-500' : 'text-amber-600 dark:text-amber-400'}`}
                >
                  {getStatusLabel(currentStatus, order.deliveryMethod)}
                </p>
              </div>
            </div>

            {/* Connection Indicator */}
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200/40 dark:border-zinc-700 text-[10px] font-bold self-start sm:self-auto shrink-0">
              <span className="relative flex h-2 w-2">
                {connectionStatus === 'connected' && (
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                )}
                <span
                  className={`relative inline-flex rounded-full h-2 w-2 ${
                    connectionStatus === 'connected' ? 'bg-emerald-500' : 'bg-rose-500'
                  }`}
                />
              </span>
              <span className="text-zinc-500 dark:text-zinc-400">
                {connectionStatus === 'connected' ? 'Live Sync' : 'Offline'}
              </span>
            </div>
          </div>
        </div>

        {/* Stepper progress timeline */}
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200/60 dark:border-zinc-800 p-6 shadow-sm">
          {isCanceled ? (
            <div className="space-y-4">
              <div className="bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400 rounded-xl p-4 flex gap-3">
                <span className="text-2xl mt-0.5">⚠️</span>
                <div>
                  <h3 className="font-bold text-sm">Pesanan Dibatalkan</h3>
                  <p className="text-xs text-rose-500/80 leading-relaxed mt-1">
                    Mohon maaf, pesanan Anda telah dibatalkan oleh dapur/kasir kami (misalnya karena
                    keterbatasan stok atau operasional). Proses pengembalian dana (refund) akan
                    segera diproses secara otomatis jika Anda membayar menggunakan metode non-tunai.
                  </p>
                </div>
              </div>
              <p className="text-xs text-zinc-400 text-center font-medium">
                Silakan hubungi dukungan Whatsapp di bawah jika Anda memerlukan bantuan lebih
                lanjut.
              </p>
            </div>
          ) : (
            <div className="relative pl-6 space-y-8 py-2">
              {/* Stepper Connecting Line */}
              <div className="absolute left-3.5 top-5 bottom-5 w-0.5 bg-zinc-100 dark:bg-zinc-800 -translate-x-1/2" />
              <div
                className={`absolute left-3.5 top-5 w-0.5 bg-amber-500 -translate-x-1/2 transition-all duration-700 ease-in-out ${heightClassMap[stepIdx] || 'h-0'}`}
              ></div>

              {dynamicOrderSteps.map((step, index) => {
                const isCompleted = index <= stepIdx
                const isActive = index === stepIdx
                const time = timestamps[step.status]

                return (
                  <div key={step.status} className="flex gap-4 relative">
                    {/* Stepper Bullet */}
                    <div
                      className={`w-7 h-7 rounded-full shrink-0 flex items-center justify-center text-xs font-black z-10 border-4 border-white dark:border-zinc-900 -ml-3.5 transition-all ${
                        isCompleted
                          ? 'bg-amber-500 text-white shadow-sm scale-110'
                          : 'bg-zinc-200 dark:bg-zinc-800 text-zinc-450 dark:text-zinc-600'
                      }`}
                    >
                      {index + 1}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <h3
                          className={`text-sm font-bold leading-none ${isActive ? 'text-amber-600 dark:text-amber-400' : isCompleted ? 'text-zinc-800 dark:text-zinc-200' : 'text-zinc-450'}`}
                        >
                          {step.label}
                        </h3>
                        {isCompleted && time && (
                          <span className="text-[10px] font-black text-zinc-400 bg-zinc-50 dark:bg-zinc-800 px-2 py-0.5 rounded border border-zinc-200/30">
                            {formatTime(time)}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-1.5 leading-relaxed">
                        {step.description}
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Masked Order Items Card */}
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200/60 dark:border-zinc-800 p-6 shadow-sm">
          <h2 className="text-xs font-black text-zinc-400 dark:text-zinc-500 uppercase tracking-wider mb-4 border-b border-zinc-100 dark:border-zinc-800 pb-2.5">
            RINCIAN ITEM PESANAN
          </h2>

          <div className="space-y-3.5">
            {order.items.map((item) => (
              <div key={item.id} className="flex items-start gap-3">
                <span className="bg-amber-500/10 text-amber-600 dark:text-amber-400 text-xs font-black rounded-lg w-7 h-7 flex items-center justify-center shrink-0 border border-amber-500/10">
                  {item.quantity}x
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-zinc-800 dark:text-zinc-200 leading-tight">
                    {item.variantName} ({item.baseType})
                  </p>
                  {item.toppings.length > 0 && (
                    <p className="text-xs text-zinc-400 mt-1 leading-snug">
                      + {item.toppings.map((t) => `${t.emoji || ''} ${t.name}`).join(', ')}
                    </p>
                  )}
                </div>
                <span className="text-sm font-bold text-zinc-700 dark:text-zinc-300">
                  {formatPrice(item.subtotal)}
                </span>
              </div>
            ))}

            {/* Notes */}
            {order.notes && (
              <div className="bg-yellow-950/20 border border-yellow-800/30 text-yellow-400 text-xs px-3 py-2.5 rounded-lg font-bold tracking-wide mt-2">
                📝 Catatan: {order.notes}
              </div>
            )}

            <div className="border-t border-zinc-100 dark:border-zinc-800 pt-3 flex items-center justify-between">
              <span className="text-xs font-black text-zinc-400 dark:text-zinc-500 uppercase">
                TOTAL BAYAR (TERPAJAK)
              </span>
              <span className="text-base font-black text-amber-600 dark:text-amber-400">
                {formatPrice(order.totalPrice)}
              </span>
            </div>
          </div>
        </div>

        {/* Dynamic Fallbacks (Help support actions) */}
        <div className="flex flex-col sm:flex-row gap-3">
          <a
            href={waUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 py-3.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-center text-xs font-black uppercase tracking-wider transition-all active:scale-[0.98] flex items-center justify-center gap-2 shadow-sm"
          >
            <span>💬 HUBUNGI ADMIN (WA)</span>
          </a>

          <Link
            href="/menu-spesial"
            className="flex-1 py-3.5 bg-zinc-800 hover:bg-zinc-700 dark:bg-zinc-900 border border-zinc-700/50 dark:border-zinc-800 text-zinc-100 rounded-xl text-center text-xs font-black uppercase tracking-wider transition-all active:scale-[0.98] flex items-center justify-center gap-2"
          >
            <span>🏪 MENU UTAMA</span>
          </Link>
        </div>
      </div>
    </div>
  )
}
