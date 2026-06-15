import { type NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { prisma } from '@/lib/prisma'
import { requireCheckoutActor } from '@/src/services/checkout.service'

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
    orderId: z.string().min(1).optional()
  })
  .strict()
  .refine((data) => data.phone || data.orderId, {
    message: 'Either phone or orderId must be provided'
  })

export async function GET(req: NextRequest) {
  const actor = await requireCheckoutActor()
  if (actor === null) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

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
      // Fetch status for a single order
      const order = await prisma.order.findUnique({
        where: { id: orderId },
        select: {
          id: true,
          status: true,
          confirmedAt: true,
          updatedAt: true,
          userId: true,
          deliveryMethod: true
        }
      })

      if (order === null) {
        return NextResponse.json({ success: false, error: 'Order not found' }, { status: 404 })
      }

      // Authorization check (BOLA prevention)
      // Check if user is owner of the order or is staff (ADMIN, SUPER_ADMIN, KITCHEN, CASHIER)
      const STAFF_ROLES = ['ADMIN', 'SUPER_ADMIN', 'KITCHEN', 'CASHIER']
      if (order.userId && order.userId !== actor.userId && !STAFF_ROLES.includes(actor.role)) {
        return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
      }

      return NextResponse.json({
        success: true,
        data: {
          id: order.id,
          status: order.status,
          confirmedAt: order.confirmedAt ? order.confirmedAt.toISOString() : null,
          updatedAt: order.updatedAt.toISOString(),
          deliveryMethod: order.deliveryMethod
        }
      })
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
