import { type NextRequest, NextResponse } from 'next/server'
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

    const users = await prisma.user.findMany({
      where: filterDeleted ? { isDeleted: true } : { isDeleted: false },
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
    })

    return NextResponse.json({ success: true, data: users })
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

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { role },
      select: { id: true, name: true, email: true, role: true }
    })

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
