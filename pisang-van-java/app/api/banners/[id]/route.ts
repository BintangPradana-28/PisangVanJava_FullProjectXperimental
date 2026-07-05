import { type NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/src/auth'
import { bannerSchema } from '../schema'

async function checkAdmin() {
  const session = await auth()
  if (!session || !['ADMIN', 'SUPER_ADMIN'].includes(session.user.role)) return false
  return true
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await checkAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { id } = await params
    const rawData = await req.json()
    const parseResult = bannerSchema.safeParse(rawData)

    if (!parseResult.success) {
      return NextResponse.json(
        { success: false, error: 'Validation Failed', details: parseResult.error.format() },
        { status: 400 }
      )
    }

    const data = parseResult.data

    const banner = await prisma.banner.update({
      where: { id },
      data: {
        title: data.title,
        subtitle: data.subtitle,
        badge: data.badge,
        imageUrl: data.imageUrl,
        isActive: data.isActive,
        linkUrl: data.linkUrl,
        startDate: data.startDate ? new Date(data.startDate) : null,
        endDate: data.endDate ? new Date(data.endDate) : null,
        priority: data.priority
      }
    })

    return NextResponse.json({ success: true, data: banner })
  } catch (_error) {
    return NextResponse.json({ success: false, error: 'Server Error' }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await checkAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { id } = await params
    await prisma.banner.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (_error) {
    return NextResponse.json({ success: false, error: 'Server Error' }, { status: 500 })
  }
}
