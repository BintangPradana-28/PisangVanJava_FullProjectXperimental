import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { redis } from '@/lib/redis'

export const dynamic = 'force-dynamic'

/**
 * GET /api/health
 *
 * Lightweight uptime-monitoring endpoint. Checks the two hard dependencies
 * the app cannot function without — Postgres (via Prisma) and Redis (Upstash) —
 * and reports per-service status instead of a single opaque boolean, so an
 * on-call engineer can immediately see which dependency is down.
 *
 * Deliberately NOT added to middleware.ts's route matcher: monitoring
 * services (UptimeRobot, Vercel cron self-checks, etc.) may poll this every
 * 10-30s, and it carries no sensitive data, so it doesn't need rate limiting
 * or auth like the rest of the API surface.
 */
export async function GET() {
  const checks: Record<string, { status: 'ok' | 'error'; latencyMs?: number; error?: string }> = {}

  const dbStart = Date.now()
  try {
    await prisma.$queryRaw`SELECT 1`
    checks.database = { status: 'ok', latencyMs: Date.now() - dbStart }
  } catch (error) {
    checks.database = {
      status: 'error',
      latencyMs: Date.now() - dbStart,
      error: error instanceof Error ? error.message : 'Unknown database error'
    }
  }

  const redisStart = Date.now()
  try {
    // .ping() does not exist on @upstash/redis's client (verified against
    // node_modules/@upstash/redis's type defs) — .get() is the same method
    // already used successfully elsewhere in this codebase (security.ts,
    // middleware.ts) and is sufficient to prove a real round-trip to Upstash.
    await redis.get('__health_check__')
    checks.redis = { status: 'ok', latencyMs: Date.now() - redisStart }
  } catch (error) {
    checks.redis = {
      status: 'error',
      latencyMs: Date.now() - redisStart,
      error: error instanceof Error ? error.message : 'Unknown redis error'
    }
  }

  const isHealthy = Object.values(checks).every((check) => check.status === 'ok')

  return NextResponse.json(
    {
      status: isHealthy ? 'ok' : 'degraded',
      timestamp: new Date().toISOString(),
      checks
    },
    { status: isHealthy ? 200 : 503 }
  )
}
