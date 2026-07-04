/**
 * Intended path: app/api/notifications/[id]/route.ts (NEW FILE)
 *
 * Security Strategy : BOLA prevention — the looked-up-from-session userId must
 *                      match the notification's own userId before any mutation.
 *                      A user guessing another user's notification id gets 404,
 *                      not the notification's existence confirmed via a 403.
 * State Source      : RAG — app/api/favorites/route.ts (auth pattern),
 *                      prisma/schema.prisma Notification model
 */
import { type NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/src/auth'

export const dynamic = 'force-dynamic'

export async function PATCH(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params

    const session = await auth()
    if (!session?.user?.email) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true }
    })
    if (!user) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 })
    }

    // BOLA: fetch + ownership check BEFORE mutating. Returning 404 (not 403)
    // when the notification belongs to someone else avoids confirming to a
    // prober that a given notification id exists at all.
    const notification = await prisma.notification.findUnique({
      where: { id },
      select: { userId: true }
    })
    if (!notification || notification.userId !== user.id) {
      return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 })
    }

    await prisma.notification.update({
      where: { id },
      data: { isRead: true }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('PATCH /api/notifications/[id] Error:', error)
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 })
  }
}
