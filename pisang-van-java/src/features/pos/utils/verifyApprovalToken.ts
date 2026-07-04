// src/features/pos/utils/verifyApprovalToken.ts
// RAG Source: app/api/pos/auth-pin/route.ts (generateApprovalToken logic)
// Purpose: Server-side utility to verify Manager PIN approval tokens (HMAC-based)

import crypto from 'node:crypto'
import { getAuthSecret } from '@/src/env'

/**
 * Verifies a POS Manager approval token.
 * Token format: "pos_override|{expiry_timestamp}.{hmac_signature}"
 *
 * Zero-Trust: Uses timing-safe comparison to prevent timing attacks.
 * Returns true ONLY if the token is structurally valid, not expired, and signature matches.
 */
export function verifyApprovalToken(token: string): boolean {
  try {
    if (!token || typeof token !== 'string') return false

    const [payload, signature] = token.split('.')
    if (!payload || !signature) return false

    const [prefix, expStr] = payload.split('|')
    if (prefix !== 'pos_override' || !expStr) return false

    const expiry = Number(expStr)
    if (!Number.isFinite(expiry) || Date.now() > expiry) return false

    // Recompute HMAC with the same secret used in generateApprovalToken.
    // SECURITY FIX: sebelumnya fallback ke 'fallback_secret_for_local_only' (string
    // publik yang ada di source code) jika NEXTAUTH_SECRET kosong — artinya siapa pun
    // yang tahu string itu bisa memalsukan token approval override Manager PIN POS
    // tanpa pernah tahu PIN sungguhan. Sekarang pakai resolver fail-closed yang sama
    // dengan session auth (lihat src/env.ts:getAuthSecret).
    const secret = getAuthSecret()
    const expectedSignature = crypto.createHmac('sha256', secret).update(payload).digest('hex')

    // Timing-safe comparison (Zero-Trust mandate)
    const expectedBuffer = Buffer.from(expectedSignature, 'hex')
    const providedBuffer = Buffer.from(signature, 'hex')

    if (expectedBuffer.length !== providedBuffer.length) return false

    return crypto.timingSafeEqual(expectedBuffer, providedBuffer)
  } catch {
    // Fail closed: any parsing or crypto error = reject
    return false
  }
}
