import { serve } from 'inngest/next'
import { inngest } from '@/src/lib/inngest'
import { paymentSettledWorkflow } from '@/src/features/payment/inngest/payment.workflow'
import { orderStatusWorkflow } from '@/src/features/payment/inngest/order-status.workflow'

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [paymentSettledWorkflow, orderStatusWorkflow],
  streaming: true
})
