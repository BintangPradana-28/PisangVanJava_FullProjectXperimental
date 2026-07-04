import { create } from 'zustand'

export interface CartItem {
  id: string
  name: string
  price: number
  quantity: number
  toppings: string[]
}

interface PosState {
  cart: CartItem[]
  addToCart: (item: CartItem) => void
  removeFromCart: (id: string) => void
  updateQuantity: (id: string, delta: number) => void
  clearCart: () => void
  getTotal: () => number
}

export const usePosStore = create<PosState>((set, get) => ({
  cart: [],
  addToCart: (item) =>
    set((state) => {
      const existing = state.cart.find((c) => c.id === item.id)
      if (existing) {
        return {
          cart: state.cart.map((c) =>
            c.id === item.id ? { ...c, quantity: c.quantity + item.quantity } : c
          )
        }
      }
      return { cart: [...state.cart, item] }
    }),
  removeFromCart: (id) =>
    set((state) => ({
      cart: state.cart.filter((c) => c.id !== id)
    })),
  updateQuantity: (id, delta) =>
    set((state) => ({
      cart: state.cart.map((c) => {
        if (c.id === id) {
          const newQuantity = Math.max(1, c.quantity + delta)
          return { ...c, quantity: newQuantity }
        }
        return c
      })
    })),
  clearCart: () => set({ cart: [] }),
  getTotal: () => {
    const { cart } = get()
    return cart.reduce((sum, item) => sum + item.price * item.quantity, 0)
  }
}))
