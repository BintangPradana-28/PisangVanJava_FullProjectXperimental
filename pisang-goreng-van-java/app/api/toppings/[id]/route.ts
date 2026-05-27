// app/api/toppings/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/src/features/auth/authOptions'

async function isAdmin() {
  const session = await getServerSession(authOptions)
  return !!session
}

import { z } from 'zod'

const updateToppingSchema = z.object({
  name: z.string().trim().min(2).max(50),
  price: z.number().int().nonnegative("Harga tidak boleh negatif"),
  emoji: z.string().max(10).nullable().optional(),
  isActive: z.boolean().optional()
}).strict()

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  try {
    const { id } = await params
    const body = await req.json()
    const parsed = updateToppingSchema.safeParse(body)
    
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: 'Validasi Gagal', details: parsed.error.flatten() }, { status: 400 })
    }

    const t = await prisma.topping.update({ where: { id: id }, data: parsed.data })
    return NextResponse.json({ success: true, data: t })
  } catch (error) {
    console.error("PUT /api/toppings/[id] Error:", error)
    return NextResponse.json({ success: false, error: 'Gagal update' }, { status: 500 })
  }
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  try {
    const { id } = await params
    await prisma.topping.delete({ where: { id: id } })
    return NextResponse.json({ success: true, message: 'Topping dihapus' })
  } catch (error) {
    console.error("DELETE /api/toppings/[id] Error:", error)
    return NextResponse.json({ success: false, error: 'Gagal menghapus' }, { status: 500 })
  }
}
