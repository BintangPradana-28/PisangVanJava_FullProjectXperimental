/**
 * Intended path: app/api/notifications/route.ts (NEW FILE)
 *
 * Security Strategy : Session-scoped only — mirrors app/api/favorites/route.ts
 *                      exactly (session.user.email → prisma.user.findUnique for id).
 *                      No BOLA surface: every query is pre-filtered by the looked-up
 *                      userId, never trusts a client-supplied userId.
 * State Source      : RAG — app/api/favorites/route.ts (auth pattern),
 *                      prisma/schema.prisma Notification model (schema-notification.prisma draft)
 */
import { type NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/src/auth'

export const dynamic = 'force-dynamic'

const LIST_LIMIT = 20 // MVP scope — no pagination yet, see notes below

export async function GET(_req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.email) {
      return NextResponse.json({ success: false, data: { notifications: [], unreadCount: 0 } })
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true }
    })
    if (!user) {
      return NextResponse.json({ success: false, data: { notifications: [], unreadCount: 0 } })
    }

    // Single round-trip for both the list and the badge count — avoids the
    // N+1 shape of "fetch list, then separately fetch count."
    const [notifications, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: 'desc' },
        take: LIST_LIMIT,
        select: { id: true, title: true, body: true, link: true, isRead: true, createdAt: true }
      }),
      prisma.notification.count({
        where: { userId: user.id, isRead: false }
      })
    ])

    return NextResponse.json({ success: true, data: { notifications, unreadCount } })
  } catch (error) {
    console.error('GET /api/notifications Error:', error)
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 })
  }
}

/**
 * Bulk mark-all-read. For marking a SINGLE notification read (e.g. on click),
 * see PATCH /api/notifications/[id] — kept as a separate route rather than one
 * handler branching on body shape, matching this project's existing pattern of
 * one action per route (see app/api/orders/[id]/tip vs the general order PATCH).
 */
export async function PATCH(_req: NextRequest) {
  try {
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

    await prisma.notification.updateMany({
      where: { userId: user.id, isRead: false },
      data: { isRead: true }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('PATCH /api/notifications Error:', error)
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 })
  }
}

// ─── Scope notes (deliberate cuts, not oversights) ─────────────────────────
//
// 1. No pagination beyond LIST_LIMIT=20. A "load more" / cursor param is a
//    clean follow-up (findMany already supports cursor) but wasn't needed to
//    close the gap this feature targets — MVP shows the 20 most recent.
//
// 2. No realtime subscription for unreadCount. TrackOrderDetailClient.tsx
//    opens a Supabase channel scoped to ONE order on a page the user is
//    already looking at. NotificationBell lives in Navbar — mounted on every
//    page for every logged-in user. Opening a global realtime channel there
//    is a real architectural decision (connection cost × concurrent users),
//    not a small addition — flagging it rather than deciding it silently.
//    Current draft: fetch on mount + on dropdown open. Upgrade path exists
//    if live badge updates become a priority.
