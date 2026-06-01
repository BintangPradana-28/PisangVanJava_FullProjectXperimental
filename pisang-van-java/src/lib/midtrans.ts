import midtransClient from 'midtrans-client'
import { env } from '@/src/env'

// Initialize Snap client for frontend integration (Web/Mobile checkout)
export const snap = new midtransClient.Snap({
  isProduction: env.NEXT_PUBLIC_MIDTRANS_IS_PRODUCTION === 'true',
  serverKey: env.MIDTRANS_SERVER_KEY,
  clientKey: env.NEXT_PUBLIC_MIDTRANS_CLIENT_KEY,
})

// Initialize CoreAPI client for backend custom integrations
export const coreApi = new midtransClient.CoreApi({
  isProduction: env.NEXT_PUBLIC_MIDTRANS_IS_PRODUCTION === 'true',
  serverKey: env.MIDTRANS_SERVER_KEY,
  clientKey: env.NEXT_PUBLIC_MIDTRANS_CLIENT_KEY,
})
