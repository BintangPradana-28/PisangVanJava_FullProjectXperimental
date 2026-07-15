/**
 * lib/notifications.ts
 *
 * Abstraksi untuk mengirim notifikasi ke pelanggan via WhatsApp.
 */

import { env } from '@/src/env'

export async function sendWhatsAppNotification(
  customerPhone: string,
  customerName: string,
  orderStatus: string,
  orderId: string,
  etaMinutes?: number | null,
  courierName?: string | null
) {
  try {
    let message = ''
    const statusLower = orderStatus.toLowerCase()

    if (statusLower === 'confirmed' || statusLower === 'processing') {
      message = `Halo Kak ${customerName}! 🍌\nPesanan Pisang Goreng Van Java Anda (ID: ${orderId.slice(-5).toUpperCase()}) telah Dikonfirmasi dan sedang diproses di dapur kami.`
    } else if (statusLower === 'ready') {
      message = `Yeay! 🥳\nPesanan Pisang Goreng Van Java Anda (ID: ${orderId.slice(-5).toUpperCase()}) sudah SIAP! Silakan diambil atau ditunggu kedatangan kurirnya ya Kak.`
    } else if (statusLower === 'out_for_delivery') {
      const etaText = etaMinutes ? ` Estimasi tiba: ${etaMinutes} menit.` : ''
      message = `Halo Kak ${customerName}! 🛵\nKurir${courierName ? ` ${courierName}` : ''} sedang menuju lokasi Anda!${etaText} Mohon bersiap menerima pesanan Pisang Goreng Van Java Anda (ID: ${orderId.slice(-5).toUpperCase()}).`
    } else if (statusLower === 'delivered') {
      message = `Halo Kak ${customerName}! 📦\nPesanan Pisang Goreng Van Java Anda (ID: ${orderId.slice(-5).toUpperCase()}) telah diantar. Terima kasih! Selamat menikmati!`
    } else if (statusLower === 'cancelled' || statusLower === 'canceled') {
      message = `Mohon maaf Kak ${customerName} 🙏\nPesanan Anda (ID: ${orderId.slice(-5).toUpperCase()}) terpaksa kami batalkan. Hubungi admin untuk informasi lebih lanjut.`
    } else {
      return // Tidak ada notifikasi untuk status lain
    }

    const fonnteToken = env.FONNTE_API_TOKEN
    if (fonnteToken) {
      console.log(`[WA] Mengirim pesan ke Fonnte untuk ${customerPhone}...`)
      const res = await fetch('https://api.fonnte.com/send', {
        method: 'POST',
        headers: { Authorization: fonnteToken },
        body: new URLSearchParams({
          target: customerPhone,
          message: message
        })
      })

      if (!res.ok) {
        const text = await res.text()
        console.error(`[WA ERROR] Fonnte API gagal dengan status ${res.status}: ${text}`)
        return { success: false, error: new Error(`Fonnte API error: ${text}`) }
      }

      const responseData = await res.json()
      console.log(`[WA SUCCESS] Notifikasi berhasil dikirim via Fonnte:`, responseData)
    } else {
      console.log(`\n==========================================`)
      console.log(`[MOCK WEBHOOK WA] Mempersiapkan pengiriman (FONNTE_API_TOKEN kosong):`)
      console.log(`Ke     : ${customerPhone}`)
      console.log(`Pesan  :\n${message}`)
      console.log(`==========================================\n`)
    }

    return { success: true }
  } catch (error) {
    console.error('[WEBHOOK ERROR] Gagal mengirim notifikasi WA:', error)
    return { success: false, error }
  }
}

export async function queueWhatsAppNotification(
  customerPhone: string,
  customerName: string,
  orderStatus: string,
  orderId: string,
  etaMinutes?: number | null,
  courierName?: string | null
) {
  const qstashToken = env.QSTASH_TOKEN
  if (!qstashToken) {
    console.warn('[WA] QStash is not configured. Falling back to synchronous Fonnte send.')
    return sendWhatsAppNotification(
      customerPhone,
      customerName,
      orderStatus,
      orderId,
      etaMinutes,
      courierName
    )
  }

  try {
    const { qstash } = await import('@/src/lib/qstash')
    const payload = {
      customerPhone,
      customerName,
      orderStatus,
      orderId,
      etaMinutes,
      courierName
    }

    const appUrl = env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    const endpoint = `${appUrl}/api/webhooks/outgoing/whatsapp`

    console.log(`[QSTASH] Queueing WA notification for order ${orderId} to endpoint: ${endpoint}`)
    await qstash.publishJSON({
      url: endpoint,
      body: payload
    })

    return { success: true }
  } catch (error) {
    console.error('[QSTASH ERROR] Failed to queue WA notification:', error)
    // Fallback to sync send on QStash publish failure to prevent missing notifications
    return sendWhatsAppNotification(
      customerPhone,
      customerName,
      orderStatus,
      orderId,
      etaMinutes,
      courierName
    )
  }
}
