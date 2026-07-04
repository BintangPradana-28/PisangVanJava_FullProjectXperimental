import { NextResponse } from 'next/server'
import { getOpenApiSpec } from '@/src/lib/openapi/generator'

export async function GET() {
  try {
    const spec = getOpenApiSpec()
    return NextResponse.json(spec)
  } catch (error) {
    console.error('[OPENAPI SPEC ERROR] Failed to generate spec:', error)
    return NextResponse.json({ error: 'Failed to generate specification' }, { status: 500 })
  }
}
