import { type NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { rateLimit } from '@/lib/redis'
import { registerSchema } from '@/src/features/auth/schemas'
import { hashPassword } from '@/src/lib/password'

export async function POST(req: NextRequest) {
  try {
    // RAG Source: app/api/auth/register/route.ts (apply rate-limiting to registration endpoints)
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || '127.0.0.1'
    const { success: withinLimit } = await rateLimit.limit(`register:${ip}`)
    if (!withinLimit) {
      return NextResponse.json(
        { success: false, message: 'Terlalu banyak percobaan pendaftaran. Coba lagi nanti.' },
        { status: 429 }
      )
    }

    const body = await req.json()

    // 1. Zero-Trust Validation via Zod
    const parsed = registerSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          message: 'Format data tidak valid',
          data: parsed.error.flatten()
        },
        { status: 400 }
      )
    }

    const { name, email, password } = parsed.data

    // 2. Check if email already exists
    const existingUser = await prisma.user.findUnique({
      where: { email }
    })

    if (existingUser) {
      return NextResponse.json(
        { success: false, message: 'Email sudah terdaftar' },
        { status: 409 }
      )
    }

    // 3. Hash password securely
    const passwordHash = await hashPassword(password)

    // 4. Save to Database (Prisma)
    const newUser = await prisma.user.create({
      data: {
        name,
        email,
        passwordHash,
        role: 'CUSTOMER'
      }
    })

    // 5. Return sanitized response (NEVER return passwordHash)
    return NextResponse.json(
      {
        success: true,
        message: 'Registrasi berhasil',
        data: { id: newUser.id, name: newUser.name, email: newUser.email }
      },
      { status: 201 }
    )
  } catch (error: unknown) {
    console.error('Register Error:', error)
    return NextResponse.json(
      { success: false, message: 'Terjadi kesalahan pada server' },
      { status: 500 }
    )
  }
}
