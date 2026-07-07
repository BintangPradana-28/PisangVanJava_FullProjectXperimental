import { act } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('./idbStorage', () => ({
  idbStorage: {
    getItem: vi.fn().mockResolvedValue(null),
    setItem: vi.fn().mockResolvedValue(undefined),
    removeItem: vi.fn().mockResolvedValue(undefined)
  }
}))

import {
  type CartItem,
  selectCartDisplayTotal,
  selectCartItemCount,
  useCartStore
} from './cart.store'

const baseItem: Omit<CartItem, 'cartItemId' | 'addedAt'> = {
  menuVariantId: 'variant-kembung-blueberry',
  variantName: 'Blueberry (Kembung)',
  basePrice: 15000,
  toppings: [],
  quantity: 1,
  notes: ''
}

describe('useCartStore', () => {
  beforeEach(() => {
    act(() => {
      useCartStore.setState({
        items: [],
        conflictState: null,
        isLoggingOut: false
      })
    })
  })

  describe('addItem', () => {
    it('adds a new item with a generated cartItemId and addedAt timestamp', () => {
      act(() => useCartStore.getState().addItem(baseItem))
      const items = useCartStore.getState().items
      expect(items).toHaveLength(1)
      expect(items[0].cartItemId).toBeTruthy()
      expect(items[0].addedAt).toBeTruthy()
      expect(items[0].menuVariantId).toBe('variant-kembung-blueberry')
    })

    it('merges identical variant + notes + toppings into one line by incrementing quantity', () => {
      act(() => {
        useCartStore.getState().addItem({ ...baseItem, quantity: 1 })
        useCartStore.getState().addItem({ ...baseItem, quantity: 2 })
      })
      const items = useCartStore.getState().items
      expect(items).toHaveLength(1)
      expect(items[0].quantity).toBe(3)
    })

    it('keeps items with different notes as separate lines', () => {
      act(() => {
        useCartStore.getState().addItem({ ...baseItem, notes: 'Extra pedas' })
        useCartStore.getState().addItem({ ...baseItem, notes: 'Tanpa gula' })
      })
      expect(useCartStore.getState().items).toHaveLength(2)
    })

    it('caps quantity at the item stock limit instead of exceeding it', () => {
      act(() => {
        useCartStore.getState().addItem({ ...baseItem, quantity: 3, stock: 5 })
        useCartStore.getState().addItem({ ...baseItem, quantity: 4, stock: 5 })
      })
      expect(useCartStore.getState().items[0].quantity).toBe(5)
    })

    it('merges identical toppings added in a different order', () => {
      act(() => {
        useCartStore.getState().addItem({
          ...baseItem,
          toppings: [
            { toppingId: 'keju', name: 'Keju', priceAdd: 3000 },
            { toppingId: 'coklat', name: 'Coklat', priceAdd: 2000 }
          ]
        })
        useCartStore.getState().addItem({
          ...baseItem,
          toppings: [
            { toppingId: 'coklat', name: 'Coklat', priceAdd: 2000 },
            { toppingId: 'keju', name: 'Keju', priceAdd: 3000 }
          ]
        })
      })
      expect(useCartStore.getState().items).toHaveLength(1)
      expect(useCartStore.getState().items[0]?.quantity).toBe(2)
    })
  })

  describe('updateQuantity', () => {
    it('removes the item entirely when quantity is set to 0 or below', () => {
      act(() => {
        useCartStore.getState().addItem(baseItem)
        const id = useCartStore.getState().items[0].cartItemId
        useCartStore.getState().updateQuantity(id, 0)
      })
      expect(useCartStore.getState().items).toHaveLength(0)
    })

    it('caps quantity at stock limit rather than allowing overselling', () => {
      act(() => {
        useCartStore.getState().addItem({ ...baseItem, stock: 3 })
        const id = useCartStore.getState().items[0].cartItemId
        useCartStore.getState().updateQuantity(id, 99)
      })
      expect(useCartStore.getState().items[0].quantity).toBe(3)
    })
  })

  describe('removeItem', () => {
    it('removes only the targeted item, leaving others untouched', () => {
      act(() => {
        useCartStore.getState().addItem({ ...baseItem, notes: 'A' })
        useCartStore.getState().addItem({ ...baseItem, notes: 'B' })
        const idToRemove = useCartStore.getState().items[0].cartItemId
        useCartStore.getState().removeItem(idToRemove)
      })
      expect(useCartStore.getState().items).toHaveLength(1)
      expect(useCartStore.getState().items[0].notes).toBe('B')
    })
  })

  describe('resolveConflict', () => {
    const localItems: CartItem[] = [
      { ...baseItem, cartItemId: 'local-1', addedAt: '2026-01-01T00:00:00Z', notes: 'local' }
    ]
    const dbItems: CartItem[] = [
      { ...baseItem, cartItemId: 'db-1', addedAt: '2026-01-01T00:00:00Z', notes: 'db' }
    ]

    beforeEach(() => {
      act(() => {
        useCartStore.getState().setConflictState({ local: localItems, db: dbItems })
      })
    })

    it('LOCAL resolution keeps only the local items and clears conflictState', () => {
      act(() => useCartStore.getState().resolveConflict('LOCAL'))
      expect(useCartStore.getState().items).toEqual(localItems)
      expect(useCartStore.getState().conflictState).toBeNull()
    })

    it('DB resolution keeps only the db items and clears conflictState', () => {
      act(() => useCartStore.getState().resolveConflict('DB'))
      expect(useCartStore.getState().items).toEqual(dbItems)
      expect(useCartStore.getState().conflictState).toBeNull()
    })

    it('MERGED resolution uses the explicitly provided merged array', () => {
      const merged = [...localItems, ...dbItems]
      act(() => useCartStore.getState().resolveConflict('MERGED', merged))
      expect(useCartStore.getState().items).toEqual(merged)
      expect(useCartStore.getState().conflictState).toBeNull()
    })

    it('is a no-op if conflictState is already null', () => {
      act(() => useCartStore.getState().setConflictState(null))
      const itemsBefore = useCartStore.getState().items
      act(() => useCartStore.getState().resolveConflict('LOCAL'))
      expect(useCartStore.getState().items).toEqual(itemsBefore)
    })
  })

  describe('selectors', () => {
    it('selectCartItemCount sums quantities across all lines, not line count', () => {
      act(() => {
        useCartStore.getState().addItem({ ...baseItem, notes: 'A', quantity: 2 })
        useCartStore.getState().addItem({ ...baseItem, notes: 'B', quantity: 3 })
      })
      expect(selectCartItemCount(useCartStore.getState())).toBe(5)
    })

    it('selectCartDisplayTotal includes topping prices multiplied by quantity', () => {
      act(() => {
        useCartStore.getState().addItem({
          ...baseItem,
          basePrice: 15000,
          quantity: 2,
          toppings: [{ toppingId: 'keju', name: 'Keju', priceAdd: 3000 }]
        })
      })
      expect(selectCartDisplayTotal(useCartStore.getState())).toBe(36000)
    })
  })
})
