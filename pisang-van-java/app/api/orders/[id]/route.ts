import { type NextRequest, NextResponse } from 'next/server'
import { logAudit } from '@/lib/audit'
import { sendWhatsAppNotification } from '@/lib/notifications'
import { prisma } from '@/lib/prisma'
import { orderStatusInputSchema, paymentFormInputSchema } from '@/src/features/checkout/schemas'
import { hasValidSameOriginHeaders, requireCheckoutActor } from '@/src/services/checkout.service'
import { sendOrderStatusEmail } from '@/src/features/payment/email'

interface OrderRouteContext {
  params: Promise<{
    id: string
  }>
}

const updateOrderStatusSchema = orderStatusInputSchema

export async function GET(_: NextRequest, { params }: OrderRouteContext) {
  const { id } = await params
  const actor = await requireCheckoutActor()
  if (actor === null) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  const STAFF_ROLES = ['ADMIN', 'SUPER_ADMIN', 'KITCHEN', 'CASHIER'] as const
  if (!actor || !STAFF_ROLES.includes(actor.role as (typeof STAFF_ROLES)[number])) {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
  }

  const parsedParams = paymentFormInputSchema.safeParse({ orderId: id })
  if (!parsedParams.success) {
    return NextResponse.json({ success: false, error: 'Invalid order' }, { status: 400 })
  }

  try {
    const order = await prisma.order.findUnique({
      where: { id: parsedParams.data.orderId },
      select: orderDetailSelect
    })

    if (order === null) {
      return NextResponse.json({ success: false, error: 'Order not found' }, { status: 404 })
    }

    return NextResponse.json({ success: true, data: order })
  } catch (error) {
    console.error('[SECURITY] Failed to read order.', error)
    return NextResponse.json({ success: false, error: 'Server error' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest, { params }: OrderRouteContext) {
  const { id } = await params
  const actor = await requireCheckoutActor()
  if (actor === null) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  const STAFF_ROLES = ['ADMIN', 'SUPER_ADMIN', 'KITCHEN', 'CASHIER'] as const
  if (!actor || !STAFF_ROLES.includes(actor.role as (typeof STAFF_ROLES)[number])) {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
  }

  if (!(await hasValidSameOriginHeaders())) {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
  }

  const parsedParams = paymentFormInputSchema.safeParse({ orderId: id })
  if (!parsedParams.success) {
    return NextResponse.json({ success: false, error: 'Invalid order' }, { status: 400 })
  }

  const payload = await readRequestJson(req)
  if (payload === null || typeof payload !== 'object' || Array.isArray(payload)) {
    return NextResponse.json({ success: false, error: 'Invalid request' }, { status: 400 })
  }

  const statusCandidate = 'status' in payload ? payload.status : undefined
  const parsedStatus = updateOrderStatusSchema.safeParse(statusCandidate)
  if (!parsedStatus.success) {
    return NextResponse.json({ success: false, error: 'Invalid status' }, { status: 400 })
  }

  try {
    const order = await prisma.$transaction(async (tx: any) => {
      // If transitioning to cancelled, we must restore stock exactly once.
      if (parsedStatus.data === 'CANCELED') {
        const orderWithItems = await tx.order.findUnique({
          where: { id: parsedParams.data.orderId },
          include: { items: true }
        })

        if (orderWithItems && orderWithItems.status !== 'CANCELED') {
          for (const item of orderWithItems.items) {
            await tx.menuVariant.updateMany({
              where: { id: item.variantId },
              data: { stock: { increment: item.quantity } }
            })
          }
        }
      }

      // If transitioning to COMPLETED, process referral bonus
      if (parsedStatus.data === 'COMPLETED') {
        const orderInfo = await tx.order.findUnique({
          where: { id: parsedParams.data.orderId },
          select: { userId: true, status: true }
        })

        if (orderInfo && orderInfo.userId && orderInfo.status !== 'COMPLETED') {
          const userObj = await tx.user.findUnique({
            where: { id: orderInfo.userId },
            select: { hasOrdered: true, referredBy: true }
          })

          if (userObj && !userObj.hasOrdered) {
            await tx.user.update({
              where: { id: orderInfo.userId },
              data: { hasOrdered: true }
            })

            if (userObj.referredBy) {
              const referrer = await tx.user.findUnique({
                where: { referralCode: userObj.referredBy }
              })
              if (referrer) {
                await tx.user.update({
                  where: { id: referrer.id },
                  data: { koinPisang: { increment: 5000 } }
                })
                await tx.koinPisangLog.create({
                  data: {
                    userId: referrer.id,
                    amount: 5000,
                    description: `Bonus Referral (Teman Anda #${orderInfo.userId.slice(-6).toUpperCase()} melakukan order pertama)`
                  }
                })
              }
            }
          }
        }
      }

      return tx.order.update({
        where: { id: parsedParams.data.orderId },
        data: { status: parsedStatus.data },
        select: {
          id: true,
          customerName: true,
          customerPhone: true,
          status: true
        }
      })
    })

    await logAudit('UPDATE_ORDER_STATUS', 'Order', order.id, { newStatus: parsedStatus.data })

    if (
      parsedStatus.data === 'PROCESSING' ||
      parsedStatus.data === 'READY' ||
      parsedStatus.data === 'CANCELED'
    ) {
      await sendWhatsAppNotification(
        order.customerPhone,
        order.customerName,
        parsedStatus.data,
        order.id
      )
    }

    // Send email notification about status change (asynchronously)
    if (
      parsedStatus.data === 'PROCESSING' ||
      parsedStatus.data === 'READY' ||
      parsedStatus.data === 'COMPLETED' ||
      parsedStatus.data === 'CANCELED'
    ) {
      sendOrderStatusEmail(order.id, parsedStatus.data).catch((err) =>
        console.error('[EMAIL] Failed to send order status email', err)
      )
    }

    return NextResponse.json({
      success: true,
      data: {
        id: order.id,
        status: order.status
      }
    })
  } catch (error) {
    console.error('[SECURITY] Failed to update order.', error)
    return NextResponse.json({ success: false, error: 'Server error' }, { status: 500 })
  }
}

export async function DELETE(_: NextRequest, { params }: OrderRouteContext) {
  const { id } = await params
  const actor = await requireCheckoutActor()
  if (actor === null) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  if (actor.role !== 'ADMIN' && actor.role !== 'SUPER_ADMIN') {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
  }

  if (!(await hasValidSameOriginHeaders())) {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
  }

  const parsedParams = paymentFormInputSchema.safeParse({ orderId: id })
  if (!parsedParams.success) {
    return NextResponse.json({ success: false, error: 'Invalid order' }, { status: 400 })
  }

  try {
    await prisma.order.delete({
      where: { id: parsedParams.data.orderId }
    })

    await logAudit('DELETE_ORDER', 'Order', parsedParams.data.orderId)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[SECURITY] Failed to delete order.', error)
    return NextResponse.json({ success: false, error: 'Server error' }, { status: 500 })
  }
}

const orderDetailSelect = {
  id: true,
  customerName: true,
  customerPhone: true,
  totalPrice: true,
  status: true,
  notes: true,
  source: true,
  voucherCode: true,
  discountAmount: true,
  deliveryMethod: true,
  deliveryFee: true,
  createdAt: true,
  items: {
    select: {
      id: true,
      baseType: true,
      quantity: true,
      unitPrice: true,
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

async function readRequestJson(req: NextRequest): Promise<unknown | null> {
  try {
    return await req.json()
  } catch {
    return null
  }
}
