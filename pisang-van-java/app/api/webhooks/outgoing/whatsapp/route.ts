import * as Sentry from '@sentry/nextjs'
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
    // SECURITY FIX (audit QA & Security): sebelumnya `if (receiver) { ...verify... }` — kalau
    // QSTASH_CURRENT_SIGNING_KEY / QSTASH_NEXT_SIGNING_KEY tidak di-set, `receiver` bernilai
    // null dan verifikasi signature DILEWATI SELURUHNYA. Endpoint ini mengirim pesan WhatsApp
    // sungguhan (via Fonnte) — tanpa verifikasi, siapa pun bisa memakainya sebagai open relay
    // untuk mengirim pesan (termasuk konten phishing mengatasnamakan Pisang Van Java) ke nomor
    // mana pun, dengan biaya API dan risiko nomor WA bisnis di-banned karena spam. Sekarang
    // fail-closed: signing key wajib ada, dan signature wajib valid.
    if (!receiver) {
      logger.error(
        new Error('QSTASH signing keys missing'),
        '[SECURITY] QSTASH_CURRENT_SIGNING_KEY/QSTASH_NEXT_SIGNING_KEY belum dikonfigurasi — menolak semua request demi keamanan.'
      )
      // ADDITION (QA & Security): captureMessage eksplisit agar misconfiguration ini
      // pasti memicu alert Sentry, bukan cuma masuk log yang bisa terlewat.
      Sentry.captureMessage(
        '[SECURITY][MISCONFIG] QSTASH signing keys belum di-set — semua notifikasi WhatsApp outgoing ditolak.',
        'error'
      )
      return NextResponse.json({ success: false, error: 'Webhook not configured' }, { status: 503 })
    }

    const rawBody = await req.text()

    const signature = req.headers.get('upstash-signature')
    const isValid = await receiver.verify({
      signature: signature || '',
      body: rawBody
    })
    if (!isValid) {
      return NextResponse.json({ success: false, error: 'Unauthorized signature' }, { status: 401 })
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
