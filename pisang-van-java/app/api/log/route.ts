import { NextResponse } from 'next/server'
import { z } from 'zod'
import { globalRateLimit } from '@/lib/redis'
import { auth } from '@/src/auth'

// SECURITY FIX: this endpoint previously had NO auth check, NO Zod validation, and
// NO body size limit, while writing every request body straight to disk via
// fs.appendFileSync('client-log.txt', ...). That combination is a disk-exhaustion
// DoS vector (unbounded, unauthenticated, unlimited POSTs) and a log-injection risk
// (arbitrary attacker-controlled content written verbatim to a file). It also never
// actually worked as intended in production: serverless/Vercel filesystems are
// ephemeral, so appendFileSync wrote to a throwaway /tmp that nothing ever reads.
//
// Fix: require an authenticated session, rate-limit per user, cap payload size via
// Zod, and route through console.info (captured by the platform's log pipeline)
// instead of an unbounded local file.

const clientLogSchema = z
  .object({
    level: z.enum(['info', 'warn', 'error']).default('info'),
    message: z.string().min(1).max(500),
    context: z.record(z.string(), z.unknown()).optional()
  })
  .strict()

export async function POST(req: Request) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { success: limitSuccess } = await globalRateLimit.limit(`client_log_${session.user.id}`)
    if (!limitSuccess) {
      return NextResponse.json(
        { success: false, error: 'Terlalu banyak permintaan.' },
        { status: 429 }
      )
    }

    const rawBody = await req.json()
    const parsed = clientLogSchema.safeParse(rawBody)
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: 'Invalid payload' }, { status: 400 })
    }

    const { level, message, context } = parsed.data
    // Semgrep: unsafe-formatstring — first arg must stay a constant literal so
    // Node's util.format never treats attacker-controlled `message` content as
    // containing format specifiers (%s/%d/%j). Dynamic values go in the second
    // (object) argument instead of being interpolated into the template string.
    console.info('[CLIENT_LOG]', { level, userId: session.user.id, message, context: context ?? {} })

    return NextResponse.json({ success: true })
  } catch (_error) {
    return NextResponse.json({ success: false }, { status: 400 })
  }
}
