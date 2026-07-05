import type { Prisma } from '@prisma/client'
import { type NextRequest, NextResponse } from 'next/server'
import { logAudit } from '@/lib/audit'
import { prisma } from '@/lib/prisma'
import { auth } from '@/src/auth'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    if (!session || !['ADMIN', 'SUPER_ADMIN'].includes(session.user.role)) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 403 })
    }

    const { searchParams } = new URL(req.url)
    const filterDeleted = searchParams.get('deleted') === 'true'
    const page = Math.max(parseInt(searchParams.get('page') || '1', 10), 1)
    const limit = Math.max(parseInt(searchParams.get('limit') || '50', 10), 1)
    const safeLimit = Math.min(limit, 100)
    const skip = (page - 1) * safeLimit

    const where: Prisma.UserWhereInput = filterDeleted ? { isDeleted: true } : { isDeleted: false }

    const [users, totalCount] = await Promise.all([
      prisma.user.findMany({
        where,
        skip,
        take: safeLimit,
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          koinPisang: true,
          referralCode: true,
          referredBy: true,
          isDeleted: true,
          isBanned: true,
          createdAt: true
        },
        orderBy: { createdAt: 'desc' }
      }),
      prisma.user.count({ where })
    ])

    return NextResponse.json({
      success: true,
      data: users,
      pagination: {
        page,
        limit: safeLimit,
        total: totalCount,
        totalPages: Math.ceil(totalCount / safeLimit)
      }
    })
  } catch (error) {
    console.error('GET /api/admin/users Error:', error)
    return NextResponse.json(
      { success: false, message: 'Terjadi kesalahan pada server' },
      { status: 500 }
    )
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const session = await auth()
    if (!session || !['ADMIN', 'SUPER_ADMIN'].includes(session.user.role)) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 403 })
    }

    const body = await req.json()
    const { userId, role } = body

    if (!userId || !role || !['ADMIN', 'CUSTOMER', 'RESELLER'].includes(role)) {
      return NextResponse.json({ success: false, message: 'Data tidak valid' }, { status: 400 })
    }

    const targetUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true }
    })
    if (!targetUser) {
      return NextResponse.json({ success: false, message: 'User tidak ditemukan' }, { status: 404 })
    }

    const updatedUser = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const u = await tx.user.update({
        where: { id: userId },
        data: { role },
        select: { id: true, name: true, email: true, role: true }
      })

      if (role === 'RESELLER') {
        await tx.b2BDeal.updateMany({
          where: {
            ownerId: userId,
            dealName: 'Reseller Application',
            stage: { in: ['PROSPECTING', 'NEGOTIATION'] }
          },
          data: { stage: 'CLOSED_WON' }
        })
      } else if (role === 'CUSTOMER') {
        await tx.b2BDeal.updateMany({
          where: {
            ownerId: userId,
            dealName: 'Reseller Application',
            stage: { in: ['PROSPECTING', 'NEGOTIATION'] }
          },
          data: { stage: 'CLOSED_LOST' }
        })
      }

      return u
    })

    const ip = req.headers.get('x-forwarded-for')?.split(',')[0] || '127.0.0.1'
    await logAudit(
      'CHANGE_USER_ROLE',
      'User',
      userId,
      {
        oldRole: targetUser.role,
        newRole: role
      },
      ip
    )

    return NextResponse.json({
      success: true,
      data: updatedUser,
      message: 'Peran pengguna berhasil diperbarui'
    })
  } catch (error) {
    console.error('PATCH /api/admin/users Error:', error)
    return NextResponse.json(
      { success: false, message: 'Terjadi kesalahan pada server' },
      { status: 500 }
    )
  }
}
