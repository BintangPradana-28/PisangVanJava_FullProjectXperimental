'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import PosMenuGrid from '@/src/features/pos/components/PosMenuGrid'
import PosCart, { CartItem } from '@/src/features/pos/components/PosCart'
import OfflineSyncManager from '@/src/features/pos/components/OfflineSyncManager'
import { ProductType } from '@/src/features/menu/components/MenuCards'
import { Topping } from '@/src/features/pos/components/PosModifierModal'
import toast from 'react-hot-toast'

interface PosClientProps {
  products: ProductType[]
  toppings: Topping[]
}

export default function PosClient({ products, toppings }: PosClientProps) {
  const router = useRouter()
  const [cartItems, setCartItems] = useState<CartItem[]>([])
  const [isCartOpenOnMobile, setIsCartOpenOnMobile] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)

  // 1. Mekanisme Segar Ulang Data (Data Refresh Rule)
  const handleRefreshMenu = async () => {
    setIsRefreshing(true)
    const toastId = toast.loading('Menyinkronkan data menu terbaru...')
    try {
      router.refresh()
      // Give it a small delay for better UX
      await new Promise(res => setTimeout(res, 800))
      toast.success('Menu berhasil diperbarui!', { id: toastId })
    } catch (err) {
      toast.error('Gagal memperbarui menu', { id: toastId })
    } finally {
      setIsRefreshing(false)
    }
  }

  // Cart Functions
  const handleAddToCart = useCallback((orderItem: any) => {
    setCartItems(prev => {
      // Check if exact same item exists (same product, base, and topping)
      const existingItemIndex = prev.findIndex(
        i => i.product.id === orderItem.product.id && 
             i.baseType === orderItem.baseType && 
             i.topping?.id === orderItem.topping?.id
      )

      if (existingItemIndex > -1) {
        const newItems = [...prev]
        const existing = newItems[existingItemIndex]
        const newQuantity = existing.quantity + orderItem.quantity
        const unitPrice = existing.subtotal / existing.quantity
        newItems[existingItemIndex] = {
          ...existing,
          quantity: newQuantity,
          subtotal: newQuantity * unitPrice
        }
        return newItems
      }

      // Add new
      return [...prev, { ...orderItem, id: crypto.randomUUID() }]
    })
  }, [])

  const handleUpdateQuantity = useCallback((id: string, newQuantity: number) => {
    if (newQuantity < 1) return
    setCartItems(prev => prev.map(item => {
      if (item.id === id) {
        const unitPrice = item.subtotal / item.quantity
        return { ...item, quantity: newQuantity, subtotal: newQuantity * unitPrice }
      }
      return item
    }))
  }, [])

  const handleRemoveItem = useCallback((id: string) => {
    setCartItems(prev => prev.filter(item => item.id !== id))
  }, [])

  const handleClearCart = useCallback(() => {
    setCartItems([])
    setIsCartOpenOnMobile(false) // Close mobile drawer after success
  }, [])

  const totalCartItems = cartItems.reduce((acc, item) => acc + item.quantity, 0)

  return (
    <div className="flex h-full w-full relative">
      {/* Background Manager */}
      <OfflineSyncManager />

      {/* LEFT PANE: Menu Grid (70% on lg) */}
      <div className="flex-1 h-full flex flex-col bg-gray-100 overflow-hidden">
        {/* Top Navbar */}
        <div className="bg-white p-4 shadow-sm z-10 flex justify-between items-center shrink-0">
          <div>
            <h1 className="text-2xl font-black text-gray-800 tracking-tight">PISANG VAN JAVA</h1>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Point of Sale</p>
          </div>
          
          <div className="flex items-center gap-3">
            <button 
              onClick={handleRefreshMenu}
              disabled={isRefreshing}
              className="flex items-center gap-2 bg-gray-50 hover:bg-orange-50 text-gray-600 hover:text-orange-600 px-4 py-2 rounded-xl font-bold text-sm transition-colors border border-gray-200"
            >
              <span className={isRefreshing ? 'animate-spin' : ''}>🔄</span>
              <span className="hidden sm:inline">Sync Menu</span>
            </button>
            
            {/* Mobile Cart Toggle Button */}
            <button 
              onClick={() => setIsCartOpenOnMobile(true)}
              className="lg:hidden relative bg-[#D4802A] text-white p-3 rounded-xl shadow-md active:scale-95"
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
          <PosMenuGrid 
            products={products} 
            toppings={toppings} 
            onAddToCart={handleAddToCart} 
          />
        </div>
      </div>

      {/* RIGHT PANE: Cart (30% on lg) + MOBILE FALLBACK DRAWER */}
      {/* Responsivitas Ekstrem (Mobile Fallback Rule): Hidden on small screens unless toggled, fixed 380px on large screens */}
      <div 
        className={`fixed inset-0 z-50 lg:static lg:w-[380px] xl:w-[420px] shrink-0 transition-transform duration-300 ${
          isCartOpenOnMobile ? 'translate-x-0' : 'translate-x-full lg:translate-x-0'
        }`}
      >
        {/* Mobile Backdrop */}
        <div 
          className="absolute inset-0 bg-black/60 lg:hidden backdrop-blur-sm" 
          onClick={() => setIsCartOpenOnMobile(false)}
        />
        
        {/* Cart Container */}
        <div className="absolute right-0 top-0 bottom-0 w-[90%] sm:w-[400px] lg:w-full lg:static h-full bg-white shadow-2xl lg:shadow-none flex flex-col">
          {/* Mobile Close Button inside Cart */}
          <div className="lg:hidden bg-gray-50 p-4 border-b border-gray-100 flex justify-end">
            <button 
              onClick={() => setIsCartOpenOnMobile(false)}
              className="text-gray-500 font-bold bg-gray-200 hover:bg-gray-300 px-4 py-2 rounded-xl"
            >
              Tutup Keranjang ➔
            </button>
          </div>

          <PosCart 
            items={cartItems}
            onUpdateQuantity={handleUpdateQuantity}
            onRemoveItem={handleRemoveItem}
            onClearCart={handleClearCart}
          />
        </div>
      </div>
    </div>
  )
}
