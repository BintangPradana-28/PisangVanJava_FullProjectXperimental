import { Resend } from 'resend'
import { env } from '@/src/env'

export const resend = env.RESEND_API_KEY 
  ? new Resend(env.RESEND_API_KEY)
  : null
