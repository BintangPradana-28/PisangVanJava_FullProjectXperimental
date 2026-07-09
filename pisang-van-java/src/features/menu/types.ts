// src/features/menu/types.ts
//
// ARCHITECTURE FIX: ProductType used to live inside MenuCards.tsx, and
// QuickViewModal.tsx imported it from there purely for the type shape — but
// MenuCards.tsx also dynamically imports and renders QuickViewModal as a
// component. That's a genuine circular import (MenuCards → QuickViewModal →
// MenuCards), caught by dependency-cruiser's no-circular rule (see
// .dependency-cruiser.cjs). Moving the type to its own file breaks the cycle.
//
// MenuCards.tsx re-exports ProductType from here (`export type { ProductType }
// from './types'`) so its other 8 existing consumers across the project keep
// working unchanged — only QuickViewModal.tsx (the file causing the cycle)
// needed to switch its import source, since importing via MenuCards.tsx's
// re-export would still create the same circular edge.

export interface ProductType {
  id: string
  flavorName: string
  priceKembung: number
  priceLumpia: number
  priceKrispy: number
  wholesaleKembung: number
  wholesaleLumpia: number
  wholesaleKrispy: number
  imageUrl: string | null
  isAvailable: boolean
  tags: string[]
  deskripsi_topping?: string | null
  rating?: number
  reviewCount?: number
  stock: number
  soldCount?: number
  isActive: boolean
}
