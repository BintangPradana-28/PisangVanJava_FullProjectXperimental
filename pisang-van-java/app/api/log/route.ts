import { NextResponse } from 'next/server'
import { z } from 'zod'
import { rateLimit } from '@/lib/redis'
import { logger } from '@/src/lib/logger'

// SECURITY FIX (audit QA & Security):
// Endpoint ini sebelumnya (1) tanpa rate limit sama sekali (tidak termasuk matcher
// middleware.ts, jadi globalRateLimit middleware tidak berlaku di sini), (2) tanpa batas
// ukuran body, dan (3) menulis lewat fs.appendFileSync ke file lokal — di lingkungan
// serverless ini biasanya gagal senyap (filesystem read-only), tapi proyek ini juga
// menyediakan Dockerfile untuk self-hosting, di mana filesystem container BISA ditulis —
// menjadikannya vektor DoS "disk-fill" yang bisa dipicu siapa saja tanpa autentikasi.
// Sekarang: rate-limited per IP, body divalidasi & dibatasi ukurannya, dan dicatat lewat
// structured logger (pino, ke stdout) alih-alih menulis file — konsisten dengan cara
// logging di seluruh bagian aplikasi lain, dan tidak lagi bisa dipakai untuk disk-fill.
const clientLogSchema = z.object({
  level: z.enum(['error', 'warn', 'info']).optional().default('error'),
  message: z.string().max(2000),
  stack: z.string().max(4000).optional(),
  url: z.string().max(500).optional(),
  context: z.record(z.string(), z.unknown()).optional()
})

export async function POST(req: Request) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || '127.0.0.1'
  const { success: withinLimit } = await rateLimit.limit(`client_log_${ip}`)
  if (!withinLimit) {
    return NextResponse.json({ success: false }, { status: 429 })
  }

  try {
    const rawBody = await req.text()
    // Batas ukuran kasar (8KB cukup untuk pesan error + stack ringkas dari klien).
    if (rawBody.length > 8_000) {
      return NextResponse.json({ success: false, error: 'Payload too large' }, { status: 413 })
    }

    const parsed = clientLogSchema.safeParse(JSON.parse(rawBody))
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: 'Invalid payload' }, { status: 400 })
    }

    logger.warn({ source: 'client', ...parsed.data }, 'Client-reported log')
    return NextResponse.json({ success: true })
  } catch (_error) {
    return NextResponse.json({ success: false }, { status: 400 })
  }
}
