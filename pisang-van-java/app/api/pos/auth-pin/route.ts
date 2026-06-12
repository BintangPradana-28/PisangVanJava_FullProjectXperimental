import crypto from 'crypto'
import { type NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { logAudit } from '@/lib/audit'
import { prisma } from '@/lib/prisma'
import { auth } from '@/src/auth'
import { hashPassword, verifyPassword } from '@/src/lib/password'

const PIN_SETTING_KEY = 'pos_manager_pin'

// --- VALIDATION SCHEMAS ---
const verifyPinSchema = z.object({
  pin: z.string().length(4, 'PIN harus 4 digit')
})

const resetPinSchema = z.object({
  newPin: z.string().length(4, 'PIN Baru harus 4 digit').regex(/^\d+$/, 'Hanya angka')
})

const updatePinSchema = z.object({
  oldPin: z.string().optional(), // Optional if it's the first time
  newPin: z.string().length(4, 'PIN Baru harus 4 digit').regex(/^\d+$/, 'Hanya angka')
})

// Helper to generate a short-lived Approval Token (HMAC)
function generateApprovalToken() {
  const secret = process.env.NEXTAUTH_SECRET || 'fallback_secret_for_local_only'
  const exp = Date.now() + 60 * 1000 // 60 seconds validity
  const payload = `pos_override|${exp}`
  const signature = crypto.createHmac('sha256', secret).update(payload).digest('hex')
  return `${payload}.${signature}`
}

// Helper to check Authorization — PIN verification is allowed for all POS roles
const POS_VERIFY_ROLES = ['ADMIN', 'SUPER_ADMIN', 'CASHIER'] as const
const PIN_MANAGE_ROLES = ['ADMIN', 'SUPER_ADMIN'] as const

async function getPosUser() {
  const session = await auth()
  if (
    !session?.user?.id ||
    !POS_VERIFY_ROLES.includes(session.user.role as (typeof POS_VERIFY_ROLES)[number])
  )
    return null
  return session.user
}

async function getAdminUser() {
  const session = await auth()
  if (
    !session?.user?.id ||
    !PIN_MANAGE_ROLES.includes(session.user.role as (typeof PIN_MANAGE_ROLES)[number])
  )
    return null
  return session.user
}

// 1. GET: Check if PIN is configured
export async function GET(req: NextRequest) {
  const admin = await getAdminUser()
  if (!admin) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })

  try {
    const setting = await prisma.siteSetting.findUnique({
      where: { key: PIN_SETTING_KEY }
    })
    return NextResponse.json({ success: true, isConfigured: !!setting })
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Internal Error' }, { status: 500 })
  }
}

// 2. POST: Verify PIN for POS Override (CASHIER, ADMIN, SUPER_ADMIN)
export async function POST(req: NextRequest) {
  const admin = await getPosUser()
  if (!admin) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })

  try {
    const body = await req.json()
    const { pin } = verifyPinSchema.parse(body)

    const setting = await prisma.siteSetting.findUnique({
      where: { key: PIN_SETTING_KEY }
    })

    if (!setting) {
      return NextResponse.json(
        { success: false, error: 'PIN Manajer belum diatur.' },
        { status: 400 }
      )
    }

    const isValid = await verifyPassword(setting.value, pin)
    if (!isValid) {
      return NextResponse.json({ success: false, error: 'PIN Salah.' }, { status: 401 })
    }

    const approvalToken = generateApprovalToken()
    return NextResponse.json({ success: true, approvalToken })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 400 })
  }
}

// 3. PUT: Update/Set PIN
export async function PUT(req: NextRequest) {
  const admin = await getAdminUser()
  if (!admin) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })

  try {
    const body = await req.json()
    const { oldPin, newPin } = updatePinSchema.parse(body)

    const setting = await prisma.siteSetting.findUnique({
      where: { key: PIN_SETTING_KEY }
    })

    // If setting exists, enforce oldPin check
    if (setting) {
      if (!oldPin) {
        return NextResponse.json(
          { success: false, error: 'PIN Lama wajib diisi.' },
          { status: 400 }
        )
      }
      const isOldValid = await verifyPassword(setting.value, oldPin)
      if (!isOldValid) {
        return NextResponse.json({ success: false, error: 'PIN Lama salah.' }, { status: 401 })
      }
    }

    // Hash new PIN securely
    const hashedPin = await hashPassword(newPin)

    await prisma.siteSetting.upsert({
      where: { key: PIN_SETTING_KEY },
      update: { value: hashedPin },
      create: {
        key: PIN_SETTING_KEY,
        value: hashedPin,
        label: 'POS Manager PIN',
        group: 'pos_security'
      }
    })

    await logAudit('POS_PIN_UPDATED', 'SiteSetting', PIN_SETTING_KEY, {
      updatedBy: admin.id,
      role: admin.role
    })

    return NextResponse.json({ success: true, message: 'PIN berhasil diperbarui.' })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 400 })
  }
}

// 4. DELETE: Reset PIN (Forgot PIN — SUPER_ADMIN only, bypasses old PIN)
export async function DELETE(req: NextRequest) {
  const admin = await getAdminUser()
  if (!admin) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })

  // Only SUPER_ADMIN can force-reset without old PIN
  if (admin.role !== 'SUPER_ADMIN') {
    return NextResponse.json(
      {
        success: false,
        error: 'Hanya Super Admin yang dapat mereset PIN.'
      },
      { status: 403 }
    )
  }

  try {
    const body = await req.json()
    const { newPin } = resetPinSchema.parse(body)

    const hashedPin = await hashPassword(newPin)

    await prisma.siteSetting.upsert({
      where: { key: PIN_SETTING_KEY },
      update: { value: hashedPin },
      create: {
        key: PIN_SETTING_KEY,
        value: hashedPin,
        label: 'POS Manager PIN',
        group: 'pos_security'
      }
    })

    await logAudit('POS_PIN_RESET', 'SiteSetting', PIN_SETTING_KEY, {
      resetBy: admin.id,
      role: 'SUPER_ADMIN',
      reason: 'Forgot PIN — force reset'
    })

    return NextResponse.json({
      success: true,
      message: 'PIN berhasil direset oleh Super Admin.'
    })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 400 })
  }
}
