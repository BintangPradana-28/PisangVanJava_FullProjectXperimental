// app/(admin)/kasir/PosClient.tsx
// RAG Source: src/features/pos/store/usePosStore.ts (Zustand store)
// RAG Source: GEMINI.md ('use client' rules, Component writing order)

'use client'

import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { cn } from '@/lib/utils'
import type { ProductType } from '@/src/features/menu/components/MenuCards'
import OfflineSyncManager, {
  getOfflineQueueCount
} from '@/src/features/pos/components/OfflineSyncManager'
import PosCart from '@/src/features/pos/components/PosCart'
import PosMenuGrid from '@/src/features/pos/components/PosMenuGrid'
import type { Topping } from '@/src/features/pos/components/PosModifierModal'
import { usePosStore } from '@/src/features/pos/store/usePosStore'

// ─── Types ──────────────────────────────────────────────────

interface PosClientProps {
  products: ProductType[]
  toppings: Topping[]
}

// ─── Component ──────────────────────────────────────────────

export default function PosClient({ products, toppings }: PosClientProps): React.JSX.Element {
  const router = useRouter()
  const [isRefreshing, setIsRefreshing] = useState(false)

  // ─── Zustand Store ──────────────────────────────────────
  const items = usePosStore((s) => s.items)
  const isOnline = usePosStore((s) => s.isOnline)
  const isCartOpenOnMobile = usePosStore((s) => s.isCartOpenOnMobile)
  const addItem = usePosStore((s) => s.addItem)
  const setCartOpenOnMobile = usePosStore((s) => s.setCartOpenOnMobile)
  const setOnline = usePosStore((s) => s.setOnline)
  const setQueueCount = usePosStore((s) => s.setQueueCount)
  const getTotalItemCount = usePosStore((s) => s.getTotalItemCount)

  const totalCartItems = getTotalItemCount()

  // ─── Network Status Listener ────────────────────────────
  useEffect(() => {
    setOnline(navigator.onLine)
    setQueueCount(getOfflineQueueCount())

    const handleOnline = (): void => setOnline(true)
    const handleOffline = (): void => setOnline(false)
    const updateQueue = (): void => setQueueCount(getOfflineQueueCount())

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    window.addEventListener('offline_queue_updated', updateQueue)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
      window.removeEventListener('offline_queue_updated', updateQueue)
    }
  }, [setOnline, setQueueCount])

  // ─── Data Refresh ───────────────────────────────────────
  const handleRefreshMenu = useCallback(async (): Promise<void> => {
    setIsRefreshing(true)
    const toastId = toast.loading('Menyinkronkan data menu terbaru...')
    try {
      router.refresh()
      await new Promise((res) => setTimeout(res, 800))
      toast.success('Menu berhasil diperbarui!', { id: toastId })
    } catch {
      toast.error('Gagal memperbarui menu', { id: toastId })
    } finally {
      setIsRefreshing(false)
    }
  }, [router])

  // ─── Add to Cart via Zustand ────────────────────────────
  const handleAddToCart = useCallback(
    (orderItem: {
      product: ProductType
      baseType: 'Kembung' | 'Lumpia' | 'Krispy'
      toppings: Topping[]
      topping: Topping | null
      quantity: number
      subtotal: number
    }): void => {
      addItem(orderItem)
      toast.success(`${orderItem.product.flavorName} ditambahkan!`, {
        duration: 1500,
        icon: '🍌'
      })
    },
    [addItem]
  )

  return (
    <div className="flex h-full w-full relative">
      {/* Background Offline Sync Manager */}
      <OfflineSyncManager />

      {/* LEFT PANE: Menu Grid (70% on lg) */}
      <div className="flex-1 h-full flex flex-col bg-zinc-100 dark:bg-zinc-950 overflow-hidden">
        {/* Top Navbar */}
        <div className="bg-white dark:bg-zinc-900 p-4 shadow-sm z-10 flex justify-between items-center shrink-0 border-b border-zinc-100 dark:border-zinc-800">
          <div>
            <h1 className="text-2xl font-black text-zinc-800 dark:text-zinc-100 tracking-tight">
              PISANG VAN JAVA
            </h1>
            <p className="text-xs font-bold text-zinc-400 uppercase tracking-widest">
              Point of Sale
            </p>
          </div>

          <div className="flex items-center gap-3">
            {/* Network Status Indicator */}
            <div
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-colors',
                isOnline
                  ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                  : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 animate-pulse'
              )}
            >
              <span
                className={cn('w-2 h-2 rounded-full', isOnline ? 'bg-green-500' : 'bg-red-500')}
              />
              {isOnline ? 'Online' : 'Offline'}
            </div>

            <button
              type="button"
              onClick={handleRefreshMenu}
              disabled={isRefreshing}
              className="flex items-center gap-2 bg-zinc-50 dark:bg-zinc-800 hover:bg-amber-50 dark:hover:bg-amber-900/20 text-zinc-600 dark:text-zinc-300 hover:text-amber-600 dark:hover:text-amber-400 px-4 py-2 rounded-lg font-bold text-sm transition-colors border border-zinc-200 dark:border-zinc-700"
            >
              <span className={isRefreshing ? 'animate-spin' : ''}>🔄</span>
              <span className="hidden sm:inline">Sync Menu</span>
            </button>

            {/* Mobile Cart Toggle Button */}
            <button
              type="button"
              onClick={() => setCartOpenOnMobile(true)}
              className="lg:hidden relative bg-amber-600 text-white p-3 rounded-lg shadow-md active:scale-95 transition-transform"
            >
              🛒
              {totalCartItems > 0 && (
                <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs font-bold w-6 h-6 flex items-center justify-center rounded-full border-2 border-white">
                  {totalCartItems}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Menu Grid Scrollable Area */}
        <div className="flex-1 overflow-y-auto pb-24 lg:pb-4">
          <PosMenuGrid products={products} toppings={toppings} onAddToCart={handleAddToCart} />
        </div>
      </div>

      {/* RIGHT PANE: Cart (30% on lg) + MOBILE FALLBACK DRAWER */}
      <div
        className={cn(
          'fixed inset-0 z-50 lg:static lg:w-[380px] xl:w-[420px] shrink-0 transition-transform duration-300',
          isCartOpenOnMobile ? 'translate-x-0' : 'translate-x-full lg:translate-x-0'
        )}
      >
        {/* Mobile Backdrop */}
        <button
          type="button"
          aria-label="Tutup Keranjang"
          className="absolute inset-0 bg-black/60 lg:hidden backdrop-blur-sm w-full h-full border-none cursor-pointer outline-none p-0"
          onClick={() => setCartOpenOnMobile(false)}
        />

        {/* Cart Container */}
        <div className="absolute right-0 top-0 bottom-0 w-[90%] sm:w-[400px] lg:w-full lg:static h-full bg-white dark:bg-zinc-900 shadow-sm lg:shadow-none flex flex-col">
          {/* Mobile Close Button */}
          <div className="lg:hidden bg-zinc-50 dark:bg-zinc-800 p-4 border-b border-zinc-100 dark:border-zinc-700 flex justify-end">
            <button
              type="button"
              onClick={() => setCartOpenOnMobile(false)}
              className="text-zinc-500 dark:text-zinc-400 font-bold bg-zinc-200 dark:bg-zinc-700 hover:bg-zinc-300 dark:hover:bg-zinc-600 px-4 py-2 rounded-lg transition-colors"
            >
              Tutup Keranjang ➔
            </button>
          </div>

          {/* PosCart now uses Zustand — no props needed */}
          <PosCart />
        </div>
      </div>
    </div>
  )
}
