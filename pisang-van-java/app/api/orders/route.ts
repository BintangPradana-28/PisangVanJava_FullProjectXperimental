import { type NextRequest, NextResponse } from 'next/server'

import { prisma } from '@/lib/prisma'
import {
  CheckoutSecurityError,
  createOrderInputSchema,
  orderQueryInputSchema
} from '@/src/features/checkout/schemas'
import { logger } from '@/src/lib/logger'
import {
  createCheckoutOrder,
  enforceCheckoutRateLimit,
  enforceIdempotency,
  hasValidSameOriginHeaders,
  requireCheckoutActor
} from '@/src/services/checkout.service'

export async function GET(req: NextRequest) {
  const actor = await requireCheckoutActor()
  if (actor === null) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  const ALLOWED_GET_ROLES = ['ADMIN', 'SUPER_ADMIN', 'KITCHEN']
  if (!ALLOWED_GET_ROLES.includes(actor.role)) {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
  }

  const parsedQuery = orderQueryInputSchema.safeParse({
    status: req.nextUrl.searchParams.get('status') ?? undefined,
    page: req.nextUrl.searchParams.get('page') ?? undefined,
    limit: req.nextUrl.searchParams.get('limit') ?? undefined
  })

  if (!parsedQuery.success) {
    return NextResponse.json({ success: false, error: 'Invalid query' }, { status: 400 })
  }

  try {
    const { status, page, limit } = parsedQuery.data
    const where = status === undefined ? {} : { status }
    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        select: {
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
      }),
      prisma.order.count({ where })
    ])

    return NextResponse.json({
      success: true,
      data: {
        orders,
        total,
        page,
        limit
      }
    })
  } catch (error) {
    console.error('[SECURITY] Failed to list orders.', error)
    return NextResponse.json({ success: false, error: 'Server error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const actor = await requireCheckoutActor()
    if (actor === null) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    if (!(await hasValidSameOriginHeaders())) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
    }

    const payload = await readRequestJson(req)
    if (payload === null) {
      return NextResponse.json({ success: false, error: 'Invalid request' }, { status: 400 })
    }

    const parsed = createOrderInputSchema.safeParse(payload)
    if (!parsed.success) {
      console.error(
        '[SECURITY] Checkout payload rejected validation errors:',
        JSON.stringify(parsed.error.format(), null, 2)
      )
      return NextResponse.json(
        { success: false, error: 'Checkout payload rejected' },
        { status: 400 }
      )
    }

    const isIdempotent = await enforceIdempotency(parsed.data.idempotencyKey, actor)
    if (!isIdempotent) {
      return NextResponse.json(
        { success: false, error: 'Order is currently being processed' },
        { status: 409 }
      )
    }

    const withinLimit = await enforceCheckoutRateLimit(actor)
    if (!withinLimit) {
      return NextResponse.json(
        { success: false, error: 'Too many checkout attempts' },
        { status: 429 }
      )
    }

    const orderResult = await createCheckoutOrder(parsed.data, actor)
    return NextResponse.json(
      {
        success: true,
        data: {
          orderId: orderResult.orderId,
          redirectType: orderResult.redirectType,
          redirectUrl: orderResult.redirectUrl,
          totalPrice: orderResult.totalPrice
        }
      },
      { status: 201 }
    )
  } catch (error: any) {
    if (error instanceof CheckoutSecurityError || error?.name === 'CheckoutSecurityError') {
      return NextResponse.json(
        { success: false, error: error.reason || 'Checkout rejected' },
        { status: error.statusCode || 400 }
      )
    }

    logger.error(error as Error, '[SECURITY] Order creation failed')
    return NextResponse.json(
      // RAG Source: app/api/orders/route.ts (sanitize database/server errors to prevent schema leakage)
      { success: false, error: 'Server error' },
      { status: 500 }
    )
  }
}

async function readRequestJson(req: NextRequest): Promise<unknown | null> {
  try {
    return await req.json()
  } catch {
    return null
  }
}
