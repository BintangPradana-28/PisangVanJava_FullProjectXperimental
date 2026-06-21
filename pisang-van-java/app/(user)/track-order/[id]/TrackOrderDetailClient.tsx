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
    courierName: string | null
    courierPhone: string | null
    courierPhoneMasked: string | null
    etaMinutes: number | null
    tipAmount: number
    proofPhotoUrl: string | null
    address: {
      fullAddress: string
      notes: string | null
    } | null
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

function maskPhone(phone: string | null): string | null {
  if (!phone) return null
  const clean = phone.trim()
  if (clean.length < 8) return '****'
  return `${clean.slice(0, 4)}****${clean.slice(-4)}`
}

function getStatusIcon(status: string, deliveryMethod: string): string {
  const isPickup = deliveryMethod === 'PICKUP'
  if (status === 'READY') {
    return isPickup ? '🛍️' : '📦'
  }
  const icons: Record<string, string> = {
    PENDING_PAYMENT: '⏳',
    PROCESSING: '🧑‍🍳',
    OUT_FOR_DELIVERY: '🛵',
    DELIVERED: '📦',
    COMPLETED: '🎉',
    CANCELED: '❌'
  }
  return icons[status] || '🍌'
}

function getStatusLabel(status: string, deliveryMethod: string): string {
  const isPickup = deliveryMethod === 'PICKUP'
  if (status === 'READY') {
    return isPickup ? 'Siap Diambil' : 'Siap Diantar'
  }
  if (status === 'COMPLETED') {
    return isPickup ? 'Selesai (Diambil)' : 'Selesai (Diterima)'
  }
  const labels: Record<string, string> = {
    PENDING_PAYMENT: 'Menunggu Pembayaran',
    PROCESSING: 'Sedang Dimasak',
    OUT_FOR_DELIVERY: 'Kurir Sedang Mengantar',
    DELIVERED: 'Tiba di Lokasi',
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

  // Local states for live tracking info updates
  const [courierName, setCourierName] = useState<string | null>(order.courierName)
  const [courierPhone, setCourierPhone] = useState<string | null>(order.courierPhone)
  const [courierPhoneMasked, setCourierPhoneMasked] = useState<string | null>(
    order.courierPhoneMasked
  )
  const [etaMinutes, setEtaMinutes] = useState<number | null>(order.etaMinutes)
  const [tipAmount, setTipAmount] = useState<number>(order.tipAmount)
  const [proofPhotoUrl, setProofPhotoUrl] = useState<string | null>(order.proofPhotoUrl)

  const [timestamps, setTimestamps] = useState<Record<string, string | null>>({
    PENDING_PAYMENT: order.createdAt,
    PROCESSING: order.confirmedAt || (order.status !== 'PENDING_PAYMENT' ? order.updatedAt : null),
    READY: ['READY', 'OUT_FOR_DELIVERY', 'DELIVERED', 'COMPLETED'].includes(order.status)
      ? order.updatedAt
      : null,
    OUT_FOR_DELIVERY: ['OUT_FOR_DELIVERY', 'DELIVERED', 'COMPLETED'].includes(order.status)
      ? order.updatedAt
      : null,
    DELIVERED: ['DELIVERED', 'COMPLETED'].includes(order.status) ? order.updatedAt : null,
    COMPLETED: order.status === 'COMPLETED' ? order.updatedAt : null
  })
  const [connectionStatus, setConnectionStatus] = useState<
    'connecting' | 'connected' | 'disconnected'
  >('disconnected')

  // Live ETA Countdown state
  const [timeLeft, setTimeLeft] = useState<string | null>(null)
  const [progressPercent, setProgressPercent] = useState<number>(100)

  // Tipping UI state
  const [customTip, setCustomTip] = useState<string>('')
  const [isSubmittingTip, setIsSubmittingTip] = useState<boolean>(false)

  // ── 1. ETA Countdown Timer Logic ─────────────────────────────────────────
  useEffect(() => {
    if (currentStatus !== 'OUT_FOR_DELIVERY' || !etaMinutes || !timestamps.OUT_FOR_DELIVERY) {
      setTimeLeft(null)
      return
    }

    const startTime = new Date(timestamps.OUT_FOR_DELIVERY).getTime()
    const durationMs = etaMinutes * 60 * 1000
    const endTime = startTime + durationMs

    const updateTimer = () => {
      const now = Date.now()
      const remaining = endTime - now

      if (remaining <= 0) {
        setTimeLeft('Kurir segera sampai!')
        setProgressPercent(0)
        return
      }

      const totalSeconds = Math.floor(remaining / 1000)
      const minutes = Math.floor(totalSeconds / 60)
      const seconds = totalSeconds % 60
      setTimeLeft(`${minutes}m ${seconds}s`)
      setProgressPercent(Math.max(0, Math.min(100, (remaining / durationMs) * 100)))
    }

    updateTimer()
    const timer = setInterval(updateTimer, 1000)

    return () => clearInterval(timer)
  }, [currentStatus, etaMinutes, timestamps.OUT_FOR_DELIVERY])

  // ── 2. Real-time Status Sync via Supabase ─────────────────────────────────
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
            courierName?: string | null
            courierPhone?: string | null
            etaMinutes?: number | null
            tipAmount?: number
            proofPhotoUrl?: string | null
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

            // Update live fields
            if (newRecord.courierName !== undefined) setCourierName(newRecord.courierName)
            if (newRecord.courierPhone !== undefined) {
              setCourierPhone(newRecord.courierPhone)
              setCourierPhoneMasked(maskPhone(newRecord.courierPhone))
            }
            if (newRecord.etaMinutes !== undefined) setEtaMinutes(newRecord.etaMinutes)
            if (newRecord.tipAmount !== undefined) setTipAmount(newRecord.tipAmount ?? 0)
            if (newRecord.proofPhotoUrl !== undefined) setProofPhotoUrl(newRecord.proofPhotoUrl)

            // Update timestamps dynamically on live event
            setTimestamps((prev) => ({
              ...prev,
              [newRecord.status]: newRecord.updatedAt,
              PROCESSING: [
                'PROCESSING',
                'READY',
                'OUT_FOR_DELIVERY',
                'DELIVERED',
                'COMPLETED'
              ].includes(newRecord.status)
                ? newRecord.confirmedAt || newRecord.updatedAt
                : prev.PROCESSING,
              READY: ['READY', 'OUT_FOR_DELIVERY', 'DELIVERED', 'COMPLETED'].includes(
                newRecord.status
              )
                ? newRecord.updatedAt
                : prev.READY,
              OUT_FOR_DELIVERY: ['OUT_FOR_DELIVERY', 'DELIVERED', 'COMPLETED'].includes(
                newRecord.status
              )
                ? newRecord.updatedAt
                : prev.OUT_FOR_DELIVERY,
              DELIVERED: ['DELIVERED', 'COMPLETED'].includes(newRecord.status)
                ? newRecord.updatedAt
                : prev.DELIVERED,
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

  // ── 3. Fallback Polling ───────────────────────────────────────────────────
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
            courierName: string | null
            courierPhone: string | null
            etaMinutes: number | null
            tipAmount: number
            proofPhotoUrl: string | null
          }

          setCourierName(fresh.courierName)
          setCourierPhone(fresh.courierPhone)
          setCourierPhoneMasked(maskPhone(fresh.courierPhone))
          setEtaMinutes(fresh.etaMinutes)
          setTipAmount(fresh.tipAmount)
          setProofPhotoUrl(fresh.proofPhotoUrl)

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
              PROCESSING: [
                'PROCESSING',
                'READY',
                'OUT_FOR_DELIVERY',
                'DELIVERED',
                'COMPLETED'
              ].includes(fresh.status)
                ? fresh.confirmedAt || fresh.updatedAt
                : prev.PROCESSING,
              READY: ['READY', 'OUT_FOR_DELIVERY', 'DELIVERED', 'COMPLETED'].includes(fresh.status)
                ? fresh.updatedAt
                : prev.READY,
              OUT_FOR_DELIVERY: ['OUT_FOR_DELIVERY', 'DELIVERED', 'COMPLETED'].includes(
                fresh.status
              )
                ? fresh.updatedAt
                : prev.OUT_FOR_DELIVERY,
              DELIVERED: ['DELIVERED', 'COMPLETED'].includes(fresh.status)
                ? fresh.updatedAt
                : prev.DELIVERED,
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

  // ── 4. Tipping Handler ───────────────────────────────────────────────────
  const handleAddTip = async (amount: number) => {
    if (amount < 1000 || amount > 1000000) {
      toast.error('Tip minimal Rp 1.000 dan maksimal Rp 1.000.000')
      return
    }

    setIsSubmittingTip(true)
    try {
      const res = await fetch(`/api/orders/${order.id}/tip`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ amount })
      })

      const json = await res.json()
      if (json.success) {
        setTipAmount((prev) => prev + amount)
        toast.success(
          `Terima kasih! Tip sebesar ${formatPrice(amount)} berhasil diberikan ke kurir.`
        )
        setCustomTip('')
      } else {
        toast.error(json.error || 'Gagal mengirimkan tip.')
      }
    } catch {
      toast.error('Gagal menghubungi server.')
    } finally {
      setIsSubmittingTip(false)
    }
  }

  const isPickup = order.deliveryMethod === 'PICKUP'

  // Stepper steps depends on delivery method
  const dynamicOrderSteps = isPickup
    ? [
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
          label: 'Siap Diambil',
          description: 'Pesanan Anda sudah siap! Silakan ambil di kedai kami.'
        },
        {
          status: 'COMPLETED',
          label: 'Selesai',
          description: 'Pesanan selesai diambil. Terima kasih atas kunjungan Anda!'
        }
      ]
    : [
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
          label: 'Makanan Siap',
          description: 'Pesanan selesai dimasak dan siap diserahkan ke kurir.'
        },
        {
          status: 'OUT_FOR_DELIVERY',
          label: 'Sedang Diantar',
          description: 'Kurir sedang dalam perjalanan menuju lokasi Anda.'
        },
        {
          status: 'DELIVERED',
          label: 'Tiba di Lokasi',
          description: 'Pesanan telah sampai di lokasi tujuan Anda.'
        },
        {
          status: 'COMPLETED',
          label: 'Selesai',
          description: 'Pesanan selesai diantar dan diterima. Selamat menikmati!'
        }
      ]

  const stepIdx = dynamicOrderSteps.findIndex((s) => s.status === currentStatus)
  const isCanceled = currentStatus === 'CANCELED'

  // Calculate vertical connector progress line height dynamically
  const percent =
    stepIdx <= 0 ? 0 : Math.min(100, Math.floor((stepIdx / (dynamicOrderSteps.length - 1)) * 100))

  // Pre-filled WhatsApp link construction
  const maskedId = order.id.slice(-5).toUpperCase()
  const waMessage = `Halo Admin Pisang Van Java, saya ingin menanyakan status pesanan saya #${maskedId}.`
  const cleanPhone = storePhone.replace(/\D/g, '').replace(/^0/, '62')
  const waUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(waMessage)}`

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 py-12 px-4 md:py-20 animate-fade-in">
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

        {/* Courier Info Card */}
        {!isPickup &&
          (currentStatus === 'OUT_FOR_DELIVERY' ||
            currentStatus === 'DELIVERED' ||
            currentStatus === 'COMPLETED') &&
          courierName && (
            <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200/60 dark:border-zinc-800 p-6 shadow-sm space-y-4">
              <h2 className="text-xs font-black text-zinc-400 dark:text-zinc-500 uppercase tracking-wider mb-2 border-b border-zinc-100 dark:border-zinc-800 pb-2.5">
                🛵 INFORMASI KURIR
              </h2>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-bold text-zinc-800 dark:text-zinc-200">
                    {courierName}
                  </p>
                  {courierPhoneMasked && (
                    <p className="text-xs text-zinc-400 font-medium mt-0.5">
                      No. Telp: {courierPhoneMasked}
                    </p>
                  )}
                </div>
                {courierPhone && (
                  <a
                    href={`https://wa.me/${courierPhone.replace(/\D/g, '').replace(/^0/, '62')}?text=${encodeURIComponent(`Halo ${courierName}, saya pelanggan dari pesanan #${maskedId}.`)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all active:scale-[0.98] flex items-center gap-1.5 shadow-sm"
                  >
                    <span>💬 HUBUNGI KURIR</span>
                  </a>
                )}
              </div>
            </div>
          )}

        {/* ETA Countdown Card */}
        {currentStatus === 'OUT_FOR_DELIVERY' && timeLeft && (
          <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-6 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-amber-600 dark:text-amber-400 font-black uppercase tracking-wider">
                  🛵 ESTIMASI WAKTU TIBA (ETA)
                </p>
                <p className="text-lg font-black text-zinc-800 dark:text-zinc-200 mt-1">
                  {timeLeft}
                </p>
              </div>
              <span className="text-3xl animate-bounce">🛵</span>
            </div>
            {/* Progress Bar */}
            <div className="w-full bg-zinc-200 dark:bg-zinc-800 rounded-full h-2 overflow-hidden relative">
              <style>{`
                .order-progress-bar-fill-${maskedId} {
                  width: ${progressPercent}%;
                }
              `}</style>
              <div
                className={`order-progress-bar-fill-${maskedId} bg-amber-500 h-2 rounded-full transition-all duration-1000 ease-out`}
              />
            </div>
          </div>
        )}

        {/* Proof of Delivery Card */}
        {!isPickup && proofPhotoUrl && (
          <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200/60 dark:border-zinc-800 p-6 shadow-sm space-y-4">
            <h2 className="text-xs font-black text-zinc-400 dark:text-zinc-500 uppercase tracking-wider mb-2 border-b border-zinc-100 dark:border-zinc-800 pb-2.5">
              📸 BUKTI PENGIRIMAN
            </h2>
            <div className="border border-zinc-100 dark:border-zinc-800 rounded-xl overflow-hidden shadow-inner">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {/* biome-ignore lint/performance/noImgElement: External proof photo from dynamic URL */}
              <img
                src={proofPhotoUrl}
                alt="Bukti Pengiriman"
                className="w-full h-auto object-cover max-h-96"
              />
            </div>
            <p className="text-xs text-zinc-400 font-medium text-center italic">
              Pesanan telah berhasil diantar ke alamat Anda.
            </p>
          </div>
        )}

        {/* Tipping Card */}
        {(currentStatus === 'DELIVERED' || currentStatus === 'COMPLETED') && (
          <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200/60 dark:border-zinc-800 p-6 shadow-sm space-y-4">
            <h2 className="text-xs font-black text-zinc-400 dark:text-zinc-500 uppercase tracking-wider mb-2 border-b border-zinc-100 dark:border-zinc-800 pb-2.5">
              ☕ BERIKAN TIP UNTUK KURIR
            </h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
              Kinerja kurir sangat membantu kami. Anda dapat memberikan tip tambahan langsung
              (cashless) yang akan 100% disalurkan ke kurir.
            </p>

            {tipAmount > 0 && (
              <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 rounded-xl p-4 text-center font-bold text-sm">
                Tip yang sudah diberikan: {formatPrice(tipAmount)} 🎉
              </div>
            )}

            <div className="grid grid-cols-3 gap-2">
              {[2000, 5000, 10000].map((amt) => (
                <button
                  type="button"
                  key={amt}
                  disabled={isSubmittingTip}
                  onClick={() => handleAddTip(amt)}
                  className="py-2.5 px-3 bg-zinc-50 hover:bg-zinc-100 dark:bg-zinc-800 dark:hover:bg-zinc-700 border border-zinc-200/60 dark:border-zinc-700 rounded-xl text-xs font-bold text-zinc-700 dark:text-zinc-300 transition-all disabled:opacity-50"
                >
                  +{formatPrice(amt)}
                </button>
              ))}
            </div>

            <div className="flex gap-2">
              <input
                type="number"
                placeholder="Jumlah kustom..."
                value={customTip}
                disabled={isSubmittingTip}
                onChange={(e) => setCustomTip(e.target.value)}
                className="flex-1 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200/60 dark:border-zinc-700 rounded-xl px-3 text-xs font-bold text-zinc-800 dark:text-zinc-200 focus:outline-none focus:ring-1 focus:ring-amber-500"
              />
              <button
                type="button"
                disabled={isSubmittingTip || !customTip}
                onClick={() => {
                  const amt = parseInt(customTip, 10)
                  if (!Number.isNaN(amt)) handleAddTip(amt)
                }}
                className="py-2.5 px-4 bg-amber-500 hover:bg-amber-400 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all disabled:opacity-50"
              >
                KIRIM
              </button>
            </div>
          </div>
        )}

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
              <style>{`
                .stepper-progress-fill-${maskedId} {
                  height: ${percent}%;
                }
              `}</style>
              <div
                className={`stepper-progress-fill-${maskedId} absolute left-3.5 top-5 w-0.5 bg-amber-500 -translate-x-1/2 transition-all duration-700 ease-in-out`}
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

            {/* Delivery Address */}
            {order.address && (
              <div className="bg-zinc-50 dark:bg-zinc-800 border border-zinc-200/60 dark:border-zinc-750 p-4 rounded-xl space-y-1.5 mt-2">
                <p className="text-xs font-black text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">
                  📍 ALAMAT PENGIRIMAN
                </p>
                <p className="text-sm font-bold text-zinc-850 dark:text-zinc-150 leading-relaxed">
                  {order.address.fullAddress}
                </p>
                {order.address.notes && (
                  <p className="text-xs text-zinc-400 font-medium italic">
                    Patokan: {order.address.notes}
                  </p>
                )}
              </div>
            )}

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
