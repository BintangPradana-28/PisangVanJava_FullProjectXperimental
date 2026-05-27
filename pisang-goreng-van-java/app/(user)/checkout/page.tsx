'use client'
// app/(user)/checkout/page.tsx — Dedicated Checkout Page
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { motion, AnimatePresence } from 'framer-motion'
import toast from 'react-hot-toast'
import Link from 'next/link'
import { z } from 'zod'
import { useCart } from '@/context/CartContext'
import { useSettings } from '@/context/SettingsContext'
import { validateVoucher } from '@/src/features/checkout/actions'

// ── Response Schema ─────────────────────────────────────────────────────────
const orderResponseSchema = z.discriminatedUnion('success', [
  z.object({
    success: z.literal(true),
    data: z.object({
      orderId: z.string(),
      redirectType: z.enum(['WHATSAPP', 'PAYMENT']),
      redirectUrl: z.string().min(1).max(3000),
      totalPrice: z.number().finite().int().min(0),
    }),
  }),
  z.object({
    success: z.literal(false),
    error: z.string(),
  }),
])

type DeliveryMethod = 'DELIVERY' | 'PICKUP'
type PaymentMethod  = 'WHATSAPP' | 'ONLINE'
type BaseType       = 'kembung' | 'lumpia' | 'krispy'

interface AppliedVoucher { code: string; discountAmount: number }

function resolveBaseType(nameOrType?: string): BaseType | null {
  if (!nameOrType) return null
  const n = nameOrType.trim().toLowerCase()
  if (n === 'kembung' || n === 'lumpia' || n === 'krispy') return n
  const match = nameOrType.match(/\((Kembung|Lumpia|Krispy|kembung|lumpia|krispy)\)$/)
  if (match) return match[1].toLowerCase() as BaseType
  return null
}

const formatPrice = (n: number) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(n)

// ── Step indicator ──────────────────────────────────────────────────────────
const STEPS = ['Keranjang', 'Detail', 'Konfirmasi']

export default function CheckoutPage() {
  const router              = useRouter()
  const { data: session, status: authStatus } = useSession()
  const { cartItems, cartTotal, clearCart }    = useCart()
  const { getSetting }      = useSettings()

  // Form state
  const [step, setStep]                     = useState(0)  // 0=review, 1=form, 2=confirm
  const [customerName, setCustomerName]     = useState('')
  const [customerPhone, setCustomerPhone]   = useState('')
  const [delivery, setDelivery]             = useState<DeliveryMethod>('PICKUP')
  const [address, setAddress]               = useState('')
  const [notes, setNotes]                   = useState('')
  const [paymentMethod, setPaymentMethod]   = useState<PaymentMethod>('WHATSAPP')
  const [voucherCode, setVoucherCode]       = useState('')
  const [appliedVoucher, setAppliedVoucher] = useState<AppliedVoucher | null>(null)
  const [isValidating, setIsValidating]     = useState(false)
  const [consent, setConsent]               = useState(false)
  const [isSubmitting, setIsSubmitting]     = useState(false)

  // Hydrate user data from session
  // NOTE: Auth redirect is now handled by Edge Middleware (middleware.ts).
  // This effect only fetches profile data to pre-fill the form.
  useEffect(() => {
    if (session?.user?.name) setCustomerName(session.user.name)
    if (authStatus === 'authenticated') {
      fetch('/api/user/profile', { credentials: 'include' })
        .then(r => r.json())
        .then(d => {
          if (d.success && d.data?.phone) setCustomerPhone(d.data.phone)
          if (d.success && d.data?.address) setAddress(d.data.address)
        })
        .catch(() => {})
    }
  }, [authStatus, session])

  // Reset voucher when cart changes
  useEffect(() => { setAppliedVoucher(null) }, [cartTotal])

  // Guard: empty cart
  useEffect(() => {
    if (authStatus === 'authenticated' && cartItems.length === 0) {
      toast('Keranjang kosong, yuk pilih menu dulu!', { icon: '🛒' })
      router.push('/menu-spesial')
    }
  }, [cartItems.length, authStatus, router])

  // ── Prices ────────────────────────────────────────────────────────────────
  const deliveryFeeSetting = getSetting('store_delivery_fee', '0')
  const deliveryFee        = /^[0-9]{1,9}$/.test(deliveryFeeSetting) ? Number(deliveryFeeSetting) : 0
  const discount           = appliedVoucher?.discountAmount ?? 0
  const subtotalAfterDisc  = Math.max(cartTotal - discount, 0)
  const grandTotal         = delivery === 'DELIVERY' ? subtotalAfterDisc + deliveryFee : subtotalAfterDisc

  // ── Voucher handler ───────────────────────────────────────────────────────
  const handleApplyVoucher = async () => {
    const code = voucherCode.trim()
    if (!code) { toast.error('Masukkan kode promo'); return }
    setIsValidating(true)
    try {
      const result = await validateVoucher(code, cartTotal)
      if (!result.success) { setAppliedVoucher(null); toast.error(result.error); return }
      setAppliedVoucher({ code: result.data.code, discountAmount: result.data.discountAmount })
      setVoucherCode(result.data.code)
      toast.success(result.data.message)
    } catch { toast.error('Gagal memvalidasi voucher') }
    finally   { setIsValidating(false) }
  }

  // ── Step 1 → Step 2 Validated Transition (THE GATEKEEPER) ──────────────
  // CPO Mandate: Form MUST be validated BEFORE the user sees the confirmation
  // screen. Silent invalid data at Step 2 is "UX Malpractice".
  const handleNextToConfirm = () => {
    if (!customerName.trim()) {
      toast.error('Nama lengkap wajib diisi'); return
    }
    if (customerName.trim().length < 2 || customerName.trim().length > 60) {
      toast.error('Nama harus antara 2–60 karakter'); return
    }
    if (!customerPhone.trim()) {
      toast.error('Nomor WhatsApp wajib diisi'); return
    }
    if (!/^(\+62|62|0)8[1-9][0-9]{6,10}$/.test(customerPhone.trim())) {
      toast.error('Format nomor WhatsApp tidak valid (cth: 081234567890)'); return
    }
    if (delivery === 'DELIVERY' && !address.trim()) {
      toast.error('Alamat pengiriman wajib diisi'); return
    }
    // All valid → advance
    setStep(2)
  }

  // ── Submit (Idempotent — locked after first press) ────────────────────────
  const handleSubmit = async () => {
    if (isSubmitting) return // IDEMPOTENCY GUARD: reject re-entry
    if (!consent) { toast.error('Setujui kebijakan privasi terlebih dahulu'); return }

    const items = cartItems.map(item => {
      const baseType = resolveBaseType(item.baseType ?? item.name)
      if (!baseType) return null
      return {
        variantId: item.productId,
        toppingId: item.toppingId ?? null,
        baseType,
        quantity: item.quantity,
        notes: item.notes?.trim() || null,
      }
    }).filter(Boolean)

    if (items.length !== cartItems.length) {
      toast.error('Ada item lama yang tidak valid. Tambahkan ulang dari menu.'); return
    }

    setIsSubmitting(true)
    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          customerName: customerName.trim(),
          customerPhone: customerPhone.trim(),
          deliveryMethod: delivery,
          paymentMethod,
          notes: delivery === 'DELIVERY' ? address.trim() : (notes.trim() || null),
          voucherCode: appliedVoucher?.code ?? null,
          items,
        }),
      })

      const json: unknown = await res.json()
      const parsed = orderResponseSchema.safeParse(json)

      if (!parsed.success || !parsed.data.success) {
        const err = parsed.success && !parsed.data.success ? parsed.data.error : 'Checkout ditolak server'
        toast.error(err); return
      }

      const { redirectType, redirectUrl } = parsed.data.data

      if (redirectType === 'WHATSAPP') {
        if (!redirectUrl.startsWith('https://wa.me/')) { toast.error('URL checkout tidak valid'); return }
        clearCart()
        toast.success('Pesanan berhasil! Lanjutkan di WhatsApp 💬')
        window.open(redirectUrl, '_blank', 'noopener,noreferrer')
        router.push('/track-order')
      } else {
        if (!redirectUrl.startsWith('/payment/')) { toast.error('URL pembayaran tidak valid'); return }
        clearCart()
        router.push(redirectUrl)
      }
    } catch { toast.error('Koneksi bermasalah. Coba beberapa saat lagi.') }
    finally { setIsSubmitting(false) }
  }

  if (authStatus === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-950">
        <div className="w-10 h-10 rounded-full border-4 border-amber-500 border-t-transparent animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-white to-orange-50 dark:from-zinc-950 dark:via-zinc-900 dark:to-zinc-950 pt-24 pb-16">
      <div className="max-w-5xl mx-auto px-4 sm:px-6">

        {/* ── Step Progress ── */}
        <div className="flex items-center justify-center gap-3 mb-8">
          {STEPS.map((label, i) => (
            <div key={label} className="flex items-center gap-2">
              <button
                onClick={() => i < step && setStep(i)}
                className={`w-8 h-8 rounded-full text-xs font-bold flex items-center justify-center transition-all ${
                  i === step   ? 'bg-amber-500 text-white shadow-lg shadow-amber-200' :
                  i < step     ? 'bg-amber-100 text-amber-700 cursor-pointer hover:bg-amber-200' :
                                 'bg-zinc-100 dark:bg-zinc-800 text-zinc-400'
                }`}
              >
                {i < step ? '✓' : i + 1}
              </button>
              <span className={`text-xs font-semibold hidden sm:block ${
                i === step ? 'text-amber-700 dark:text-amber-400' : 'text-zinc-400'
              }`}>{label}</span>
              {i < STEPS.length - 1 && (
                <div className={`w-8 h-0.5 ${i < step ? 'bg-amber-400' : 'bg-zinc-200 dark:bg-zinc-800'}`} />
              )}
            </div>
          ))}
        </div>

        <div className="grid lg:grid-cols-[1fr_380px] gap-6">

          {/* ── Left Panel ── */}
          <div className="space-y-4">
            <AnimatePresence mode="wait">

              {/* STEP 0: Review Cart */}
              {step === 0 && (
                <motion.div key="step0" initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 16 }}>
                  <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-100 dark:border-zinc-800 shadow-sm p-6">
                    <h2 className="font-serif text-xl font-bold text-zinc-900 dark:text-zinc-100 mb-4">
                      🛒 Periksa Pesanan Anda
                    </h2>
                    <div className="space-y-3">
                      {cartItems.map((item, i) => (
                        <div key={`${item.productId}-${i}`} className="flex justify-between items-start py-3 border-b border-zinc-50 dark:border-zinc-800 last:border-0">
                          <div>
                            <p className="text-sm font-bold text-zinc-800 dark:text-zinc-100">{item.name}</p>
                            {item.toppingName && <p className="text-xs text-amber-600 mt-0.5">+ {item.toppingName}</p>}
                            {item.notes && <p className="text-xs text-zinc-400 italic mt-0.5">"{item.notes}"</p>}
                          </div>
                          <div className="text-right ml-4 shrink-0">
                            <p className="text-sm font-bold text-zinc-800 dark:text-zinc-100">{formatPrice(item.totalPrice)}</p>
                            <p className="text-xs text-zinc-400">×{item.quantity}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="mt-4 flex justify-between items-center">
                      <Link href="/menu-spesial" className="text-xs text-amber-600 font-semibold hover:underline">← Tambah item</Link>
                      <button onClick={() => setStep(1)} className="bg-amber-500 hover:bg-amber-600 text-white font-bold py-3 px-8 rounded-2xl transition-all active:scale-95 shadow-md shadow-amber-200">
                        Lanjut →
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* STEP 1: Customer Form */}
              {step === 1 && (
                <motion.div key="step1" initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 16 }}>
                  <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-100 dark:border-zinc-800 shadow-sm p-6 space-y-5">
                    <h2 className="font-serif text-xl font-bold text-zinc-900 dark:text-zinc-100">👤 Data Pemesan</h2>

                    {/* Nama */}
                    <div>
                      <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-1.5">Nama Lengkap *</label>
                      <input
                        type="text" value={customerName}
                        onChange={e => setCustomerName(e.target.value)}
                        placeholder="Nama Anda..."
                        className="w-full px-4 py-3 rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-100 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 transition-all"
                      />
                    </div>

                    {/* WhatsApp */}
                    <div>
                      <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-1.5">Nomor WhatsApp *</label>
                      <input
                        type="tel" value={customerPhone}
                        onChange={e => setCustomerPhone(e.target.value)}
                        placeholder="Contoh: 081234567890"
                        className="w-full px-4 py-3 rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-100 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 transition-all"
                      />
                    </div>

                    {/* Delivery Method */}
                    <div>
                      <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2">Metode Pengambilan</label>
                      <div className="grid grid-cols-2 gap-3">
                        {[
                          { value: 'PICKUP'   as DeliveryMethod, icon: '🏪', label: 'Ambil Sendiri', sub: 'Gratis' },
                          { value: 'DELIVERY' as DeliveryMethod, icon: '🛵', label: 'Diantar',       sub: deliveryFee > 0 ? `+${formatPrice(deliveryFee)}` : 'Gratis' },
                        ].map(opt => (
                          <button key={opt.value} type="button" onClick={() => setDelivery(opt.value)}
                            className={`py-4 px-4 rounded-2xl border-2 text-left transition-all ${
                              delivery === opt.value
                                ? 'border-amber-400 bg-amber-50 dark:bg-amber-900/20'
                                : 'border-zinc-200 dark:border-zinc-700 hover:border-zinc-300'
                            }`}
                          >
                            <div className="text-2xl mb-1">{opt.icon}</div>
                            <div className="font-bold text-sm text-zinc-800 dark:text-zinc-100">{opt.label}</div>
                            <div className="text-xs text-zinc-400 mt-0.5">{opt.sub}</div>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Address / Notes */}
                    <div>
                      <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-1.5">
                        {delivery === 'DELIVERY' ? 'Alamat Pengiriman Lengkap *' : 'Catatan (Opsional)'}
                      </label>
                      <textarea
                        value={delivery === 'DELIVERY' ? address : notes}
                        onChange={e => delivery === 'DELIVERY' ? setAddress(e.target.value) : setNotes(e.target.value)}
                        placeholder={delivery === 'DELIVERY' ? 'Jl. Contoh No.1, RT/RW, Kelurahan, Kota...' : 'Catatan untuk penjual...'}
                        rows={3}
                        className="w-full px-4 py-3 rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-100 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 transition-all resize-none"
                      />
                    </div>

                    {/* Voucher */}
                    <div>
                      <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-1.5">Kode Promo</label>
                      <div className="flex gap-2">
                        <input
                          type="text" value={voucherCode}
                          onChange={e => {
                            const v = e.target.value.toUpperCase()
                            setVoucherCode(v)
                            if (appliedVoucher && v !== appliedVoucher.code) setAppliedVoucher(null)
                          }}
                          placeholder="KODE-PROMO"
                          className="flex-1 px-4 py-3 rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-100 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-amber-400 transition-all uppercase"
                        />
                        <button type="button" onClick={handleApplyVoucher} disabled={isValidating || cartTotal <= 0}
                          className="px-5 py-3 rounded-2xl bg-amber-100 text-amber-800 font-bold text-sm hover:bg-amber-200 disabled:opacity-50 transition-all">
                          {isValidating ? '...' : 'Pakai'}
                        </button>
                      </div>
                      {appliedVoucher && (
                        <p className="text-xs text-green-600 font-semibold mt-1.5">
                          ✅ Voucher {appliedVoucher.code} hemat {formatPrice(appliedVoucher.discountAmount)}
                        </p>
                      )}
                    </div>

                    {/* Payment Method */}
                    <div>
                      <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2">Metode Pembayaran</label>
                      <div className="grid grid-cols-2 gap-3">
                        {[
                          { value: 'WHATSAPP' as PaymentMethod, icon: '💬', label: 'Via WhatsApp', sub: 'Konfirmasi manual' },
                          { value: 'ONLINE'   as PaymentMethod, icon: '💳', label: 'Bayar Online',  sub: 'Simulasi gateway' },
                        ].map(opt => (
                          <button key={opt.value} type="button" onClick={() => setPaymentMethod(opt.value)}
                            className={`py-4 px-4 rounded-2xl border-2 text-left transition-all ${
                              paymentMethod === opt.value
                                ? 'border-amber-400 bg-amber-50 dark:bg-amber-900/20'
                                : 'border-zinc-200 dark:border-zinc-700 hover:border-zinc-300'
                            }`}
                          >
                            <div className="text-2xl mb-1">{opt.icon}</div>
                            <div className="font-bold text-sm text-zinc-800 dark:text-zinc-100">{opt.label}</div>
                            <div className="text-xs text-zinc-400 mt-0.5">{opt.sub}</div>
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="flex justify-between items-center pt-2">
                      <button onClick={() => setStep(0)} className="text-sm text-zinc-400 font-semibold hover:text-zinc-600">← Kembali</button>
                      {/* VALIDATED TRANSITION — calls handleNextToConfirm, not setStep(2) directly */}
                      <button onClick={handleNextToConfirm} className="bg-amber-500 hover:bg-amber-600 text-white font-bold py-3 px-8 rounded-2xl transition-all active:scale-95 shadow-md shadow-amber-200">
                        Review Pesanan →
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* STEP 2: Confirmation */}
              {step === 2 && (
                <motion.div key="step2" initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 16 }}>
                  <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-100 dark:border-zinc-800 shadow-sm p-6 space-y-5">
                    <h2 className="font-serif text-xl font-bold text-zinc-900 dark:text-zinc-100">✅ Konfirmasi Pesanan</h2>

                    {/* Summary blocks */}
                    <div className="space-y-3">
                      <div className="bg-zinc-50 dark:bg-zinc-800/50 rounded-2xl p-4 space-y-2 text-sm">
                        <div className="flex justify-between"><span className="text-zinc-500">Nama</span><span className="font-semibold text-zinc-800 dark:text-zinc-100">{customerName}</span></div>
                        <div className="flex justify-between"><span className="text-zinc-500">WhatsApp</span><span className="font-semibold text-zinc-800 dark:text-zinc-100">{customerPhone}</span></div>
                        <div className="flex justify-between"><span className="text-zinc-500">Pengiriman</span><span className="font-semibold text-zinc-800 dark:text-zinc-100">{delivery === 'DELIVERY' ? '🛵 Delivery' : '🏪 Pickup'}</span></div>
                        <div className="flex justify-between"><span className="text-zinc-500">Pembayaran</span><span className="font-semibold text-zinc-800 dark:text-zinc-100">{paymentMethod === 'WHATSAPP' ? '💬 WhatsApp' : '💳 Online'}</span></div>
                        {delivery === 'DELIVERY' && address && (
                          <div className="flex justify-between gap-4"><span className="text-zinc-500 shrink-0">Alamat</span><span className="font-semibold text-zinc-800 dark:text-zinc-100 text-right">{address}</span></div>
                        )}
                      </div>

                      {/* Promo info */}
                      {appliedVoucher && (
                        <div className="bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-900 rounded-2xl px-4 py-3 text-sm text-green-700 dark:text-green-400 font-semibold">
                          🏷️ Voucher {appliedVoucher.code} — Hemat {formatPrice(appliedVoucher.discountAmount)}
                        </div>
                      )}
                    </div>

                    {/* Privacy consent */}
                    <div className="flex items-start gap-3 bg-zinc-50 dark:bg-zinc-800/50 rounded-2xl p-4">
                      <input
                        type="checkbox" id="consent-check" checked={consent}
                        onChange={e => setConsent(e.target.checked)}
                        className="mt-0.5 w-4 h-4 accent-amber-500 shrink-0 cursor-pointer"
                      />
                      <label htmlFor="consent-check" className="text-xs text-zinc-500 dark:text-zinc-400 cursor-pointer leading-relaxed">
                        Saya menyetujui bahwa data nama, nomor WhatsApp, dan alamat pengiriman saya disimpan untuk keperluan pemesanan ini sesuai{' '}
                        <Link href="/privacy" className="text-amber-600 hover:underline font-semibold">Kebijakan Privasi</Link>.
                      </label>
                    </div>

                    <div className="flex justify-between items-center gap-3">
                      <button onClick={() => setStep(1)} className="text-sm text-zinc-400 font-semibold hover:text-zinc-600">← Edit</button>
                      <button
                        onClick={handleSubmit}
                        disabled={isSubmitting || !consent}
                        className={`flex items-center gap-2 font-bold py-3.5 px-8 rounded-2xl transition-all active:scale-95 text-white shadow-lg disabled:opacity-50 disabled:cursor-not-allowed ${
                          paymentMethod === 'WHATSAPP'
                            ? 'bg-[#25D366] hover:bg-[#20b857] shadow-green-200'
                            : 'bg-blue-600 hover:bg-blue-700 shadow-blue-200'
                        }`}
                      >
                        {isSubmitting ? (
                          <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Memproses...</>
                        ) : paymentMethod === 'WHATSAPP' ? (
                          <>💬 Kirim Pesanan via WA</>
                        ) : (
                          <>💳 Lanjut Pembayaran</>
                        )}
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* ── Right Panel: Order Summary (sticky) ── */}
          <div className="lg:sticky lg:top-28 h-fit">
            <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-100 dark:border-zinc-800 shadow-sm p-6">
              <h3 className="font-serif text-lg font-bold text-zinc-900 dark:text-zinc-100 mb-4 pb-4 border-b border-zinc-100 dark:border-zinc-800">
                Ringkasan Pesanan
              </h3>

              <div className="space-y-2.5 mb-4">
                {cartItems.map((item, i) => (
                  <div key={`${item.productId}-${i}`} className="flex justify-between text-sm gap-2">
                    <div className="min-w-0">
                      <span className="text-zinc-700 dark:text-zinc-300 font-medium truncate block">{item.name}</span>
                      {item.toppingName && <span className="text-xs text-amber-500">+{item.toppingName}</span>}
                    </div>
                    <span className="text-zinc-800 dark:text-zinc-100 font-semibold shrink-0">{formatPrice(item.totalPrice)}</span>
                  </div>
                ))}
              </div>

              <div className="border-t border-zinc-100 dark:border-zinc-800 pt-4 space-y-2">
                <div className="flex justify-between text-sm text-zinc-500">
                  <span>Subtotal</span>
                  <span className="font-medium text-zinc-700 dark:text-zinc-300">{formatPrice(cartTotal)}</span>
                </div>
                {discount > 0 && (
                  <div className="flex justify-between text-sm text-green-600 font-semibold">
                    <span>Diskon</span>
                    <span>−{formatPrice(discount)}</span>
                  </div>
                )}
                {delivery === 'DELIVERY' && (
                  <div className="flex justify-between text-sm text-zinc-500">
                    <span>Ongkos Kirim</span>
                    <span className="font-medium text-zinc-700 dark:text-zinc-300">{deliveryFee > 0 ? formatPrice(deliveryFee) : 'Gratis'}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold text-zinc-900 dark:text-zinc-100 border-t border-zinc-100 dark:border-zinc-800 pt-3 text-lg">
                  <span>Total</span>
                  <span className="text-amber-600 font-serif">{formatPrice(grandTotal)}</span>
                </div>
              </div>

              {/* Security badge */}
              <div className="mt-4 flex items-center gap-2 text-xs text-zinc-400 bg-zinc-50 dark:bg-zinc-800/50 rounded-xl px-3 py-2.5">
                <span className="text-green-500 text-base">🔒</span>
                <span>Data Anda terenkripsi. Harga dikunci server, bebas manipulasi.</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
