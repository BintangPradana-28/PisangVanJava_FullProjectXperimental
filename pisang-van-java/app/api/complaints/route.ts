import { type NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { rateLimit } from '@/lib/redis'
import { auth } from '@/src/auth'

const createComplaintSchema = z
  .object({
    subject: z.string().trim().min(3).max(100),
    description: z.string().trim().min(10).max(2000),
    orderId: z.string().trim().max(64).nullable().optional()
  })
  .strict()

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0] || '127.0.0.1'
  const { success: limitSuccess } = await rateLimit.limit(`complaints_post_${ip}`)
  if (!limitSuccess) {
    return NextResponse.json(
      { success: false, error: 'Terlalu banyak permintaan. Silakan coba lagi nanti.' },
      { status: 429 }
    )
  }

  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await req.json()
    const parsed = createComplaintSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Input tidak valid', details: parsed.error.format() },
        { status: 400 }
      )
    }

    const { subject, description, orderId } = parsed.data

    // Verify orderId belongs to the authenticated user if provided
    if (orderId) {
      const order = await prisma.order.findFirst({
        where: { id: orderId, userId: session.user.id }
      })
      if (!order) {
        return NextResponse.json(
          { success: false, error: 'Nomor pesanan tidak valid atau tidak ditemukan.' },
          { status: 400 }
        )
      }
    }

    const complaint = await prisma.complaint.create({
      data: {
        userId: session.user.id,
        orderId: orderId || null,
        subject,
        description,
        status: 'OPEN'
      }
    })

    return NextResponse.json({ success: true, data: { id: complaint.id } }, { status: 201 })
  } catch (error) {
    console.error('[COMPLAINT_POST_ERROR]', error)
    return NextResponse.json(
      { success: false, error: 'Gagal membuat laporan pengaduan.' },
      { status: 500 }
    )
  }
}
