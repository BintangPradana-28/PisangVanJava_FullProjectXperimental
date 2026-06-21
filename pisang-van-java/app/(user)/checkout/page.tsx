'use client'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery } from '@tanstack/react-query'
import { AnimatePresence, motion } from 'framer-motion'
import { Loader2 } from 'lucide-react'
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

const MapPicker = dynamic(() => import('@/components/user/MapPicker'), {
  ssr: false,
  // PERF: loading fallback added so the chunk-fetch gap isn't a blank space —
  // height matches MapPicker's own internal h-[320px] mount-skeleton so there's
  // no layout shift between this fallback and the component's first paint.
  loading: () => (
    <div className="w-full h-[320px] bg-zinc-100 dark:bg-zinc-800 animate-pulse rounded-[4px] flex flex-col items-center justify-center gap-3">
      <Loader2 className="w-8 h-8 animate-spin text-zinc-400" />
      <span className="text-sm text-zinc-500 font-medium">Memuat Peta...</span>
    </div>
  )
})

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
        ? `${isManualAddress
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
                className={`w-8 h-8 rounded-[4px] text-xs font-bold flex items-center justify-center transition-all ${i === step
                    ? 'bg-amber-500 text-white shadow-sm shadow-amber-200'
                    : i < step
                      ? 'bg-amber-100 text-amber-700 cursor-pointer hover:bg-amber-200'
                      : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-400'
                  }`}
              >
                {i < step ? '✓' : i + 1}
              </button>
              <span
                className={`text-xs font-semibold hidden sm:block ${i === step ? 'text-amber-700 dark:text-amber-400' : 'text-zinc-400'
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