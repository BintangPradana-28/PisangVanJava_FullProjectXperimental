import { queueWhatsAppNotification } from '@/lib/notifications'
import { prisma } from '@/lib/prisma'
import { buildOrderStatusPushPayload, sendPushNotification } from '@/lib/push'
import { inngest } from '@/src/lib/inngest'
import { sendOrderStatusEmail } from '../email'

export const orderStatusWorkflow = inngest.createFunction(
  {
    id: 'order-status-workflow',
    name: 'Order Status Workflow',
    triggers: [{ event: 'order/status.changed' }]
  },
  async ({ event, step }) => {
    const orderId = event.data.orderId as string
    const status = event.data.status as string

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
        userId: o.userId,
        customerName: o.customerName,
        customerPhone: o.user?.phone || o.customerPhone || '',
        status: o.status
      }
    })) as {
      id: string
      userId: string | null
      customerName: string
      customerPhone: string
      status: string
    }

    // Send order status email
    await step.run('send-status-email', async () => {
      const success = await sendOrderStatusEmail(order.id, status)
      if (!success) {
        throw new Error(`Failed to send status update email for order ${order.id}`)
      }
    })

    // Send WhatsApp notification
    if (order.customerPhone) {
      await step.run('send-whatsapp-notification', async () => {
        await queueWhatsAppNotification(order.customerPhone, order.customerName, status, order.id)
      })
    }

    // Web Push notification
    const targetUserId = order.userId
    if (targetUserId) {
      await step.run('send-push-notification', async () => {
        const pushPayload = buildOrderStatusPushPayload(order.id, status)
        if (pushPayload) {
          await sendPushNotification(targetUserId, pushPayload)
        }
      })
    }
  }
)
