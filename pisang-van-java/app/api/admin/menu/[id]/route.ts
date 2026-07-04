import { revalidatePath } from 'next/cache'
import { type NextRequest, NextResponse } from 'next/server'
import { sseEmitter } from '@/lib/eventEmitter'
import { prisma } from '@/lib/prisma'
import DOMPurify from '@/lib/sanitize'
import { auth } from '@/src/auth'
import { updateMenuVariantSchema } from '@/src/features/menu/schemas'
import { CACHE_PATHS } from '@/src/lib/cache-keys'
import { StockManager } from '@/src/lib/stock-manager'
// GET /api/admin/menu/[id]
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const variant = await prisma.menuVariant.findUnique({
      where: { id, isDeleted: false }
    })

    if (!variant) {
      return NextResponse.json(
        { success: false, message: 'Variant tidak ditemukan' },
        { status: 404 }
      )
    }

    return NextResponse.json({ success: true, data: variant })
  } catch (error) {
    console.error('GET /api/admin/menu/[id] Error:', error)
    return NextResponse.json(
      { success: false, message: 'Terjadi kesalahan pada server' },
      { status: 500 }
    )
  }
}

// PUT /api/admin/menu/[id]
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth()
    if (!session || !['ADMIN', 'SUPER_ADMIN'].includes(session.user?.role || '')) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized: Admin access required' },
        { status: 403 }
      )
    }

    const { id } = await params
    const body = await req.json()

    const parsedData = updateMenuVariantSchema.safeParse(body)
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

    // Check if exists
    const existing = await prisma.menuVariant.findUnique({
      where: { id, isDeleted: false }
    })

    if (!existing) {
      return NextResponse.json(
        { success: false, message: 'Variant tidak ditemukan' },
        { status: 404 }
      )
    }

    const dataToUpdate = { ...parsedData.data }
    if (dataToUpdate.flavorName)
      dataToUpdate.flavorName = DOMPurify.sanitize(dataToUpdate.flavorName)
    if (dataToUpdate.deskripsi_topping)
      dataToUpdate.deskripsi_topping = DOMPurify.sanitize(dataToUpdate.deskripsi_topping)
    if (dataToUpdate.imageUrl) dataToUpdate.imageUrl = DOMPurify.sanitize(dataToUpdate.imageUrl)

    const updatedVariant = await prisma.menuVariant.update({
      where: { id },
      data: dataToUpdate
    })

    // ─── 🛡️ REDIS CACHE HEALING ───────────────────────────────────────────
    // If the Admin updates the stock manually, we MUST sync it to Redis
    // Otherwise, the Lua Script will oversell based on stale cache data.
    if (updatedVariant.stock !== undefined && updatedVariant.stock !== null) {
      await StockManager.syncStockFromDB(id, updatedVariant.stock)
    }

    const ip = req.headers.get('x-forwarded-for') || 'unknown'

    await prisma.auditLog.create({
      data: {
        action: 'UPDATE',
        resource: 'MenuVariant',
        resourceId: id,
        userId: session?.user?.id || 'system',
        details: JSON.stringify(parsedData.data),
        ipAddress: ip
      }
    })

    sseEmitter.emit('menuUpdated', { action: 'UPDATE', data: updatedVariant })

    // 🛡️ ZERO-TRUST REVALIDATION
    revalidatePath(CACHE_PATHS.ROOT)
    revalidatePath(CACHE_PATHS.MENU_SPESIAL)

    return NextResponse.json({ success: true, data: updatedVariant })
  } catch (error) {
    console.error('PUT /api/admin/menu/[id] Error:', error)
    return NextResponse.json(
      { success: false, message: 'Terjadi kesalahan pada server' },
      { status: 500 }
    )
  }
}

// DELETE /api/admin/menu/[id]
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth()
    if (!session || !['ADMIN', 'SUPER_ADMIN'].includes(session.user?.role || '')) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized: Admin access required' },
        { status: 403 }
      )
    }

    const { id } = await params
    const existing = await prisma.menuVariant.findUnique({
      where: { id, isDeleted: false }
    })

    if (!existing) {
      return NextResponse.json(
        { success: false, message: 'Variant tidak ditemukan' },
        { status: 404 }
      )
    }

    // Soft delete
    await prisma.menuVariant.update({
      where: { id },
      data: { isDeleted: true }
    })

    const ip = req.headers.get('x-forwarded-for') || 'unknown'

    await prisma.auditLog.create({
      data: {
        action: 'DELETE',
        resource: 'MenuVariant',
        resourceId: id,
        userId: session?.user?.id || 'system',
        details: JSON.stringify({ isDeleted: true }),
        ipAddress: ip
      }
    })

    sseEmitter.emit('menuUpdated', { action: 'DELETE', data: { id } })

    // 🛡️ ZERO-TRUST REVALIDATION
    revalidatePath(CACHE_PATHS.ROOT)
    revalidatePath(CACHE_PATHS.MENU_SPESIAL)

    return NextResponse.json({ success: true, message: 'Variant berhasil dihapus' })
  } catch (error) {
    console.error('DELETE /api/admin/menu/[id] Error:', error)
    return NextResponse.json(
      { success: false, message: 'Terjadi kesalahan pada server' },
      { status: 500 }
    )
  }
}
