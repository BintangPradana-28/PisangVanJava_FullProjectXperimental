'use server'

import { redirect } from 'next/navigation'

import {
  paymentFormInputSchema,
  type VoucherValidationResult,
  validateVoucherInputSchema
} from '@/src/features/checkout/schemas'
import {
  getPaymentOrderForActor,
  hasValidSameOriginHeaders,
  processPaymentForActor,
  requireCheckoutActor,
  validateVoucherForActor
} from '@/src/services/checkout.service'

export async function validateVoucher(
  rawCode: string,
  rawCartTotal: number
): Promise<VoucherValidationResult> {
  const actor = await requireCheckoutActor()
  if (actor === null) {
    return {
      success: false,
      error: 'Sesi pelanggan diperlukan untuk memakai voucher.'
    }
  }

  if (!(await hasValidSameOriginHeaders())) {
    return {
      success: false,
      error: 'Permintaan voucher ditolak.'
    }
  }

  const parsed = validateVoucherInputSchema.safeParse({
    code: rawCode,
    cartTotal: rawCartTotal
  })

  if (!parsed.success) {
    return {
      success: false,
      error: 'Voucher tidak dapat digunakan untuk pesanan ini.'
    }
  }

  return validateVoucherForActor(parsed.data, actor)
}

export async function processPayment(rawFormData: FormData): Promise<void> {
  const actor = await requireCheckoutActor()
  if (actor === null) {
    redirect('/member-login')
  }

  if (!(await hasValidSameOriginHeaders())) {
    redirect('/track-order?payment=failed')
  }

  const parsed = paymentFormInputSchema.safeParse({
    orderId: rawFormData.get('orderId')
  })

  if (!parsed.success) {
    redirect('/track-order?payment=failed')
  }

  const processed = await processPaymentForActor(parsed.data.orderId, actor)
  if (!processed) {
    redirect(`/payment/${parsed.data.orderId}?payment=failed`)
  }

  redirect('/track-order?payment=success')
}

export async function getShippingRates(
  lat: number,
  lng: number
): Promise<{ success: boolean; data?: any; error?: string }> {
  try {
    const actor = await requireCheckoutActor()
    if (actor === null) {
      return { success: false, error: 'Sesi pelanggan diperlukan.' }
    }

    if (!(await hasValidSameOriginHeaders())) {
      return { success: false, error: 'Permintaan ditolak.' }
    }

    // Load user cart
    const { redis } = await import('@/lib/redis')
    const { prisma } = await import('@/lib/prisma')
    const { getCachedShippingRates } = await import('@/src/services/shipping.service')

    const redisKey = `user:cart:${actor.userId}`
    let items: any[] = []

    const cachedCart = await redis.get(redisKey)
    if (cachedCart) {
      items = typeof cachedCart === 'string' ? JSON.parse(cachedCart) : (cachedCart as any[])
    } else {
      const userCart = await prisma.userCart.findUnique({
        where: { userId: actor.userId }
      })
      items = (userCart?.items as any[]) || []
    }

    if (items.length === 0) {
      return { success: false, error: 'Keranjang belanja kosong.' }
    }

    const mappedItems = items.map((item: any) => {
      const toppingsPrice = item.toppings
        ? item.toppings.reduce((sum: number, t: any) => sum + (t.priceAdd || 0), 0)
        : 0
      return {
        name: item.variantName || 'Pisang Goreng',
        quantity: item.quantity || 1,
        price: (item.basePrice || 0) + toppingsPrice
      }
    })

    const rates = await getCachedShippingRates({
      destinationLat: lat,
      destinationLng: lng,
      items: mappedItems
    })

    return { success: true, data: rates }
  } catch (error: any) {
    console.error('[SHIPPING_ACTION_ERROR]', error)
    return { success: false, error: error?.message || 'Gagal menghitung ongkos kirim.' }
  }
}

export async function getOrderSummary(orderId: string) {
  const actor = await requireCheckoutActor()
  const parsed = paymentFormInputSchema.safeParse({ orderId })
  if (!parsed.success) {
    return { success: false, error: 'Order ID tidak valid' }
  }
  const order = await getPaymentOrderForActor(parsed.data.orderId, actor)
  if (!order) {
    return { success: false, error: 'Pesanan tidak ditemukan' }
  }
  return { success: true, data: order }
}
