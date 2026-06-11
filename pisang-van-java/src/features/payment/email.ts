import { render } from '@react-email/components'
import React from 'react'
import { prisma } from '@/lib/prisma'
import { resend } from '@/src/lib/resend'
import OrderConfirmationEmail from './OrderConfirmationEmail'
import OrderStatusEmail from './OrderStatusEmail'

export async function sendOrderConfirmationEmail(orderId: string): Promise<boolean> {
  if (!resend) {
    console.warn('[EMAIL] Resend is not configured. Skipping confirmation email.')
    return false
  }

  try {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: {
          include: {
            variant: true,
            toppings: true
          }
        },
        user: true
      }
    })

    if (!order) {
      console.error(`[EMAIL] Order ${orderId} not found`)
      return false
    }

    const customerEmail = order.user?.email
    if (!customerEmail) {
      console.log(`[EMAIL] No email found for order ${orderId}, skipping.`)
      return false
    }

    const formatPrice = (n: number) =>
      new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 0
      }).format(n)

    const mappedItems = order.items.map((item: any) => {
      const toppingText = item.toppings && item.toppings.length > 0
        ? ` + ${item.toppings.map((t: any) => t.name).join(', ')}`
        : ''
      return {
        name: `${item.variant.flavorName} (${item.baseType})${toppingText}`,
        qty: item.quantity,
        subtotal: formatPrice(item.subtotal)
      }
    })

    const htmlContent = await render(
      React.createElement(OrderConfirmationEmail, {
        customerName: order.customerName,
        orderId: order.id,
        items: mappedItems,
        deliveryFee: formatPrice(order.deliveryFee),
        discount: order.discountAmount > 0 ? formatPrice(order.discountAmount) : null,
        totalPrice: formatPrice(order.totalPrice),
        deliveryMethod: order.deliveryMethod
      })
    )

    const { error } = await resend.emails.send({
      from: 'Pisang Van Java <noreply@pisangvanjava.com>',
      to: customerEmail,
      subject: `Pesanan Diproses: #${order.id.slice(-6).toUpperCase()} - Pisang Van Java`,
      html: htmlContent
    })

    if (error) {
      console.error('[EMAIL] Failed to send email:', error)
      return false
    }

    console.log(`[EMAIL] Confirmation email sent to ${customerEmail} for order ${orderId}`)
    return true
  } catch (error) {
    console.error('[EMAIL] Exception while sending email:', error)
    return false
  }
}

export async function sendOrderStatusEmail(orderId: string, status: string): Promise<boolean> {
  if (!resend) {
    console.warn('[EMAIL] Resend is not configured. Skipping status update email.')
    return false
  }

  try {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        user: true
      }
    })

    if (!order) {
      console.error(`[EMAIL] Order ${orderId} not found`)
      return false
    }

    const customerEmail = order.user?.email
    if (!customerEmail) {
      console.log(`[EMAIL] No email found for order ${orderId}, skipping status email.`)
      return false
    }

    const htmlContent = await render(
      React.createElement(OrderStatusEmail, {
        customerName: order.customerName,
        orderId: order.id,
        status: status
      })
    )

    const statusLabels: Record<string, string> = {
      PROCESSING: 'Sedang Diproses 🍳',
      READY: 'Siap Diambil/Dikirim 🎉',
      COMPLETED: 'Selesai 🍌',
      CANCELED: 'Dibatalkan ❌'
    }
    const statusLabel = statusLabels[status] || status

    const { error } = await resend.emails.send({
      from: 'Pisang Van Java <noreply@pisangvanjava.com>',
      to: customerEmail,
      subject: `Update Pesanan #${order.id.slice(-6).toUpperCase()}: ${statusLabel} - Pisang Van Java`,
      html: htmlContent
    })

    if (error) {
      console.error('[EMAIL] Failed to send status update email:', error)
      return false
    }

    console.log(`[EMAIL] Status update email (${status}) sent to ${customerEmail} for order ${orderId}`)
    return true
  } catch (error) {
    console.error('[EMAIL] Exception while sending status email:', error)
    return false
  }
}
