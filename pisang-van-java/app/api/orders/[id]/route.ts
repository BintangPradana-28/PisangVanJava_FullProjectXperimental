import { type OrderStatus, Prisma } from '@prisma/client'
import { type NextRequest, NextResponse } from 'next/server'
import { logAudit } from '@/lib/audit'
import { prisma } from '@/lib/prisma'
import {
  ALLOWED_STATUS_TRANSITIONS,
  deliveryUpdateSchema,
  orderStatusInputSchema,
  paymentFormInputSchema
} from '@/src/features/checkout/schemas'
import { inngest } from '@/src/lib/inngest'
import { hasValidSameOriginHeaders, requireCheckoutActor } from '@/src/services/checkout.service'

interface OrderRouteContext {
  params: Promise<{
    id: string
  }>
}

const _updateOrderStatusSchema = orderStatusInputSchema

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

  const parsedBody = deliveryUpdateSchema.safeParse(payload)
  if (!parsedBody.success) {
    return NextResponse.json(
      { success: false, error: 'Invalid fields', details: parsedBody.error.format() },
      { status: 400 }
    )
  }

  const orderId = parsedParams.data.orderId

  try {
    const currentOrder = await prisma.order.findUnique({
      where: { id: orderId },
      select: {
        status: true,
        deliveryMethod: true,
        courierName: true,
        courierPhone: true,
        etaMinutes: true,
        proofPhotoUrl: true
      }
    })

    if (!currentOrder) {
      return NextResponse.json({ success: false, error: 'Order not found' }, { status: 404 })
    }

    const { status, courierPhone, etaMinutes, proofPhotoUrl, tipAmount } = parsedBody.data

    // Status transition validation
    if (status && status !== currentOrder.status) {
      const allowedTransitions =
        ALLOWED_STATUS_TRANSITIONS[currentOrder.status as OrderStatus] || []
      if (!allowedTransitions.includes(status as OrderStatus)) {
        return NextResponse.json(
          {
            success: false,
            error: `Invalid status transition from ${currentOrder.status} to ${status}`
          },
          { status: 400 }
        )
      }

      // Delivery-only status restrictions
      if (
        (status === 'OUT_FOR_DELIVERY' || status === 'DELIVERED') &&
        currentOrder.deliveryMethod !== 'DELIVERY'
      ) {
        return NextResponse.json(
          {
            success: false,
            error: 'Cannot set delivery status for non-delivery order'
          },
          { status: 400 }
        )
      }
    }

    // Delivery status requirements validation
    const targetStatus = status || currentOrder.status
    if (targetStatus === 'OUT_FOR_DELIVERY') {
      const activePhone = courierPhone !== undefined ? courierPhone : currentOrder.courierPhone
      const activeEta = etaMinutes !== undefined ? etaMinutes : currentOrder.etaMinutes
      if (!activePhone || activeEta === null || activeEta === undefined) {
        return NextResponse.json(
          {
            success: false,
            error: 'courierPhone and etaMinutes are required when order is OUT_FOR_DELIVERY'
          },
          { status: 400 }
        )
      }
    }

    if (targetStatus === 'DELIVERED') {
      const activeProof = proofPhotoUrl !== undefined ? proofPhotoUrl : currentOrder.proofPhotoUrl
      if (!activeProof) {
        return NextResponse.json(
          {
            success: false,
            error: 'proofPhotoUrl is required when order is DELIVERED'
          },
          { status: 400 }
        )
      }
    }

    const order = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      // If transitioning to cancelled, we must restore stock exactly once.
      if (status === 'CANCELED') {
        const orderWithItems = await tx.order.findUnique({
          where: { id: orderId },
          include: { items: true }
        })

        if (orderWithItems && orderWithItems.status !== 'CANCELED') {
          // RAG Source: app/api/orders/[id]/route.ts (prevent N+1 queries by batching DB updates via Promise.all)
          await Promise.all(
            orderWithItems.items
              .filter((item) => item.variantId)
              .map((item) =>
                tx.menuVariant.updateMany({
                  where: { id: item.variantId! },
                  data: { stock: { increment: item.quantity } }
                })
              )
          )
        }
      }

      // If transitioning to COMPLETED, process referral bonus
      if (status === 'COMPLETED') {
        const orderInfo = await tx.order.findUnique({
          where: { id: orderId },
          select: { userId: true, status: true }
        })

        if (orderInfo?.userId && orderInfo.status !== 'COMPLETED') {
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

      const updateData: Record<string, any> = {}
      if (status) updateData.status = status
      if (courierPhone !== undefined) updateData.courierPhone = courierPhone
      if (etaMinutes !== undefined) updateData.etaMinutes = etaMinutes
      if (proofPhotoUrl !== undefined) updateData.proofPhotoUrl = proofPhotoUrl
      if (tipAmount !== undefined) updateData.tipAmount = tipAmount

      return tx.order.update({
        where: {
          id: orderId,
          status: currentOrder.status
        },
        data: updateData,
        select: {
          id: true,
          userId: true,
          customerName: true,
          customerPhone: true,
          status: true,
          courierName: true,
          courierPhone: true,
          etaMinutes: true
        }
      })
    })

    await logAudit('UPDATE_ORDER_STATUS', 'Order', order.id, {
      oldStatus: currentOrder.status,
      newStatus: order.status,
      fieldsUpdated: Object.keys(parsedBody.data)
    })

    if (
      order.status === 'PROCESSING' ||
      order.status === 'READY' ||
      order.status === 'OUT_FOR_DELIVERY' ||
      order.status === 'DELIVERED' ||
      order.status === 'COMPLETED' ||
      order.status === 'CANCELED'
    ) {
      inngest
        .send({
          name: 'order/status.changed',
          data: {
            orderId: order.id,
            status: order.status
          }
        })
        .catch((err) =>
          console.error('[INNGEST ERROR] Failed to dispatch order status change event', err)
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
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
      return NextResponse.json(
        {
          success: false,
          error: 'Pesanan telah diubah oleh transaksi lain. Silakan muat ulang halaman.'
        },
        { status: 409 }
      )
    }
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
  biteshipOrderId: true,
  waybillId: true,
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
