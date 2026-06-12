// src/features/pos/store/usePosStore.ts
// RAG Source: src/features/pos/components/PosCart.tsx (CartItem interface)
// RAG Source: GEMINI.md (Zustand rules: one store per domain, persist, selectors)
// RAG Source: Implementation Plan — Zero-Latency State Management

'use client'

import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import type { ProductType } from '@/src/features/menu/components/MenuCards'
import type { Topping } from '@/src/features/pos/components/PosModifierModal'

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

export interface PosCartItem {
  id: string // Client-side UUID per cart line
  product: ProductType
  baseType: 'Kembung' | 'Lumpia' | 'Krispy'
  topping: Topping | null
  quantity: number
  subtotal: number
}

export interface ReceiptData {
  orderId?: string
  date: Date
  items: PosCartItem[]
  totalPrice: number
  paymentMethod: 'CASH' | 'QRIS'
  cashierName: string
}

interface PosState {
  // ─── Cart State ───────────────────────────────────────────
  items: PosCartItem[]
  discountAmount: number

  // ─── Network State ────────────────────────────────────────
  isOnline: boolean
  queueCount: number

  // ─── UI State ─────────────────────────────────────────────
  isCartOpenOnMobile: boolean
  receiptData: ReceiptData | null

  // ─── Cart Actions ─────────────────────────────────────────
  addItem: (orderItem: {
    product: ProductType
    baseType: 'Kembung' | 'Lumpia' | 'Krispy'
    topping: Topping | null
    quantity: number
    subtotal: number
  }) => void
  removeItem: (id: string) => void
  updateQuantity: (id: string, newQuantity: number) => void
  clearCart: () => void

  // ─── Discount Actions ─────────────────────────────────────
  applyDiscount: (amount: number) => void
  clearDiscount: () => void

  // ─── Network Actions ──────────────────────────────────────
  setOnline: (online: boolean) => void
  setQueueCount: (count: number) => void

  // ─── UI Actions ───────────────────────────────────────────
  setCartOpenOnMobile: (open: boolean) => void
  setReceiptData: (data: ReceiptData | null) => void

  // ─── Derived (Computed via selectors, not stored) ─────────
  getTotalPrice: () => number
  getFinalPrice: () => number
  getTotalItemCount: () => number
}

// ─────────────────────────────────────────────────────────────
// Store
// ─────────────────────────────────────────────────────────────

export const usePosStore = create<PosState>()(
  persist(
    (set, get) => ({
      // ─── Initial State ──────────────────────────────────────
      items: [],
      discountAmount: 0,
      isOnline: true,
      queueCount: 0,
      isCartOpenOnMobile: false,
      receiptData: null,

      // ─── Cart Actions ───────────────────────────────────────
      addItem: (orderItem) =>
        set((state) => {
          // Merge identical items (same product + baseType + topping)
          const existingIndex = state.items.findIndex(
            (i) =>
              i.product.id === orderItem.product.id &&
              i.baseType === orderItem.baseType &&
              i.topping?.id === orderItem.topping?.id
          )

          if (existingIndex > -1) {
            const updated = [...state.items]
            const existing = updated[existingIndex]
            const unitPrice = existing.subtotal / existing.quantity
            const newQuantity = existing.quantity + orderItem.quantity
            updated[existingIndex] = {
              ...existing,
              quantity: newQuantity,
              subtotal: newQuantity * unitPrice
            }
            return { items: updated }
          }

          return {
            items: [...state.items, { ...orderItem, id: crypto.randomUUID() }]
          }
        }),

      removeItem: (id) =>
        set((state) => ({
          items: state.items.filter((item) => item.id !== id)
        })),

      updateQuantity: (id, newQuantity) => {
        if (newQuantity < 1) return
        set((state) => ({
          items: state.items.map((item) => {
            if (item.id === id) {
              const unitPrice = item.subtotal / item.quantity
              return {
                ...item,
                quantity: newQuantity,
                subtotal: newQuantity * unitPrice
              }
            }
            return item
          })
        }))
      },

      clearCart: () => set({ items: [], discountAmount: 0, isCartOpenOnMobile: false }),

      // ─── Discount Actions ─────────────────────────────────
      applyDiscount: (amount) => {
        const totalPrice = get().getTotalPrice()
        // Discount cannot exceed total price
        const safeAmount = Math.min(Math.max(0, amount), totalPrice)
        set({ discountAmount: safeAmount })
      },

      clearDiscount: () => set({ discountAmount: 0 }),

      // ─── Network Actions ──────────────────────────────────
      setOnline: (online) => set({ isOnline: online }),
      setQueueCount: (count) => set({ queueCount: count }),

      // ─── UI Actions ───────────────────────────────────────
      setCartOpenOnMobile: (open) => set({ isCartOpenOnMobile: open }),
      setReceiptData: (data) => set({ receiptData: data }),

      // ─── Derived Getters ──────────────────────────────────
      getTotalPrice: () => {
        const { items } = get()
        return items.reduce((sum, item) => sum + item.subtotal, 0)
      },

      getFinalPrice: () => {
        const { items, discountAmount } = get()
        const subtotal = items.reduce((sum, item) => sum + item.subtotal, 0)
        return Math.max(0, subtotal - discountAmount)
      },

      getTotalItemCount: () => {
        const { items } = get()
        return items.reduce((acc, item) => acc + item.quantity, 0)
      }
    }),
    {
      name: 'pisang-pos-cart', // localStorage key
      storage: createJSONStorage(() => localStorage),
      // Only persist cart items and discount — NOT network/UI state
      partialize: (state) => ({
        items: state.items,
        discountAmount: state.discountAmount
      })
    }
  )
)
