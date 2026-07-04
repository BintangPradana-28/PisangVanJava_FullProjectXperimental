import type { Prisma } from '@prisma/client'
import { type NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { logAudit } from '@/lib/audit'
import { prisma } from '@/lib/prisma'
import { rateLimit } from '@/lib/redis'
import { auth } from '@/src/auth'

const reviewSchema = z.object({
  orderId: z.string().min(1),
  variantId: z.string().min(1).optional(),
  rating: z.number().int().min(1).max(5),
  comment: z.string().max(1000).optional(),
  imageUrl: z
    .string()
    .url()
    .refine(
      (url) => url.includes('res.cloudinary.com'),
      'URL gambar harus berasal dari res.cloudinary.com'
    )
    .optional()
    .or(z.literal(''))
})

// GET /api/reviews
export async function GET(req: NextRequest) {
  const variantId = req.nextUrl.searchParams.get('variantId')
  const ratingFilter = req.nextUrl.searchParams.get('rating')
  const hasComment = req.nextUrl.searchParams.get('hasComment') === 'true'
  const withPhoto = req.nextUrl.searchParams.get('withPhoto') === 'true'
  const session = await auth()
  const isAdmin = session && ['ADMIN', 'SUPER_ADMIN'].includes(session.user.role)
  const adminView = req.nextUrl.searchParams.get('adminView') === 'true' && isAdmin

  const page = Math.max(parseInt(req.nextUrl.searchParams.get('page') || '1', 10), 1)
  const limit = Math.max(parseInt(req.nextUrl.searchParams.get('limit') || '10', 10), 1)
  const safeLimit = Math.min(limit, 50)
  const skip = (page - 1) * safeLimit

  const where: Prisma.ReviewWhereInput = adminView ? {} : { isHidden: false }
  if (variantId) where.variantId = variantId
  if (ratingFilter) where.rating = parseInt(ratingFilter, 10)
  if (hasComment) where.comment = { not: null, gt: '' }
  if (withPhoto) where.imageUrl = { not: null, gt: '' }

  try {
    const reviews = await prisma.review.findMany({
      where,
      skip,
      take: safeLimit,
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { name: true } },
        variant: { select: { flavorName: true } }
      }
    })

    const data = reviews.map((r: any) => {
      const maskName = (name: string | null) => {
        if (!name) return 'A****n'
        if (name.length <= 2) return name
        return name[0] + '*'.repeat(name.length - 2) + name[name.length - 1]
      }
      return {
        id: r.id,
        userId: r.userId,
        userName: adminView ? r.user?.name : maskName(r.user?.name),
        variantName: r.variant?.flavorName || 'Pesanan Umum',
        rating: r.rating,
        comment: r.comment,
        imageUrl: r.imageUrl,
        isVerifiedBuyer: r.isVerifiedBuyer,
        isHidden: r.isHidden,
        createdAt: r.createdAt.toISOString()
      }
    })

    const allReviewsWhere: Prisma.ReviewWhereInput = variantId
      ? { variantId, isHidden: false }
      : { isHidden: false }

    const aggregates = await prisma.review.aggregate({
      where: allReviewsWhere,
      _avg: { rating: true },
      _count: { id: true }
    })

    const starCountsGroup = await prisma.review.groupBy({
      by: ['rating'],
      where: allReviewsWhere,
      _count: { id: true }
    })

    const starCounts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
    starCountsGroup.forEach((g: any) => {
      const r = g.rating
      if (r >= 1 && r <= 5) {
        starCounts[r as keyof typeof starCounts] = g._count.id
      }
    })

    const average = aggregates._avg.rating ? Number(aggregates._avg.rating.toFixed(1)) : 0
    const total = aggregates._count.id

    return NextResponse.json({
      success: true,
      data,
      pagination: {
        page,
        limit: safeLimit,
        total
      },
      aggregates: { average, total, starCounts }
    })
  } catch (err) {
    console.error('[GET /api/reviews]', err)
    return NextResponse.json(
      { success: false, error: 'Gagal mengambil data ulasan.' },
      { status: 500 }
    )
  }
}

// POST /api/reviews
export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0] || '127.0.0.1'
  const { success: limitSuccess } = await rateLimit.limit(`reviews_post_${ip}`)
  if (!limitSuccess) {
    return NextResponse.json(
      { success: false, error: 'Terlalu banyak permintaan. Silakan coba lagi nanti.' },
      { status: 429 }
    )
  }

  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json(
      { success: false, error: 'Login terlebih dahulu untuk memberikan ulasan.' },
      { status: 401 }
    )
  }

  const body = await req.json()
  const parsed = reviewSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: parsed.error.issues[0].message },
      { status: 400 }
    )
  }

  const { orderId, variantId, rating, comment, imageUrl } = parsed.data

  try {
    // SECURITY FIX (audit QA & Security — review-bombing gap): sebelumnya hanya menolak
    // ketika order DITEMUKAN tapi milik orang lain. Kalau orderId TIDAK ADA sama sekali
    // (string bebas apa pun), request tetap lolos dengan isVerifiedBuyer: false — artinya
    // satu akun bisa membuat banyak review dengan orderId fiktif berbeda-beda tanpa pernah
    // punya order asli (unique constraint userId_orderId tidak menahan ini karena orderId-nya
    // bebas). Sekarang orderId WAJIB merujuk order asli milik user ini, dan order harus sudah
    // sampai ke pelanggan (DELIVERED/COMPLETED) — bukan sekadar dibuat (PENDING_PAYMENT dst).
    const order = await prisma.order.findUnique({ where: { id: orderId } })

    if (!order || order.userId !== session.user.id) {
      return NextResponse.json(
        { success: false, error: 'Order tidak ditemukan atau bukan milik Anda.' },
        { status: 403 }
      )
    }

    if (order.status !== 'DELIVERED' && order.status !== 'COMPLETED') {
      return NextResponse.json(
        {
          success: false,
          error: 'Ulasan hanya bisa diberikan setelah pesanan selesai diterima.'
        },
        { status: 400 }
      )
    }

    const isVerifiedBuyer = true

    const review = await prisma.review.upsert({
      where: { userId_orderId: { userId: session.user.id, orderId } },
      create: {
        userId: session.user.id,
        orderId,
        variantId: variantId ?? null,
        rating,
        comment: comment ?? null,
        imageUrl: imageUrl ?? null,
        isVerifiedBuyer
      },
      update: {
        rating,
        comment: comment ?? null,
        imageUrl: imageUrl ?? null
      }
    })
    return NextResponse.json({ success: true, data: review }, { status: 201 })
  } catch (err) {
    console.error('[POST /api/reviews]', err)
    return NextResponse.json({ success: false, error: 'Gagal menyimpan ulasan.' }, { status: 500 })
  }
}

// PATCH /api/reviews — Admin only: toggle isHidden
export async function PATCH(req: NextRequest) {
  try {
    const session = await auth()
    if (!session || !['ADMIN', 'SUPER_ADMIN'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const body = await req.json()
    const { reviewId, isHidden } = body
    if (!reviewId || typeof isHidden !== 'boolean') {
      return NextResponse.json({ error: 'Payload tidak valid' }, { status: 400 })
    }

    const updated = await prisma.review.update({
      where: { id: reviewId },
      data: { isHidden }
    })

    const ip = req.headers.get('x-forwarded-for')?.split(',')[0] || '127.0.0.1'
    await logAudit('MODERATE_REVIEW_HIDE', 'Review', reviewId, { isHidden }, ip)

    return NextResponse.json({ success: true, review: updated })
  } catch (err) {
    console.error('[PATCH /api/reviews]', err)
    return NextResponse.json(
      { success: false, error: 'Gagal memperbarui ulasan.' },
      { status: 500 }
    )
  }
}

// DELETE /api/reviews — Admin only: hard delete a review
export async function DELETE(req: NextRequest) {
  try {
    const session = await auth()
    if (!session || !['ADMIN', 'SUPER_ADMIN'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const { searchParams } = new URL(req.url)
    const reviewId = searchParams.get('reviewId')
    if (!reviewId) {
      return NextResponse.json({ error: 'reviewId diperlukan' }, { status: 400 })
    }

    await prisma.review.delete({ where: { id: reviewId } })

    const ip = req.headers.get('x-forwarded-for')?.split(',')[0] || '127.0.0.1'
    await logAudit('MODERATE_REVIEW_DELETE', 'Review', reviewId, null, ip)

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[DELETE /api/reviews]', err)
    return NextResponse.json({ success: false, error: 'Gagal menghapus ulasan.' }, { status: 500 })
  }
}
