import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { immer } from 'zustand/middleware/immer'

// ── Types ────────────────────────────────────────────────────────────────────
export interface CartTopping {
  toppingId: string
  name: string
  priceAdd: number // dalam rupiah, integer
}

export interface CartItem {
  cartItemId: string // uuidv4 — unique per item dalam cart
  menuVariantId: string // FK ke MenuVariant (Kembung/Lumpia/Krispy)
  variantName: string // display: "Blueberry (Kembung)"
  basePrice: number // harga base variant, integer rupiah
  toppings: CartTopping[]
  quantity: number
  notes: string
  imageUrl?: string
  addedAt: string // ISO string
}

export interface ConflictState {
  local: CartItem[]
  db: CartItem[]
}

interface CartStore {
  items: CartItem[]
  _hasHydrated: boolean
  conflictState: ConflictState | null
  isLoggingOut: boolean

  // Mutations
  addItem: (item: Omit<CartItem, 'cartItemId' | 'addedAt'>) => void
  setItems: (items: CartItem[]) => void
  removeItem: (cartItemId: string) => void
  updateQuantity: (cartItemId: string, qty: number) => void
  clearCart: () => void
  setHasHydrated: (v: boolean) => void
  setConflictState: (state: ConflictState | null) => void
  resolveConflict: (resolution: 'MERGED' | 'LOCAL' | 'DB', mergedItems?: CartItem[]) => void
  setIsLoggingOut: (v: boolean) => void
}

// ── Selectors ─────────────────────────────────────────────────────────────────
export const selectCartItems = (s: CartStore) => s.items
export const selectCartItemCount = (s: CartStore) => s.items.reduce((acc, i) => acc + i.quantity, 0)
export const selectCartDisplayTotal = (s: CartStore) =>
  s.items.reduce((acc, item) => {
    const toppingTotal = item.toppings ? item.toppings.reduce((sum, t) => sum + t.priceAdd, 0) : 0
    return acc + (item.basePrice + toppingTotal) * item.quantity
  }, 0)
export const selectItemSubtotal = (cartItemId: string) => (s: CartStore) => {
  const item = s.items.find((i) => i.cartItemId === cartItemId)
  if (!item) return 0
  const toppingTotal = item.toppings ? item.toppings.reduce((sum, t) => sum + t.priceAdd, 0) : 0
  return (item.basePrice + toppingTotal) * item.quantity
}

// ── Store ─────────────────────────────────────────────────────────────────────
export const useCartStore = create<CartStore>()(
  persist(
    immer((set) => ({
      items: [],
      _hasHydrated: false,
      conflictState: null,
      isLoggingOut: false,

      addItem: (newItem) =>
        set((state) => {
          // Cek apakah variant + topping sama persis → increment qty
          const existing = state.items.find(
            (i) =>
              i.menuVariantId === newItem.menuVariantId &&
              i.notes === newItem.notes &&
              i.toppings?.length === newItem.toppings?.length &&
              i.toppings?.every((t, idx) => t.toppingId === newItem.toppings?.[idx]?.toppingId)
          )
          if (existing) {
            existing.quantity += newItem.quantity
          } else {
            state.items.push({
              ...newItem,
              cartItemId: crypto.randomUUID(),
              addedAt: new Date().toISOString()
            })
          }
        }),

      setItems: (items) => set({ items }),

      removeItem: (cartItemId) =>
        set((state) => {
          state.items = state.items.filter((i) => i.cartItemId !== cartItemId)
        }),

      updateQuantity: (cartItemId, qty) =>
        set((state) => {
          const item = state.items.find((i) => i.cartItemId === cartItemId)
          if (item) {
            if (qty <= 0) {
              state.items = state.items.filter((i) => i.cartItemId !== cartItemId)
            } else {
              item.quantity = qty
            }
          }
        }),

      clearCart: () =>
        set((state) => {
          state.items = []
        }),

      setHasHydrated: (v) =>
        set((state) => {
          state._hasHydrated = v
        }),

      setConflictState: (state) =>
        set((s) => {
          s.conflictState = state
        }),

      resolveConflict: (resolution, mergedItems) =>
        set((state) => {
          if (!state.conflictState) return

          if (resolution === 'MERGED' && mergedItems) {
            state.items = mergedItems
          } else if (resolution === 'LOCAL') {
            state.items = state.conflictState.local
          } else if (resolution === 'DB') {
            state.items = state.conflictState.db
          }

          state.conflictState = null
        }),

      setIsLoggingOut: (v) =>
        set((state) => {
          state.isLoggingOut = v
        })
    })),
    {
      name: 'pvj-cart-v2',
      storage: createJSONStorage(() => localStorage),
      // ✅ skipHydration — zero SSR mismatch
      skipHydration: true,
      partialize: (state) => ({ items: state.items }), // Jangan simpan conflictState ke storage
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true)
      }
    }
  )
)
