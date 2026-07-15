import { serve } from 'inngest/next'
import { orderStatusWorkflow } from '@/src/features/payment/inngest/order-status.workflow'
import { paymentSettledWorkflow } from '@/src/features/payment/inngest/payment.workflow'
import { inngest } from '@/src/lib/inngest'

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [paymentSettledWorkflow, orderStatusWorkflow],
  streaming: true
})
