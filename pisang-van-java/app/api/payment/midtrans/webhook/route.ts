import { OrderStatus, PaymentStatus, Prisma } from '@prisma/client'
import * as Sentry from '@sentry/nextjs'
import { revalidatePath, revalidateTag } from 'next/cache'
import { type NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { redis } from '@/lib/redis'
import { inngest } from '@/src/lib/inngest'
import { mapMidtransStatusToPaymentStatus } from '@/src/features/payment/payment-status.mapper'
import { verifyMidtransSignature } from '@/src/features/payment/service'
import { logger } from '@/src/lib/logger'


export async function POST(req: NextRequest) {
  try {
    const payload = await req.json()

    // The Midtrans Webhook Payload contains:
    // order_id, status_code, gross_amount, signature_key, transaction_status, etc.
    const {
      order_id,
      status_code,
      gross_amount,
      signature_key,
      transaction_status,
      transaction_id,
      payment_type,
      va_numbers,
      bank,
      qris_acquirer,
      settlement_time,
      expiry_time,
      acquirer,
      fraud_status
    } = payload

    if (!order_id || !status_code || !gross_amount || !signature_key) {
      return NextResponse.json({ success: false, error: 'Invalid payload' }, { status: 400 })
    }

    // Zero-Trust: Verify HMAC Signature Key
    const isValid = verifyMidtransSignature(order_id, status_code, gross_amount, signature_key)
    if (!isValid) {
      Sentry.captureMessage(
        `[SECURITY] Invalid Midtrans signature detected for order: ${order_id}`,
        'fatal'
      )
      return NextResponse.json(
        { success: false, error: 'Forbidden: Signature mismatch' },
        { status: 403 }
      )
    }

    // Zero-Trust: Distributed Idempotency & Concurrency Guard via Redis NX
    // Prevents race conditions and duplicate processing from concurrent Midtrans webhooks
    const lockKey = `midtrans:webhook:lock:${transaction_id}:${status_code}`
    const acquired = await redis.set(lockKey, 'locked', { nx: true, ex: 300 }) // Lock for 5 minutes

    if (!acquired) {
      logger.warn(
        `[SECURITY] Duplicate webhook blocked by Redis NX Guard for transaction: ${transaction_id}`
      )
      // Return 200 so Midtrans marks it as successfully delivered without us double-processing it
      return NextResponse.json({
        success: true,
        message: 'Webhook already processed or currently processing'
      })
    }

    // Resolve real order ID from the potentially prefixed order_id
    const realOrderId = order_id.startsWith('PVJ-')
      ? order_id.substring(4, order_id.lastIndexOf('-'))
      : order_id

    // Verify order exists and amount matches
    const order = await prisma.order.findUnique({
      where: { id: realOrderId }
    })

    if (!order) {
      Sentry.captureMessage(
        `[SECURITY] Midtrans webhook order not found: ${realOrderId} (raw: ${order_id})`,
        'warning'
      )
      // Rollback Redis lock so retry can be processed
      await redis.del(lockKey)
      return NextResponse.json({ success: false, error: 'Order not found' }, { status: 404 })
    }

    // Ensure gross_amount string from Midtrans matches our database value closely
    // Midtrans might send "15000.00", parseFloat handles this.
    if (Math.abs(parseFloat(gross_amount) - order.totalPrice) > 1) {
      Sentry.captureMessage(
        `[SECURITY] Midtrans webhook amount mismatch: received ${gross_amount}, expected ${order.totalPrice}`,
        'error'
      )
      // Rollback Redis lock
      await redis.del(lockKey)
      return NextResponse.json({ success: false, error: 'Amount mismatch' }, { status: 400 })
    }

    // Determine target payment and order status
    const newPaymentStatus = mapMidtransStatusToPaymentStatus(transaction_status, fraud_status)

    let targetOrderStatus: OrderStatus = order.status
    if (newPaymentStatus === PaymentStatus.PAID) {
      targetOrderStatus = OrderStatus.PROCESSING
    } else if (
      newPaymentStatus === PaymentStatus.FAILED ||
      newPaymentStatus === PaymentStatus.CANCELED ||
      newPaymentStatus === PaymentStatus.EXPIRED
    ) {
      targetOrderStatus = OrderStatus.CANCELED
    }

    const paymentChannel = va_numbers?.[0]?.bank ?? bank ?? qris_acquirer ?? null
    const vaNumber = va_numbers?.[0]?.va_number ?? null
    const finalAcquirer = acquirer ?? qris_acquirer ?? null
    const settlementTime = settlement_time ? new Date(settlement_time) : null
    const expiryTime = expiry_time ? new Date(expiry_time) : null

    // Execute atomic transaction for Payment and Order updates
    let sendEmail = false

    await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      // 1. Upsert/Update the Payment record
      await tx.payment.upsert({
        where: { orderId: realOrderId },
        create: {
          orderId: realOrderId,
          midtransOrderId: order_id,
          transactionId: transaction_id,
          status: newPaymentStatus,
          paymentType: payment_type,
          paymentChannel,
          grossAmount: new Prisma.Decimal(gross_amount),
          fraudStatus: fraud_status ?? null,
          settlementTime,
          expiryTime,
          vaNumber,
          acquirer: finalAcquirer,
          currency: payload.currency || 'IDR',
          rawWebhookPayload: payload as unknown as Prisma.InputJsonValue
        },
        update: {
          midtransOrderId: order_id,
          transactionId: transaction_id,
          status: newPaymentStatus,
          paymentType: payment_type,
          paymentChannel,
          grossAmount: new Prisma.Decimal(gross_amount),
          fraudStatus: fraud_status ?? null,
          settlementTime,
          expiryTime,
          vaNumber,
          acquirer: finalAcquirer,
          rawWebhookPayload: payload as unknown as Prisma.InputJsonValue
        }
      })

      // 2. Perform Order status transitions safely
      if (targetOrderStatus === OrderStatus.PROCESSING) {
        const updateCount = await tx.order.updateMany({
          where: { id: realOrderId, status: OrderStatus.PENDING_PAYMENT },
          data: {
            status: OrderStatus.PROCESSING,
            confirmedAt: new Date()
          }
        })
        if (updateCount.count > 0) {
          sendEmail = true

          const orderWithItems = await tx.order.findUnique({
            where: { id: realOrderId },
            include: { items: true }
          })
          // RAG Source: app/api/payment/midtrans/webhook/route.ts (prevent N+1 queries by batching DB updates via Promise.all)
          if (orderWithItems?.items) {
            await Promise.all(
              orderWithItems.items
                .filter((item) => item.variantId)
                .map((item) =>
                  tx.menuVariant.update({
                    where: { id: item.variantId! },
                    data: { soldCount: { increment: item.quantity } }
                  })
                )
            )
          }
        }
      } else if (targetOrderStatus === OrderStatus.CANCELED) {
        // Zero-Trust: Only restore stock IF the order is transitioning from PENDING_PAYMENT to CANCELED.
        // This prevents double-incrementing stock if multiple cancel webhooks arrive.
        const updateCount = await tx.order.updateMany({
          where: { id: realOrderId, status: OrderStatus.PENDING_PAYMENT },
          data: {
            status: OrderStatus.CANCELED
          }
        })

        if (updateCount.count > 0) {
          const orderWithItems = await tx.order.findUnique({
            where: { id: realOrderId },
            include: { items: true }
          })
          // RAG Source: app/api/payment/midtrans/webhook/route.ts (prevent N+1 queries by batching DB updates via Promise.all)
          if (orderWithItems?.items) {
            await Promise.all(
              orderWithItems.items
                .filter((item) => item.variantId)
                .map((item) =>
                  tx.menuVariant.update({
                    where: { id: item.variantId! },
                    data: { stock: { increment: item.quantity } }
                  })
                )
            )
          }
        }
      }
    })

    if (sendEmail) {
      // Trigger order confirmation email in the background via Inngest durable job queue
      inngest
        .send({
          name: 'order/payment.settled',
          data: {
            orderId: realOrderId
          }
        })
        .catch((err) => logger.error(err as Error, '[INNGEST ERROR] Failed to dispatch payment.settled event'))
    }

    // Force real-time Edge Cache purge for Storefront and Dashboard
    // This allows UI to show accurate stock and soldCount instantly without a hard reload.
    try {
      revalidatePath('/', 'layout')
      revalidatePath('/(user)/menu-spesial', 'page')
      revalidatePath('/(admin)', 'layout')
      // @ts-expect-error Next.js Canary type requires 2 args
      revalidateTag('menu')
      // @ts-expect-error Next.js Canary type requires 2 args
      revalidateTag('menu-spesial-all-products')
    } catch (e) {
      logger.warn(e as Error, '[Midtrans Webhook] Failed to revalidate Next.js cache')
    }

    return NextResponse.json({ success: true, message: 'Webhook processed successfully' })
  } catch (error) {
    Sentry.captureException(error)
    logger.error(error as Error, '[Midtrans Webhook Error]')
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 })
  }
}

export async function GET() {
  return NextResponse.json({ message: 'Method not allowed' }, { status: 405 })
}
