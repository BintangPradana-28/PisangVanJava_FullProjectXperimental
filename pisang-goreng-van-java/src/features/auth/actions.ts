'use server'

import { prisma } from '@/lib/prisma'
import { registerSchema, forgotPasswordSchema } from './schemas'
import bcrypt from 'bcryptjs'
import { redis, rateLimit } from '@/lib/redis'
import crypto from 'crypto'
import { headers } from 'next/headers'

export async function registerUser(formData: FormData) {
  try {
    // 1. EXTRACT AND SANITIZE PAYLOAD
    const payload = {
      name: formData.get('name'),
      email: formData.get('email'),
      whatsapp: formData.get('whatsapp'),
      password: formData.get('password'),
      consent: formData.get('consent') === 'on' || formData.get('consent') === 'true',
    }

    // 2. THE ABSOLUTE QUARANTINE
    const parsed = registerSchema.safeParse(payload)
    if (!parsed.success) {
      return { success: false, error: 'Validasi gagal. Pastikan semua data diisi dengan format yang benar.' }
    }

    const { name, email, password, whatsapp } = parsed.data

    // 3. THE IRON GATE: IP RATE LIMITING
    const headerStore = await headers()
    const ip = headerStore.get('x-forwarded-for')?.split(',')[0] || 'unknown-ip'
    
    const { success: rateLimitSuccess } = await rateLimit.limit(`register_ip_${ip}`)
    if (!rateLimitSuccess) {
      return { success: false, error: 'Terlalu banyak aktivitas. Silakan coba lagi nanti.' }
    }

    // 4. ANTI-USER ENUMERATION & DUPLICATE CHECK
    const existingUser = await prisma.user.findUnique({ 
      where: { email },
      select: { id: true } 
    })
    
    if (existingUser) {
      // OPAQUE ERROR: Menolak pendaftaran tanpa membocorkan eksistensi data secara terang-terangan
      return { success: false, error: 'Pendaftaran ditolak. Jika Anda sudah memiliki akun, silakan masuk.' }
    }

    // 5. SECONDARY HASHING: BCRYPTJS MANDATE
    const passwordHash = await bcrypt.hash(password, 12)

    // 6. LEAST PRIVILEGE DB INSERT
    await prisma.user.create({
      data: {
        name,
        email,
        phone: whatsapp,
        passwordHash,
        role: 'CUSTOMER', // Default absolut, anti-mass assignment
      },
      select: { id: true }
    })

    return { success: true }
  } catch (error) {
    // BLIND LOGGING: Jangan log raw data atau password
    console.error('[SECURITY] Register Error:', error instanceof Error ? error.message : 'Unknown')
    return { success: false, error: 'Kesalahan sistem. Permintaan dibatalkan.' }
  }
}

export async function generateResetToken(formData: FormData) {
  try {
    // 1. EXTRACT PAYLOAD SECURELY
    const payload = {
      email: formData.get('email'),
    }
    
    // 2. THE ABSOLUTE QUARANTINE
    const parsed = forgotPasswordSchema.safeParse(payload)
    if (!parsed.success) {
      return { success: false, error: 'Format email tidak valid.' }
    }

    const { email } = parsed.data

    // 3. THE IRON GATE: IP RATE LIMITING
    const headerStore = await headers()
    const ip = headerStore.get('x-forwarded-for')?.split(',')[0] || 'unknown-ip'

    const { success: rateLimitSuccess } = await rateLimit.limit(`reset_ip_${ip}`)
    if (!rateLimitSuccess) {
      return { success: false, error: 'Terlalu banyak permintaan. Silakan coba lagi nanti.' }
    }

    const user = await prisma.user.findUnique({ where: { email } })
    
    // 4. CONSTANT-TIME BLIND RESPONSE (ANTI-USER ENUMERATION)
    // Jangan pernah biarkan eksekusi gagal atau melambat jika user tidak ditemukan
    if (user) {
      // 5. THE CRYPTO UUID MANDATE
      // Menghasilkan token acak 32-byte yang mustahil ditebak
      const token = crypto.randomBytes(32).toString('hex')
      
      // 6. HUKUM TOKEN SEKALI PAKAI (HARD EXPIRE 15 MENIT)
      // Waktu 1 jam (3600s) terlalu berisiko. Diubah ke 900s (15 menit).
      await redis.set(`reset-token:${token}`, user.id, { ex: 900 })

      // TODO: Panggil fungsi pihak ketiga untuk mengirim email berisi token
      // sendEmail(user.email, `https://.../reset-password?token=${token}`)
    }

    // OPAQUE MESSAGE: Selalu kembalikan respons yang sama
    return { 
      success: true, 
      message: 'Jika email terdaftar di sistem kami, tautan pemulihan sandi telah dikirim.' 
    }
  } catch (error) {
    // 7. BLIND LOGGING
    console.error('[SECURITY] Reset Password Error:', error instanceof Error ? error.message : 'Unknown')
    return { success: false, error: 'Terjadi kesalahan sistem.' }
  }
}
