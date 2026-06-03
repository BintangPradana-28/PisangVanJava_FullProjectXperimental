'use client'

import { useEffect, useRef } from 'react'
import { useSession } from 'next-auth/react'
import { useCartStore, type CartItem } from '@/src/lib/store/useCartStore'

/**
 * CartSyncProvider — Handles DB ↔ Zustand synchronization for authenticated users.
 * Place inside Providers tree (after SessionProvider).
 * Does NOT wrap children in a Context; Zustand is globally accessible via hooks.
 */
export function CartSyncProvider({ children }: { children: React.ReactNode }) {
  const { status } = useSession()
  const hasSynced = useRef(false)

  const items = useCartStore((s) => s.items)
  const setItems = useCartStore((s) => s.setItems)
  const mergeItems = useCartStore((s) => s.mergeItems)
  const isDBSynced = useCartStore((s) => s.isDBSynced)
  const setDBSynced = useCartStore((s) => s.setDBSynced)

  // 1. Initial sync: fetch from DB, merge with local, then mark synced
  useEffect(() => {
    if (status !== 'authenticated' || hasSynced.current) return
    hasSynced.current = true

    const localItems = [...items] // snapshot current Zustand (hydrated from localStorage)

    fetch('/api/cart', { cache: 'no-store', credentials: 'include' })
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.data) {
          if (localItems.length > 0) {
            const merged = mergeItems(data.data as CartItem[], localItems)
            setItems(merged)
            syncToDB(merged)
          } else {
            setItems(data.data as CartItem[])
          }
        }
        setDBSynced(true)
      })
      .catch((e) => {
        console.error('GET /api/cart failed', e)
        setDBSynced(true) // proceed anyway
      })
  }, [status, items, setItems, mergeItems, setDBSynced])

  // 2. Auto-sync to DB whenever items change (after initial sync)
  useEffect(() => {
    if (status !== 'authenticated' || !isDBSynced) return
    syncToDB(items)
  }, [items, status, isDBSynced])

  return <>{children}</>
}

// ── Background DB sync ──────────────────────────────────────────────────────────

function syncToDB(items: CartItem[]): void {
  const payloadItems = items.map((item) => ({
    productId: item.productId,
    toppingId: item.toppingId ?? null,
    name: item.name,
    quantity: item.quantity,
    notes: item.notes,
    baseType: item.baseType ?? null,
  }))

  fetch('/api/cart', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ items: payloadItems }),
    credentials: 'include',
  }).catch((err) => console.error('Failed to sync cart to DB', err))
}
