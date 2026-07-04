import { revalidatePath } from 'next/cache'
import { type NextRequest, NextResponse } from 'next/server'
import { sseEmitter } from '@/lib/eventEmitter'
import { prisma } from '@/lib/prisma'
import DOMPurify from '@/lib/sanitize'
import { auth } from '@/src/auth'
import { createMenuVariantSchema } from '@/src/features/menu/schemas'
import { CACHE_PATHS } from '@/src/lib/cache-keys'

// GET /api/admin/menu
export async function GET(_req: NextRequest) {
  try {
    // Note: Middleware protects this route, no need to manually check session again
    const variants = await prisma.menuVariant.findMany({
      where: { isDeleted: false },
      orderBy: { createdAt: 'desc' }
    })

    return NextResponse.json({ success: true, data: variants })
  } catch (error) {
    console.error('GET /api/admin/menu Error:', error)
    return NextResponse.json(
      { success: false, message: 'Terjadi kesalahan pada server' },
      { status: 500 }
    )
  }
}

// POST /api/admin/menu
export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session || !['ADMIN', 'SUPER_ADMIN'].includes(session.user?.role || '')) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized: Admin access required' },
        { status: 403 }
      )
    }

    const body = await req.json()

    // Zero Trust Validation
    const parsedData = createMenuVariantSchema.safeParse(body)
    if (!parsedData.success) {
      return NextResponse.json(
        {
          success: false,
          message: 'Data tidak valid',
          data: parsedData.error.flatten()
        },
        { status: 400 }
      )
    }

    const {
      flavorName,
      priceKembung,
      priceLumpia,
      priceKrispy,
      wholesaleKembung,
      wholesaleLumpia,
      wholesaleKrispy,
      imageUrl,
      deskripsi_topping,
      isActive,
      isAvailable,
      tags
    } = parsedData.data

    const newVariant = await prisma.menuVariant.create({
      data: {
        flavorName: DOMPurify.sanitize(flavorName),
        priceKembung,
        priceLumpia,
        priceKrispy,
        wholesaleKembung,
        wholesaleLumpia,
        wholesaleKrispy,
        imageUrl: imageUrl ? DOMPurify.sanitize(imageUrl) : null,
        deskripsi_topping: deskripsi_topping ? DOMPurify.sanitize(deskripsi_topping) : null,
        isActive: isActive !== undefined ? isActive : true,
        isAvailable: isAvailable !== undefined ? isAvailable : true,
        tags: tags || []
      }
    })

    const ip = req.headers.get('x-forwarded-for') || 'unknown'

    await prisma.auditLog.create({
      data: {
        action: 'CREATE',
        resource: 'MenuVariant',
        resourceId: newVariant.id,
        userId: session?.user?.id || 'system',
        details: JSON.stringify({ flavorName, priceKembung, priceLumpia, priceKrispy }),
        ipAddress: ip
      }
    })

    sseEmitter.emit('menuUpdated', { action: 'CREATE', data: newVariant })

    // 🛡️ ZERO-TRUST REVALIDATION: Hancurkan cache menu lama
    revalidatePath(CACHE_PATHS.ROOT)
    revalidatePath(CACHE_PATHS.MENU_SPESIAL)

    return NextResponse.json({ success: true, data: newVariant }, { status: 201 })
  } catch (error) {
    console.error('POST /api/admin/menu Error:', error)
    return NextResponse.json(
      { success: false, message: 'Terjadi kesalahan pada server' },
      { status: 500 }
    )
  }
}
