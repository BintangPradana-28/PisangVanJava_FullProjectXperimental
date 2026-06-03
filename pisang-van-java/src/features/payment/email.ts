import { resend } from '@/src/lib/resend'
import { prisma } from '@/lib/prisma'
import { render } from '@react-email/components'
import OrderConfirmationEmail from './OrderConfirmationEmail'
import React from 'react'

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
            topping: true,
          }
        },
        user: true,
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

    const formatPrice = (n: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(n)

    const mappedItems = order.items.map(item => ({
      name: `${item.variant.flavorName} (${item.baseType})${item.topping ? ` + ${item.topping.name}` : ''}`,
      qty: item.quantity,
      subtotal: formatPrice(item.subtotal),
    }))

    const htmlContent = await render(
      React.createElement(OrderConfirmationEmail, {
        customerName: order.customerName,
        orderId: order.id,
        items: mappedItems,
        deliveryFee: formatPrice(order.deliveryFee),
        discount: order.discountAmount > 0 ? formatPrice(order.discountAmount) : null,
        totalPrice: formatPrice(order.totalPrice),
        deliveryMethod: order.deliveryMethod,
      })
    )

    const { error } = await resend.emails.send({
      from: 'Pisang Van Java <noreply@pisangvanjava.com>',
      to: customerEmail,
      subject: `Pesanan Diproses: #${order.id.slice(-6).toUpperCase()} - Pisang Van Java`,
      html: htmlContent,
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

