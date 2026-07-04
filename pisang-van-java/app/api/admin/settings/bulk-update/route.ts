import { revalidatePath } from 'next/cache'
import { type NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { auth } from '@/src/auth'

// ABSOLUTE QUARANTINE: Zod Schema to strictly validate inputs
// Strips out script tags or highly suspicious HTML payloads as a basic XSS defense mechanism
const sanitizeHtml = (val: string) =>
  val.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')

const GenericSettingsSchema = z.record(z.string(), z.string().transform(sanitizeHtml))

export async function POST(req: NextRequest) {
  try {
    // THE IRON GATE: Verify Authentication & Authorization
    const session = await auth()
    if (!session || !['ADMIN', 'SUPER_ADMIN'].includes(session.user.role)) {
      return NextResponse.json({ success: false, error: 'Unauthorized Access' }, { status: 401 })
    }

    const body = await req.json()
    const { group, payload } = body

    if (!['home', 'about', 'contact', 'store'].includes(group)) {
      return NextResponse.json({ success: false, error: 'Invalid group' }, { status: 400 })
    }

    // QUARANTINE VALIDATION: Validate payload as string record
    const validationResult = GenericSettingsSchema.safeParse(payload)

    if (!validationResult.success) {
      console.warn(
        `[SECURITY] Invalid payload shape detected at /api/admin/settings/bulk-update:`,
        validationResult.error.format()
      )
      return NextResponse.json(
        { success: false, error: 'Bad Request: Data integrity validation failed' },
        { status: 400 }
      )
    }

    const safeData = validationResult.data

    // ARCHITECTURE FIX: previously each upsert + the audit log write ran as
    // independent Promise.all() calls with no shared transaction — this project's
    // own ARCHITECTURE.md states multi-table/multi-row operations must use
    // prisma.$transaction. Under the old code, if upsert #3 of 5 settings failed
    // (e.g. a transient connection blip), the first 2 would already be committed
    // while the rest silently weren't — a half-applied settings update with no
    // audit trail explaining what actually landed. Now all-or-nothing.
    await prisma.$transaction(async (tx) => {
      const updatePromises = Object.entries(safeData).map(([key, value]) => {
        if (value === undefined) return Promise.resolve()
        return tx.siteSetting.upsert({
          where: { key },
          update: { value },
          create: { key, value, group }
        })
      })

      await Promise.all(updatePromises)

      // Log the audit trail for accountability
      await tx.auditLog.create({
        data: {
          action: `UPDATE_${group.toUpperCase()}_SETTINGS`,
          resource: 'SiteSetting',
          resourceId: `${group}-group`,
          userId: session.user.id,
          details: JSON.stringify(Object.keys(safeData))
        }
      })
    })

    // 🛡️ ZERO-TRUST REVALIDATION: Hancurkan cache lama agar perubahan instan
    revalidatePath('/', 'layout')

    // DATA MASKING: Return generic success without leaking database structure.
    // ARCHITECTURE FIX: added `success: true` — components/admin/SettingsClient.tsx
    // already typed this response as `{ success: boolean; error?: string }`, but
    // this endpoint never actually sent that field. It worked by coincidence
    // (client only checked `.error`), but the field is now genuinely present.
    return NextResponse.json(
      { success: true, message: 'Settings secured and updated successfully.' },
      { status: 200 }
    )
  } catch (error) {
    // OPAQUE ERRORS: Log actual error to internal console, return generic to client
    console.error('[CRITICAL] Exception in /api/admin/settings/bulk-update:', error)
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 })
  }
}
