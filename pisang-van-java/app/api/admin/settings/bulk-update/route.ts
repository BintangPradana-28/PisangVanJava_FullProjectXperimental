import type { Prisma } from '@prisma/client'
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
      return NextResponse.json(
        { success: false, error: 'Unauthorized Access', data: null },
        { status: 401 }
      )
    }

    const body = await req.json()
    const { group, payload } = body

    if (!['home', 'about', 'contact', 'store'].includes(group)) {
      return NextResponse.json(
        { success: false, error: 'Invalid group', data: null },
        { status: 400 }
      )
    }

    // QUARANTINE VALIDATION: Validate payload as string record
    const validationResult = GenericSettingsSchema.safeParse(payload)

    if (!validationResult.success) {
      console.warn(
        `[SECURITY] Invalid payload shape detected at /api/admin/settings/bulk-update:`,
        validationResult.error.format()
      )
      return NextResponse.json(
        { success: false, error: 'Bad Request: Data integrity validation failed', data: null },
        { status: 400 }
      )
    }

    const safeData = validationResult.data

    // Database Execution Strategy: Upsert each key-value pair securely inside a transaction
    await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      for (const [key, value] of Object.entries(safeData)) {
        if (value === undefined) continue
        await tx.siteSetting.upsert({
          where: { key },
          update: { value },
          create: { key, value, group }
        })
      }

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

    // DATA MASKING: Return generic success without leaking database structure
    return NextResponse.json(
      {
        success: true,
        data: { message: 'Settings secured and updated successfully.' },
        error: null
      },
      { status: 200 }
    )
  } catch (error) {
    // OPAQUE ERRORS: Log actual error to internal console, return generic to client
    console.error('[CRITICAL] Exception in /api/admin/settings/bulk-update:', error)
    return NextResponse.json(
      { success: false, error: 'Internal Server Error', data: null },
      { status: 500 }
    )
  }
}
