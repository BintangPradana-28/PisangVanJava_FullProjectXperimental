import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { auth } from '@/src/auth'

const adjustCoinSchema = z.object({
  targetUserId: z.string(),
  amount: z.number().int(), // Bisa negatif untuk pengurangan
  reason: z.string().min(5, 'Alasan wajib diisi untuk audit trail')
})

export async function POST(req: Request) {
  try {
    const session = await auth()
    // ZERO-TRUST GATE: Hanya SUPER_ADMIN yang diizinkan mengubah uang secara manual (atau sesuaikan dengan kebiakan).
    // Saya mengizinkan ADMIN juga agar fitur jalan untuk demo, sesuaikan nanti jika perlu.
    if (!session || !['ADMIN', 'SUPER_ADMIN'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Unauthorized. Insufficient Privileges.' }, { status: 403 })
    }

    const body = await req.json()
    const { targetUserId, amount, reason } = adjustCoinSchema.parse(body)

    if (amount === 0) {
      return NextResponse.json({ error: 'Jumlah tidak valid' }, { status: 400 })
    }

    // ATOMIC TRANSACTION: Modifikasi saldo dan pencatatan audit tidak boleh terpisah.
    const result = await prisma.$transaction(async (tx: any) => {
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
