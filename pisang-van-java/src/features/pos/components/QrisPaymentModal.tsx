// src/features/pos/components/QrisPaymentModal.tsx
// Dynamic QRIS payment modal with auto-polling for POS cashier interface

'use client'

import Image from 'next/image'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'

// ─── Types ──────────────────────────────────────────────────

interface QrisData {
  midtransOrderId: string
  transactionId: string | null
  qrString: string | null
  expiryTime: string | null
}

type PaymentStatus = 'GENERATING' | 'WAITING' | 'PAID' | 'EXPIRED' | 'ERROR'

interface QrisPaymentModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  totalPrice: number
  orderId: string | null
  qrisData: QrisData | null
  onPaymentConfirmed: () => void
  onPaymentExpired: () => void
}

// ─── Constants ──────────────────────────────────────────────

const POLL_INTERVAL_MS = 3000 // 3 seconds
const MAX_POLL_DURATION_MS = 5 * 60 * 1000 // 5 minutes

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0
  }).format(value)
}

// ─── Component ──────────────────────────────────────────────

export function QrisPaymentModal({
  open,
  onOpenChange,
  totalPrice,
  orderId,
  qrisData,
  onPaymentConfirmed,
  onPaymentExpired
}: QrisPaymentModalProps): React.JSX.Element {
  const [status, setStatus] = useState<PaymentStatus>('GENERATING')
  const [timeLeft, setTimeLeft] = useState<number>(300) // seconds
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const startTimeRef = useRef<number>(0)

  // ─── Cleanup ────────────────────────────────────────────
  const stopPolling = useCallback((): void => {
    if (pollRef.current) {
      clearInterval(pollRef.current)
      pollRef.current = null
    }
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
  }, [])

  // ─── Poll for Payment Status ────────────────────────────
  const pollPaymentStatus = useCallback(async (): Promise<void> => {
    if (!orderId) return

    try {
      const response = await fetch(`/api/pos/orders/${orderId}/status`, {
        method: 'GET',
        credentials: 'include'
      })

      if (!response.ok) return

      const result = await response.json()
      const paymentStatus = result?.data?.status

      if (paymentStatus === 'PAID') {
        stopPolling()
        setStatus('PAID')
        onPaymentConfirmed()
      } else if (paymentStatus === 'EXPIRED' || paymentStatus === 'CANCELED') {
        stopPolling()
        setStatus('EXPIRED')
        onPaymentExpired()
      }
    } catch {
      // Silently retry on next poll — network resilience
    }
  }, [orderId, stopPolling, onPaymentConfirmed, onPaymentExpired])

  // ─── Start Polling when QR is ready ─────────────────────
  useEffect(() => {
    if (!open || !qrisData?.qrString || !orderId) {
      setStatus('GENERATING')
      stopPolling()
      return
    }

    setStatus('WAITING')
    startTimeRef.current = Date.now()

    // Calculate initial time left from expiryTime
    if (qrisData.expiryTime) {
      const expiryMs = new Date(qrisData.expiryTime).getTime()
      const remainingSeconds = Math.max(0, Math.floor((expiryMs - Date.now()) / 1000))
      setTimeLeft(remainingSeconds)
    } else {
      setTimeLeft(300)
    }

    // Start polling
    pollRef.current = setInterval(() => {
      const elapsed = Date.now() - startTimeRef.current
      if (elapsed > MAX_POLL_DURATION_MS) {
        stopPolling()
        setStatus('EXPIRED')
        onPaymentExpired()
        return
      }
      pollPaymentStatus()
    }, POLL_INTERVAL_MS)

    // Countdown timer
    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          stopPolling()
          setStatus('EXPIRED')
          onPaymentExpired()
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => stopPolling()
  }, [open, qrisData, orderId, stopPolling, pollPaymentStatus, onPaymentExpired])

  // Format seconds to MM:SS
  const formattedTime = `${String(Math.floor(timeLeft / 60)).padStart(2, '0')}:${String(timeLeft % 60).padStart(2, '0')}`

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-[420px] p-0 gap-0 bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800"
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogHeader className="p-6 pb-4 border-b border-zinc-100 dark:border-zinc-800">
          <DialogTitle className="text-xl font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
            📱 Pembayaran QRIS
          </DialogTitle>
          <DialogDescription className="text-zinc-500 dark:text-zinc-400">
            Minta pelanggan scan kode QR di bawah ini.
          </DialogDescription>
        </DialogHeader>

        <div className="p-6 space-y-5 flex flex-col items-center">
          {/* Total */}
          <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/50 rounded-lg p-4 w-full">
            <div className="text-xs text-blue-700 dark:text-blue-400 font-semibold uppercase tracking-wider mb-1 text-center">
              Total Pembayaran
            </div>
            <div className="text-3xl font-bold text-blue-800 dark:text-blue-300 tabular-nums text-center">
              {formatCurrency(totalPrice)}
            </div>
          </div>

          {/* QR Code Display */}
          <div className="relative w-64 h-64 rounded-xl overflow-hidden border-2 border-zinc-200 dark:border-zinc-700 bg-white">
            {status === 'GENERATING' && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-white dark:bg-zinc-800">
                <div className="h-10 w-10 border-3 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
                <span className="text-sm font-medium text-zinc-500">Membuat QR Code...</span>
              </div>
            )}

            {status === 'WAITING' && qrisData?.qrString && (
              <Image
                src={qrisData.qrString}
                alt="QRIS QR Code"
                fill
                className="object-contain p-2"
                unoptimized
              />
            )}

            {status === 'PAID' && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-green-50 dark:bg-green-950/30">
                <div className="w-16 h-16 rounded-full bg-green-500 flex items-center justify-center animate-in zoom-in">
                  <svg
                    className="w-8 h-8 text-white"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={3}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <span className="text-lg font-bold text-green-700 dark:text-green-400">
                  Pembayaran Berhasil!
                </span>
              </div>
            )}

            {status === 'EXPIRED' && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-red-50 dark:bg-red-950/30">
                <div className="w-16 h-16 rounded-full bg-red-500 flex items-center justify-center">
                  <svg
                    className="w-8 h-8 text-white"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={3}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </div>
                <span className="text-lg font-bold text-red-700 dark:text-red-400">
                  QR Kedaluwarsa
                </span>
              </div>
            )}

            {status === 'ERROR' && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-red-50 dark:bg-red-950/30 p-4">
                <span className="text-sm font-medium text-red-600 text-center">
                  Gagal membuat QR Code. Silakan coba lagi.
                </span>
              </div>
            )}
          </div>

          {/* Timer */}
          {status === 'WAITING' && (
            <div className="flex flex-col items-center gap-1">
              <div
                className={cn(
                  'text-2xl font-bold tabular-nums',
                  timeLeft <= 60
                    ? 'text-red-600 dark:text-red-400 animate-pulse'
                    : 'text-zinc-700 dark:text-zinc-300'
                )}
              >
                ⏱ {formattedTime}
              </div>
              <span className="text-xs text-zinc-500">Menunggu pembayaran...</span>
            </div>
          )}

          {/* Polling Indicator */}
          {status === 'WAITING' && (
            <div className="flex items-center gap-2 text-xs text-zinc-400">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500" />
              </span>
              Auto-checking setiap 3 detik
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-zinc-100 dark:border-zinc-800 flex gap-2">
          {status === 'PAID' ? (
            <Button
              onClick={() => onOpenChange(false)}
              className="flex-1 bg-green-600 hover:bg-green-700 text-white"
            >
              ✅ Selesai
            </Button>
          ) : (
            <Button
              variant="outline"
              onClick={() => {
                stopPolling()
                onOpenChange(false)
              }}
              className="flex-1"
            >
              {status === 'EXPIRED' ? 'Tutup' : 'Batalkan'}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
