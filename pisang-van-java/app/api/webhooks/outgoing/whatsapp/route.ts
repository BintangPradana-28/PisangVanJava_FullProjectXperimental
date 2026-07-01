import { Receiver } from '@upstash/qstash'
import { type NextRequest, NextResponse } from 'next/server'
import { sendWhatsAppNotification } from '@/lib/notifications'
import { logger } from '@/src/lib/logger'

const currentSigningKey = process.env.QSTASH_CURRENT_SIGNING_KEY || ''
const nextSigningKey = process.env.QSTASH_NEXT_SIGNING_KEY || ''

const receiver =
  currentSigningKey && nextSigningKey ? new Receiver({ currentSigningKey, nextSigningKey }) : null

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text()

    if (!receiver) {
      logger.warn('[QSTASH WHATSAPP] Signature verification bypassed because signing keys are not configured')
      if (process.env.NODE_ENV === 'production') {
        return NextResponse.json(
          { success: false, error: 'Misconfigured signing keys' },
          { status: 500 }
        )
      }
    } else {
      const signature = req.headers.get('upstash-signature')
      const isValid = await receiver.verify({
        signature: signature || '',
        body: rawBody
      })
      if (!isValid) {
        return NextResponse.json(
          { success: false, error: 'Unauthorized signature' },
          { status: 401 }
        )
      }
    }

    const payload = JSON.parse(rawBody)
    const { customerPhone, customerName, orderStatus, orderId, etaMinutes, courierName } = payload

    if (!customerPhone || !customerName || !orderStatus || !orderId) {
      return NextResponse.json({ success: false, error: 'Missing parameters' }, { status: 400 })
    }

    await sendWhatsAppNotification(
      customerPhone,
      customerName,
      orderStatus,
      orderId,
      etaMinutes,
      courierName
    )

    return NextResponse.json({ success: true, message: 'WhatsApp notification sent' })
  } catch (error) {
    logger.error(error as Error, '[QSTASH WHATSAPP WH ERROR] Outgoing WA message failed')
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 })
  }
}
