import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { rateLimit } from '@/lib/redis'

// STRICT VALIDATION (C-Level Standard)
const ContactSchema = z
  .object({
    nama: z.string().min(2, 'Nama terlalu pendek').max(100, 'Nama terlalu panjang'),
    email: z.string().email('Format email tidak valid'),
    phone: z.string().min(8, 'Nomor HP terlalu pendek').max(20, 'Nomor HP terlalu panjang'),
    pesan: z.string().min(5, 'Pesan terlalu pendek').max(2000, 'Pesan terlalu panjang'),
    consent: z.boolean().refine((val) => val === true, {
      message: 'Anda harus menyetujui Kebijakan Privasi'
    })
  })
  .strict()

export async function POST(req: Request) {
  try {
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0] || '127.0.0.1'
    const { success: limitSuccess } = await rateLimit.limit(`contact_post_${ip}`)
    if (!limitSuccess) {
      return NextResponse.json(
        { error: 'Terlalu banyak permintaan. Silakan coba lagi nanti.' },
        { status: 429 }
      )
    }

    const rawBody = await req.json()

    // 1. ABSOLUTE QUARANTINE (Zod Validation)
    const parsed = ContactSchema.safeParse(rawBody)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validasi gagal', details: parsed.error.format() },
        { status: 400 }
      )
    }

    const { nama, email, phone, pesan } = parsed.data
    const ipAddress = req.headers.get('x-forwarded-for') || 'Unknown IP'
    const userAgent = req.headers.get('user-agent') || 'Unknown Agent'

    // Format the database message to store the email and phone number cleanly
    const formattedMessage = `[Email: ${email} | Phone: ${phone}]\n\n${pesan}`

    // 2. SAVE TO POSTGRES (Data Asset Capture)
    await prisma.contactLead.create({
      data: {
        name: nama,
        message: formattedMessage,
        ipAddress: ipAddress.substring(0, 45), // IPv6 max length safe
        userAgent: userAgent.substring(0, 255),
        isConsent: true
      }
    })

    // 3. GENERATE WHATSAPP REDIRECT URL
    // Kita panggil Setting nomor WA dari database juga jika perlu, tapi untuk performa kita gunakan env/default
    const waNumber = process.env.WHATSAPP_NUMBER || '6285773728748'
    const text = encodeURIComponent(
      `Halo Van Java! Saya *${nama}*.\nEmail: ${email}\nNo. HP: ${phone}\n\n${pesan}`
    )
    const redirectUrl = `https://wa.me/${waNumber}?text=${text}`

    // Return the secure redirect URL
    return NextResponse.json({ success: true, redirectUrl })
  } catch (error) {
    // 4. GENERIC OPAQUE ERROR (No Stack Trace Leak)
    console.error('[SECURITY_LOG] Contact Form Error:', error)
    return NextResponse.json(
      { error: 'Terjadi kesalahan pada server. Permintaan Anda tidak dapat diproses.' },
      { status: 500 }
    )
  }
}
