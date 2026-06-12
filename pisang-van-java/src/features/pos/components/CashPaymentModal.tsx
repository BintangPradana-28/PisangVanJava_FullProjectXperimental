// src/features/pos/components/CashPaymentModal.tsx
// Cash payment calculator modal for POS cashier interface

'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'

// ─── Quick Denomination Buttons ─────────────────────────────

const QUICK_AMOUNTS = [5_000, 10_000, 20_000, 50_000, 100_000, 150_000, 200_000, 250_000] as const

// ─── Props ──────────────────────────────────────────────────

interface CashPaymentModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  totalPrice: number
  onConfirm: (cashTendered: number) => void
  isLoading?: boolean
}

// ─── Formatter ──────────────────────────────────────────────

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0
  }).format(value)
}

// ─── Component ──────────────────────────────────────────────

export function CashPaymentModal({
  open,
  onOpenChange,
  totalPrice,
  onConfirm,
  isLoading = false
}: CashPaymentModalProps): React.JSX.Element {
  const [cashTendered, setCashTendered] = useState<string>('')

  // Reset when dialog opens
  useEffect(() => {
    if (open) {
      setCashTendered('')
    }
  }, [open])

  const numericValue = useMemo((): number => {
    const parsed = Number(cashTendered)
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0
  }, [cashTendered])

  const changeAmount = useMemo(
    (): number => Math.max(0, numericValue - totalPrice),
    [numericValue, totalPrice]
  )

  const isInsufficientFunds = numericValue < totalPrice && cashTendered !== ''

  // ─── Numpad Handlers ────────────────────────────────────
  const handleNumpadPress = useCallback((digit: string): void => {
    setCashTendered((prev) => {
      if (digit === 'C') return ''
      if (digit === '⌫') return prev.slice(0, -1)
      // Prevent excessively long input
      if (prev.length >= 10) return prev
      // Prevent leading zeros
      if (prev === '0' && digit !== '.') return digit
      return prev + digit
    })
  }, [])

  const handleQuickAmount = useCallback((amount: number): void => {
    setCashTendered(String(amount))
  }, [])

  const handleConfirm = useCallback((): void => {
    if (numericValue >= totalPrice) {
      onConfirm(numericValue)
    }
  }, [numericValue, totalPrice, onConfirm])

  // ─── Keyboard Listener ──────────────────────────────────
  useEffect(() => {
    if (!open) return

    const handler = (e: KeyboardEvent): void => {
      if (e.key >= '0' && e.key <= '9') {
        handleNumpadPress(e.key)
      } else if (e.key === 'Backspace') {
        handleNumpadPress('⌫')
      } else if (e.key === 'Escape') {
        handleNumpadPress('C')
      } else if (e.key === 'Enter' && numericValue >= totalPrice) {
        handleConfirm()
      }
    }

    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, handleNumpadPress, handleConfirm, numericValue, totalPrice])

  // Relevant quick amounts (only show amounts >= totalPrice, plus some below)
  const relevantQuickAmounts = useMemo((): number[] => {
    return QUICK_AMOUNTS.filter((a) => a >= totalPrice * 0.5)
  }, [totalPrice])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-[480px] p-0 gap-0 bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800"
        onInteractOutside={(e) => e.preventDefault()}
      >
        {/* Header */}
        <DialogHeader className="p-6 pb-4 border-b border-zinc-100 dark:border-zinc-800">
          <DialogTitle className="text-xl font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
            💵 Pembayaran Tunai
          </DialogTitle>
          <DialogDescription className="text-zinc-500 dark:text-zinc-400">
            Masukkan jumlah uang yang diterima dari pelanggan.
          </DialogDescription>
        </DialogHeader>

        {/* Body */}
        <div className="p-6 space-y-5">
          {/* Total to Pay */}
          <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 rounded-lg p-4">
            <div className="text-xs text-amber-700 dark:text-amber-400 font-semibold uppercase tracking-wider mb-1">
              Total Tagihan
            </div>
            <div className="text-3xl font-bold text-amber-800 dark:text-amber-300 tabular-nums">
              {formatCurrency(totalPrice)}
            </div>
          </div>

          {/* Cash Input Display */}
          <div className="relative">
            <label
              htmlFor="cash-display"
              className="block text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-2"
            >
              Uang Diterima
            </label>
            <div
              id="cash-display"
              className={cn(
                'w-full h-14 px-4 flex items-center justify-end rounded-lg border text-2xl font-bold tabular-nums transition-colors',
                isInsufficientFunds
                  ? 'border-red-400 bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-400'
                  : 'border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100'
              )}
            >
              {cashTendered ? (
                formatCurrency(numericValue)
              ) : (
                <span className="text-zinc-400 dark:text-zinc-600 text-lg">
                  Ketik atau tekan tombol...
                </span>
              )}
            </div>
          </div>

          {/* Quick Amount Buttons */}
          <div className="grid grid-cols-4 gap-2">
            {relevantQuickAmounts.map((amount) => (
              <button
                key={amount}
                type="button"
                onClick={() => handleQuickAmount(amount)}
                className={cn(
                  'py-2.5 rounded-lg text-sm font-semibold transition-all active:scale-95',
                  numericValue === amount
                    ? 'bg-amber-500 text-white shadow-md'
                    : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700'
                )}
              >
                {formatCurrency(amount).replace('Rp', '').trim()}
              </button>
            ))}
          </div>

          {/* Numpad */}
          <div className="grid grid-cols-3 gap-2">
            {['1', '2', '3', '4', '5', '6', '7', '8', '9', 'C', '0', '⌫'].map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => handleNumpadPress(key)}
                className={cn(
                  'h-12 rounded-lg font-bold text-lg transition-all active:scale-95',
                  key === 'C'
                    ? 'bg-red-100 dark:bg-red-950/30 text-red-600 dark:text-red-400 hover:bg-red-200'
                    : key === '⌫'
                      ? 'bg-zinc-200 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-300'
                      : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 hover:bg-zinc-200 dark:hover:bg-zinc-700'
                )}
              >
                {key}
              </button>
            ))}
          </div>

          {/* Change Calculation */}
          {numericValue > 0 && (
            <div
              className={cn(
                'rounded-lg p-4 border transition-colors',
                numericValue >= totalPrice
                  ? 'bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-900/50'
                  : 'bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-900/50'
              )}
            >
              <div
                className={cn(
                  'text-xs font-semibold uppercase tracking-wider mb-1',
                  numericValue >= totalPrice
                    ? 'text-green-700 dark:text-green-400'
                    : 'text-red-700 dark:text-red-400'
                )}
              >
                {numericValue >= totalPrice ? 'Kembalian' : 'Kurang'}
              </div>
              <div
                className={cn(
                  'text-3xl font-bold tabular-nums',
                  numericValue >= totalPrice
                    ? 'text-green-700 dark:text-green-400'
                    : 'text-red-600 dark:text-red-400'
                )}
              >
                {numericValue >= totalPrice
                  ? formatCurrency(changeAmount)
                  : formatCurrency(totalPrice - numericValue)}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <DialogFooter className="p-4 pt-0 gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isLoading}
            className="flex-1"
          >
            Batal
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={numericValue < totalPrice || isLoading}
            className="flex-1 bg-green-600 hover:bg-green-700 text-white"
          >
            {isLoading ? (
              <span className="flex items-center gap-2">
                <span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Memproses...
              </span>
            ) : (
              `✅ Bayar ${formatCurrency(totalPrice)}`
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
