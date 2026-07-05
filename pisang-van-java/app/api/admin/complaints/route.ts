import type { ComplaintStatus, Prisma } from '@prisma/client'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { auth } from '@/src/auth'

export async function GET(req: Request) {
  const session = await auth()
  if (!session || !['ADMIN', 'SUPER_ADMIN'].includes(session.user.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status')

  const complaints = await prisma.complaint.findMany({
    where: status ? { status: status as ComplaintStatus } : undefined,
    orderBy: { createdAt: 'desc' },
    include: {
      user: { select: { name: true, email: true } },
      order: { select: { id: true } }
    }
  })

  return NextResponse.json(complaints)
}

const resolveSchema = z.object({
  complaintId: z.string(),
  adminResponse: z.string().min(5),
  compensationKoin: z.number().int().min(0).default(0)
})

export async function PATCH(req: Request) {
  try {
    const session = await auth()
    if (!session || !['ADMIN', 'SUPER_ADMIN'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const body = await req.json()
    const { complaintId, adminResponse, compensationKoin } = resolveSchema.parse(body)

    const result = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const complaint = await tx.complaint.update({
        where: { id: complaintId },
        data: {
          adminResponse,
          compensationKoin,
          status: 'RESOLVED'
        }
      })

      if (compensationKoin > 0) {
        await tx.user.update({
          where: { id: complaint.userId },
          data: { koinPisang: { increment: compensationKoin } }
        })

        await tx.koinPisangLog.create({
          data: {
            userId: complaint.userId,
            amount: compensationKoin,
            description: `Kompensasi penyelesaian tiket pengaduan #${complaintId.slice(-6).toUpperCase()}`
          }
        })

        await tx.auditLog.create({
          data: {
            action: 'COMPLAINT_COMPENSATION',
            resource: 'User',
            resourceId: complaint.userId,
            userId: session.user.id,
            details: JSON.stringify({ complaintId, amount: compensationKoin })
          }
        })
      }

      return complaint
    })

    return NextResponse.json({ success: true, complaint: result })
  } catch (error: any) {
    console.error('PATCH /api/admin/complaints Error:', error)
    return NextResponse.json({ error: 'Gagal memproses resolusi tiket' }, { status: 500 })
  }
}
