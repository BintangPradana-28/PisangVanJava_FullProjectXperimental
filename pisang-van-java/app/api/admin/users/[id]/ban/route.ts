import type { Prisma } from '@prisma/client'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/src/auth'

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth()
    // 🛡️ ZERO-TRUST: Strict RBAC for banning users
    if (!session || !['SUPER_ADMIN', 'ADMIN'].includes(session.user.role)) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 403 })
    }

    const { id: targetUserId } = await params
    const body = await req.json()
    const { isBanned } = body // Expected boolean

    if (typeof isBanned !== 'boolean') {
      return NextResponse.json({ success: false, message: 'Invalid payload' }, { status: 400 })
    }

    if (targetUserId === session.user.id) {
      return NextResponse.json(
        { success: false, message: 'Anda tidak dapat melakukan aksi ini pada diri sendiri' },
        { status: 400 }
      )
    }

    // Eksekusi atomik (Transaction)
    const result = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      // 1. Update status ban pengguna
      const updatedUser = await tx.user.update({
        where: { id: targetUserId },
        data: { isBanned }
      })

      // 2. Jika di-ban, eksekusi pencabutan sesi secara langsung (Session Revocation)
      if (isBanned) {
        await tx.session.deleteMany({
          where: { userId: targetUserId }
        })
      }

      // 3. Catat ke dalam log audit (Security compliance)
      await tx.auditLog.create({
        data: {
          action: isBanned ? 'BAN' : 'UNBAN',
          resource: 'User',
          resourceId: targetUserId,
          userId: session.user.id, // Admin yang mengeksekusi
          ipAddress: req.headers.get('x-forwarded-for') || 'unknown',
          details: JSON.stringify({ isBanned })
        }
      })

      return updatedUser
    })

    return NextResponse.json({ success: true, isBanned: result.isBanned })
  } catch (error) {
    console.error('POST /api/admin/users/[id]/ban Error:', error)
    return NextResponse.json(
      { success: false, message: 'Gagal memproses aksi pengguna' },
      { status: 500 }
    )
  }
}
