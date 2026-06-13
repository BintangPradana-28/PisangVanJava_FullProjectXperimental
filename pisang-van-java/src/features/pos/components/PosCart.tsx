// src/features/pos/components/PosCart.tsx
// RAG Source: src/features/pos/store/usePosStore.ts (Zustand store)
// RAG Source: GEMINI.md (Component writing order, Server vs Client)

'use client'

import { useMutation } from '@tanstack/react-query'
import { useSession } from 'next-auth/react'
import { FetchError } from 'ofetch'
import { useCallback, useState } from 'react'
import toast from 'react-hot-toast'
import { cn } from '@/lib/utils'
// Re-export for backwards compatibility with PosClient
import type { ProductType } from '@/src/features/menu/components/MenuCards'
import { usePosStore } from '@/src/features/pos/store/usePosStore'
import { api } from '@/src/lib/api'
import { CashPaymentModal } from './CashPaymentModal'
import { ManualDiscountModal } from './ManualDiscountModal'
import { getOfflineQueueCount, saveToOfflineQueue } from './OfflineSyncManager'
import type { Topping } from './PosModifierModal'
import PosReceiptModal from './PosReceiptModal'
import { QrisPaymentModal } from './QrisPaymentModal'

export interface CartItem {
  id: string // temporary client-side id
  product: ProductType
  baseType: string
  toppings: Topping[]
  topping: Topping | null
  quantity: number
  subtotal: number
}

// ─── Formatting Utility ─────────────────────────────────────

function formatRupiah(num: number): string {
  return `Rp ${num.toLocaleString('id-ID')}`
}

// ─── Component ──────────────────────────────────────────────

export default function PosCart(): React.JSX.Element {
  const { data: session } = useSession()
  const userRole = (session?.user as { role?: string })?.role ?? 'CASHIER'
  const isAdminOrSuperAdmin = userRole === 'ADMIN' || userRole === 'SUPER_ADMIN'

  // ─── Zustand Store ──────────────────────────────────────
  const items = usePosStore((s) => s.items)
  const discountAmount = usePosStore((s) => s.discountAmount)
  const isOnline = usePosStore((s) => s.isOnline)
  const queueCount = usePosStore((s) => s.queueCount)
  const receiptData = usePosStore((s) => s.receiptData)
  const removeItem = usePosStore((s) => s.removeItem)
  const updateQuantity = usePosStore((s) => s.updateQuantity)
  const clearCart = usePosStore((s) => s.clearCart)
  const applyDiscount = usePosStore((s) => s.applyDiscount)
  const clearDiscount = usePosStore((s) => s.clearDiscount)
  const setReceiptData = usePosStore((s) => s.setReceiptData)
  const getTotalPrice = usePosStore((s) => s.getTotalPrice)
  const getFinalPrice = usePosStore((s) => s.getFinalPrice)

  // ─── Modal State ────────────────────────────────────────
  const [showCashModal, setShowCashModal] = useState(false)
  const [showQrisModal, setShowQrisModal] = useState(false)
  const [showDiscountModal, setShowDiscountModal] = useState(false)
  const [approvalToken, setApprovalToken] = useState<string | null>(null)

  // ─── QRIS State ─────────────────────────────────────────
  const [qrisOrderId, setQrisOrderId] = useState<string | null>(null)
  const [qrisData, setQrisData] = useState<{
    midtransOrderId: string
    transactionId: string | null
    qrString: string | null
    expiryTime: string | null
  } | null>(null)

  const totalPrice = getTotalPrice()
  const finalPrice = getFinalPrice()

  // ─── Checkout Mutation ──────────────────────────────────
  const checkoutMutation = useMutation({
    mutationFn: async ({
      payload,
      paymentMethod
    }: {
      payload: Record<string, unknown>
      paymentMethod: 'CASH' | 'QRIS'
    }) => {
      if (!isOnline) {
        saveToOfflineQueue(payload)
        return { offline: true, payload, paymentMethod }
      }
      const data = await api<{ success: boolean; data?: any; error?: string }>('/api/pos/orders', {
        method: 'POST',
        body: payload
      })
      if (!data.success) throw new Error(data.error || 'Gagal memproses transaksi')
      return { offline: false, data, payload, paymentMethod }
    },
    retry: 0,
    onSuccess: (res) => {
      if (res.offline) {
        toast.success('Mode Offline: Pesanan Masuk Antrean.', { icon: '📶' })
        setReceiptData({
          orderId: res.payload.offlineId as string,
          date: new Date(),
          items: [...items],
          totalPrice: finalPrice,
          paymentMethod: res.paymentMethod,
          cashierName: 'Kasir POS (Offline)'
        })
      } else if (res.paymentMethod === 'QRIS' && res.data?.data?.qris) {
        // QRIS: Show QR modal for payment
        const qris = res.data.data.qris
        setQrisOrderId(res.data.data.id)
        setQrisData({
          midtransOrderId: qris.midtransOrderId,
          transactionId: qris.transactionId,
          qrString: qris.qrString,
          expiryTime: qris.expiryTime
        })
        setShowQrisModal(true)
      } else {
        // CASH: Show receipt
        toast.success('Transaksi Berhasil! Pesanan dikirim ke dapur.')
        setReceiptData({
          orderId: res.data?.data?.id || (res.payload.offlineId as string),
          date: new Date(),
          items: [...items],
          totalPrice: finalPrice,
          paymentMethod: res.paymentMethod,
          cashierName: session?.user?.name || 'Kasir POS'
        })
      }
    },
    onError: (error: FetchError | Error, variables) => {
      if (
        error instanceof TypeError ||
        error.message.includes('Failed to fetch') ||
        error.message.includes('fetch failed')
      ) {
        saveToOfflineQueue(variables.payload)
        toast.error('Koneksi terputus. Pesanan Masuk Antrean.')
        setReceiptData({
          orderId: variables.payload.offlineId as string,
          date: new Date(),
          items: [...items],
          totalPrice: finalPrice,
          paymentMethod: variables.paymentMethod,
          cashierName: 'Kasir POS (Offline)'
        })
      } else {
        const msg =
          error instanceof FetchError
            ? error.data?.error || 'Gagal memproses transaksi'
            : error.message
        toast.error(msg, { duration: 5000 })
      }
    }
  })

  // ─── Build Payload ──────────────────────────────────────
  const buildPayload = useCallback(
    (paymentMethod: 'CASH' | 'QRIS'): Record<string, unknown> => ({
      offlineId: crypto.randomUUID(),
      customerName: 'Pelanggan Kasir',
      customerPhone: '-',
      paymentMethod,
      totalPrice: finalPrice,
      discountAmount,
      approvalToken: approvalToken ?? undefined,
      items: items.map((item) => ({
        variantId: item.product.id,
        toppingId: item.topping?.id || null,
        toppingIds: item.toppings ? item.toppings.map((t) => t.id) : item.topping ? [item.topping.id] : [],
        baseType: item.baseType,
        quantity: item.quantity,
        unitPrice: item.subtotal / item.quantity,
        subtotal: item.subtotal
      }))
    }),
    [items, finalPrice, discountAmount, approvalToken]
  )

  // ─── CASH Checkout Flow ─────────────────────────────────
  const handleCashCheckout = useCallback((): void => {
    if (items.length === 0 || checkoutMutation.isPending) return
    setShowCashModal(true)
  }, [items.length, checkoutMutation.isPending])

  const handleCashConfirm = useCallback(
    (_cashTendered: number): void => {
      setShowCashModal(false)
      const payload = buildPayload('CASH')
      checkoutMutation.mutate({ payload, paymentMethod: 'CASH' })
    },
    [buildPayload, checkoutMutation]
  )

  // ─── QRIS Checkout Flow ─────────────────────────────────
  const handleQrisCheckout = useCallback((): void => {
    if (items.length === 0 || checkoutMutation.isPending || !isOnline) return
    const payload = buildPayload('QRIS')
    checkoutMutation.mutate({ payload, paymentMethod: 'QRIS' })
  }, [items.length, checkoutMutation, isOnline, buildPayload])

  const handleQrisConfirmed = useCallback((): void => {
    toast.success('Pembayaran QRIS Berhasil! ✅')
    setShowQrisModal(false)
    setReceiptData({
      orderId: qrisOrderId ?? undefined,
      date: new Date(),
      items: [...items],
      totalPrice: finalPrice,
      paymentMethod: 'QRIS',
      cashierName: session?.user?.name || 'Kasir POS'
    })
  }, [qrisOrderId, items, finalPrice, session?.user?.name, setReceiptData])

  const handleQrisExpired = useCallback((): void => {
    toast.error('QR Code kedaluwarsa. Silakan buat transaksi baru.')
  }, [])

  // ─── Discount Flow ──────────────────────────────────────
  const handleApplyDiscount = useCallback(
    (amount: number, token: string): void => {
      applyDiscount(amount)
      setApprovalToken(token)
      toast.success(`Diskon ${formatRupiah(amount)} diterapkan! 🏷️`)
    },
    [applyDiscount]
  )

  // ─── Receipt Close ─────────────────────────────────────
  const handleReceiptClose = useCallback((): void => {
    setReceiptData(null)
    clearCart()
    setApprovalToken(null)
    setQrisOrderId(null)
    setQrisData(null)
  }, [setReceiptData, clearCart])

  return (
    <div className="w-full h-full bg-white dark:bg-zinc-900 flex flex-col border-l border-zinc-100 dark:border-zinc-800 shadow-xl relative">
      {/* Overlay if processing */}
      {checkoutMutation.isPending && (
        <div className="absolute inset-0 bg-white/60 dark:bg-zinc-900/60 backdrop-blur-sm z-10 flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <div className="h-8 w-8 border-3 border-amber-200 border-t-amber-600 rounded-full animate-spin" />
            <span className="font-bold text-amber-600 dark:text-amber-400">Memproses...</span>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="p-5 border-b border-zinc-100 dark:border-zinc-800 flex justify-between items-center bg-zinc-50 dark:bg-zinc-800/50">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-bold text-zinc-800 dark:text-zinc-100">Keranjang Kasir</h2>
          {queueCount > 0 && (
            <div
              className="relative flex items-center justify-center cursor-help"
              title={`${queueCount} transaksi menunggu sinkronisasi`}
            >
              <span className="text-2xl text-zinc-400">☁️</span>
              <span className="absolute -top-1 -right-2 bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full border-2 border-zinc-50 dark:border-zinc-800">
                {queueCount}
              </span>
            </div>
          )}
        </div>
        <span className="bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 px-3 py-1 rounded-full text-sm font-bold">
          {items.length} Item
        </span>
      </div>

      {/* Cart Items */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-zinc-400">
            <div className="text-4xl mb-3">🛒</div>
            <p className="font-semibold">Keranjang kosong</p>
          </div>
        ) : (
          items.map((item) => (
            <div
              key={item.id}
              className="flex flex-col p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-2xl border border-zinc-100 dark:border-zinc-700 relative"
            >
              <div className="flex justify-between items-start mb-2">
                <div className="pr-6">
                  <h3 className="font-bold text-zinc-800 dark:text-zinc-100 leading-tight">
                    {item.product.flavorName}
                  </h3>
                  <div className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
                    Dasar: <span className="font-semibold">{item.baseType}</span>
                    {item.toppings && item.toppings.length > 0 ? (
                      <span> • + {item.toppings.map((t) => t.name).join(', ')}</span>
                    ) : item.topping ? (
                      <span> • + {item.topping.name}</span>
                    ) : null}
                  </div>
                </div>
                <button
                  onClick={() => removeItem(item.id)}
                  className="absolute top-4 right-4 text-zinc-400 hover:text-red-500 font-bold transition-colors"
                  aria-label={`Hapus ${item.product.flavorName}`}
                >
                  &times;
                </button>
              </div>

              <div className="flex justify-between items-end mt-2">
                <div className="flex items-center gap-3 bg-white dark:bg-zinc-900 p-1 rounded-xl shadow-sm border border-zinc-100 dark:border-zinc-700">
                  <button
                    onClick={() => updateQuantity(item.id, item.quantity - 1)}
                    className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-amber-100 dark:hover:bg-amber-900/30 text-amber-600 dark:text-amber-400 font-bold active:scale-95"
                  >
                    -
                  </button>
                  <span className="font-bold w-4 text-center text-zinc-800 dark:text-zinc-100">
                    {item.quantity}
                  </span>
                  <button
                    onClick={() => updateQuantity(item.id, item.quantity + 1)}
                    className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-amber-100 dark:hover:bg-amber-900/30 text-amber-600 dark:text-amber-400 font-bold active:scale-95"
                  >
                    +
                  </button>
                </div>
                <span className="font-bold text-lg text-zinc-800 dark:text-zinc-100">
                  {formatRupiah(item.subtotal)}
                </span>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Footer / Checkout Actions */}
      <div className="p-5 border-t border-zinc-100 dark:border-zinc-800 bg-white dark:bg-zinc-900 space-y-3">
        {/* Subtotal */}
        <div className="flex justify-between items-center">
          <span className="text-zinc-500 dark:text-zinc-400 font-medium text-sm">Subtotal</span>
          <span className="font-bold text-zinc-700 dark:text-zinc-300 tabular-nums">
            {formatRupiah(totalPrice)}
          </span>
        </div>

        {/* Discount Row */}
        <div className="flex justify-between items-center">
          <button
            onClick={() => setShowDiscountModal(true)}
            disabled={items.length === 0}
            className={cn(
              'text-sm font-semibold transition-colors',
              discountAmount > 0
                ? 'text-green-600 dark:text-green-400'
                : 'text-amber-600 dark:text-amber-400 hover:text-amber-700'
            )}
          >
            {discountAmount > 0 ? '🏷️ Diskon' : '+ Tambah Diskon'}
          </button>
          {discountAmount > 0 ? (
            <div className="flex items-center gap-2">
              <span className="font-bold text-green-600 dark:text-green-400 tabular-nums">
                - {formatRupiah(discountAmount)}
              </span>
              <button
                onClick={() => {
                  clearDiscount()
                  setApprovalToken(null)
                }}
                className="text-xs text-red-500 hover:text-red-700 font-bold"
                title="Hapus diskon"
              >
                ✕
              </button>
            </div>
          ) : (
            <span className="text-sm text-zinc-400">—</span>
          )}
        </div>

        {/* Divider */}
        <div className="border-t border-zinc-100 dark:border-zinc-800" />

        {/* Total */}
        <div className="flex justify-between items-center">
          <span className="text-zinc-600 dark:text-zinc-300 font-bold">Total Penjualan</span>
          <span className="text-3xl font-black text-zinc-800 dark:text-zinc-100 tabular-nums">
            {formatRupiah(finalPrice)}
          </span>
        </div>

        {/* Payment Buttons */}
        <div className="grid grid-cols-2 gap-3 pt-1">
          <button
            onClick={handleCashCheckout}
            disabled={items.length === 0 || checkoutMutation.isPending}
            className="w-full bg-green-500 hover:bg-green-600 text-white font-bold py-4 rounded-2xl text-lg flex justify-center items-center active:scale-[0.98] transition-all shadow-lg shadow-green-500/30 disabled:opacity-50 disabled:shadow-none"
          >
            💵 Tunai
          </button>
          <button
            onClick={handleQrisCheckout}
            disabled={items.length === 0 || checkoutMutation.isPending || !isOnline}
            className="w-full bg-blue-500 hover:bg-blue-600 text-white font-bold py-4 rounded-2xl text-lg flex flex-col justify-center items-center active:scale-[0.98] transition-all shadow-lg shadow-blue-500/30 disabled:opacity-50 disabled:shadow-none disabled:bg-zinc-400"
          >
            <span>📱 QRIS</span>
            {!isOnline && (
              <span className="text-[10px] uppercase font-bold text-zinc-200 tracking-wider">
                Terkunci (Offline)
              </span>
            )}
          </button>
        </div>
      </div>

      {/* ─── Modals ───────────────────────────────────────── */}

      {/* Cash Payment Modal */}
      <CashPaymentModal
        open={showCashModal}
        onOpenChange={setShowCashModal}
        totalPrice={finalPrice}
        onConfirm={handleCashConfirm}
        isLoading={checkoutMutation.isPending}
      />

      {/* QRIS Payment Modal */}
      <QrisPaymentModal
        open={showQrisModal}
        onOpenChange={setShowQrisModal}
        totalPrice={finalPrice}
        orderId={qrisOrderId}
        qrisData={qrisData}
        onPaymentConfirmed={handleQrisConfirmed}
        onPaymentExpired={handleQrisExpired}
      />

      {/* Manual Discount Modal */}
      <ManualDiscountModal
        open={showDiscountModal}
        onOpenChange={setShowDiscountModal}
        totalPrice={totalPrice}
        onApply={handleApplyDiscount}
        isAdminOrSuperAdmin={isAdminOrSuperAdmin}
      />

      {/* Receipt Modal */}
      <PosReceiptModal isOpen={!!receiptData} data={receiptData} onClose={handleReceiptClose} />
    </div>
  )
}
