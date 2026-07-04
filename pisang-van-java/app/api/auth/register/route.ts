import { type NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { rateLimit } from '@/lib/redis'
import { normalizePhoneNumber } from '@/lib/utils'
import { registerSchema } from '@/src/features/auth/schemas'
import { hashPassword } from '@/src/lib/password'
import { logger } from '@/src/lib/logger'

// SECURITY FIX (audit QA & Security):
// Endpoint ini adalah kontrak publik terdokumentasi di /api-docs (lihat
// src/lib/openapi/generator.ts) untuk konsumen API eksternal, jadi TIDAK dihapus —
// tapi implementasinya sebelumnya menyimpang dari alur registrasi utama
// (src/features/auth/actions.ts registerUser) dalam 3 hal:
//   1. Field `whatsapp` divalidasi tapi tidak pernah disimpan ke User.phone (data hilang).
//   2. Pesan 409 "Email sudah terdaftar" membocorkan eksistensi akun (user enumeration),
//      berbeda dari pesan opaque di alur utama.
//   3. Rate-limit key `register:${ip}` terpisah dari `register_ip_${ip}` milik alur utama,
//      sehingga penyerang bisa memakai kedua endpoint bergantian untuk melipatgandakan
//      kuota percobaan registrasi.
// Ketiganya diselaraskan dengan alur utama di bawah ini.
export async function POST(req: NextRequest) {
  try {
    // Rate limit key disamakan dengan src/features/auth/actions.ts agar kedua entry
    // point berbagi satu kuota per-IP, bukan dua kuota terpisah.
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || '127.0.0.1'
    const { success: withinLimit } = await rateLimit.limit(`register_ip_${ip}`)
    if (!withinLimit) {
      return NextResponse.json(
        { success: false, message: 'Terlalu banyak percobaan pendaftaran. Coba lagi nanti.' },
        { status: 429 }
      )
    }

    const body = await req.json()

    // 1. Zero-Trust Validation via Zod
    const parsed = registerSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          message: 'Format data tidak valid',
          data: parsed.error.flatten()
        },
        { status: 400 }
      )
    }

    const { name, email, password, whatsapp, referralCode } = parsed.data

    // 2. Anti-user-enumeration: cek email tanpa membocorkan eksistensi akun di respons.
    const existingUser = await prisma.user.findUnique({
      where: { email },
      select: { id: true }
    })

    if (existingUser) {
      // OPAQUE ERROR — sama seperti registerUser() agar tidak jadi oracle enumerasi akun.
      return NextResponse.json(
        {
          success: false,
          message: 'Pendaftaran ditolak. Jika Anda sudah memiliki akun, silakan masuk.'
        },
        { status: 409 }
      )
    }

    // 3. Hash password securely
    const passwordHash = await hashPassword(password)

    // 3b. Referral code opsional (sama seperti alur utama)
    let validReferralCode: string | null = null
    if (referralCode) {
      const referrer = await prisma.user.findUnique({ where: { referralCode } })
      if (referrer) {
        validReferralCode = referrer.referralCode
      }
    }

    // 4. Save to Database (Prisma) — phone kini ikut tersimpan, tidak lagi hilang.
    const newUser = await prisma.user.create({
      data: {
        name,
        email,
        phone: normalizePhoneNumber(whatsapp),
        passwordHash,
        role: 'CUSTOMER',
        referredBy: validReferralCode
      },
      select: { id: true, name: true, email: true }
    })

    // 5. Return sanitized response (NEVER return passwordHash)
    return NextResponse.json(
      {
        success: true,
        message: 'Registrasi berhasil',
        data: { id: newUser.id, name: newUser.name, email: newUser.email }
      },
      { status: 201 }
    )
  } catch (error) {
    logger.error(error as Error, 'Register Error')
    return NextResponse.json(
      { success: false, message: 'Terjadi kesalahan pada server' },
      { status: 500 }
    )
  }
}
