// src/features/pos/components/ManualDiscountModal.tsx
// Manual discount input with Manager PIN verification gate

'use client'

import { useCallback, useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

// ─── Types ──────────────────────────────────────────────────

type Step = 'input-discount' | 'verify-pin' | 'success'

interface ManualDiscountModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  totalPrice: number
  onApply: (discountAmount: number, approvalToken: string) => void
  isAdminOrSuperAdmin: boolean
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0
  }).format(value)
}

// ─── Component ──────────────────────────────────────────────

export function ManualDiscountModal({
  open,
  onOpenChange,
  totalPrice,
  onApply,
  isAdminOrSuperAdmin
}: ManualDiscountModalProps): React.JSX.Element {
  const [step, setStep] = useState<Step>('input-discount')
  const [discountInput, setDiscountInput] = useState<string>('')
  const [pinInput, setPinInput] = useState<string>('')
  const [error, setError] = useState<string | null>(null)
  const [isVerifying, setIsVerifying] = useState(false)

  // Reset on open change
  const handleOpenChange = useCallback(
    (newOpen: boolean): void => {
      if (!newOpen) {
        setStep('input-discount')
        setDiscountInput('')
        setPinInput('')
        setError(null)
        setIsVerifying(false)
      }
      onOpenChange(newOpen)
    },
    [onOpenChange]
  )

  const discountAmount = Math.max(0, Number(discountInput) || 0)
  const isDiscountExceedsTotal = discountAmount > totalPrice
  const isDiscountValid = discountAmount > 0 && discountAmount <= totalPrice

  // ─── Step 1 → Step 2 ─────────────────────────────────────
  const handleProceedToPin = useCallback((): void => {
    if (!isDiscountValid) return

    // ADMIN/SUPER_ADMIN bypass PIN verification
    if (isAdminOrSuperAdmin) {
      // Generate a synthetic approval (they don't need PIN)
      onApply(discountAmount, 'admin_bypass')
      handleOpenChange(false)
      return
    }

    // CASHIER must verify Manager PIN
    setStep('verify-pin')
    setError(null)
    setPinInput('')
  }, [isDiscountValid, isAdminOrSuperAdmin, discountAmount, onApply, handleOpenChange])

  // ─── PIN Verification ─────────────────────────────────────
  const handleVerifyPin = useCallback(async (): Promise<void> => {
    if (pinInput.length !== 4) {
      setError('PIN harus 4 digit.')
      return
    }

    setIsVerifying(true)
    setError(null)

    try {
      const response = await fetch('/api/pos/auth-pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ pin: pinInput })
      })

      const result = await response.json()

      if (result.success && result.approvalToken) {
        onApply(discountAmount, result.approvalToken)
        handleOpenChange(false)
      } else {
        setError(result.error || 'PIN salah. Coba lagi.')
        setPinInput('')
      }
    } catch {
      setError('Gagal memverifikasi PIN. Periksa koneksi jaringan.')
    } finally {
      setIsVerifying(false)
    }
  }, [pinInput, discountAmount, onApply, handleOpenChange])

  // ─── PIN Numpad ───────────────────────────────────────────
  const handlePinDigit = useCallback((digit: string): void => {
    setPinInput((prev) => {
      if (digit === 'C') return ''
      if (digit === '⌫') return prev.slice(0, -1)
      if (prev.length >= 4) return prev
      return prev + digit
    })
    setError(null)
  }, [])

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className="sm:max-w-[420px] p-0 gap-0 bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800"
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogHeader className="p-6 pb-4 border-b border-zinc-100 dark:border-zinc-800">
          <DialogTitle className="text-xl font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
            {step === 'verify-pin' ? '🔐 Otorisasi Manajer' : '🏷️ Diskon Manual'}
          </DialogTitle>
          <DialogDescription className="text-zinc-500 dark:text-zinc-400">
            {step === 'verify-pin'
              ? 'Masukkan PIN Manajer untuk memberikan diskon.'
              : 'Masukkan jumlah diskon untuk transaksi ini.'}
          </DialogDescription>
        </DialogHeader>

        <div className="p-6 space-y-4">
          {step === 'input-discount' && (
            <>
              {/* Current Total */}
              <div className="bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg p-3">
                <div className="text-xs text-zinc-500 font-semibold uppercase tracking-wider mb-0.5">
                  Total Saat Ini
                </div>
                <div className="text-xl font-bold text-zinc-900 dark:text-zinc-100 tabular-nums">
                  {formatCurrency(totalPrice)}
                </div>
              </div>

              {/* Discount Input */}
              <div>
                <label
                  htmlFor="discount-amount"
                  className="block text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-2"
                >
                  Jumlah Diskon (Rp)
                </label>
                <Input
                  id="discount-amount"
                  type="number"
                  placeholder="Contoh: 5000"
                  value={discountInput}
                  onChange={(e) => setDiscountInput(e.target.value)}
                  min={0}
                  max={totalPrice}
                  className={cn(
                    'text-lg h-12 font-semibold tabular-nums',
                    isDiscountExceedsTotal && 'border-red-400 focus-visible:ring-red-400'
                  )}
                  autoFocus
                />
                {isDiscountExceedsTotal && (
                  <p className="text-xs text-red-500 mt-1.5">
                    Diskon tidak boleh melebihi total harga.
                  </p>
                )}
              </div>

              {/* Preview */}
              {isDiscountValid && (
                <div className="bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-900/50 rounded-lg p-3">
                  <div className="text-xs text-green-700 dark:text-green-400 font-semibold uppercase tracking-wider mb-0.5">
                    Total Setelah Diskon
                  </div>
                  <div className="text-xl font-bold text-green-700 dark:text-green-400 tabular-nums">
                    {formatCurrency(totalPrice - discountAmount)}
                  </div>
                  <div className="text-xs text-green-600 dark:text-green-500 mt-1">
                    Hemat {formatCurrency(discountAmount)}
                  </div>
                </div>
              )}
            </>
          )}

          {step === 'verify-pin' && (
            <>
              {/* Discount Summary */}
              <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 rounded-lg p-3 text-center">
                <span className="text-sm font-semibold text-amber-800 dark:text-amber-300">
                  Diskon: {formatCurrency(discountAmount)}
                </span>
              </div>

              {/* PIN Display */}
              <div className="flex justify-center gap-3 py-2">
                {[0, 1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className={cn(
                      'w-12 h-14 rounded-lg border-2 flex items-center justify-center text-2xl font-bold transition-all',
                      pinInput[i]
                        ? 'border-amber-500 bg-amber-50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-300'
                        : 'border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800'
                    )}
                  >
                    {pinInput[i] ? '●' : ''}
                  </div>
                ))}
              </div>

              {/* Error Message */}
              {error && (
                <div className="text-center text-sm text-red-500 font-medium bg-red-50 dark:bg-red-950/20 py-2 rounded-lg">
                  {error}
                </div>
              )}

              {/* PIN Numpad */}
              <div className="grid grid-cols-3 gap-2">
                {['1', '2', '3', '4', '5', '6', '7', '8', '9', 'C', '0', '⌫'].map((key) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => handlePinDigit(key)}
                    disabled={isVerifying}
                    className={cn(
                      'h-12 rounded-lg font-bold text-lg transition-all active:scale-95 disabled:opacity-50',
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
            </>
          )}
        </div>

        <DialogFooter className="p-4 pt-0 gap-2">
          {step === 'input-discount' && (
            <>
              <Button variant="outline" onClick={() => handleOpenChange(false)} className="flex-1">
                Batal
              </Button>
              <Button
                onClick={handleProceedToPin}
                disabled={!isDiscountValid}
                className="flex-1 bg-amber-600 hover:bg-amber-700 text-white"
              >
                {isAdminOrSuperAdmin ? '✅ Terapkan Diskon' : '🔐 Verifikasi PIN'}
              </Button>
            </>
          )}

          {step === 'verify-pin' && (
            <>
              <Button
                variant="outline"
                onClick={() => setStep('input-discount')}
                disabled={isVerifying}
                className="flex-1"
              >
                ← Kembali
              </Button>
              <Button
                onClick={handleVerifyPin}
                disabled={pinInput.length !== 4 || isVerifying}
                className="flex-1 bg-green-600 hover:bg-green-700 text-white"
              >
                {isVerifying ? (
                  <span className="flex items-center gap-2">
                    <span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Verifikasi...
                  </span>
                ) : (
                  '✅ Konfirmasi'
                )}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
