'use client'

import React, { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useRouter } from 'next/navigation'
import { CreditCard, MessageCircle, TicketPercent, ShoppingCart, X, Minus, Plus, Trash2 } from 'lucide-react'
import { z } from 'zod'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useCart, type CartItem } from '@/context/CartContext'
import { useLanguage } from '@/context/LanguageContext'
import { useSettings } from '@/context/SettingsContext'
import { validateVoucher } from '@/src/features/checkout/actions'
import toast from 'react-hot-toast'

// ============================================================
// ZOD SCHEMA — Client-side Quarantine (VP Engineering mandate)
// ============================================================
const customerInfoSchema = z.object({
  customerName: z
    .string()
    .min(3, { message: 'Nama minimal 3 karakter.' })
    .max(60, { message: 'Nama maksimal 60 karakter.' })
    .regex(/^[A-Za-z\s]+$/, { message: 'Nama hanya boleh berisi huruf dan spasi.' }),
  customerPhone: z
    .string()
    .regex(/^(\+62|62|0)8[1-9][0-9]{6,10}$/, { message: 'Format WA tidak valid. Contoh: 08123456789' }),
}).strict()

type CustomerInfoValues = z.infer<typeof customerInfoSchema>

// ============================================================
// TYPES & SCHEMAS (Identik dengan CartDrawer — Zero Regression)
// ============================================================
interface CartModalProps {
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
  if (match === null) return null
  return normalizeBaseType(match[1])
}

function normalizeBaseType(value: string): BaseType | null {
  const normalized = value.trim().toLowerCase()
  if (normalized === 'kembung' || normalized === 'lumpia' || normalized === 'krispy') {
    return normalized
  }
  return null
}

const formatPrice = (amount: number) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(amount)

// ============================================================
// MAIN COMPONENT
// ============================================================
export default function CartModal({ isOpen, onClose }: CartModalProps) {
  const router = useRouter()
  const { cartItems, updateQuantity, removeFromCart, cartTotal, clearCart } = useCart()
  const { t } = useLanguage()
  const { getSetting } = useSettings()

  // — Form State —
  const [address, setAddress] = useState('')
  const [deliveryMethod, setDeliveryMethod] = useState<'DELIVERY' | 'PICKUP'>('DELIVERY')
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('WHATSAPP')
  const [voucherCode, setVoucherCode] = useState('')
  const [appliedVoucher, setAppliedVoucher] = useState<AppliedVoucher | null>(null)
  const [isValidatingVoucher, setIsValidatingVoucher] = useState(false)
  const [consent, setConsent] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // — Tab State —
  const [activeTab, setActiveTab] = useState<'cart' | 'checkout'>('cart')

  // — React Hook Form + Zod (VP Engineering: Iron Gate) —
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CustomerInfoValues>({
    resolver: zodResolver(customerInfoSchema),
    defaultValues: { customerName: '', customerPhone: '' },
  })

  const deliveryFeeSetting = getSetting('store_delivery_fee', '0')
  const deliveryFee = /^[0-9]{1,9}$/.test(deliveryFeeSetting) ? Number(deliveryFeeSetting) : 0
  const discountAmount = appliedVoucher?.discountAmount ?? 0
  const discountedSubtotal = Math.max(cartTotal - discountAmount, 0)
  const finalTotal = deliveryMethod === 'DELIVERY' ? discountedSubtotal + deliveryFee : discountedSubtotal

  // Reset voucher kalau cart berubah
  useEffect(() => {
    setAppliedVoucher(null)
  }, [cartTotal])

  // Auto-switch ke tab 'cart' dan reset tab saat keranjang jadi kosong
  useEffect(() => {
    if (cartItems.length === 0) {
      setActiveTab('cart')
    }
  }, [cartItems.length])

  // Tutup modal dengan Escape
  useEffect(() => {
    if (!isOpen) return
    const handleEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handleEsc)
    return () => document.removeEventListener('keydown', handleEsc)
  }, [isOpen, onClose])

  // Prevent body scroll saat modal terbuka
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [isOpen])

  // ============================================================
  // HANDLERS (Identik dengan CartDrawer — Zero Regression)
  // ============================================================
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
      setAppliedVoucher({ code: result.data.code, discountAmount: result.data.discountAmount })
      setVoucherCode(result.data.code)
      toast.success(result.data.message)
    } catch {
      setAppliedVoucher(null)
      toast.error('Voucher belum bisa divalidasi.')
    } finally {
      setIsValidatingVoucher(false)
    }
  }

  // handleCheckout sekarang menerima data dari RHF yang sudah divalidasi Zod
  const handleCheckout = async (formData: CustomerInfoValues) => {
    if (cartItems.length === 0) return
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
      if (baseType === null) return null
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
        customerName: formData.customerName.trim(),
        customerPhone: formData.customerPhone.trim(),
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

  // ============================================================
  // UI — CENTERED MODAL (The Shopee Design Language)
  // ============================================================
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* ── Backdrop ── */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
          />

          {/* ── Modal Container — Centered ── */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: 'spring', damping: 28, stiffness: 300 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none"
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="pointer-events-auto w-full max-w-2xl max-h-[90vh] flex flex-col bg-white dark:bg-zinc-900 rounded-3xl shadow-2xl overflow-hidden border border-zinc-200/60 dark:border-zinc-800"
            >

              {/* ── HEADER ── */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100 dark:border-zinc-800 bg-gradient-to-r from-[#D4802A]/5 to-transparent shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-2xl bg-[#D4802A]/15 flex items-center justify-center">
                    <ShoppingCart className="w-5 h-5 text-[#D4802A]" />
                  </div>
                  <div>
                    <h2 className="font-serif font-bold text-lg text-zinc-900 dark:text-zinc-100 leading-tight">
                      {t('cart_title')}
                    </h2>
                    <p className="text-xs text-zinc-400 dark:text-zinc-500">
                      {cartItems.length === 0 ? 'Keranjang kosong' : `${cartItems.reduce((s, i) => s + i.quantity, 0)} item • ${formatPrice(cartTotal)}`}
                    </p>
                  </div>
                </div>
                <button
                  onClick={onClose}
                  className="w-8 h-8 rounded-full bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-600 dark:text-zinc-400 flex items-center justify-center transition-colors focus:outline-none"
                  aria-label="Tutup keranjang"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* ── TAB SWITCHER (Shopee-style) ── */}
              {cartItems.length > 0 && (
                <div className="flex border-b border-zinc-100 dark:border-zinc-800 shrink-0">
                  <button
                    onClick={() => setActiveTab('cart')}
                    className={`flex-1 py-3 text-sm font-bold transition-all relative ${
                      activeTab === 'cart'
                        ? 'text-[#D4802A]'
                        : 'text-zinc-400 dark:text-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-400'
                    }`}
                  >
                    🛒 Keranjang
                    {activeTab === 'cart' && (
                      <span className="absolute bottom-0 left-1/4 right-1/4 h-0.5 rounded-full bg-[#D4802A]" />
                    )}
                  </button>
                  <button
                    onClick={() => setActiveTab('checkout')}
                    className={`flex-1 py-3 text-sm font-bold transition-all relative ${
                      activeTab === 'checkout'
                        ? 'text-[#D4802A]'
                        : 'text-zinc-400 dark:text-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-400'
                    }`}
                  >
                    📋 Detail Pesanan
                    {activeTab === 'checkout' && (
                      <span className="absolute bottom-0 left-1/4 right-1/4 h-0.5 rounded-full bg-[#D4802A]" />
                    )}
                  </button>
                </div>
              )}

              {/* ── BODY (Scrollable) ── */}
              <div className="flex-1 overflow-y-auto min-h-0">

                {/* ===== EMPTY STATE ===== */}
                {cartItems.length === 0 && (
                  <div className="flex flex-col items-center justify-center h-64 text-zinc-400 dark:text-zinc-500 gap-4">
                    <div className="text-6xl">🛍️</div>
                    <div className="text-center">
                      <p className="font-semibold text-zinc-500 dark:text-zinc-400">{t('cart_empty')}</p>
                      <p className="text-sm text-zinc-400 dark:text-zinc-500 mt-1">Belum ada produk di keranjang Anda</p>
                    </div>
                    <button
                      onClick={() => {
                        onClose()
                        router.push('/menu-spesial')
                      }}
                      className="mt-2 px-6 py-2.5 bg-[#D4802A] text-white text-sm font-bold rounded-full hover:bg-[#b56d24] transition-all active:scale-95"
                    >
                      Mulai Belanja →
                    </button>
                  </div>
                )}

                {/* ===== TAB: KERANJANG ===== */}
                {cartItems.length > 0 && activeTab === 'cart' && (
                  <div className="p-5 space-y-3">
                    {cartItems.map((item, index) => (
                      <motion.div
                        key={`${item.productId}-${item.toppingName ?? 'none'}-${index}`}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        transition={{ delay: index * 0.04 }}
                        className="flex items-start gap-4 p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-100 dark:border-zinc-800 hover:border-[#D4802A]/30 transition-all"
                      >
                        {/* Product Emoji Avatar */}
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-100 to-orange-100 dark:from-zinc-700 dark:to-zinc-800 flex items-center justify-center text-2xl shrink-0 shadow-sm">
                          🍌
                        </div>

                        {/* Product Detail */}
                        <div className="flex-1 min-w-0">
                          <h4 className="font-bold text-sm text-zinc-800 dark:text-zinc-100 truncate">{item.name}</h4>
                          {item.toppingName && (
                            <p className="text-xs text-[#D4802A] font-medium mt-0.5">+ {item.toppingName}</p>
                          )}
                          {item.notes && (
                            <p className="text-xs text-zinc-400 dark:text-zinc-500 italic mt-0.5 truncate">"{item.notes}"</p>
                          )}
                          <div className="flex items-center justify-between mt-2">
                            {/* Quantity Control — Shopee Style: minus→trash saat qty=1 */}
                            <div className="flex items-center gap-1 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-full p-0.5 shadow-sm">
                              <button
                                onClick={() =>
                                  item.quantity === 1
                                    ? removeFromCart(item.productId, item.toppingName, item.notes)
                                    : updateQuantity(item.productId, item.toppingName, item.notes, item.quantity - 1)
                                }
                                className={`w-7 h-7 rounded-full flex items-center justify-center transition-all active:scale-90 ${
                                  item.quantity === 1
                                    ? 'text-red-400 hover:bg-red-50 dark:hover:bg-red-950/20 hover:text-red-600'
                                    : 'text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-[#D4802A]'
                                }`}
                                aria-label={item.quantity === 1 ? 'Hapus item' : 'Kurangi kuantitas'}
                              >
                                {item.quantity === 1 ? <Trash2 className="w-3 h-3" /> : <Minus className="w-3 h-3" />}
                              </button>
                              <span className="w-7 text-center text-sm font-bold text-zinc-800 dark:text-zinc-100">
                                {item.quantity}
                              </span>
                              <button
                                onClick={() => updateQuantity(item.productId, item.toppingName, item.notes, item.quantity + 1)}
                                className="w-7 h-7 rounded-full flex items-center justify-center bg-[#D4802A] text-white hover:bg-[#b56d24] transition-all active:scale-90"
                                aria-label="Tambah kuantitas"
                              >
                                <Plus className="w-3 h-3" />
                              </button>
                            </div>

                            {/* Price */}
                            <span className="text-sm font-bold text-[#D4802A]">{formatPrice(item.totalPrice)}</span>
                          </div>
                        </div>

                        {/* Remove Button */}
                        <button
                          onClick={() => removeFromCart(item.productId, item.toppingName, item.notes)}
                          className="p-1.5 rounded-lg text-zinc-300 dark:text-zinc-600 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 transition-all active:scale-90"
                          aria-label="Hapus item"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </motion.div>
                    ))}
                  </div>
                )}

                {/* ===== TAB: CHECKOUT DETAIL ===== */}
                {cartItems.length > 0 && activeTab === 'checkout' && (
                  <div className="p-5 space-y-5">

                    {/* — Customer Info (RHF + Zod Iron Gate) — */}
                    <div className="space-y-3">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                        Informasi Pemesan
                      </h3>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-semibold text-zinc-600 dark:text-zinc-400 mb-1.5">
                            Nama Lengkap *
                          </label>
                          <input
                            {...register('customerName')}
                            type="text"
                            placeholder="Nama Anda..."
                            className={`w-full px-3 py-2.5 border rounded-xl text-sm text-zinc-800 dark:text-zinc-200 placeholder:text-zinc-400 focus:outline-none focus:ring-2 transition-all bg-zinc-50 dark:bg-zinc-800/50 ${
                              errors.customerName
                                ? 'border-red-400 focus:ring-red-300/30'
                                : 'border-zinc-200 dark:border-zinc-700 focus:ring-[#D4802A]/30 focus:border-[#D4802A]'
                            }`}
                          />
                          {errors.customerName && (
                            <p className="mt-1 text-[10px] text-red-500 font-medium">{errors.customerName.message}</p>
                          )}
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-zinc-600 dark:text-zinc-400 mb-1.5">
                            Nomor WhatsApp *
                          </label>
                          <input
                            {...register('customerPhone')}
                            type="tel"
                            placeholder="08123456789"
                            className={`w-full px-3 py-2.5 border rounded-xl text-sm text-zinc-800 dark:text-zinc-200 placeholder:text-zinc-400 focus:outline-none focus:ring-2 transition-all bg-zinc-50 dark:bg-zinc-800/50 ${
                              errors.customerPhone
                                ? 'border-red-400 focus:ring-red-300/30'
                                : 'border-zinc-200 dark:border-zinc-700 focus:ring-[#D4802A]/30 focus:border-[#D4802A]'
                            }`}
                          />
                          {errors.customerPhone && (
                            <p className="mt-1 text-[10px] text-red-500 font-medium">{errors.customerPhone.message}</p>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* — Delivery Method — */}
                    <div>
                      <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500 mb-3">
                        Metode Pengiriman
                      </h3>
                      <div className="grid grid-cols-2 gap-2 mb-3">
                        <button
                          onClick={() => setDeliveryMethod('DELIVERY')}
                          className={`flex items-center justify-center gap-2 py-3 text-sm font-bold rounded-2xl transition-all border-2 ${
                            deliveryMethod === 'DELIVERY'
                              ? 'bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-300 border-[#D4802A]'
                              : 'bg-white dark:bg-zinc-800 text-zinc-500 border-zinc-200 dark:border-zinc-700'
                          }`}
                        >
                          🛵 Pesan Antar
                        </button>
                        <button
                          onClick={() => setDeliveryMethod('PICKUP')}
                          className={`flex items-center justify-center gap-2 py-3 text-sm font-bold rounded-2xl transition-all border-2 ${
                            deliveryMethod === 'PICKUP'
                              ? 'bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-300 border-[#D4802A]'
                              : 'bg-white dark:bg-zinc-800 text-zinc-500 border-zinc-200 dark:border-zinc-700'
                          }`}
                        >
                          🏪 Ambil Sendiri
                        </button>
                      </div>
                      <textarea
                        value={address}
                        onChange={(e) => setAddress(e.target.value)}
                        placeholder={deliveryMethod === 'DELIVERY' ? 'Alamat pengiriman lengkap...' : 'Catatan tambahan (opsional)...'}
                        rows={2}
                        className="w-full px-3 py-2.5 border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/50 rounded-xl text-sm text-zinc-800 dark:text-zinc-200 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-[#D4802A]/30 focus:border-[#D4802A] transition-all resize-none"
                      />
                    </div>

                    {/* — Voucher — */}
                    <div>
                      <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500 mb-3">
                        Kode Promo
                      </h3>
                      <div className="flex gap-2">
                        <div className="relative flex-1">
                          <TicketPercent className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" aria-hidden />
                          <input
                            type="text"
                            value={voucherCode}
                            onChange={(e) => {
                              const next = e.target.value.toUpperCase()
                              setVoucherCode(next)
                              if (appliedVoucher !== null && next.trim() !== appliedVoucher.code) {
                                setAppliedVoucher(null)
                              }
                            }}
                            placeholder="Kode promo"
                            className="w-full pl-9 pr-3 py-2.5 border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/50 rounded-xl text-sm text-zinc-800 dark:text-zinc-200 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-[#D4802A]/30 focus:border-[#D4802A] transition-all"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={handleApplyVoucher}
                          disabled={isValidatingVoucher || cartTotal <= 0}
                          className="px-5 rounded-xl text-sm font-bold border-2 border-amber-300 bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-300 hover:bg-amber-100 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {isValidatingVoucher ? '...' : 'Pakai'}
                        </button>
                      </div>
                      {appliedVoucher && (
                        <p className="mt-1.5 text-xs font-semibold text-green-600 dark:text-green-400">
                          ✅ Voucher <strong>{appliedVoucher.code}</strong> aktif — hemat {formatPrice(appliedVoucher.discountAmount)}
                        </p>
                      )}
                    </div>

                    {/* — Payment Method — */}
                    <div>
                      <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500 mb-3">
                        Metode Pembayaran
                      </h3>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => setPaymentMethod('WHATSAPP')}
                          className={`flex items-center justify-center gap-2 py-3 text-sm font-bold rounded-2xl transition-all border-2 ${
                            paymentMethod === 'WHATSAPP'
                              ? 'bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-300 border-green-400'
                              : 'bg-white dark:bg-zinc-800 text-zinc-500 border-zinc-200 dark:border-zinc-700'
                          }`}
                        >
                          <MessageCircle className="w-4 h-4" aria-hidden />
                          WhatsApp
                        </button>
                        <button
                          type="button"
                          onClick={() => setPaymentMethod('ONLINE')}
                          className={`flex items-center justify-center gap-2 py-3 text-sm font-bold rounded-2xl transition-all border-2 ${
                            paymentMethod === 'ONLINE'
                              ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-800 dark:text-blue-300 border-blue-400'
                              : 'bg-white dark:bg-zinc-800 text-zinc-500 border-zinc-200 dark:border-zinc-700'
                          }`}
                        >
                          <CreditCard className="w-4 h-4" aria-hidden />
                          Online
                        </button>
                      </div>
                    </div>

                    {/* — Consent — */}
                    <div className="flex items-start gap-2.5">
                      <input
                        type="checkbox"
                        id="privacy-consent-modal"
                        checked={consent}
                        onChange={(e) => setConsent(e.target.checked)}
                        className="mt-0.5 shrink-0 accent-[#D4802A] w-4 h-4 rounded cursor-pointer"
                      />
                      <label htmlFor="privacy-consent-modal" className="text-xs text-zinc-500 dark:text-zinc-400 cursor-pointer leading-relaxed">
                        Saya menyetujui data saya disimpan sesuai Kebijakan Privasi perusahaan untuk keperluan pemesanan.
                      </label>
                    </div>
                  </div>
                )}
              </div>

              {/* ── FOOTER — Sticky Price Summary + CTA ── */}
              {cartItems.length > 0 && (
                <div className="shrink-0 border-t border-zinc-100 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-5 py-4 space-y-3 shadow-[0_-4px_20px_rgba(0,0,0,0.06)]">

                  {/* Price Breakdown */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs text-zinc-400 dark:text-zinc-500">
                      <span>Subtotal ({cartItems.reduce((s, i) => s + i.quantity, 0)} item)</span>
                      <span className="font-semibold text-zinc-600 dark:text-zinc-300">{formatPrice(cartTotal)}</span>
                    </div>
                    {discountAmount > 0 && (
                      <div className="flex justify-between text-xs">
                        <span className="text-green-600 dark:text-green-400">Diskon {appliedVoucher?.code}</span>
                        <span className="font-semibold text-green-600 dark:text-green-400">-{formatPrice(discountAmount)}</span>
                      </div>
                    )}
                    {/* Ongkos kirim selalu tampil saat Pesan Antar dipilih (CFO mandate) */}
                    {deliveryMethod === 'DELIVERY' && (
                      <div className="flex justify-between text-xs text-zinc-400 dark:text-zinc-500">
                        <span>Ongkos Kirim</span>
                        <span className={`font-semibold ${
                          deliveryFee > 0 ? 'text-zinc-600 dark:text-zinc-300' : 'text-green-600 dark:text-green-400'
                        }`}>
                          {deliveryFee > 0 ? formatPrice(deliveryFee) : 'Gratis 🎉'}
                        </span>
                      </div>
                    )}
                    <div className="flex justify-between items-center pt-2 border-t border-zinc-100 dark:border-zinc-800">
                      <span className="text-sm font-bold text-zinc-800 dark:text-zinc-100">Total Akhir</span>
                      <span className="text-xl font-extrabold text-[#D4802A]">{formatPrice(finalTotal)}</span>
                    </div>
                  </div>

                  {/* CTA Buttons */}
                  <div className="flex gap-2">
                    {activeTab === 'cart' && (
                      <button
                        onClick={() => setActiveTab('checkout')}
                        className="flex-1 py-3.5 bg-[#D4802A] hover:bg-[#b56d24] text-white font-bold rounded-2xl shadow-lg shadow-[#D4802A]/25 transition-all active:scale-95 text-sm flex items-center justify-center gap-2"
                      >
                        Lanjut ke Checkout →
                      </button>
                    )}
                    {activeTab === 'checkout' && (
                      <>
                        <button
                          onClick={() => setActiveTab('cart')}
                          className="px-4 py-3.5 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-600 dark:text-zinc-300 font-bold rounded-2xl transition-all active:scale-95 text-sm"
                        >
                          ← Kembali
                        </button>
                        {/* handleSubmit dari RHF memvalidasi Zod SEBELUM handleCheckout dipanggil */}
                        <button
                          onClick={handleSubmit(handleCheckout)}
                          disabled={isSubmitting}
                          className="flex-1 py-3.5 flex items-center justify-center gap-2 text-white font-bold rounded-2xl shadow-lg transition-all active:scale-95 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                          style={{ background: paymentMethod === 'ONLINE' ? '#1a56db' : '#2E7D32' }}
                        >
                          {isSubmitting ? (
                            <>
                              <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                              </svg>
                              Memproses...
                            </>
                          ) : (
                            <>
                              {paymentMethod === 'ONLINE'
                                ? <><CreditCard className="w-4 h-4" aria-hidden /> Bayar Online</>
                                : <><MessageCircle className="w-4 h-4" aria-hidden /> {t('cart_checkout')}</>
                              }
                            </>
                          )}
                        </button>
                      </>
                    )}
                  </div>
                </div>
              )}

            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
