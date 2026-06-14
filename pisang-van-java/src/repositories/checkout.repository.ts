import { OrderStatus, Prisma } from '@prisma/client'
import DOMPurify from '@/lib/sanitize'
import {
  BaseType,
  CheckoutActor,
  CheckoutRole,
  CheckoutSecurityError,
  CreateCheckoutOrderResult,
  CreateOrderInput,
  PreparedOrderItem,
  ToppingRecord,
  VariantRecord,
  VoucherApplication,
  VoucherRecord
} from '@/src/features/checkout/schemas'

const voucherSelect = {
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
} satisfies Prisma.VoucherSelect

export async function executeCheckoutTransaction(
  input: CreateOrderInput,
  actor: CheckoutActor,
  deliveryFee: number,
  prismaClient: any
): Promise<CreateCheckoutOrderResult> {
  const result = await prismaClient.$transaction(
    async (tx: Prisma.TransactionClient) => {
      const variantIds = Array.from(new Set(input.items.map((item) => item.variantId)))
      const toppingIds = Array.from(new Set(input.items.flatMap((item) => item.toppingIds)))

      const variants = await tx.menuVariant.findMany({
        where: { id: { in: variantIds } },
        select: {
          id: true,
          flavorName: true,
          priceKembung: true,
          priceLumpia: true,
          priceKrispy: true,
          wholesaleKembung: true,
          wholesaleLumpia: true,
          wholesaleKrispy: true,
          isActive: true,
          isAvailable: true,
          isDeleted: true,
          stock: true,
          version: true
        }
      })

      const toppings = await tx.topping.findMany({
        where: { id: { in: toppingIds } },
        select: {
          id: true,
          name: true,
          price: true,
          emoji: true,
          isActive: true
        }
      })

      const variantById = new Map<string, VariantRecord>(
        variants.map((variant) => [variant.id, variant])
      )
      const toppingById = new Map<string, ToppingRecord>(
        toppings.map((topping) => [topping.id, topping])
      )
      const preparedItems: PreparedOrderItem[] = []
      let subtotal = 0

      for (const item of input.items) {
        const variant = variantById.get(item.variantId)
        if (
          variant === undefined ||
          !variant.isActive ||
          !variant.isAvailable ||
          variant.isDeleted ||
          variant.stock < item.quantity
        ) {
          throw new CheckoutSecurityError(400)
        }

        const itemToppings: ToppingRecord[] = []
        for (const tId of item.toppingIds) {
          const selectedTopping = toppingById.get(tId)
          if (selectedTopping === undefined || !selectedTopping.isActive) {
            throw new CheckoutSecurityError(400)
          }
          itemToppings.push(selectedTopping)
        }

        const basePrice = selectBasePrice(variant, item.baseType, actor.role)
        const toppingPrice = itemToppings.reduce((sum, t) => sum + t.price, 0)
        const unitPrice = basePrice + toppingPrice
        const itemSubtotal = unitPrice * item.quantity
        const notes = normalizeNullableText(item.notes)
        subtotal += itemSubtotal

        preparedItems.push({
          variantId: item.variantId,
          toppingIds: item.toppingIds,
          baseType: item.baseType,
          quantity: item.quantity,
          unitPrice,
          subtotal: itemSubtotal,
          name: `${variant.flavorName} (${item.baseType})${itemToppings.length > 0 ? ` + ${itemToppings.map((t) => t.name).join(', ')}` : ''}`,
          whatsappLine: buildWhatsAppItemLine(
            variant.flavorName,
            item.baseType,
            item.quantity,
            itemToppings,
            itemSubtotal,
            notes
          )
        })
      }

      let discountAmount = 0
      let voucherApplication = null
      let pointsToUse = 0

      if (input.voucherCode) {
        voucherApplication = await resolveVoucherApplication(
          input.voucherCode,
          subtotal,
          actor.role,
          tx
        )
        discountAmount = voucherApplication?.discountAmount ?? 0
      } else if (input.usePoints) {
        const userRecord = await tx.user.findUnique({
          where: { id: actor.userId },
          select: { koinPisang: true }
        })
        if (userRecord && userRecord.koinPisang > 0) {
          const maxDiscount = subtotal + deliveryFee
          pointsToUse = Math.min(userRecord.koinPisang, maxDiscount)
          discountAmount = pointsToUse
        }
      }

      const totalPrice = subtotal - discountAmount + deliveryFee

      if (!Number.isSafeInteger(totalPrice) || totalPrice < 0) {
        throw new CheckoutSecurityError(400)
      }

      const earnedPoints = Math.floor(totalPrice * 0.01)
      const netPointChange = earnedPoints - pointsToUse

      if (netPointChange !== 0) {
        const updateResult = await tx.user.updateMany({
          where: {
            id: actor.userId,
            ...(pointsToUse > 0 ? { koinPisang: { gte: pointsToUse } } : {})
          },
          data: {
            koinPisang:
              netPointChange >= 0
                ? { increment: netPointChange }
                : { decrement: Math.abs(netPointChange) }
          }
        })
        if (updateResult.count === 0) {
          throw new CheckoutSecurityError(409)
        }
      }

      if (voucherApplication !== null) {
        const voucherUpdate = await tx.voucher.updateMany({
          where: {
            id: voucherApplication.voucherId,
            OR: [{ usageLimit: 0 }, { usedCount: { lt: voucherApplication.usageLimit } }]
          },
          data: {
            usedCount: {
              increment: 1
            }
          }
        })

        if (voucherUpdate.count !== 1) {
          throw new CheckoutSecurityError(409)
        }
      }

      const variantQuantities = new Map<string, number>()
      for (const item of input.items) {
        variantQuantities.set(
          item.variantId,
          (variantQuantities.get(item.variantId) || 0) + item.quantity
        )
      }

      for (const [variantId, totalQuantity] of Array.from(variantQuantities.entries())) {
        const variant = variantById.get(variantId)!
        const updateResult = await tx.menuVariant.updateMany({
          where: {
            id: variantId,
            version: variant.version,
            stock: { gte: totalQuantity }
          },
          data: {
            stock: { decrement: totalQuantity },
            version: { increment: 1 }
          }
        })

        if (updateResult.count === 0) {
          throw new CheckoutSecurityError(409)
        }
      }

      const source = input.paymentMethod === 'ONLINE' ? 'online' : 'whatsapp'
      const order = await tx.order.create({
        data: {
          userId: actor.userId,
          customerName: DOMPurify.sanitize(input.customerName),
          customerPhone: input.customerPhone,
          totalPrice,
          status: OrderStatus.PENDING_PAYMENT,
          notes: normalizeNullableText(input.notes)
            ? DOMPurify.sanitize(normalizeNullableText(input.notes) as string)
            : null,
          source,
          voucherCode: voucherApplication?.code ?? null,
          discountAmount,
          deliveryMethod: input.deliveryMethod,
          deliveryFee,
          items: {
            create: preparedItems.map((item) => ({
              variantId: item.variantId,
              toppings:
                item.toppingIds.length > 0
                  ? { connect: item.toppingIds.map((id) => ({ id })) }
                  : undefined,
              baseType: item.baseType,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              subtotal: item.subtotal
            }))
          }
        },
        select: {
          id: true,
          totalPrice: true
        }
      })

      await tx.userCart.updateMany({
        where: {
          userId: actor.userId
        },
        data: {
          items: []
        }
      })

      if (netPointChange !== 0) {
        await tx.koinPisangLog.create({
          data: {
            userId: actor.userId,
            amount: netPointChange,
            description: `Pembelian order #${order.id.slice(-6).toUpperCase()} (Dapat: +${earnedPoints}, Tukar: -${pointsToUse})`
          }
        })
      }

      return {
        orderId: order.id,
        source,
        totalPrice: order.totalPrice,
        subtotal,
        discountAmount,
        deliveryFee,
        preparedItems,
        redirectType: 'PAYMENT', // Dummy default, will be overridden by service
        redirectUrl: ''
      }
    },
    {
      timeout: 15000,
      maxWait: 5000
    }
  )

  return result as CreateCheckoutOrderResult
}

export function normalizeNullableText(value: string | null | undefined): string | null {
  if (value === undefined || value === null || value.length === 0) {
    return null
  }
  return value
}

export function evaluateVoucher(
  voucher: VoucherRecord | null,
  cartTotal: number,
  role: CheckoutRole
): VoucherApplication | null {
  if (voucher === null || !voucher.isActive) {
    return null
  }

  if (
    !Number.isSafeInteger(voucher.usageLimit) ||
    voucher.usageLimit < 0 ||
    !Number.isSafeInteger(voucher.usedCount) ||
    voucher.usedCount < 0 ||
    !Number.isFinite(voucher.minPurchase) ||
    voucher.minPurchase < 0
  ) {
    return null
  }

  const now = new Date()
  if (now < voucher.startDate || now > voucher.endDate) {
    return null
  }

  if (voucher.usageLimit > 0 && voucher.usedCount >= voucher.usageLimit) {
    return null
  }

  if (cartTotal < voucher.minPurchase) {
    return null
  }

  if (voucher.applicableTo !== 'ALL' && voucher.applicableTo !== role) {
    return null
  }

  const discountAmount = calculateDiscount(voucher, cartTotal)
  if (discountAmount === null) {
    return null
  }

  return {
    voucherId: voucher.id,
    code: voucher.code,
    discountAmount,
    usageLimit: voucher.usageLimit
  }
}

export function calculateDiscount(voucher: VoucherRecord, cartTotal: number): number | null {
  if (!Number.isFinite(voucher.discountValue) || voucher.discountValue <= 0) {
    return null
  }

  if (
    voucher.maxDiscount !== null &&
    (!Number.isFinite(voucher.maxDiscount) || voucher.maxDiscount < 0)
  ) {
    return null
  }

  if (voucher.discountType === 'FIXED') {
    return Math.min(cartTotal, Math.floor(voucher.discountValue))
  }

  if (voucher.discountType === 'PERCENTAGE') {
    if (voucher.discountValue > 100) {
      return null
    }

    const uncappedDiscount = Math.floor(cartTotal * (voucher.discountValue / 100))
    const cappedDiscount =
      voucher.maxDiscount === null
        ? uncappedDiscount
        : Math.min(uncappedDiscount, voucher.maxDiscount)
    return Math.min(cartTotal, Math.floor(cappedDiscount))
  }

  return null
}

export function selectBasePrice(variant: VariantRecord, baseType: BaseType, role: CheckoutRole): number {
  if (baseType === 'lumpia') {
    return role === 'RESELLER' && variant.wholesaleLumpia > 0
      ? variant.wholesaleLumpia
      : variant.priceLumpia
  }

  if (baseType === 'krispy') {
    return role === 'RESELLER' && variant.wholesaleKrispy > 0
      ? variant.wholesaleKrispy
      : variant.priceKrispy
  }

  return role === 'RESELLER' && variant.wholesaleKembung > 0
    ? variant.wholesaleKembung
    : variant.priceKembung
}

export async function resolveVoucherApplication(
  voucherCode: string | null | undefined,
  subtotal: number,
  role: CheckoutRole,
  tx: Prisma.TransactionClient
): Promise<VoucherApplication | null> {
  if (voucherCode === undefined || voucherCode === null) {
    return null
  }

  const voucher = await tx.voucher.findUnique({
    where: { code: voucherCode },
    select: voucherSelect
  })

  const application = evaluateVoucher(voucher, subtotal, role)
  if (application === null) {
    throw new CheckoutSecurityError(400)
  }

  return application
}

export function buildWhatsAppItemLine(
  flavorName: string,
  baseType: BaseType,
  quantity: number,
  toppings: ToppingRecord[],
  subtotal: number,
  notes: string | null
): string {
  let line = `- ${quantity}x ${flavorName} (${baseType})\n`
  if (toppings.length > 0) {
    line += `  Topping: ${toppings.map((t) => t.name).join(', ')}\n`
  }
  if (notes !== null) {
    line += `  Catatan: "${notes}"\n`
  }
  line += `  Subtotal: ${formatPrice(subtotal)}\n`
  return line
}

export function formatPrice(amount: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0
  }).format(amount)
}
