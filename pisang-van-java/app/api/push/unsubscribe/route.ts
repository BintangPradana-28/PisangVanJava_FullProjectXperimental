/**
 * app/api/push/unsubscribe/route.ts
 *
 * DELETE /api/push/unsubscribe
 * Remove the Web Push subscription for the authenticated user.
 *
 * Security Strategy : Full FT Zero-Trust — auth required, no body needed
 * Style Alignment   : LoRA PVJ API pattern (mirrors admin ban-user route)
 * State Source      : RAG — lib/push.ts (deletePushSubscription), src/auth.ts
 *
 * No body parsing required: the user identity comes from the session alone.
 * BOLA is impossible here — we only delete the subscription of the authenticated user.
 */
import { NextResponse } from 'next/server'

import { deletePushSubscription } from '@/lib/push'
import { auth } from '@/src/auth'

export const dynamic = 'force-dynamic'

export async function DELETE() {
  // ── 1. AUTH GATE ──────────────────────────────────────────────────────────────
  const session = await auth()
  const userId = session?.user?.id
  if (!session || !userId) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  // ── 2. DELETE FROM REDIS ──────────────────────────────────────────────────────
  // Deletion is idempotent — deleting a non-existent key is safe in Redis
  try {
    await deletePushSubscription(userId)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[PUSH] Failed to delete subscription:', error)
    return NextResponse.json(
      { success: false, error: 'Gagal menonaktifkan notifikasi.' },
      { status: 500 }
    )
  }
}
