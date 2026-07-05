// app/api/settings/route.ts

import { revalidatePath } from 'next/cache'
import { type NextRequest, NextResponse } from 'next/server'
import { logAudit } from '@/lib/audit'
import { prisma } from '@/lib/prisma'
import { auth } from '@/src/auth'

export const dynamic = 'force-dynamic'

export async function GET() {
  const settings = await prisma.siteSetting.findMany({
    orderBy: [{ group: 'asc' }, { key: 'asc' }]
  })
  return NextResponse.json({ success: true, data: settings })
}

export async function PUT(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  const body = await req.json()
  const updates: { key: string; value: string }[] = body.settings || []
  const results = await Promise.all(
    updates.map(({ key, value }) =>
      prisma.siteSetting.upsert({ where: { key }, update: { value }, create: { key, value } })
    )
  )
  await logAudit('UPDATE_SETTINGS', 'SiteSetting', 'bulk', updates)

  // 🛡️ ZERO-TRUST REVALIDATION: Hancurkan seluruh static cache layout dan halaman depan
  revalidatePath('/', 'layout')

  return NextResponse.json({ success: true, data: results })
}
