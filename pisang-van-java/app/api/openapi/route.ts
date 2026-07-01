import { NextResponse } from 'next/server'
import { auth } from '@/src/auth'
import { requireRole } from '@/src/lib/auth-utils'
import { getOpenApiSpec } from '@/src/lib/openapi/generator'

export async function GET() {
  try {
    const session = await auth()
    try {
      requireRole(session, 'ADMIN', 'SUPER_ADMIN')
    } catch {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const spec = getOpenApiSpec()
    return NextResponse.json(spec)
  } catch (error) {
    console.error('[OPENAPI SPEC ERROR] Failed to generate spec:', error)
    return NextResponse.json({ error: 'Failed to generate specification' }, { status: 500 })
  }
}
