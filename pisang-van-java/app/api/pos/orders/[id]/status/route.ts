// app/api/pos/orders/[id]/status/route.ts
// RAG Source: src/lib/midtrans.ts (coreApi for status check)
// RAG Source: prisma/schema.prisma (Payment, Order models)
// Purpose: QRIS payment status polling endpoint for POS cashier UI

import type { Prisma } from '@prisma/client'
import { type NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { logAudit } from '@/lib/audit'
import { prisma } from '@/lib/prisma'
import { auth } from '@/src/auth'
import { coreApi } from '@/src/lib/midtrans'

const POS_ROLES = ['ADMIN', 'SUPER_ADMIN', 'CASHIER'] as const

const paramsSchema = z.object({
  id: z.string().min(1).max(64)
})

interface RouteContext {
  params: Promise<{ id: string }>
}

export async function GET(_req: NextRequest, { params }: RouteContext): Promise<NextResponse> {
  const session = await auth()
  if (!session?.user?.id || !POS_ROLES.includes(session.user.role as (typeof POS_ROLES)[number])) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params
  const parsed = paramsSchema.safeParse({ id })
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: 'Invalid order ID' }, { status: 400 })
  }

  try {
    // Find the Payment record for this order
    const payment = await prisma.payment.findUnique({
      where: { orderId: parsed.data.id },
      select: {
        id: true,
        midtransOrderId: true,
        status: true,
        transactionId: true,
        orderId: true
      }
    })

    if (!payment) {
      return NextResponse.json(
        { success: false, error: 'Payment tidak ditemukan' },
        { status: 404 }
      )
    }

    // If already settled, return immediately without hitting Midtrans
    if (payment.status === 'PAID') {
      return NextResponse.json({
        success: true,
        data: { status: 'PAID', orderId: payment.orderId }
      })
    }

    if (payment.status === 'CANCELED' || payment.status === 'EXPIRED') {
      return NextResponse.json({
        success: true,
        data: { status: payment.status, orderId: payment.orderId }
      })
    }

    // Query Midtrans for real-time status
    const midtransStatus = (await coreApi.transaction.status(payment.midtransOrderId)) as any

    const txStatus: string = midtransStatus.transaction_status || ''

    // Map Midtrans status → our PaymentStatus
    if (txStatus === 'settlement' || txStatus === 'capture') {
      // Payment confirmed — update Payment + Order atomically
      await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        await tx.payment.update({
          where: { id: payment.id },
          data: {
            status: 'PAID',
            transactionId: midtransStatus.transaction_id ?? payment.transactionId,
            paymentType: midtransStatus.payment_type ?? 'qris',
            settlementTime: midtransStatus.settlement_time
              ? new Date(midtransStatus.settlement_time)
              : new Date(),
            rawWebhookPayload: midtransStatus
          }
        })

        await tx.order.update({
          where: { id: payment.orderId },
          data: {
            status: 'COMPLETED',
            confirmedAt: new Date()
          }
        })
      })

      await logAudit('POS_QRIS_CONFIRMED', 'Payment', payment.id, {
        midtransOrderId: payment.midtransOrderId,
        confirmedBy: session.user.id
      })

      await logAudit('UPDATE_ORDER_STATUS', 'Order', payment.orderId, {
        oldStatus: 'PENDING_PAYMENT',
        newStatus: 'COMPLETED',
        method: 'POS_QRIS_POLLING'
      })

      return NextResponse.json({
        success: true,
        data: { status: 'PAID', orderId: payment.orderId }
      })
    }

    if (txStatus === 'cancel' || txStatus === 'deny' || txStatus === 'expire') {
      // Payment failed or expired
      const failedStatus = txStatus === 'expire' ? 'EXPIRED' : 'CANCELED'
      await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        await tx.payment.update({
          where: { id: payment.id },
          data: { status: failedStatus }
        })

        // Restore stock and cancel order
        const orderWithItems = await tx.order.findUnique({
          where: { id: payment.orderId },
          include: { items: true }
        })
        if (orderWithItems && orderWithItems.status !== 'CANCELED') {
          for (const item of orderWithItems.items) {
            if (item.variantId) {
              await tx.menuVariant.update({
                where: { id: item.variantId },
                data: { stock: { increment: item.quantity } }
              })
            }
          }
          await tx.order.update({
            where: { id: payment.orderId },
            data: { status: 'CANCELED' }
          })
        }
      })

      return NextResponse.json({
        success: true,
        data: { status: failedStatus, orderId: payment.orderId }
      })
    }

    // Still pending
    return NextResponse.json({
      success: true,
      data: { status: 'PENDING', orderId: payment.orderId }
    })
  } catch (error: any) {
    console.error('[POS] QRIS status check failed:', error?.message)
    return NextResponse.json(
      { success: false, error: 'Gagal memeriksa status pembayaran' },
      { status: 500 }
    )
  }
}
