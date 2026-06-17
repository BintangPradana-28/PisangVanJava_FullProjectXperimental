import { type NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { prisma } from '@/lib/prisma'
import { paymentFormInputSchema } from '@/src/features/checkout/schemas'
import { authorizeOrderReadForActor, requireCheckoutActor } from '@/src/services/checkout.service'

// RAG Source: prisma/schema.prisma (Order model and OrderStatus enum)
// RAG Source: src/services/checkout.service.ts (requireCheckoutActor)

const trackOrderQuerySchema = z
  .object({
    phone: z
      .string()
      .trim()
      .min(9)
      .max(20)
      .regex(/^(\+62|62|0)8[1-9][0-9]{6,10}$/)
      .optional(),
    orderId: z.string().trim().min(1).max(128).optional()
  })
  .strict()
  .refine((data) => data.phone || data.orderId, {
    message: 'Either phone or orderId must be provided'
  })

export async function GET(req: NextRequest) {
  const actor = await requireCheckoutActor()
  const phoneParam = req.nextUrl.searchParams.get('phone')
  const orderIdParam = req.nextUrl.searchParams.get('orderId')

  const parsedQuery = trackOrderQuerySchema.safeParse({
    phone: phoneParam ?? undefined,
    orderId: orderIdParam ?? undefined
  })

  if (!parsedQuery.success) {
    return NextResponse.json({ success: false, error: 'Invalid request' }, { status: 400 })
  }

  const { phone, orderId } = parsedQuery.data

  try {
    if (orderId) {
      const parsedOrderId = paymentFormInputSchema.safeParse({ orderId })
      if (!parsedOrderId.success) {
        return NextResponse.json({ success: false, error: 'Invalid order' }, { status: 400 })
      }

      // Fetch status for a single order
      const order = await prisma.order.findUnique({
        where: { id: parsedOrderId.data.orderId },
        select: {
          id: true,
          status: true,
          confirmedAt: true,
          updatedAt: true,
          userId: true,
          deliveryMethod: true,
          courierName: true,
          courierPhone: true,
          etaMinutes: true,
          tipAmount: true,
          proofPhotoUrl: true
        }
      })

      if (order === null) {
        return NextResponse.json({ success: false, error: 'Order not found' }, { status: 404 })
      }

      const authorization = authorizeOrderReadForActor(order, actor)
      if (!authorization.allowed) {
        return NextResponse.json(
          {
            success: false,
            error: authorization.statusCode === 401 ? 'Unauthorized' : 'Forbidden'
          },
          { status: authorization.statusCode }
        )
      }

      return NextResponse.json({
        success: true,
        data: {
          id: order.id,
          status: order.status,
          confirmedAt: order.confirmedAt ? order.confirmedAt.toISOString() : null,
          updatedAt: order.updatedAt.toISOString(),
          deliveryMethod: order.deliveryMethod,
          courierName: order.courierName,
          courierPhone: order.courierPhone,
          etaMinutes: order.etaMinutes,
          tipAmount: order.tipAmount,
          proofPhotoUrl: order.proofPhotoUrl
        }
      })
    }

    if (actor === null) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    if (!phone) {
      return NextResponse.json({ success: false, error: 'Invalid request' }, { status: 400 })
    }

    // Fetch list of orders by phone
    const orders = await prisma.order.findMany({
      where: {
        userId: actor.userId,
        customerPhone: phone
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: {
        id: true,
        customerName: true,
        status: true,
        totalPrice: true,
        createdAt: true,
        deliveryMethod: true,
        items: {
          select: {
            id: true,
            baseType: true,
            quantity: true,
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
    })

    return NextResponse.json({ success: true, data: orders })
  } catch (error) {
    console.error('[SECURITY] Failed to track order.', error)
    return NextResponse.json({ success: false, error: 'Server error' }, { status: 500 })
  }
}
