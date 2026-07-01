import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { sseEmitter } from '@/lib/eventEmitter'
import { auth } from '@/src/auth'

export const dynamic = 'force-dynamic'

// SECURITY FIX: this route previously had no auth check at all — `curl /api/admin/events`
// from anywhere would open a live stream of admin menu changes (price updates, new
// items, disabled stock) with no account required. Restricted to the same roles that
// can reach /manage-menu, matching this codebase's existing pattern for admin routes
// (see e.g. app/api/banners/route.ts).
const ALLOWED_ROLES = ['ADMIN', 'SUPER_ADMIN']

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id || !ALLOWED_ROLES.includes(session.user.role)) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    start(controller) {
      const onMenuUpdated = (data: unknown) => {
        const message = `data: ${JSON.stringify(data)}\n\n`
        controller.enqueue(encoder.encode(message))
      }

      sseEmitter.on('menuUpdated', onMenuUpdated)

      // Send initial connection event
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'connected' })}\n\n`))

      // Keep connection alive
      const interval = setInterval(() => {
        controller.enqueue(encoder.encode(': keepalive\n\n'))
      }, 15000)

      req.signal.addEventListener('abort', () => {
        clearInterval(interval)
        sseEmitter.off('menuUpdated', onMenuUpdated)
        controller.close()
      })
    }
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive'
    }
  })
}
