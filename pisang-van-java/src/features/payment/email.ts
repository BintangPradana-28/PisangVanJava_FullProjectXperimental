import { resend } from '@/src/lib/resend'
import { prisma } from '@/lib/prisma'

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

    // Attempt to get user's email if available. Guest checkout might not have email.
    // If we don't have an email, we can't send it.
    const customerEmail = order.user?.email
    if (!customerEmail) {
      console.log(`[EMAIL] No email found for order ${orderId}, skipping.`)
      return false
    }

    const formatPrice = (n: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(n)

    const itemsHtml = order.items.map(item => `
      <tr>
        <td style="padding: 8px; border-bottom: 1px solid #eee;">
          <strong>${item.variant.flavorName} (${item.baseType})</strong>
          ${item.topping ? `<br/><small>+ ${item.topping.name}</small>` : ''}
        </td>
        <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: center;">${item.quantity}</td>
        <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: right;">${formatPrice(item.subtotal)}</td>
      </tr>
    `).join('')

    const htmlContent = `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #d97706;">Konfirmasi Pesanan Pisang Van Java</h1>
        <p>Halo <strong>${order.customerName}</strong>,</p>
        <p>Terima kasih atas pesanan Anda. Pembayaran Anda telah kami terima dan pesanan Anda sedang <strong>diproses</strong>.</p>
        
        <h3>Detail Pesanan (#${order.id.slice(-6).toUpperCase()})</h3>
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
          <thead>
            <tr style="background-color: #f8f9fa;">
              <th style="padding: 8px; text-align: left;">Item</th>
              <th style="padding: 8px; text-align: center;">Qty</th>
              <th style="padding: 8px; text-align: right;">Subtotal</th>
            </tr>
          </thead>
          <tbody>
            ${itemsHtml}
          </tbody>
          <tfoot>
            <tr>
              <td colspan="2" style="padding: 8px; text-align: right; font-weight: bold;">Ongkir / Biaya</td>
              <td style="padding: 8px; text-align: right;">${formatPrice(order.deliveryFee)}</td>
            </tr>
            ${order.discountAmount > 0 ? `
            <tr>
              <td colspan="2" style="padding: 8px; text-align: right; font-weight: bold; color: green;">Diskon</td>
              <td style="padding: 8px; text-align: right; color: green;">-${formatPrice(order.discountAmount)}</td>
            </tr>
            ` : ''}
            <tr>
              <td colspan="2" style="padding: 8px; text-align: right; font-weight: bold; border-top: 2px solid #333;">Total</td>
              <td style="padding: 8px; text-align: right; font-weight: bold; border-top: 2px solid #333;">${formatPrice(order.totalPrice)}</td>
            </tr>
          </tfoot>
        </table>

        <p><strong>Pengiriman:</strong> ${order.deliveryMethod === 'DELIVERY' ? 'Diantar ke alamat' : 'Ambil di toko'}</p>
        
        <p style="margin-top: 30px; font-size: 14px; color: #666;">
          Anda dapat melacak pesanan Anda melalui website kami.<br/>
          Salam hangat,<br/>
          <strong>Pisang Van Java</strong>
        </p>
      </div>
    `

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
