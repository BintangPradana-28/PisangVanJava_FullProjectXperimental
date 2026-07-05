import crypto from 'node:crypto'
import { OrderStatus, type Prisma } from '@prisma/client'
import * as Sentry from '@sentry/nextjs'
import { type NextRequest, NextResponse } from 'next/server'
import { sendWhatsAppNotification } from '@/lib/notifications'
import { prisma } from '@/lib/prisma'
import { buildOrderStatusPushPayload, sendPushNotification } from '@/lib/push'
import { redis } from '@/lib/redis'
import { sendOrderStatusEmail } from '@/src/features/payment/email'

/**
 * Timing-safe token comparison. Returns false (never throws) on any length mismatch.
 */
function safeTokenEquals(a: string, b: string): boolean {
  const bufA = Buffer.from(a)
  const bufB = Buffer.from(b)
  if (bufA.length !== bufB.length) return false
  return crypto.timingSafeEqual(bufA, bufB)
}

// Allowed status mapping from Biteship to DB OrderStatus
const STATUS_MAP: Record<string, OrderStatus> = {
  picked: OrderStatus.OUT_FOR_DELIVERY,
  in_transit: OrderStatus.OUT_FOR_DELIVERY,
  dropping_off: OrderStatus.OUT_FOR_DELIVERY,
  delivered: OrderStatus.DELIVERED,
  cancelled: OrderStatus.CANCELED,
  rejected: OrderStatus.CANCELED
}

export async function POST(req: NextRequest) {
  try {
    const payload = await req.json()
    console.info('[BITESHIP WEBHOOK] Received payload:', JSON.stringify(payload))

    const { event, order_id, status, courier } = payload

    if (!order_id || !status) {
      return NextResponse.json(
        { success: false, error: 'Invalid payload: order_id and status are required' },
        { status: 400 }
      )
    }

    // SECURITY FIX (audit QA & Security): sebelumnya `if (expectedToken && token !== expectedToken)`
    // — kalau BITESHIP_WEBHOOK_TOKEN tidak di-set, verifikasi ini otomatis DILEWATI dan webhook
    // jadi terbuka untuk siapa pun (bisa memalsukan status order jadi DELIVERED/CANCELED,
    // memicu notifikasi WA/email palsu ke pelanggan asli). Sekarang fail-closed: token WAJIB
    // dikonfigurasi di server, dan dibandingkan dengan timing-safe comparison (bukan `!==`).
    // Header lebih diutamakan; query-param dipertahankan sebagai fallback kompatibilitas
    // (beberapa provider webhook hanya bisa dikonfigurasi lewat URL), tapi header disarankan
    // karena query string bisa tercatat di access log / proxy log.
    const expectedToken = process.env.BITESHIP_WEBHOOK_TOKEN
    if (!expectedToken) {
      // ADDITION (QA & Security): sebelumnya cuma console.error, gampang terlewat di
      // stdout. Sentry.captureMessage memastikan misconfiguration ini benar-benar
      // memicu alert, bukan diam-diam bikin update status pengiriman berhenti bekerja
      // tanpa disadari siapa pun sampai ada pelanggan komplain.
      Sentry.captureMessage(
        '[SECURITY][MISCONFIG] BITESHIP_WEBHOOK_TOKEN belum di-set — semua webhook Biteship ditolak.',
        'error'
      )
      console.error(
        '[SECURITY] BITESHIP_WEBHOOK_TOKEN belum dikonfigurasi di server — menolak semua webhook demi keamanan.'
      )
      return NextResponse.json(
        { success: false, error: 'Webhook not configured' },
        { status: 503 }
      )
    }

    const token = req.headers.get('x-biteship-token') || req.nextUrl.searchParams.get('token')
    if (!token || !safeTokenEquals(token, expectedToken)) {
      console.warn('[SECURITY] Unauthorized Biteship webhook attempt detected')
      return NextResponse.json(
        { success: false, error: 'Unauthorized: Invalid token' },
        { status: 401 }
      )
    }

    // Zero-Trust: Distributed Idempotency & Concurrency Guard via Redis NX
    const lockKey = `biteship:webhook:lock:${order_id}:${status}`
    const acquired = await redis.set(lockKey, 'locked', { nx: true, ex: 300 }) // Lock for 5 minutes
    if (!acquired) {
      console.warn(
        `[SECURITY] Duplicate Biteship webhook blocked by Redis NX Guard for order: ${order_id}`
      )
      return NextResponse.json({ success: true, message: 'Already processed' })
    }

    // Find the corresponding order by biteshipOrderId
    const existingOrder = await prisma.order.findFirst({
      where: { biteshipOrderId: order_id },
      include: { items: true }
    })

    if (!existingOrder) {
      console.warn(`[BITESHIP WEBHOOK] Order not found for Biteship ID: ${order_id}`)
      return NextResponse.json({ success: false, error: 'Order not found' }, { status: 404 })
    }

    // If order is already completed, delivered, or canceled, we should not transition it back
    if (
      existingOrder.status === OrderStatus.COMPLETED ||
      (existingOrder.status === OrderStatus.DELIVERED &&
        status !== 'cancelled' &&
        status !== 'rejected') ||
      existingOrder.status === OrderStatus.CANCELED
    ) {
      console.info(
        `[BITESHIP WEBHOOK] Skipping status update because order ${existingOrder.id} is already in state ${existingOrder.status}`
      )
      return NextResponse.json({ success: true, message: 'Order is already in a final state' })
    }

    const targetStatus = STATUS_MAP[status]
    if (!targetStatus) {
      // Biteship status changes like 'allocated' or 'picking_up' don't map to order status changes, but we might want to update courier details
      const updateData: Record<string, any> = {}
      let updated = false

      if (courier?.phone && courier.phone !== existingOrder.courierPhone) {
        updateData.courierPhone = courier.phone
        updated = true
      }
      if (courier?.name && courier.name !== existingOrder.courierName) {
        updateData.courierName = courier.name
        updated = true
      }

      if (updated) {
        await prisma.order.update({
          where: { id: existingOrder.id },
          data: updateData
        })
        console.info(`[BITESHIP WEBHOOK] Updated courier details for order ${existingOrder.id}`)
      }

      return NextResponse.json({
        success: true,
        message: 'Status parsed but no order state transition required'
      })
    }

    // Update database and process state changes transactionally
    const updatedOrder = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      // 1. Stock restoration if transitioning to CANCELED
      if (targetStatus === OrderStatus.CANCELED && existingOrder.status !== OrderStatus.CANCELED) {
        for (const item of existingOrder.items) {
          if (item.variantId) {
            await tx.menuVariant.update({
              where: { id: item.variantId },
              data: { stock: { increment: item.quantity } }
            })
          }
        }
      }

      const updateData: Record<string, any> = { status: targetStatus }
      if (courier?.phone) updateData.courierPhone = courier.phone
      if (courier?.name) updateData.courierName = courier.name

      return tx.order.update({
        where: { id: existingOrder.id },
        data: updateData
      })
    })

    console.info(
      `[BITESHIP WEBHOOK] Order ${updatedOrder.id} successfully updated to status ${updatedOrder.status}`
    )

    // Trigger Notifications asynchronously
    try {
      await sendWhatsAppNotification(
        updatedOrder.customerPhone,
        updatedOrder.customerName,
        updatedOrder.status,
        updatedOrder.id,
        updatedOrder.etaMinutes,
        updatedOrder.courierName
      )
    } catch (waErr) {
      console.error('[WA ERROR] Failed to send WhatsApp notification from Biteship webhook:', waErr)
    }

    sendOrderStatusEmail(updatedOrder.id, updatedOrder.status).catch((emailErr) =>
      console.error('[EMAIL ERROR] Failed to send email from Biteship webhook:', emailErr)
    )

    if (updatedOrder.userId) {
      const pushPayload = buildOrderStatusPushPayload(updatedOrder.id, updatedOrder.status)
      if (pushPayload) {
        sendPushNotification(updatedOrder.userId, pushPayload).catch((pushErr) =>
          console.error(
            '[PUSH ERROR] Failed to send push notification from Biteship webhook:',
            pushErr
          )
        )
      }
    }

    return NextResponse.json({ success: true, message: `Order updated to ${updatedOrder.status}` })
  } catch (error) {
    Sentry.captureException(error)
    console.error('[BITESHIP WEBHOOK ERROR] Error handling webhook:', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
