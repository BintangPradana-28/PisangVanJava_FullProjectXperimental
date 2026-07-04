import { type NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { rateLimit } from '@/lib/redis'
import { auth } from '@/src/auth'
import { hashPassword, verifyPassword } from '@/src/lib/password'
import { logger } from '@/src/lib/logger'

const passwordSchema = z.object({
  oldPassword: z.string().min(1, 'Password lama wajib diisi'),
  newPassword: z.string().min(8, 'Password baru minimal 8 karakter')
})

export async function PUT(req: NextRequest) {
  try {
    const session = await auth()
    const userId = session?.user?.id
    if (!session || !userId) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 })
    }

    // RAG Source: app/api/user/password/route.ts (apply rate-limiting to password change endpoints)
    const { success: withinLimit } = await rateLimit.limit(`pwd-change:${userId}`)
    if (!withinLimit) {
      return NextResponse.json(
        { success: false, message: 'Terlalu banyak percobaan penggantian password. Coba lagi dalam 15 menit.' },
        { status: 429 }
      )
    }

    const body = await req.json()
    const parsed = passwordSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          message: parsed.error.issues[0]?.message || 'Data tidak valid'
        },
        { status: 400 }
      )
    }

    const { oldPassword, newPassword } = parsed.data

    // Ambil password lama dari DB
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { passwordHash: true }
    })

    if (!user) {
      return NextResponse.json({ success: false, message: 'User not found' }, { status: 404 })
    }

    // Jika pengguna login dengan OAuth dan tidak punya password sebelumnya
    if (!user.passwordHash) {
      return NextResponse.json(
        {
          success: false,
          message:
            'Akun ini didaftarkan menggunakan Google/OAuth. Anda tidak dapat mengubah password.'
        },
        { status: 400 }
      )
    }

    // Verifikasi password lama
    const isPasswordValid = await verifyPassword(user.passwordHash, oldPassword)
    if (!isPasswordValid) {
      return NextResponse.json(
        { success: false, message: 'Password lama tidak sesuai.' },
        { status: 400 }
      )
    }

    // Hash password baru
    const hashedNewPassword = await hashPassword(newPassword)

    // Simpan ke database
    await prisma.user.update({
      where: { id: userId },
      data: { passwordHash: hashedNewPassword }
    })

    return NextResponse.json({ success: true, message: 'Password berhasil diubah.' })
  } catch (error) {
    logger.error(error as Error, 'PUT /api/user/password Error')
    return NextResponse.json({ success: false, message: 'Internal Server Error' }, { status: 500 })
  }
}
