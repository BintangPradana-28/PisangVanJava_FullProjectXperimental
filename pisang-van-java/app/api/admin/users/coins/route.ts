import type { Prisma } from '@prisma/client'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { auth } from '@/src/auth'

const MAX_MANUAL_COIN_ADJUSTMENT = 1_000_000

const adjustCoinSchema = z.object({
  targetUserId: z.string(),
  // SECURITY FIX (audit QA & Security): sebelumnya tidak ada batas atas sama sekali —
  // sebuah akun ADMIN (atau sesi admin yang di-compromise) bisa menambah koin siapa pun
  // hingga Number.MAX_SAFE_INTEGER, dan karena checkout memakai koin sebagai potongan
  // harga langsung (1 koin = Rp1), ini setara mencetak saldo diskon tak terbatas.
  amount: z.number().int().min(-MAX_MANUAL_COIN_ADJUSTMENT).max(MAX_MANUAL_COIN_ADJUSTMENT),
  reason: z.string().min(5, 'Alasan wajib diisi untuk audit trail').max(500)
})

export async function POST(req: Request) {
  try {
    const session = await auth()
    // SECURITY FIX (audit QA & Security): sebelumnya ADMIN (bukan cuma SUPER_ADMIN) juga
    // diizinkan — komentar asli developer menyebut ini kompromi "agar fitur jalan untuk
    // demo". Penyesuaian saldo manual adalah operasi finansial sensitif; dikembalikan ke
    // niat "ZERO-TRUST GATE" semula: SUPER_ADMIN only. Kalau memang masih dibutuhkan untuk
    // demo, tambahkan kembali 'ADMIN' di array ini secara sadar.
    if (!session || session.user.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Unauthorized. Insufficient Privileges.' }, { status: 403 })
    }

    const body = await req.json()
    const { targetUserId, amount, reason } = adjustCoinSchema.parse(body)

    if (amount === 0) {
      return NextResponse.json({ error: 'Jumlah tidak valid' }, { status: 400 })
    }

    // ATOMIC TRANSACTION: Modifikasi saldo dan pencatatan audit tidak boleh terpisah.
    const result = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const user = await tx.user.update({
        where: { id: targetUserId },
        data: {
          koinPisang: { increment: amount } // Increment bekerja secara atomik di tingkat DB
        }
      })

      await tx.koinPisangLog.create({
        data: {
          userId: targetUserId,
          amount: amount,
          description: `Penyesuaian manual oleh Admin: ${reason}`
        }
      })

      await tx.auditLog.create({
        data: {
          action: 'MANUAL_KOIN_ADJUSTMENT',
          resource: 'User',
          resourceId: targetUserId,
          userId: session.user.id,
          details: JSON.stringify({ amount, reason, previousBalance: user.koinPisang - amount })
        }
      })

      return user
    })

    return NextResponse.json({ success: true, newBalance: result.koinPisang })
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Payload tidak valid', details: error.issues },
        { status: 400 }
      )
    }
    console.error('POST /api/admin/users/coins Error:', error)
    return NextResponse.json({ error: 'Gagal menyesuaikan Koin Pisang' }, { status: 500 })
  }
}
