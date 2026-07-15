import { queueWhatsAppNotification } from '@/lib/notifications'
import { prisma } from '@/lib/prisma'
import { inngest } from '@/src/lib/inngest'
import { sendOrderConfirmationEmail } from '../email'

export const paymentSettledWorkflow = inngest.createFunction(
  {
    id: 'payment-settled-workflow',
    name: 'Order Payment Settled Workflow',
    triggers: [{ event: 'order/payment.settled' }]
  },
  async ({ event, step }) => {
    const orderId = event.data.orderId as string

    // Fetch order details
    const order = (await step.run('fetch-order', async () => {
      const o = await prisma.order.findUnique({
        where: { id: orderId },
        include: { user: true }
      })
      if (!o) {
        throw new Error(`Order ${orderId} not found`)
      }
      return {
        id: o.id,
        customerName: o.customerName,
        customerPhone: o.user?.phone || o.customerPhone || '',
        status: o.status
      }
    })) as {
      id: string
      customerName: string
      customerPhone: string
      status: string
    }

    // Send order confirmation email
    await step.run('send-confirmation-email', async () => {
      const success = await sendOrderConfirmationEmail(order.id)
      if (!success) {
        throw new Error(`Failed to send confirmation email for order ${order.id}`)
      }
    })

    // Send WhatsApp notification
    if (order.customerPhone) {
      await step.run('send-whatsapp-notification', async () => {
        await queueWhatsAppNotification(
          order.customerPhone,
          order.customerName,
          order.status,
          order.id
        )
      })
    }
  }
)
