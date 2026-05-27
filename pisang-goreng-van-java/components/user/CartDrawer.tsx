'use client'

import React, { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useRouter } from 'next/navigation'
import { CreditCard, MessageCircle, TicketPercent } from 'lucide-react'
import { z } from 'zod'
import { useCart, type CartItem } from '@/context/CartContext'
import { useLanguage } from '@/context/LanguageContext'
import { useSettings } from '@/context/SettingsContext'
import { validateVoucher } from '@/src/features/checkout/actions'
import toast from 'react-hot-toast'

interface CartDrawerProps {
  isOpen: boolean
  onClose: () => void
}

type BaseType = 'kembung' | 'lumpia' | 'krispy'
type PaymentMethod = 'WHATSAPP' | 'ONLINE'

interface AppliedVoucher {
  code: string
  discountAmount: number
}

interface CheckoutPayloadItem {
  variantId: string
  toppingId: string | null
  baseType: BaseType
  quantity: number
  notes: string | null
}

const createOrderResponseSchema = z.discriminatedUnion('success', [
  z.object({
    success: z.literal(true),
    data: z.object({
      orderId: z.string().min(8).max(64),
      redirectType: z.enum(['WHATSAPP', 'PAYMENT']),
      redirectUrl: z.string().min(1).max(3000),
      totalPrice: z.number().finite().int().min(0),
    }).strict(),
  }).strict(),
  z.object({
    success: z.literal(false),
    error: z.string().min(1).max(120),
  }).strict(),
])

function resolveBaseType(item: CartItem): BaseType | null {
  const explicitBaseType = item.baseType ?? null
  if (explicitBaseType !== null) {
    return normalizeBaseType(explicitBaseType)
  }

  const match = item.name.match(/\((Kembung|Lumpia|Krispy|kembung|lumpia|krispy)\)$/)
  if (match === null) {
    return null
  }

  return normalizeBaseType(match[1])
}

function normalizeBaseType(value: string): BaseType | null {
  const normalized = value.trim().toLowerCase()
  if (normalized === 'kembung' || normalized === 'lumpia' || normalized === 'krispy') {
    return normalized
  }

  return null
}

export default function CartDrawer({ isOpen, onClose }: CartDrawerProps) {
  const router = useRouter()
  const { cartItems, updateQuantity, removeFromCart, cartTotal, clearCart } = useCart()
  const { t } = useLanguage()
  const { getSetting } = useSettings()
  const [address, setAddress] = useState('')
  const [customerName, setCustomerName] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [deliveryMethod, setDeliveryMethod] = useState<'DELIVERY' | 'PICKUP'>('DELIVERY')
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('WHATSAPP')
  const [voucherCode, setVoucherCode] = useState('')
  const [appliedVoucher, setAppliedVoucher] = useState<AppliedVoucher | null>(null)
  const [isValidatingVoucher, setIsValidatingVoucher] = useState(false)
  const [consent, setConsent] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const deliveryFeeSetting = getSetting('store_delivery_fee', '0')
  const deliveryFee = /^[0-9]{1,9}$/.test(deliveryFeeSetting) ? Number(deliveryFeeSetting) : 0
  const discountAmount = appliedVoucher?.discountAmount ?? 0
  const discountedSubtotal = Math.max(cartTotal - discountAmount, 0)
  const finalTotal = deliveryMethod === 'DELIVERY' ? discountedSubtotal + deliveryFee : discountedSubtotal

  useEffect(() => {
    setAppliedVoucher(null)
  }, [cartTotal])

  const formatPrice = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(amount)
  }

  const handleApplyVoucher = async () => {
    const requestedCode = voucherCode.trim()
    if (requestedCode.length === 0) {
      toast.error('Masukkan kode promo terlebih dahulu.')
      return
    }

    if (cartTotal <= 0) {
      toast.error('Keranjang belum memiliki subtotal valid.')
      return
    }

    setIsValidatingVoucher(true)
    try {
      const result = await validateVoucher(requestedCode, cartTotal)
      if (!result.success) {
        setAppliedVoucher(null)
        toast.error(result.error)
        return
      }

      setAppliedVoucher({
        code: result.data.code,
        discountAmount: result.data.discountAmount,
      })
      setVoucherCode(result.data.code)
      toast.success(result.data.message)
    } catch {
      setAppliedVoucher(null)
      toast.error('Voucher belum bisa divalidasi.')
    } finally {
      setIsValidatingVoucher(false)
    }
  }

  const handleCheckout = async () => {
    if (cartItems.length === 0) return
    if (!customerName.trim() || !customerPhone.trim()) {
      toast.error('Mohon isi nama dan nomor WhatsApp Anda.')
      return
    }

    const phoneRegex = /^(\+62|62|0)8[1-9][0-9]{6,10}$/
    if (!phoneRegex.test(customerPhone.trim())) {
      toast.error('Format nomor WhatsApp tidak valid (Contoh: 08123456789)')
      return
    }

    if (deliveryMethod === 'DELIVERY' && address.trim().length === 0) {
      toast.error('Mohon isi alamat pengiriman lengkap.')
      return
    }

    if (!consent) {
      toast.error('Anda harus menyetujui Kebijakan Privasi terlebih dahulu.')
      return
    }

    const checkoutItems = cartItems.map((item): CheckoutPayloadItem | null => {
      const baseType = resolveBaseType(item)
      if (baseType === null) {
        return null
      }

      const notes = item.notes.trim()
      return {
        variantId: item.productId,
        toppingId: item.toppingId ?? null,
        baseType,
        quantity: item.quantity,
        notes: notes.length > 0 ? notes : null,
      }
    })

    const safeItems = checkoutItems.filter((item): item is CheckoutPayloadItem => item !== null)
    if (safeItems.length !== cartItems.length) {
      toast.error('Keranjang berisi item lama yang tidak valid. Tambahkan ulang item tersebut.')
      return
    }

    setIsSubmitting(true)
    
    try {
      const orderPayload = {
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim(),
        notes: address.trim().length > 0 ? address.trim() : null,
        deliveryMethod,
        paymentMethod,
        voucherCode: appliedVoucher?.code ?? null,
        items: safeItems,
      }

      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(orderPayload),
      })

      const responseJson: unknown = await res.json()
      const parsedResponse = createOrderResponseSchema.safeParse(responseJson)

      if (!parsedResponse.success) {
        toast.error('Respons checkout tidak valid.')
        return
      }

      if (!parsedResponse.data.success || !res.ok) {
        toast.error(parsedResponse.data.success ? 'Checkout ditolak.' : parsedResponse.data.error)
        return
      }

      const { redirectType, redirectUrl } = parsedResponse.data.data
      if (redirectType === 'WHATSAPP') {
        if (!redirectUrl.startsWith('https://wa.me/')) {
          toast.error('Redirect checkout ditolak.')
          return
        }
        window.open(redirectUrl, '_blank', 'noopener,noreferrer')
      } else {
        if (!redirectUrl.startsWith('/payment/')) {
          toast.error('Redirect pembayaran ditolak.')
          return
        }
        router.push(redirectUrl)
      }
      
      clearCart()
      toast.success(paymentMethod === 'ONLINE' ? 'Pesanan dibuat. Lanjutkan pembayaran.' : 'Pesanan berhasil dibuat! Silakan lanjutkan di WhatsApp.')
      onClose()
    } catch (error: unknown) {
      toast.error('Terjadi kesalahan saat memproses pesanan.')
      console.error('[CHECKOUT_ERROR]', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs"
          />

          {/* Drawer Container */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed top-0 right-0 z-50 h-full w-full max-w-md bg-white dark:bg-zinc-900 shadow-2xl border-l border-cream-200/40 dark:border-zinc-800 flex flex-col"
          >
            {/* Header */}
            <div className="p-6 border-b border-zinc-100 dark:border-zinc-800/80 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xl">🛒</span>
                <h3 className="font-serif text-xl font-bold text-brown dark:text-zinc-100">
                  {t('cart_title')}
                </h3>
              </div>
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-full bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-600 dark:text-zinc-400 flex items-center justify-center transition-colors focus:outline-none"
                aria-label="Tutup keranjang"
              >
                ✕
              </button>
            </div>

            {/* Cart Items List */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {cartItems.length === 0 ? (
                <div className="h-64 flex flex-col items-center justify-center text-zinc-400 dark:text-zinc-500">
                  <span className="text-4xl mb-2">🛍️</span>
                  <p className="text-sm font-medium">{t('cart_empty')}</p>
                </div>
              ) : (
                cartItems.map((item, index) => (
                  <div
                    key={`${item.productId}-${item.toppingName || 'none'}-${index}`}
                    className="p-4 border border-zinc-100 dark:border-zinc-850 bg-zinc-50/40 dark:bg-zinc-800/20 rounded-2xl flex flex-col gap-2 relative"
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="font-sans text-sm font-bold text-zinc-800 dark:text-zinc-100">
                          {item.name}
                        </h4>
                        {item.toppingName && (
                          <span className="text-xs text-secondary font-medium block">
                            + {t('cart_topping')}: {item.toppingName}
                          </span>
                        )}
                        {item.notes && (
                          <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-1 italic">
                            "{item.notes}"
                          </p>
                        )}
                      </div>
                      
                      <button
                        onClick={() => removeFromCart(item.productId, item.toppingName, item.notes)}
                        className="text-zinc-400 hover:text-red-500 transition-colors text-xs"
                        aria-label="Hapus item"
                      >
                        ✕
                      </button>
                    </div>

                    <div className="flex items-center justify-between mt-2 pt-2 border-t border-zinc-100/50 dark:border-zinc-800/30">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => updateQuantity(item.productId, item.toppingName, item.notes, item.quantity - 1)}
                          className="w-6 h-6 rounded-full border border-zinc-300 dark:border-zinc-700 flex items-center justify-center text-xs text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors"
                        >
                          -
                        </button>
                        <span className="w-6 text-center text-xs font-bold text-zinc-800 dark:text-zinc-200">
                          {item.quantity}
                        </span>
                        <button
                          onClick={() => updateQuantity(item.productId, item.toppingName, item.notes, item.quantity + 1)}
                          className="w-6 h-6 rounded-full border border-zinc-300 dark:border-zinc-700 flex items-center justify-center text-xs text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors"
                        >
                          +
                        </button>
                      </div>

                      <span className="text-sm font-bold text-brown dark:text-amber-400">
                        {formatPrice(item.totalPrice)}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Footer Form & Checkout Actions */}
            {cartItems.length > 0 && (
              <div className="p-6 border-t border-zinc-100 dark:bg-zinc-900/60 dark:border-zinc-800 bg-zinc-50/50 space-y-4">
                {/* Customer Info Area */}
                <div className="space-y-3 mb-4">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500 mb-2">
                      Nama Lengkap *
                    </label>
                    <input
                      type="text"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      placeholder="Masukkan nama Anda..."
                      className="w-full p-3 border border-zinc-200 dark:border-zinc-800 bg-transparent rounded-xl text-xs text-zinc-800 dark:text-zinc-200 focus:outline-none focus:ring-2 focus:ring-secondary/40"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500 mb-2">
                      Nomor WhatsApp *
                    </label>
                    <input
                      type="tel"
                      value={customerPhone}
                      onChange={(e) => setCustomerPhone(e.target.value)}
                      placeholder="Contoh: 081234567890"
                      className="w-full p-3 border border-zinc-200 dark:border-zinc-800 bg-transparent rounded-xl text-xs text-zinc-800 dark:text-zinc-200 focus:outline-none focus:ring-2 focus:ring-secondary/40"
                    />
                  </div>
                </div>

                {/* Notes/Address Area */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500 mb-2">
                    Metode Pengiriman
                  </label>
                  <div className="flex gap-2 mb-4">
                    <button 
                      onClick={() => setDeliveryMethod('DELIVERY')}
                      className={`flex-1 py-2.5 text-xs font-bold rounded-xl transition-all border ${deliveryMethod === 'DELIVERY' ? 'bg-amber-100/50 text-amber-800 border-amber-300' : 'bg-white dark:bg-zinc-800 text-zinc-500 border-zinc-200 dark:border-zinc-700'}`}>
                      🛵 Pesan Antar
                    </button>
                    <button 
                      onClick={() => setDeliveryMethod('PICKUP')}
                      className={`flex-1 py-2.5 text-xs font-bold rounded-xl transition-all border ${deliveryMethod === 'PICKUP' ? 'bg-amber-100/50 text-amber-800 border-amber-300' : 'bg-white dark:bg-zinc-800 text-zinc-500 border-zinc-200 dark:border-zinc-700'}`}>
                      🏪 Ambil Sendiri
                    </button>
                  </div>

                  <label className="block text-xs font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500 mb-2">
                    Catatan {deliveryMethod === 'DELIVERY' ? 'Pengiriman / Alamat Lengkap *' : 'Tambahan (Opsional)'}
                  </label>
                  <textarea
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder={deliveryMethod === 'DELIVERY' ? "Masukkan alamat pengiriman lengkap Anda..." : "Catatan untuk penjual..."}
                    className="w-full p-3 border border-zinc-200 dark:border-zinc-800 bg-transparent rounded-xl text-xs text-zinc-800 dark:text-zinc-200 focus:outline-none focus:ring-2 focus:ring-secondary/40 min-h-[60px]"
                  />
                </div>

                <div className="space-y-3">
                  <label className="block text-xs font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                    Kode Promo
                  </label>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <TicketPercent className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" aria-hidden="true" />
                      <input
                        type="text"
                        value={voucherCode}
                        onChange={(e) => {
                          const nextCode = e.target.value.toUpperCase()
                          setVoucherCode(nextCode)
                          if (appliedVoucher !== null && nextCode.trim() !== appliedVoucher.code) {
                            setAppliedVoucher(null)
                          }
                        }}
                        placeholder="Masukkan kode promo"
                        className="w-full p-3 pl-9 border border-zinc-200 dark:border-zinc-800 bg-transparent rounded-xl text-xs text-zinc-800 dark:text-zinc-200 focus:outline-none focus:ring-2 focus:ring-secondary/40"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={handleApplyVoucher}
                      disabled={isValidatingVoucher || cartTotal <= 0}
                      className="px-4 rounded-xl text-xs font-bold border border-amber-300 bg-amber-100/60 text-amber-800 hover:bg-amber-200/70 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isValidatingVoucher ? '...' : 'Pakai'}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500 mb-2">
                    Metode Pembayaran
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setPaymentMethod('WHATSAPP')}
                      className={`flex items-center justify-center gap-2 py-2.5 text-xs font-bold rounded-xl transition-all border ${paymentMethod === 'WHATSAPP' ? 'bg-green-100/70 text-green-800 border-green-300' : 'bg-white dark:bg-zinc-800 text-zinc-500 border-zinc-200 dark:border-zinc-700'}`}
                    >
                      <MessageCircle className="h-4 w-4" aria-hidden="true" />
                      WhatsApp
                    </button>
                    <button
                      type="button"
                      onClick={() => setPaymentMethod('ONLINE')}
                      className={`flex items-center justify-center gap-2 py-2.5 text-xs font-bold rounded-xl transition-all border ${paymentMethod === 'ONLINE' ? 'bg-blue-100/70 text-blue-800 border-blue-300' : 'bg-white dark:bg-zinc-800 text-zinc-500 border-zinc-200 dark:border-zinc-700'}`}
                    >
                      <CreditCard className="h-4 w-4" aria-hidden="true" />
                      Online
                    </button>
                  </div>
                </div>

                <div className="border-t border-zinc-100 dark:border-zinc-800 my-2" />

                {/* Total and CTA */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-zinc-500 dark:text-zinc-400">Subtotal</span>
                    <span className="text-sm font-medium text-zinc-800 dark:text-zinc-200">{formatPrice(cartTotal)}</span>
                  </div>
                  {discountAmount > 0 && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-zinc-500 dark:text-zinc-400">Diskon {appliedVoucher?.code}</span>
                      <span className="text-sm font-semibold text-green-700 dark:text-green-400">-{formatPrice(discountAmount)}</span>
                    </div>
                  )}
                  {deliveryMethod === 'DELIVERY' && deliveryFee > 0 && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-zinc-500 dark:text-zinc-400">Ongkos Kirim</span>
                      <span className="text-sm font-medium text-zinc-800 dark:text-zinc-200">{formatPrice(deliveryFee)}</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between pt-2 border-t border-zinc-200 dark:border-zinc-800">
                    <span className="text-sm font-bold text-zinc-800 dark:text-zinc-200">
                      Total Akhir
                    </span>
                    <span className="text-xl font-bold text-brown dark:text-amber-400">
                      {formatPrice(finalTotal)}
                    </span>
                  </div>
                </div>

                <div className="flex items-start gap-2 mt-4">
                  <input
                    type="checkbox"
                    id="privacy-consent"
                    checked={consent}
                    onChange={(e) => setConsent(e.target.checked)}
                    className="mt-1 shrink-0 accent-brown w-4 h-4 rounded cursor-pointer"
                  />
                  <label htmlFor="privacy-consent" className="text-[10px] text-zinc-500 cursor-pointer">
                    Saya menyetujui data saya disimpan sesuai Kebijakan Privasi perusahaan untuk keperluan pemesanan.
                  </label>
                </div>

                <button
                  onClick={handleCheckout}
                  disabled={isSubmitting}
                  className="w-full flex items-center justify-center gap-2 bg-[#2E7D32] hover:bg-[#236026] text-white font-semibold py-3.5 px-4 rounded-xl transition-all duration-200 shadow-md active:scale-95 text-center text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? 'Memproses...' : (
                    <>
                      {paymentMethod === 'ONLINE' ? <CreditCard className="h-4 w-4" aria-hidden="true" /> : <MessageCircle className="h-4 w-4" aria-hidden="true" />}
                      {paymentMethod === 'ONLINE' ? 'Bayar Online' : t('cart_checkout')}
                    </>
                  )}
                </button>
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
