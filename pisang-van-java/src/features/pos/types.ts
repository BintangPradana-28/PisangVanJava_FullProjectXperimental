// src/features/pos/types.ts
//
// ARCHITECTURE FIX: CartItem used to live inside PosCart.tsx, and
// PosReceiptModal.tsx imported it from there (`import type { CartItem } from
// './PosCart'`) purely for the type shape — but PosCart.tsx also imports and
// renders PosReceiptModal as a component. That's a genuine circular import
// (PosCart → PosReceiptModal → PosCart), caught by dependency-cruiser's
// no-circular rule (see .dependency-cruiser.cjs). Moving the type to its own
// file with no component-level imports breaks the cycle: both files now
// import CartItem from here instead of from each other.

import type { ProductType } from '@/src/features/menu/components/MenuCards'
import type { Topping } from './components/PosModifierModal'

export interface CartItem {
  id: string // temporary client-side id
  product: ProductType
  baseType: string
  toppings: Topping[]
  topping: Topping | null
  quantity: number
  subtotal: number
}
