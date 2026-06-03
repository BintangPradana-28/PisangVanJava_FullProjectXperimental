'use client'

import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

// ── Types ───────────────────────────────────────────────────────────────────────

export interface CartItem {
  productId: string
  name: string
  basePrice: number
  toppingName: string | null
  toppingPrice: number
  quantity: number
  notes: string
  totalPrice: number
  toppingId?: string | null
  baseType?: string
}

interface CartState {
  items: CartItem[]
  isDBSynced: boolean
  addItem: (item: Omit<CartItem, 'totalPrice'>) => void
  removeItem: (productId: string, toppingName: string | null, notes: string) => void
  updateQuantity: (productId: string, toppingName: string | null, notes: string, quantity: number) => void
  clearCart: () => void
  setItems: (items: CartItem[]) => void
  mergeItems: (dbItems: CartItem[], localItems: CartItem[]) => CartItem[]
  setDBSynced: (synced: boolean) => void
}

// ── Helpers ─────────────────────────────────────────────────────────────────────

function computeTotal(basePrice: number, toppingPrice: number, quantity: number): number {
  return (basePrice + toppingPrice) * quantity
}

function isSameItem(a: CartItem, b: { productId: string; toppingName: string | null; notes: string }): boolean {
  return a.productId === b.productId && a.toppingName === b.toppingName && a.notes === b.notes
}

function mergeCarts(dbCart: CartItem[], localCart: CartItem[]): CartItem[] {
  const merged = [...dbCart]
  for (const localItem of localCart) {
    const existingIndex = merged.findIndex((item) => isSameItem(item, localItem))
    if (existingIndex > -1) {
      const existing = merged[existingIndex]
      const newQty = existing.quantity + localItem.quantity
      merged[existingIndex] = {
        ...existing,
        quantity: newQty,
        totalPrice: computeTotal(existing.basePrice, existing.toppingPrice, newQty),
      }
    } else {
      merged.push(localItem)
    }
  }
  return merged
}

// ── Store ───────────────────────────────────────────────────────────────────────

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      isDBSynced: false,

      addItem: (newItem) => {
        set((state) => {
          const existingIndex = state.items.findIndex((item) => isSameItem(item, newItem))
          const totalItemPrice = computeTotal(newItem.basePrice, newItem.toppingPrice, newItem.quantity)

          if (existingIndex > -1) {
            const updated = [...state.items]
            const existing = updated[existingIndex]
            const newQty = existing.quantity + newItem.quantity
            updated[existingIndex] = {
              ...existing,
              quantity: newQty,
              totalPrice: computeTotal(existing.basePrice, existing.toppingPrice, newQty),
            }
            return { items: updated }
          }
          return { items: [...state.items, { ...newItem, totalPrice: totalItemPrice }] }
        })
      },

      removeItem: (productId, toppingName, notes) => {
        set((state) => ({
          items: state.items.filter((item) => !isSameItem(item, { productId, toppingName, notes })),
        }))
      },

      updateQuantity: (productId, toppingName, notes, quantity) => {
        if (quantity <= 0) {
          get().removeItem(productId, toppingName, notes)
          return
        }
        set((state) => ({
          items: state.items.map((item) => {
            if (isSameItem(item, { productId, toppingName, notes })) {
              return {
                ...item,
                quantity,
                totalPrice: computeTotal(item.basePrice, item.toppingPrice, quantity),
              }
            }
            return item
          }),
        }))
      },

      clearCart: () => set({ items: [] }),

      setItems: (items) => set({ items }),

      mergeItems: (_dbItems, _localItems) => mergeCarts(_dbItems, _localItems),

      setDBSynced: (synced) => set({ isDBSynced: synced }),
    }),
    {
      name: 'pvj-cart',
      storage: createJSONStorage(() => {
        if (typeof window === 'undefined') {
          return {
            getItem: () => null,
            setItem: () => {},
            removeItem: () => {},
          }
        }
        return localStorage
      }),
      partialize: (state) => ({ items: state.items }),
    },
  ),
)

// ── Derived selectors (prevent re-renders) ──────────────────────────────────────

export const useCartItems = (): CartItem[] => useCartStore((s) => s.items)
export const useCartCount = (): number => useCartStore((s) => s.items.reduce((sum, item) => sum + item.quantity, 0))
export const useCartTotal = (): number => useCartStore((s) => s.items.reduce((sum, item) => sum + item.totalPrice, 0))
