'use client'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery } from '@tanstack/react-query'
import { AnimatePresence, motion } from 'framer-motion'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { FetchError } from 'ofetch'
// app/(user)/checkout/page.tsx — Dedicated Checkout Page
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import toast from 'react-hot-toast'
import { z } from 'zod'
import { useSettings } from '@/context/SettingsContext'
import { selectCartDisplayTotal, useCartStore } from '@/src/features/cart/stores/cart.store'
import { getShippingRates, validateVoucher } from '@/src/features/checkout/actions'
import { api } from '@/src/lib/api'
import { isStoreOpen } from '@/src/lib/time'

const MapPicker = dynamic(() => import('@/components/user/MapPicker'), { ssr: false })

// ── Response Schema ─────────────────────────────────────────────────────────
const orderResponseSchema = z.discriminatedUnion('success', [
  z.object({
    success: z.literal(true),
    data: z.object({
      orderId: z.string(),
      redirectType: z.enum(['WHATSAPP', 'PAYMENT', 'CASHLESS_SUCCESS']),
      redirectUrl: z.string().min(1),
      totalPrice: z.number().finite().int().min(0)
    })
  }),
  z.object({
    success: z.literal(false),
    error: z.string()
  })
])

type DeliveryMethod = 'DELIVERY' | 'PICKUP'
type PaymentMethod = 'WHATSAPP' | 'ONLINE'
type BaseType = 'kembung' | 'lumpia' | 'krispy'

interface AppliedVoucher {
  code: string
  discountAmount: number
}

interface UserAddress {
  id: string
  label: string
  fullAddress: string
  isDefault: boolean
  notes?: string | null
}

function resolveBaseType(nameOrType?: string): BaseType | null {
  if (!nameOrType) return null
  const n = nameOrType.trim().toLowerCase()
  if (n === 'kembung' || n === 'lumpia' || n === 'krispy') return n
  const match = nameOrType.match(/\((Kembung|Lumpia|Krispy|kembung|lumpia|krispy)\)$/)
  if (match) return match[1].toLowerCase() as BaseType
  return null
}

const formatPrice = (n: number) =>
  new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0
  }).format(n)

// ── Step indicator ──────────────────────────────────────────────────────────
const STEPS = ['Keranjang', 'Detail', 'Konfirmasi']

export default function CheckoutPage() {
  const router = useRouter()
  const { data: session, status: authStatus } = useSession()
  const cartItems = useCartStore((s) => s.items)
  const clearCart = useCartStore((s) => s.clearCart)
  const cartTotal = useCartStore(selectCartDisplayTotal)
  const { getSetting } = useSettings()

  // Form state
  const [step, setStep] = useState(0) // 0=review, 1=form, 2=confirm
  const {
    register,
    trigger,
    watch,
    setValue,
    formState: { errors }
  } = useForm({
    resolver: zodResolver(
      z.object({
        customerName: z
          .string()
          .trim()
          .min(3, 'Nama minimal 3 karakter')
          .max(60, 'Nama maksimal 60 karakter')
          .regex(/^[A-Za-z\s]+$/, 'Hanya huruf yang diperbolehkan'),
        customerPhone: z
          .string()
          .trim()
          .regex(/^(\+62|62|0)8[1-9][0-9]{6,10}$/, 'Format nomor tidak valid (contoh: 081234...)')
      })
    ),
    mode: 'onChange',
    defaultValues: { customerName: '', customerPhone: '' }
  })
  const customerName = watch('customerName') || ''
  const customerPhone = watch('customerPhone') || ''

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Auto-Format: Remove non-digits except a leading +
    const val = e.target.value.replace(/(?!^\+)[^\d]/g, '')
    setValue('customerPhone', val, { shouldValidate: true })
  }
  const [delivery, setDelivery] = useState<DeliveryMethod>('PICKUP')
  const [address, setAddress] = useState('')
  const [pickupTime, setPickupTime] = useState('')
  const [notes, setNotes] = useState('')
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('WHATSAPP')
  const [voucherCode, setVoucherCode] = useState('')
  const [appliedVoucher, setAppliedVoucher] = useState<AppliedVoucher | null>(null)
  const [koinPisang, setKoinPisang] = useState(0)
  const [usePoints, setUsePoints] = useState(false)
  const [isValidating, setIsValidating] = useState(false)
  const [consent, setConsent] = useState(false)

  // Address state
  const [addresses, setAddresses] = useState<UserAddress[]>([])
  const [selectedAddressId, setSelectedAddressId] = useState<string>('')
  const [isManualAddress, setIsManualAddress] = useState(false)

  // Shipping & Pinpoint Map state
  const [coordinates, setCoordinates] = useState<[number, number] | null>(null)
  const [shippingRates, setShippingRates] = useState<any[]>([])
  const [selectedRate, setSelectedRate] = useState<any | null>(null)
  const [isLoadingRates, setIsLoadingRates] = useState(false)
  const [addressNameFromMap, setAddressNameFromMap] = useState('')

  const { data: profileResponse } = useQuery({
    queryKey: ['profile'],
    queryFn: () => api<{ success: boolean; data?: any }>('/api/user/profile'),
    enabled: authStatus === 'authenticated',
    staleTime: 60 * 1000
  })

  const { data: addressesResponse, isError: addressesError } = useQuery({
    queryKey: ['addresses'],
    queryFn: () => api<{ success: boolean; data?: UserAddress[] }>('/api/user/addresses'),
    enabled: authStatus === 'authenticated',
    staleTime: 60 * 1000
  })

  // Hydrate user data from session
  useEffect(() => {
    if (session?.user?.name) setValue('customerName', session.user.name, { shouldValidate: true })
    if (profileResponse?.success && profileResponse.data) {
      if (profileResponse.data.phone)
        setValue('customerPhone', profileResponse.data.phone, { shouldValidate: true })
      if (profileResponse.data.koinPisang !== undefined)
        setKoinPisang(profileResponse.data.koinPisang)
    }
  }, [session, profileResponse])

  useEffect(() => {
    if (addressesResponse?.success && addressesResponse.data) {
      setAddresses(addressesResponse.data)
      const defaultAddr = addressesResponse.data.find((a) => a.isDefault)
      if (defaultAddr) setSelectedAddressId(defaultAddr.id)
      else if (addressesResponse.data.length > 0) setSelectedAddressId(addressesResponse.data[0].id)
      else setIsManualAddress(true)
    }
  }, [addressesResponse])

  useEffect(() => {
    if (authStatus === 'unauthenticated' || addressesError) {
      setIsManualAddress(true)
    }
  }, [authStatus, addressesError])

  // Reset voucher when cart changes
  useEffect(() => {
    setAppliedVoucher(null)
  }, [cartTotal])

  // Guard: empty cart
  useEffect(() => {
    if (authStatus === 'authenticated' && cartItems.length === 0) {
      toast('Keranjang kosong, yuk pilih menu dulu!', { icon: '🛒' })
      router.push('/menu-spesial')
    }
  }, [cartItems.length, authStatus, router])

  // Geocode saved address when selected
  useEffect(() => {
    if (delivery === 'DELIVERY' && !isManualAddress && selectedAddressId && addresses.length > 0) {
      const selected = addresses.find((a) => a.id === selectedAddressId)
      if (selected) {
        setIsLoadingRates(true)
        fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(selected.fullAddress)}&countrycodes=id&limit=1`
        )
          .then((res) => res.json())
          .then((data) => {
            if (data && data.length > 0) {
              const lat = parseFloat(data[0].lat)
              const lon = parseFloat(data[0].lon)
              setCoordinates([lat, lon])
            } else {
              toast.error(
                'Alamat tersimpan tidak ditemukan di peta. Silakan pinpoint lokasi manual.'
              )
              setIsManualAddress(true)
            }
          })
          .catch((err) => {
            console.error('Geocoding Error:', err)
            setIsManualAddress(true)
          })
          .finally(() => setIsLoadingRates(false))
      }
    }
  }, [selectedAddressId, isManualAddress, delivery, addresses])

  // Fetch shipping rates when coordinates change
  useEffect(() => {
    if (coordinates) {
      setIsLoadingRates(true)
      getShippingRates(coordinates[0], coordinates[1])
        .then((res) => {
          if (res.success && res.data) {
            setShippingRates(res.data)
            if (res.data.length > 0) {
              // Select cheapest rate by default
              const sorted = [...res.data].sort((a, b) => a.price - b.price)
              setSelectedRate(sorted[0])
            } else {
              setShippingRates([])
              setSelectedRate(null)
              toast.error('Lokasi Anda di luar jangkauan pengiriman kami (Maksimal 40km).')
            }
          } else {
            toast.error(res.error || 'Gagal mengambil tarif pengiriman.')
          }
        })
        .catch((err) => {
          console.error(err)
          toast.error('Gagal memuat ongkos kirim.')
        })
        .finally(() => setIsLoadingRates(false))
    }
  }, [coordinates])

  // Reset shipping when changing delivery method
  useEffect(() => {
    if (delivery === 'PICKUP') {
      setCoordinates(null)
      setShippingRates([])
      setSelectedRate(null)
    }
  }, [delivery])

  const deliveryFeeSetting = getSetting('store_delivery_fee', '0')
  const baseDeliveryFee = /^[0-9]{1,9}$/.test(deliveryFeeSetting) ? Number(deliveryFeeSetting) : 0
  const deliveryFee = delivery === 'DELIVERY' ? (selectedRate ? selectedRate.price : 0) : 0
  const pointsToUse = usePoints ? Math.min(koinPisang, cartTotal + deliveryFee) : 0
  const discount = usePoints ? pointsToUse : (appliedVoucher?.discountAmount ?? 0)
  const grandTotal = Math.max(cartTotal + deliveryFee - discount, 0)

  const jamOperasional = getSetting('jam_operasional', '10.00–21.00')
  const storeMode = getSetting('store_status', 'AUTO')
  const storeStatus = isStoreOpen(jamOperasional, storeMode)

  // ── Voucher handler ───────────────────────────────────────────────────────
  const handleApplyVoucher = async () => {
    const code = voucherCode.trim()
    if (!code) {
      toast.error('Masukkan kode promo')
      return
    }
    setIsValidating(true)
    try {
      const result = await validateVoucher(code, cartTotal)
      if (!result.success) {
        setAppliedVoucher(null)
        toast.error(result.error)
        return
      }
      setAppliedVoucher({ code: result.data.code, discountAmount: result.data.discountAmount })
      setVoucherCode(result.data.code)
      toast.success(result.data.message)
    } catch {
      toast.error('Gagal memvalidasi voucher')
    } finally {
      setIsValidating(false)
    }
  }

  // ── Step 1 → Step 2 Validated Transition (THE GATEKEEPER) ──────────────
  const handleNextToConfirm = async () => {
    const isRHFValid = await trigger()
    if (!isRHFValid) {
      toast.error('Periksa kembali isian form Anda')
      return
    }

    if (delivery === 'DELIVERY') {
      if (isManualAddress && !address.trim()) {
        toast.error('Alamat pengiriman wajib diisi')
        return
      }
      if (!isManualAddress && !selectedAddressId) {
        toast.error('Pilih alamat pengiriman terlebih dahulu')
        return
      }
      if (!coordinates) {
        toast.error('Silakan tentukan lokasi pengiriman Anda pada peta terlebih dahulu')
        return
      }
      if (!selectedRate) {
        toast.error('Silakan pilih kurir pengiriman terlebih dahulu')
        return
      }
    }
    if (delivery === 'PICKUP' && !pickupTime.trim()) {
      toast.error('Waktu pengambilan wajib diisi')
      return
    }
    // All valid → advance
    setStep(2)
  }

  const checkoutMutation = useMutation({
    mutationFn: async (payload: any) => {
      const json = await api<unknown>('/api/orders', {
        method: 'POST',
        body: payload
      })

      const parsed = orderResponseSchema.safeParse(json)
      if (!parsed.success || !parsed.data.success) {
        throw new Error(
          parsed.success && !parsed.data.success ? parsed.data.error : 'Checkout ditolak server'
        )
      }
      return parsed.data.data
    },
    retry: 0,
    onSuccess: (data) => {
      const { redirectType, redirectUrl } = data

      if (redirectType === 'WHATSAPP') {
        if (!redirectUrl.startsWith('https://wa.me/')) {
          toast.error('URL checkout tidak valid')
          return
        }
        clearCart()
        toast.success('Pesanan berhasil! Lanjutkan di WhatsApp 💬')
        window.open(redirectUrl, '_blank', 'noopener,noreferrer')
        router.push('/track-order')
      } else if (redirectType === 'CASHLESS_SUCCESS') {
        clearCart()
        toast.success('Pesanan berhasil dengan Koin Pisang! ✅')
        router.push(redirectUrl)
      } else {
        if (!redirectUrl.startsWith('/payment/')) {
          toast.error('URL pembayaran tidak valid')
          return
        }
        clearCart()
        router.push(redirectUrl)
      }
    },
    onError: (error: FetchError | Error) => {
      const msg =
        error instanceof FetchError ? error.data?.error || 'Checkout ditolak server' : error.message
      toast.error(msg)
    }
  })

  // ── Submit (Idempotent — locked after first press) ────────────────────────
  const handleSubmit = () => {
    if (checkoutMutation.isPending) return // IDEMPOTENCY GUARD: reject re-entry
    if (!consent) {
      toast.error('Setujui kebijakan privasi terlebih dahulu')
      return
    }

    const items = cartItems
      .map((item) => {
        const baseType = resolveBaseType(item.variantName)
        if (!baseType) return null
        return {
          variantId: item.menuVariantId,
          toppingIds: item.toppings ? item.toppings.map((t: any) => t.toppingId) : [],
          baseType,
          quantity: item.quantity,
          notes: item.notes?.trim() || null
        }
      })
      .filter(Boolean)

    if (items.length !== cartItems.length) {
      toast.error('Ada item lama yang tidak valid. Tambahkan ulang dari menu.')
      return
    }

    const finalAddress =
      delivery === 'DELIVERY'
        ? `${
            isManualAddress
              ? address.trim()
              : (
                  () => {
                    const sel = addresses.find((a) => a.id === selectedAddressId)
                    return sel
                      ? `${sel.fullAddress} ${sel.notes ? `(Catatan: ${sel.notes})` : ''}`.trim()
                      : ''
                  }
                )()
          } | Kurir: ${selectedRate?.courierName} ${selectedRate?.serviceName} (Rp ${selectedRate?.price})`
        : [pickupTime ? `Waktu Ambil: ${pickupTime}` : null, notes.trim()]
            .filter(Boolean)
            .join(' | ') || null

    // Generasikan UUID valid untuk idempotencyKey
    const idempotencyKey = crypto.randomUUID()

    checkoutMutation.mutate({
      idempotencyKey,
      customerName: customerName.trim(),
      customerPhone: customerPhone.trim(),
      deliveryMethod: delivery,
      paymentMethod,
      notes: finalAddress,
      voucherCode: usePoints ? null : (appliedVoucher?.code ?? null),
      usePoints,
      deliveryCoordinates: coordinates ? `${coordinates[0]},${coordinates[1]}` : null,
      courierCode: selectedRate?.courierCode || null,
      courierService: selectedRate?.serviceCode || null,
      items
    })
  }

  if (authStatus === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-950">
        <div className="w-10 h-10 rounded-full border-4 border-amber-500 border-t-transparent animate-spin" />
      </div>
    )
  }

  if (!storeStatus.isOpen) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-950 p-4">
        <div className="bg-white dark:bg-zinc-900 rounded-[4px] border border-zinc-100 dark:border-zinc-800 shadow-sm p-8 text-center max-w-md">
          <div className="text-5xl mb-4">🏪</div>
          <h2 className="font-serif text-2xl font-bold text-zinc-900 dark:text-zinc-100 mb-2">
            Kedai Tutup
          </h2>
          <p className="text-zinc-500 mb-6">{storeStatus.message}</p>
          <Link
            href="/menu-spesial"
            className="bg-amber-500 hover:bg-amber-600 text-white font-bold py-3 px-8 rounded-[4px] transition-all shadow-md shadow-amber-200"
          >
            Kembali ke Menu
          </Link>
        </div>
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
                className={`w-8 h-8 rounded-[4px] text-xs font-bold flex items-center justify-center transition-all ${
                  i === step
                    ? 'bg-amber-500 text-white shadow-sm shadow-amber-200'
                    : i < step
                      ? 'bg-amber-100 text-amber-700 cursor-pointer hover:bg-amber-200'
                      : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-400'
                }`}
              >
                {i < step ? '✓' : i + 1}
              </button>
              <span
                className={`text-xs font-semibold hidden sm:block ${
                  i === step ? 'text-amber-700 dark:text-amber-400' : 'text-zinc-400'
                }`}
              >
                {label}
              </span>
              {i < STEPS.length - 1 && (
                <div
                  className={`w-8 h-0.5 ${i < step ? 'bg-amber-400' : 'bg-zinc-200 dark:bg-zinc-800'}`}
                />
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
                <motion.div
                  key="step0"
                  initial={{ opacity: 0, x: -16 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 16 }}
                >
                  <div className="bg-white dark:bg-zinc-900 rounded-[4px] border border-zinc-100 dark:border-zinc-800 shadow-sm p-6">
                    <h2 className="font-serif text-xl font-bold text-zinc-900 dark:text-zinc-100 mb-4">
                      🛒 Periksa Pesanan Anda
                    </h2>
                    <div className="space-y-3">
                      {cartItems.map((item, i) => {
                        const itemTotal =
                          (item.basePrice +
                            (item.toppings
                              ? item.toppings.reduce((sum: number, t: any) => sum + t.priceAdd, 0)
                              : 0)) *
                          item.quantity
                        return (
                          <div
                            key={`${item.cartItemId}`}
                            className="flex justify-between items-start py-3 border-b border-zinc-50 dark:border-zinc-800 last:border-0"
                          >
                            <div>
                              <p className="text-sm font-bold text-zinc-800 dark:text-zinc-100">
                                {item.variantName}
                              </p>
                              {item.toppings && item.toppings.length > 0 && (
                                <p className="text-xs text-amber-600 mt-0.5">
                                  + {item.toppings.map((t: any) => t.name).join(', ')}
                                </p>
                              )}
                              {item.notes && (
                                <p className="text-xs text-zinc-400 italic mt-0.5">
                                  "{item.notes}"
                                </p>
                              )}
                            </div>
                            <div className="text-right ml-4 shrink-0">
                              <p className="text-sm font-bold text-zinc-800 dark:text-zinc-100">
                                {formatPrice(itemTotal)}
                              </p>
                              <p className="text-xs text-zinc-400">×{item.quantity}</p>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                    <div className="mt-4 flex justify-between items-center">
                      <Link
                        href="/menu-spesial"
                        className="text-xs text-amber-600 font-semibold hover:underline"
                      >
                        ← Tambah item
                      </Link>
                      <button
                        onClick={() => setStep(1)}
                        className="bg-amber-500 hover:bg-amber-600 text-white font-bold py-3 px-8 rounded-[4px] transition-all active:scale-95 shadow-md shadow-amber-200"
                      >
                        Lanjut →
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* STEP 1: Customer Form */}
              {step === 1 && (
                <motion.div
                  key="step1"
                  initial={{ opacity: 0, x: -16 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 16 }}
                >
                  <div className="bg-white dark:bg-zinc-900 rounded-[4px] border border-zinc-100 dark:border-zinc-800 shadow-sm p-6 space-y-5">
                    <h2 className="font-serif text-xl font-bold text-zinc-900 dark:text-zinc-100">
                      👤 Data Pemesan
                    </h2>

                    <div>
                      <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-1.5">
                        Nama Lengkap *
                      </label>
                      <input
                        type="text"
                        {...register('customerName')}
                        placeholder="Nama Anda..."
                        className={`w-full px-4 py-3 rounded-[4px] border ${errors.customerName ? 'border-red-400 focus:ring-red-400' : 'border-zinc-200 dark:border-zinc-700 focus:ring-amber-400'} bg-zinc-50 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-100 text-sm focus:outline-none focus:ring-2 transition-all`}
                      />
                      {errors.customerName && (
                        <p className="text-xs text-red-500 font-semibold mt-1">
                          {errors.customerName.message as string}
                        </p>
                      )}
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-1.5">
                        Nomor WhatsApp *
                      </label>
                      <input
                        type="tel"
                        {...register('customerPhone', { onChange: handlePhoneChange })}
                        placeholder="Contoh: 081234567890"
                        className={`w-full px-4 py-3 rounded-[4px] border ${errors.customerPhone ? 'border-red-400 focus:ring-red-400' : 'border-zinc-200 dark:border-zinc-700 focus:ring-amber-400'} bg-zinc-50 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-100 text-sm focus:outline-none focus:ring-2 transition-all`}
                      />
                      {errors.customerPhone && (
                        <p className="text-xs text-red-500 font-semibold mt-1">
                          {errors.customerPhone.message as string}
                        </p>
                      )}
                    </div>

                    {/* Delivery Method */}
                    <div>
                      <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2">
                        Metode Pengambilan
                      </label>
                      <div className="grid grid-cols-2 gap-3">
                        {[
                          {
                            value: 'PICKUP' as DeliveryMethod,
                            icon: '🏪',
                            label: 'Ambil Sendiri',
                            sub: 'Gratis'
                          },
                          {
                            value: 'DELIVERY' as DeliveryMethod,
                            icon: '🛵',
                            label: 'Diantar',
                            sub: deliveryFee > 0 ? `+${formatPrice(deliveryFee)}` : 'Gratis'
                          }
                        ].map((opt) => (
                          <button
                            key={opt.value}
                            type="button"
                            onClick={() => setDelivery(opt.value)}
                            className={`py-4 px-4 rounded-[4px] border-2 text-left transition-all ${
                              delivery === opt.value
                                ? 'border-amber-400 bg-amber-50 dark:bg-amber-900/20'
                                : 'border-zinc-200 dark:border-zinc-700 hover:border-zinc-300'
                            }`}
                          >
                            <div className="text-2xl mb-1">{opt.icon}</div>
                            <div className="font-bold text-sm text-zinc-800 dark:text-zinc-100">
                              {opt.label}
                            </div>
                            <div className="text-xs text-zinc-400 mt-0.5">{opt.sub}</div>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Address / Notes / Pickup Time */}
                    {delivery === 'PICKUP' && (
                      <div className="space-y-5">
                        <div>
                          <label
                            htmlFor="pickup-time-input"
                            className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-1.5"
                          >
                            Waktu Pengambilan *
                          </label>
                          <input
                            id="pickup-time-input"
                            type="time"
                            value={pickupTime}
                            onChange={(e) => setPickupTime(e.target.value)}
                            className="w-full px-4 py-3 rounded-[4px] border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-100 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 transition-all"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-1.5">
                            Catatan (Opsional)
                          </label>
                          <textarea
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            placeholder="Catatan untuk penjual..."
                            rows={2}
                            className="w-full px-4 py-3 rounded-[4px] border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-100 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 transition-all resize-none"
                          />
                        </div>
                      </div>
                    )}

                    {delivery === 'DELIVERY' && (
                      <div className="space-y-4">
                        <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider">
                          Alamat Pengiriman Lengkap *
                        </label>

                        {authStatus === 'authenticated' &&
                        addresses.length > 0 &&
                        !isManualAddress ? (
                          <div className="space-y-3">
                            <div className="grid gap-2">
                              {addresses.map((addr) => (
                                <button
                                  key={addr.id}
                                  type="button"
                                  onClick={() => setSelectedAddressId(addr.id)}
                                  className={`text-left p-4 rounded-[4px] border-2 transition-all ${
                                    selectedAddressId === addr.id
                                      ? 'border-amber-400 bg-amber-50 dark:bg-amber-900/20'
                                      : 'border-zinc-200 dark:border-zinc-700 hover:border-zinc-300 dark:hover:border-zinc-600 bg-zinc-50 dark:bg-zinc-800'
                                  }`}
                                >
                                  <div className="flex items-center justify-between mb-1">
                                    <span className="font-bold text-sm text-zinc-800 dark:text-zinc-100">
                                      {addr.label}
                                    </span>
                                    {addr.isDefault && (
                                      <span className="text-[10px] font-bold bg-amber-200 text-amber-800 px-2 py-0.5 rounded-[4px]">
                                        Utama
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-xs text-zinc-600 dark:text-zinc-400 line-clamp-2">
                                    {addr.fullAddress}
                                  </p>
                                  {addr.notes && (
                                    <p className="text-xs text-zinc-500 italic mt-1">
                                      Catatan: {addr.notes}
                                    </p>
                                  )}
                                </button>
                              ))}
                            </div>
                            <button
                              type="button"
                              onClick={() => setIsManualAddress(true)}
                              className="text-xs font-bold text-amber-600 hover:text-amber-700 underline"
                            >
                              + Tulis Alamat Baru Secara Manual
                            </button>
                          </div>
                        ) : (
                          <div className="space-y-3">
                            <textarea
                              value={address}
                              onChange={(e) => setAddress(e.target.value)}
                              placeholder="Jl. Contoh No.1, RT/RW, Kelurahan, Kecamatan, Kota..."
                              rows={3}
                              className="w-full px-4 py-3 rounded-[4px] border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-100 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 transition-all resize-none"
                            />
                            {authStatus === 'authenticated' && addresses.length > 0 && (
                              <button
                                type="button"
                                onClick={() => setIsManualAddress(false)}
                                className="text-xs font-bold text-amber-600 hover:text-amber-700 underline"
                              >
                                ← Kembali Pilih Alamat Tersimpan
                              </button>
                            )}
                          </div>
                        )}

                        {/* Pinpoint Lokasi (Peta) */}
                        <div className="space-y-2 pt-2">
                          <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider">
                            Tentukan Titik Pengiriman (Peta) *
                          </label>
                          <MapPicker
                            position={coordinates}
                            setPosition={(pos) => setCoordinates(pos)}
                            setAddressName={(name) => {
                              setAddressNameFromMap(name)
                              setAddress(name)
                            }}
                          />
                        </div>

                        {/* Kurir Pengiriman Section */}
                        {isLoadingRates ? (
                          <div className="space-y-2 py-2">
                            <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider">
                              Kurir Pengiriman
                            </label>
                            <div className="w-full h-20 bg-zinc-100 dark:bg-zinc-800 animate-pulse rounded-[4px] flex items-center justify-center text-zinc-400 text-xs">
                              Menghitung tarif pengiriman...
                            </div>
                          </div>
                        ) : shippingRates.length > 0 ? (
                          <div className="space-y-2 py-2">
                            <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider animate-fadeIn">
                              Pilih Kurir Pengiriman *
                            </label>
                            <div className="grid gap-2">
                              {shippingRates.map((rate) => {
                                const isSelected =
                                  selectedRate?.courierCode === rate.courierCode &&
                                  selectedRate?.serviceCode === rate.serviceCode
                                return (
                                  <button
                                    key={`${rate.courierCode}-${rate.serviceCode}`}
                                    type="button"
                                    onClick={() => setSelectedRate(rate)}
                                    className={`flex items-center justify-between p-3.5 rounded-[4px] border-2 text-left transition-all ${
                                      isSelected
                                        ? 'border-amber-400 bg-amber-50 dark:bg-amber-900/20'
                                        : 'border-zinc-200 dark:border-zinc-700 hover:border-zinc-300 dark:hover:border-zinc-600 bg-zinc-50 dark:bg-zinc-800'
                                    }`}
                                  >
                                    <div className="flex items-center gap-3">
                                      <span className="text-xl">🛵</span>
                                      <div>
                                        <div className="font-bold text-sm text-zinc-800 dark:text-zinc-100">
                                          {rate.courierName} ({rate.serviceName})
                                        </div>
                                        <div className="text-xs text-zinc-400 mt-0.5">
                                          Estimasi: {rate.etd}
                                        </div>
                                      </div>
                                    </div>
                                    <div className="text-right">
                                      <span className="font-serif text-sm font-bold text-amber-600 dark:text-amber-400">
                                        {formatPrice(rate.price)}
                                      </span>
                                    </div>
                                  </button>
                                )
                              })}
                            </div>
                          </div>
                        ) : coordinates ? (
                          <div className="text-xs text-red-500 bg-red-50 dark:bg-red-950/20 p-3 rounded-[4px] border border-red-200 dark:border-red-900/50">
                            ⚠️ Tidak ada layanan kurir instan yang menjangkau lokasi Anda. Silakan
                            pilih lokasi pinpoint yang lebih dekat atau ubah ke Ambil Sendiri.
                          </div>
                        ) : null}
                      </div>
                    )}

                    {/* Voucher & Poin */}
                    <div className="space-y-4">
                      {/* Poin Toggle */}
                      {koinPisang > 0 && (
                        <div className="flex items-center justify-between p-3 rounded-[4px] border border-amber-200 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-700/50">
                          <div className="flex items-center gap-3">
                            <div className="text-2xl">🪙</div>
                            <div>
                              <p className="font-bold text-sm text-zinc-800 dark:text-zinc-100">
                                Koin Pisang Anda
                              </p>
                              <p className="text-xs text-zinc-500">
                                Saldo: {formatPrice(koinPisang)}
                              </p>
                            </div>
                          </div>
                          <label
                            htmlFor="use-points-checkbox"
                            className="relative inline-flex items-center cursor-pointer"
                          >
                            <input
                              id="use-points-checkbox"
                              type="checkbox"
                              className="sr-only peer"
                              checked={usePoints}
                              onChange={(e) => {
                                setUsePoints(e.target.checked)
                                if (e.target.checked) {
                                  setAppliedVoucher(null)
                                  setVoucherCode('')
                                }
                              }}
                              aria-label="Gunakan Koin Pisang"
                            />
                            <div className="w-11 h-6 bg-zinc-200 peer-focus:outline-none rounded-[4px] peer dark:bg-zinc-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-[4px] after:h-5 after:w-5 after:transition-all dark:border-zinc-600 peer-checked:bg-amber-500"></div>
                          </label>
                        </div>
                      )}

                      {/* Voucher Input */}
                      <div className={usePoints ? 'opacity-50 pointer-events-none' : ''}>
                        <label
                          htmlFor="voucher-code-input"
                          className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-1.5"
                        >
                          Kode Promo
                        </label>
                        <div className="flex gap-2">
                          <input
                            id="voucher-code-input"
                            type="text"
                            value={voucherCode}
                            onChange={(e) => {
                              const v = e.target.value.toUpperCase()
                              setVoucherCode(v)
                              if (appliedVoucher && v !== appliedVoucher.code)
                                setAppliedVoucher(null)
                            }}
                            placeholder="KODE-PROMO"
                            className="flex-1 px-4 py-3 rounded-[4px] border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-100 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-amber-400 transition-all uppercase"
                          />
                          <button
                            type="button"
                            onClick={handleApplyVoucher}
                            disabled={isValidating || cartTotal <= 0}
                            className="px-5 py-3 rounded-[4px] bg-amber-100 text-amber-800 font-bold text-sm hover:bg-amber-200 disabled:opacity-50 transition-all"
                          >
                            {isValidating ? '...' : 'Pakai'}
                          </button>
                        </div>
                        {appliedVoucher && !usePoints && (
                          <p className="text-xs text-green-600 font-semibold mt-1.5">
                            ✅ Voucher {appliedVoucher.code} hemat{' '}
                            {formatPrice(appliedVoucher.discountAmount)}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Payment Method */}
                    <div>
                      <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2">
                        Metode Pembayaran
                      </label>
                      <div className="grid grid-cols-2 gap-3">
                        {[
                          {
                            value: 'WHATSAPP' as PaymentMethod,
                            icon: '💵',
                            label: 'COD',
                            sub: 'Konfirmasi manual'
                          },
                          {
                            value: 'ONLINE' as PaymentMethod,
                            icon: '💳',
                            label: 'Bayar Online',
                            sub: 'Simulasi gateway'
                          }
                        ].map((opt) => (
                          <button
                            key={opt.value}
                            type="button"
                            onClick={() => setPaymentMethod(opt.value)}
                            className={`py-4 px-4 rounded-[4px] border-2 text-left transition-all ${
                              paymentMethod === opt.value
                                ? 'border-amber-400 bg-amber-50 dark:bg-amber-900/20'
                                : 'border-zinc-200 dark:border-zinc-700 hover:border-zinc-300'
                            }`}
                          >
                            <div className="text-2xl mb-1">{opt.icon}</div>
                            <div className="font-bold text-sm text-zinc-800 dark:text-zinc-100">
                              {opt.label}
                            </div>
                            <div className="text-xs text-zinc-400 mt-0.5">{opt.sub}</div>
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="flex justify-between items-center pt-2">
                      <button
                        onClick={() => setStep(0)}
                        className="text-sm text-zinc-400 font-semibold hover:text-zinc-600"
                      >
                        ← Kembali
                      </button>
                      {/* VALIDATED TRANSITION — calls handleNextToConfirm, not setStep(2) directly */}
                      <button
                        onClick={handleNextToConfirm}
                        className="bg-amber-500 hover:bg-amber-600 text-white font-bold py-3 px-8 rounded-[4px] transition-all active:scale-95 shadow-md shadow-amber-200"
                      >
                        Review Pesanan →
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* STEP 2: Confirmation */}
              {step === 2 && (
                <motion.div
                  key="step2"
                  initial={{ opacity: 0, x: -16 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 16 }}
                >
                  <div className="bg-white dark:bg-zinc-900 rounded-[4px] border border-zinc-100 dark:border-zinc-800 shadow-sm p-6 space-y-5">
                    <h2 className="font-serif text-xl font-bold text-zinc-900 dark:text-zinc-100">
                      ✅ Konfirmasi Pesanan
                    </h2>

                    {/* Summary blocks */}
                    <div className="space-y-3">
                      <div className="bg-zinc-50 dark:bg-zinc-800/50 rounded-[4px] p-4 space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-zinc-500">Nama</span>
                          <span className="font-semibold text-zinc-800 dark:text-zinc-100">
                            {customerName}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-zinc-500">WhatsApp</span>
                          <span className="font-semibold text-zinc-800 dark:text-zinc-100">
                            {customerPhone}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-zinc-500">Pengiriman</span>
                          <span className="font-semibold text-zinc-800 dark:text-zinc-100">
                            {delivery === 'DELIVERY' ? '🛵 Delivery' : '🏪 Pickup'}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-zinc-500">Pembayaran</span>
                          <span className="font-semibold text-zinc-800 dark:text-zinc-100">
                            {paymentMethod === 'WHATSAPP' ? '💵 COD' : '💳 Online'}
                          </span>
                        </div>
                        {delivery === 'DELIVERY' && (
                          <div className="flex justify-between gap-4">
                            <span className="text-zinc-500 shrink-0">Alamat</span>
                            <span className="font-semibold text-zinc-800 dark:text-zinc-100 text-right">
                              {isManualAddress
                                ? address
                                : addresses.find((a) => a.id === selectedAddressId)?.fullAddress}
                            </span>
                          </div>
                        )}
                        {delivery === 'PICKUP' && pickupTime && (
                          <div className="flex justify-between gap-4">
                            <span className="text-zinc-500 shrink-0">Waktu Ambil</span>
                            <span className="font-semibold text-zinc-800 dark:text-zinc-100 text-right">
                              {pickupTime}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Promo info */}
                      {appliedVoucher && !usePoints && (
                        <div className="bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-900 rounded-[4px] px-4 py-3 text-sm text-green-700 dark:text-green-400 font-semibold">
                          🏷️ Voucher {appliedVoucher.code} — Hemat{' '}
                          {formatPrice(appliedVoucher.discountAmount)}
                        </div>
                      )}
                      {usePoints && pointsToUse > 0 && (
                        <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900 rounded-[4px] px-4 py-3 text-sm text-amber-700 dark:text-amber-400 font-semibold">
                          🪙 Tukar Koin — Hemat {formatPrice(pointsToUse)}
                        </div>
                      )}
                    </div>

                    {/* Privacy consent */}
                    <div className="flex items-start gap-3 bg-zinc-50 dark:bg-zinc-800/50 rounded-[4px] p-4">
                      <input
                        type="checkbox"
                        id="consent-check"
                        checked={consent}
                        onChange={(e) => setConsent(e.target.checked)}
                        className="mt-0.5 w-4 h-4 accent-amber-500 shrink-0 cursor-pointer"
                      />
                      <label
                        htmlFor="consent-check"
                        className="text-xs text-zinc-500 dark:text-zinc-400 cursor-pointer leading-relaxed"
                      >
                        Saya menyetujui bahwa data nama, nomor WhatsApp, dan alamat pengiriman saya
                        disimpan untuk keperluan pemesanan ini sesuai{' '}
                        <Link
                          href="/privacy"
                          className="text-amber-600 hover:underline font-semibold"
                        >
                          Kebijakan Privasi
                        </Link>
                        .
                      </label>
                    </div>

                    <div className="flex justify-between items-center gap-3">
                      <button
                        onClick={() => setStep(1)}
                        className="text-sm text-zinc-400 font-semibold hover:text-zinc-600"
                      >
                        ← Edit
                      </button>
                      <button
                        onClick={handleSubmit}
                        disabled={checkoutMutation.isPending || !consent}
                        className={`flex items-center gap-2 font-bold py-3.5 px-8 rounded-[4px] transition-all active:scale-95 text-white shadow-sm disabled:opacity-50 disabled:cursor-not-allowed ${
                          paymentMethod === 'WHATSAPP'
                            ? 'bg-[#25D366] hover:bg-[#20b857] shadow-green-200'
                            : 'bg-blue-600 hover:bg-blue-700 shadow-blue-200'
                        }`}
                      >
                        {checkoutMutation.isPending ? (
                          <>
                            <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />{' '}
                            Memproses...
                          </>
                        ) : paymentMethod === 'WHATSAPP' ? (
                          <>💵 Kirim Pesanan (COD)</>
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
            <div className="bg-white dark:bg-zinc-900 rounded-[4px] border border-zinc-100 dark:border-zinc-800 shadow-sm p-6">
              <h3 className="font-serif text-lg font-bold text-zinc-900 dark:text-zinc-100 mb-4 pb-4 border-b border-zinc-100 dark:border-zinc-800">
                Ringkasan Pesanan
              </h3>

              <div className="space-y-2.5 mb-4">
                {cartItems.map((item, i) => {
                  const itemTotal =
                    (item.basePrice +
                      (item.toppings
                        ? item.toppings.reduce((sum: number, t: any) => sum + t.priceAdd, 0)
                        : 0)) *
                    item.quantity
                  return (
                    <div key={`${item.cartItemId}`} className="flex justify-between text-sm gap-2">
                      <div className="min-w-0">
                        <span className="text-zinc-700 dark:text-zinc-300 font-medium truncate block">
                          {item.variantName}
                        </span>
                        {item.toppings && item.toppings.length > 0 && (
                          <span className="text-xs text-amber-500 block">
                            +{item.toppings.map((t: any) => t.name).join(', ')}
                          </span>
                        )}
                      </div>
                      <span className="text-zinc-800 dark:text-zinc-100 font-semibold shrink-0">
                        {formatPrice(itemTotal)}
                      </span>
                    </div>
                  )
                })}
              </div>

              <div className="border-t border-zinc-100 dark:border-zinc-800 pt-4 space-y-2">
                <div className="flex justify-between text-sm text-zinc-500">
                  <span>Subtotal</span>
                  <span className="font-medium text-zinc-700 dark:text-zinc-300">
                    {formatPrice(cartTotal)}
                  </span>
                </div>
                {discount > 0 && (
                  <div className="flex justify-between text-sm text-green-600 font-semibold">
                    <span>{usePoints ? 'Tukar Koin' : 'Diskon'}</span>
                    <span>−{formatPrice(discount)}</span>
                  </div>
                )}
                {delivery === 'DELIVERY' && (
                  <div className="flex justify-between text-sm text-zinc-500">
                    <span>Ongkos Kirim</span>
                    <span className="font-medium text-zinc-700 dark:text-zinc-300">
                      {deliveryFee > 0 ? formatPrice(deliveryFee) : 'Gratis'}
                    </span>
                  </div>
                )}
                <div className="flex justify-between font-bold text-zinc-900 dark:text-zinc-100 border-t border-zinc-100 dark:border-zinc-800 pt-3 text-lg">
                  <span>Total</span>
                  <span className="text-amber-600 font-serif">{formatPrice(grandTotal)}</span>
                </div>
              </div>

              {/* Security badge */}
              <div className="mt-4 flex items-center gap-2 text-xs text-zinc-400 bg-zinc-50 dark:bg-zinc-800/50 rounded-[4px] px-3 py-2.5">
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
