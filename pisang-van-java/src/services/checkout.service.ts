import { OrderStatus, Prisma } from '@prisma/client'
import { Ratelimit } from '@upstash/ratelimit'
import { headers } from 'next/headers'
import { prisma } from '@/lib/prisma'
import { redis } from '@/lib/redis'
import { auth } from '@/src/auth'
import { createPendingPayment } from '@/src/features/payment/payment.service'
import { generateSnapToken } from '@/src/features/payment/service'
import {
  CheckoutActor,
  CheckoutSecurityError,
  CreateCheckoutOrderResult,
  CreateOrderInput,
  PaymentOrderView,
  ValidateVoucherInput,
  VoucherValidationResult,
  checkoutActorSchema
} from '@/src/features/checkout/schemas'
import {
  executeCheckoutTransaction,
  evaluateVoucher,
  formatPrice,
  normalizeNullableText
} from '@/src/repositories/checkout.repository'

const voucherRateLimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(5, '1 m'),
  analytics: true,
  prefix: 'ratelimit_checkout_voucher'
})

const checkoutRateLimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(8, '10 m'),
  analytics: true,
  prefix: 'ratelimit_checkout_order'
})

const paymentRateLimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(5, '5 m'),
  analytics: true,
  prefix: 'ratelimit_checkout_payment'
})

export async function requireCheckoutActor(): Promise<CheckoutActor | null> {
  const session = await auth()
  if (!session?.user) {
    console.error(
      '[SECURITY] requireCheckoutActor: session or session.user is null/undefined',
      session
    )
    return null
  }

  const role = session.user.role || 'CUSTOMER'

  const parsed = checkoutActorSchema.safeParse({
    userId: session.user.id || '',
    role: role,
    email: session.user.email ?? null
  })

  if (!parsed.success) {
    console.error(
      '[SECURITY] requireCheckoutActor parsing failed',
      parsed.error.issues,
      'User data:',
      { id: session.user.id, role: session.user.role, email: session.user.email }
    )
    return null
  }

  return {
    userId: parsed.data.userId,
    role: parsed.data.role,
    email: parsed.data.email
  }
}

export async function hasValidSameOriginHeaders(): Promise<boolean> {
  const headerStore = await headers()
  const origin = headerStore.get('origin')
  const referer = headerStore.get('referer')
  const host = headerStore.get('x-forwarded-host') || headerStore.get('host')

  if (!host) {
    console.warn('[SECURITY] Same-origin check failed: host header is missing')
    return false
  }

  const cleanHost = host.split(':')[0]

  if (origin !== null && origin !== 'null' && origin !== undefined) {
    try {
      const originUrl = new URL(origin)
      if (originUrl.hostname === cleanHost) {
        return true
      }
    } catch (e) {
      console.warn('[SECURITY] Same-origin check: failed to parse origin URL', origin, e)
    }
  }

  if (referer !== null && referer !== undefined) {
    try {
      const refererUrl = new URL(referer)
      if (refererUrl.hostname === cleanHost) {
        return true
      }
    } catch (e) {
      console.warn('[SECURITY] Same-origin check: failed to parse referer URL', referer, e)
    }
  }

  console.warn('[SECURITY] Same-origin check failed. Headers: ', {
    origin,
    referer,
    host,
    cleanHost
  })
  return false
}

export async function getRateLimitIdentifier(scope: string, actor: CheckoutActor): Promise<string> {
  const headerStore = await headers()
  const forwardedFor = headerStore.get('x-forwarded-for')
  const clientIp = forwardedFor?.split(',')[0]?.trim()
  const networkPart = clientIp && clientIp.length > 0 ? clientIp : 'unknown'
  return `${scope}:${actor.userId}:${networkPart}`
}

export async function enforceCheckoutRateLimit(actor: CheckoutActor): Promise<boolean> {
  const identifier = await getRateLimitIdentifier('order', actor)
  return isRateAllowed(checkoutRateLimit, identifier)
}

export async function enforcePaymentRateLimit(actor: CheckoutActor): Promise<boolean> {
  const identifier = await getRateLimitIdentifier('payment', actor)
  return isRateAllowed(paymentRateLimit, identifier)
}

export async function enforceIdempotency(key: string, actor: CheckoutActor): Promise<boolean> {
  try {
    const redisKey = `idempotency:checkout:${actor.userId}:${key}`
    const result = await redis.set(redisKey, '1', { nx: true, ex: 60 })
    return result === 'OK'
  } catch (error) {
    // [STRATEGI FAIL-OPEN]
    // Jika Redis down, kita mengembalikan `true` agar checkout tetap bisa berjalan.
    // Risiko: Idempotency protection hilang sementara, namun sistem masih dilindungi
    // oleh OCC stock lock di Prisma yang mencegah oversell. Ini adalah trade-off
    // sadar untuk memprioritaskan availability (ketersediaan) di atas strict consistency.
    console.error('[SECURITY] Redis idempotency check failed, failing open', error)
    return true
  }
}

async function isRateAllowed(limiter: Ratelimit, identifier: string): Promise<boolean> {
  try {
    const result = await limiter.limit(identifier)
    return result.success
  } catch (error) {
    console.warn(
      '[SECURITY] Rate limiter unavailable; failing open. Identifier:',
      identifier,
      'Error:',
      error instanceof Error ? error.message : 'unknown'
    )
    return true
  }
}

export async function validateVoucherForActor(
  input: ValidateVoucherInput,
  actor: CheckoutActor
): Promise<VoucherValidationResult> {
  const identifier = await getRateLimitIdentifier('voucher', actor)
  const allowed = await isRateAllowed(voucherRateLimit, identifier)
  if (!allowed) {
    return {
      success: false,
      error: 'Terlalu banyak percobaan voucher. Silakan coba lagi nanti.'
    }
  }

  const voucher = await prisma.voucher.findUnique({
    where: { code: input.code },
    select: {
      id: true,
      code: true,
      isActive: true,
      startDate: true,
      endDate: true,
      usageLimit: true,
      usedCount: true,
      minPurchase: true,
      applicableTo: true,
      discountType: true,
      discountValue: true,
      maxDiscount: true
    }
  })

  const application = evaluateVoucher(voucher as any, input.cartTotal, actor.role)
  if (application === null) {
    return {
      success: false,
      error: 'Voucher tidak dapat digunakan untuk pesanan ini.'
    }
  }

  return {
    success: true,
    data: {
      code: application.code,
      discountAmount: application.discountAmount,
      message: `Voucher diterapkan. Diskon Rp ${application.discountAmount.toLocaleString('id-ID')}.`
    }
  }
}

export async function createCheckoutOrder(
  input: CreateOrderInput,
  actor: CheckoutActor
): Promise<CreateCheckoutOrderResult> {
  const deliveryFee = await resolveDeliveryFeeOutsideTx(input.deliveryMethod)

  const result = await executeCheckoutTransaction(input, actor, deliveryFee, prisma)

  try {
    await redis.del(`user:cart:${actor.userId}`)
  } catch (redisError) {
    console.error('[SECURITY] Failed to invalidate cart cache in Redis:', redisError)
  }

  if (input.paymentMethod === 'ONLINE') {
    if (result.totalPrice === 0) {
      await prisma.order.update({
        where: { id: result.orderId },
        data: {
          status: OrderStatus.PROCESSING,
          confirmedAt: new Date()
        }
      })

      await createPendingPayment({
        orderId: result.orderId,
        midtransOrderId: result.orderId,
        grossAmount: new Prisma.Decimal(0)
      })

      await prisma.payment.update({
        where: { orderId: result.orderId },
        data: {
          status: 'PAID',
          paymentType: 'koin_pisang',
          settlementTime: new Date()
        }
      })

      return {
        orderId: result.orderId,
        redirectType: 'CASHLESS_SUCCESS',
        redirectUrl: `/profile/pesanan`,
        totalPrice: 0
      }
    }

    const midtransItems = result.preparedItems!.map((item: any) => ({
      id: item.variantId,
      price: item.unitPrice,
      quantity: item.quantity,
      name: item.name
    }))

    if (result.deliveryFee! > 0) {
      midtransItems.push({
        id: 'delivery-fee',
        price: result.deliveryFee,
        quantity: 1,
        name: 'Ongkos Kirim'
      })
    }

    if (result.discountAmount! > 0) {
      midtransItems.push({
        id: 'discount',
        price: -result.discountAmount!,
        quantity: 1,
        name: input.voucherCode ? `Diskon (${input.voucherCode})` : 'Diskon Koin'
      })
    }

    const snapToken = await generateSnapToken({
      orderId: result.orderId,
      grossAmount: result.totalPrice,
      customerName: input.customerName,
      customerPhone: input.customerPhone,
      items: midtransItems
    })

    if (snapToken) {
      await prisma.order.update({
        where: { id: result.orderId },
        data: { midtransToken: snapToken }
      })

      await createPendingPayment({
        orderId: result.orderId,
        midtransOrderId: result.orderId,
        grossAmount: new Prisma.Decimal(result.totalPrice)
      })
    }

    return {
      orderId: result.orderId,
      redirectType: 'PAYMENT',
      redirectUrl: `/payment/${result.orderId}`,
      totalPrice: result.totalPrice
    }
  }

  const whatsappNumber = await resolveWhatsAppNumber()
  if (whatsappNumber === null) {
    throw new CheckoutSecurityError(500)
  }

  const message = buildWhatsAppMessage({
    orderId: result.orderId,
    customerName: input.customerName,
    customerPhone: input.customerPhone,
    deliveryMethod: input.deliveryMethod,
    notes: normalizeNullableText(input.notes),
    subtotal: result.subtotal!,
    discountAmount: result.discountAmount!,
    deliveryFee: result.deliveryFee!,
    totalPrice: result.totalPrice,
    voucherCode: input.voucherCode ?? null,
    itemLines: result.preparedItems!.map((item: any) => item.whatsappLine)
  })

  return {
    orderId: result.orderId,
    redirectType: 'WHATSAPP',
    redirectUrl: `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(message)}`,
    totalPrice: result.totalPrice
  }
}

export async function getPaymentOrderForActor(
  orderId: string,
  actor: CheckoutActor
): Promise<PaymentOrderView | null> {
  return prisma.order.findFirst({
    where: {
      id: orderId,
      userId: actor.userId,
      source: 'online'
    },
    select: {
      id: true,
      customerName: true,
      customerPhone: true,
      totalPrice: true,
      status: true,
      source: true,
      midtransToken: true,
      voucherCode: true,
      discountAmount: true,
      deliveryMethod: true,
      deliveryFee: true,
      createdAt: true,
      items: {
        select: {
          id: true,
          quantity: true,
          baseType: true,
          subtotal: true,
          variant: {
            select: {
              flavorName: true
            }
          },
          toppings: {
            select: {
              name: true,
              emoji: true
            }
          }
        }
      }
    }
  }) as unknown as Promise<PaymentOrderView | null>
}

export async function processPaymentForActor(
  orderId: string,
  actor: CheckoutActor
): Promise<boolean> {
  const allowed = await enforcePaymentRateLimit(actor)
  if (!allowed) {
    return false
  }

  const updateResult = await prisma.order.updateMany({
    where: {
      id: orderId,
      userId: actor.userId,
      source: 'online',
      status: OrderStatus.PENDING_PAYMENT
    },
    data: {
      status: OrderStatus.PROCESSING
    }
  })

  return updateResult.count === 1
}

async function resolveDeliveryFeeOutsideTx(
  deliveryMethod: CreateOrderInput['deliveryMethod']
): Promise<number> {
  if (deliveryMethod === 'PICKUP') {
    return 0
  }

  const setting = await prisma.siteSetting.findUnique({
    where: { key: 'store_delivery_fee' },
    select: { value: true }
  })

  if (setting === null) {
    console.warn('[SECURITY] store_delivery_fee not found in SiteSetting, failing open to 0')
    return 0
  }

  const deliveryFee = parseCurrencySetting(setting.value)
  if (deliveryFee === null) {
    console.warn('[SECURITY] invalid store_delivery_fee in SiteSetting, failing open to 0')
    return 0
  }

  return deliveryFee
}

async function resolveWhatsAppNumber(): Promise<string | null> {
  const settings = await prisma.siteSetting.findMany({
    where: {
      key: {
        in: ['kontak_whatsapp', 'nomor_wa']
      }
    },
    select: {
      key: true,
      value: true
    }
  })

  const orderedKeys = ['kontak_whatsapp', 'nomor_wa']
  for (const key of orderedKeys) {
    const setting = settings.find((candidate: any) => candidate.key === key)
    const value = setting?.value.trim()
    if (value !== undefined && /^62[1-9][0-9]{7,14}$/.test(value)) {
      return value
    }
  }

  return null
}

function parseCurrencySetting(value: string): number | null {
  const trimmed = value.trim()
  if (!/^[0-9]{1,9}$/.test(trimmed)) {
    return null
  }

  const parsed = Number(trimmed)
  if (!Number.isSafeInteger(parsed) || parsed < 0 || parsed > 100_000_000) {
    return null
  }

  return parsed
}

function buildWhatsAppMessage(input: {
  orderId: string
  customerName: string
  customerPhone: string
  deliveryMethod: CreateOrderInput['deliveryMethod']
  notes: string | null
  subtotal: number
  discountAmount: number
  deliveryFee: number
  totalPrice: number
  voucherCode: string | null
  itemLines: string[]
}): string {
  const shortOrderId = input.orderId.length > 6 ? input.orderId.slice(-6) : input.orderId
  let message = `Halo Pisang Goreng Van Java, saya ingin melakukan pemesanan (Order ID: #${shortOrderId}):\n\n`
  message += `Nama: ${input.customerName}\n`
  message += `No HP: ${input.customerPhone}\n`
  message += `Metode: ${input.deliveryMethod}\n\n`
  message += input.itemLines.join('\n')
  message += '\nRingkasan Pembayaran:\n'
  message += `Total Pesanan: ${formatPrice(input.subtotal)}\n`
  if (input.voucherCode !== null && input.discountAmount > 0) {
    message += `Diskon Voucher (${input.voucherCode}): -${formatPrice(input.discountAmount)}\n`
  }
  if (input.deliveryMethod === 'DELIVERY' && input.deliveryFee > 0) {
    message += `Ongkos Kirim: ${formatPrice(input.deliveryFee)}\n`
  }
  message += `Total Akhir: ${formatPrice(input.totalPrice)}\n`

  if (input.notes !== null) {
    message += `\nCatatan/Alamat: ${input.notes}\n`
  }

  return message
}
