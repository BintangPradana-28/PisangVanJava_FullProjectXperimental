import { type NextRequest, NextResponse } from 'next/server'
import { OrderStatus } from '@prisma/client'
import { logAudit } from '@/lib/audit'
import { prisma } from '@/lib/prisma'
import { redis } from '@/lib/redis'
import { requireCheckoutActor } from '@/src/services/checkout.service'
import { Ratelimit } from '@upstash/ratelimit'
import { z } from 'zod'

interface TipRouteContext {
  params: Promise<{
    id: string
  }>
}

const tipRateLimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(3, '5 m'), // 3 tips per 5 minutes per user
  analytics: true
})

const tipSchema = z
  .object({
    amount: z.number().finite().int().min(1000).max(1_000_000) // Rp 1.000 to Rp 1.000.000
  })
  .strict()

export async function POST(req: NextRequest, { params }: TipRouteContext) {
  const { id: orderId } = await params

  // 1. Auth Check
  const actor = await requireCheckoutActor()
  if (actor === null) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  // 2. Rate Limiting Protection (Max 3 requests per 5 minutes per user)
  const { success: rateLimitOk } = await tipRateLimit.limit(`tip_${actor.userId}`)
  if (!rateLimitOk) {
    return NextResponse.json(
      { success: false, error: 'Too many requests. Please try again later.' },
      { status: 429 }
    )
  }

  // 3. Request Body Validation
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 })
  }

  const parsedBody = tipSchema.safeParse(body)
  if (!parsedBody.success) {
    return NextResponse.json(
      { success: false, error: 'Invalid tip amount. Must be between Rp 1.000 and Rp 1.000.000.' },
      { status: 400 }
    )
  }

  const { amount } = parsedBody.data

  try {
    // 4. Fetch order for BOLA verification
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: {
        userId: true,
        status: true
      }
    })

    if (order === null) {
      return NextResponse.json({ success: false, error: 'Order not found' }, { status: 404 })
    }

    // BOLA Check: Only the order owner is allowed to tip
    if (order.userId !== actor.userId) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
    }

    // 5. Lifecycle Guard: Only DELIVERED or COMPLETED orders can be tipped
    if (order.status !== OrderStatus.DELIVERED && order.status !== OrderStatus.COMPLETED) {
      return NextResponse.json(
        { success: false, error: 'Tipping is only allowed for delivered or completed orders' },
        { status: 400 }
      )
    }

    // 6. Atomically update tip amount
    const updatedOrder = await prisma.order.update({
      where: { id: orderId },
      data: {
        tipAmount: {
          increment: amount
        }
      },
      select: {
        id: true,
        tipAmount: true
      }
    })

    // 7. Audit log the tip addition
    await logAudit('ADD_TIP', 'Order', orderId, { amount, userId: actor.userId })

    return NextResponse.json({
      success: true,
      data: {
        id: updatedOrder.id,
        tipAmount: updatedOrder.tipAmount
      }
    })
  } catch (error) {
    console.error('[SECURITY] Failed to add tip to order.', error)
    return NextResponse.json({ success: false, error: 'Server error' }, { status: 500 })
  }
}
