'use client'

import React from 'react'
import { type CartItem, useCartStore } from '@/src/features/cart/stores/cart.store'

const formatRupiah = (value: number) => {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(value)
}

export function MergeConflictModal() {
  const conflictState = useCartStore((s) => s.conflictState)
  const resolveConflict = useCartStore((s) => s.resolveConflict)

  if (!conflictState) return null

  const { local, db } = conflictState

  const calcTotal = (items: CartItem[]) => {
    return items.reduce(
      (acc, item) =>
        acc +
        (item.basePrice + (item.toppings?.reduce((sum, t) => sum + t.priceAdd, 0) || 0)) *
          item.quantity,
      0
    )
  }

  const localTotal = calcTotal(local)
  const dbTotal = calcTotal(db)

  // Hitung merged preview
  const merged = [...db]
  local.forEach((localItem) => {
    const existingIndex = merged.findIndex(
      (i) =>
        i.menuVariantId === localItem.menuVariantId &&
        i.notes === localItem.notes &&
        i.toppings?.length === localItem.toppings?.length &&
        i.toppings?.every((t, idx) => t.toppingId === localItem.toppings?.[idx]?.toppingId)
    )
    if (existingIndex !== -1) {
      merged[existingIndex].quantity += localItem.quantity
    } else {
      merged.push(localItem)
    }
  })
  const mergedTotal = calcTotal(merged)

  const ItemListPreview = ({
    items,
    title,
    total
  }: {
    items: CartItem[]
    title: string
    total: number
  }) => (
    <div className="bg-neutral-50 rounded-[4px] p-4 border border-neutral-200">
      <h3 className="font-semibold text-neutral-800 mb-3">{title}</h3>
      <div className="space-y-2 max-h-32 overflow-y-auto pr-2">
        {items.length === 0 ? (
          <p className="text-sm text-neutral-500 italic">Keranjang kosong</p>
        ) : (
          items.map((item, idx) => (
            <div key={idx} className="flex justify-between items-start text-sm">
              <div className="flex-1">
                <span className="text-neutral-700">
                  {item.variantName} x{item.quantity}
                </span>
                {item.toppings && item.toppings.length > 0 && (
                  <div className="text-xs text-neutral-500">
                    + {item.toppings.map((t: any) => t.name).join(', ')}
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>
      <div className="mt-3 pt-3 border-t border-neutral-200 flex justify-between items-center font-medium">
        <span className="text-sm">Total:</span>
        <span className="text-amber-600">{formatRupiah(total)}</span>
      </div>
    </div>
  )

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-[4px] shadow-sm w-full max-w-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="bg-amber-50 px-6 py-5 border-b border-amber-100">
          <h2 className="text-xl font-bold text-amber-900">Gabungkan Keranjang?</h2>
          <p className="text-sm text-amber-700 mt-1">
            Kami menemukan keranjang lama Anda yang tersimpan di server. Pilih keranjang mana yang
            ingin Anda gunakan.
          </p>
        </div>

        {/* Content */}
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <ItemListPreview items={local} title="Keranjang Saat Ini (Lokal)" total={localTotal} />
            <ItemListPreview items={db} title="Keranjang Tersimpan (Server)" total={dbTotal} />
          </div>

          {/* Actions */}
          <div className="space-y-3">
            <button
              onClick={() => resolveConflict('MERGED', merged)}
              className="w-full py-3 px-4 bg-amber-500 hover:bg-amber-600 text-white font-semibold rounded-[4px] transition-colors shadow-sm flex items-center justify-between"
            >
              <span>Gabungkan Keduanya (Rekomendasi)</span>
              <span>Total: {formatRupiah(mergedTotal)}</span>
            </button>

            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => resolveConflict('LOCAL')}
                className="py-2.5 px-4 bg-white border border-neutral-300 hover:bg-neutral-50 text-neutral-700 font-medium rounded-[4px] transition-colors"
              >
                Gunakan Saat Ini
              </button>
              <button
                onClick={() => resolveConflict('DB')}
                className="py-2.5 px-4 bg-white border border-neutral-300 hover:bg-neutral-50 text-neutral-700 font-medium rounded-[4px] transition-colors"
              >
                Gunakan Tersimpan
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
