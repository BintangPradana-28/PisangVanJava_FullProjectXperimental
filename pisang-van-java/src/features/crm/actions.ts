'use server'

import type { Prisma } from '@prisma/client'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { auth } from '@/src/auth'
import { authActionClient } from '@/src/lib/safe-action'

export async function requireAdminActor() {
  const session = await auth()
  if (!session?.user?.id) {
    return null
  }

  if (session.user.role !== 'ADMIN' && session.user.role !== 'SUPER_ADMIN') {
    return null
  }

  return { userId: session.user.id }
}

const createDealSchema = z
  .object({
    companyName: z.string().min(2, 'Nama perusahaan terlalu pendek').max(100),
    contactName: z.string().min(2, 'Nama kontak terlalu pendek').max(100),
    phone: z.string().min(8, 'Nomor HP tidak valid').max(20),
    email: z.string().email('Email tidak valid').optional().or(z.literal('')),
    dealName: z.string().min(5, 'Nama deal terlalu pendek').max(150),
    amount: z.coerce.number().nonnegative('Nominal tidak boleh negatif').optional().nullable(),
    notes: z.string().max(1000).optional().nullable()
  })
  .strict()

export async function createB2BDeal(payload: unknown) {
  const admin = await requireAdminActor()
  if (!admin) {
    return { success: false as const, error: 'Unauthorized. Admin access required.' }
  }

  const parsed = createDealSchema.safeParse(payload)
  if (!parsed.success) {
    return { success: false as const, error: parsed.error.issues[0].message }
  }

  try {
    const newDeal = await prisma.b2BDeal.create({
      data: {
        companyName: parsed.data.companyName,
        contactName: parsed.data.contactName,
        phone: parsed.data.phone,
        email: parsed.data.email || null,
        dealName: parsed.data.dealName,
        amount: parsed.data.amount || null,
        notes: parsed.data.notes || null,
        ownerId: admin.userId
      }
    })
    return { success: true as const, data: newDeal }
  } catch (err) {
    console.error('[CRM_CREATE_ERROR]', err)
    return { success: false as const, error: 'Failed to create B2B deal.' }
  }
}

const updateDealStatusSchema = z
  .object({
    dealId: z.string().cuid(),
    stage: z.enum(['PROSPECTING', 'NEGOTIATION', 'CLOSED_WON', 'CLOSED_LOST'])
  })
  .strict()

export async function updateB2BDealStatus(payload: unknown) {
  const admin = await requireAdminActor()
  if (!admin) {
    return { success: false as const, error: 'Unauthorized. Admin access required.' }
  }

  const parsed = updateDealStatusSchema.safeParse(payload)
  if (!parsed.success) {
    return { success: false as const, error: 'Invalid input data.' }
  }

  try {
    const updated = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const deal = await tx.b2BDeal.findUnique({
        where: { id: parsed.data.dealId },
        select: { dealName: true, ownerId: true }
      })

      const dealUpdate = await tx.b2BDeal.update({
        where: { id: parsed.data.dealId },
        data: { stage: parsed.data.stage }
      })

      if (
        deal &&
        deal.dealName === 'Reseller Application' &&
        parsed.data.stage === 'CLOSED_WON' &&
        deal.ownerId
      ) {
        await tx.user.update({
          where: { id: deal.ownerId },
          data: { role: 'RESELLER' }
        })
      }

      return dealUpdate
    })

    return { success: true as const, data: updated }
  } catch (err) {
    console.error('[CRM_UPDATE_ERROR]', err)
    return { success: false as const, error: 'Failed to update deal status.' }
  }
}

export async function getB2BDeals() {
  const admin = await requireAdminActor()
  if (!admin) {
    return []
  }

  try {
    return await prisma.b2BDeal.findMany({
      orderBy: { updatedAt: 'desc' },
      include: {
        owner: { select: { name: true, email: true } }
      }
    })
  } catch (err) {
    console.error('[CRM_FETCH_ERROR]', err)
    return []
  }
}

const resellerApplySchema = z.object({
  companyName: z.string().min(2, 'Nama bisnis/toko minimal 2 karakter').max(100),
  address: z.string().min(10, 'Alamat lengkap bisnis minimal 10 karakter').max(500),
  notes: z.string().max(1000).optional().nullable()
})

export async function applyForReseller(payload: unknown) {
  const session = await auth()
  if (!session?.user?.id) {
    return { success: false as const, error: 'Silakan login terlebih dahulu untuk mendaftar.' }
  }

  const parsed = resellerApplySchema.safeParse(payload)
  if (!parsed.success) {
    return { success: false as const, error: parsed.error.issues[0].message }
  }

  try {
    // Check if user is already a reseller
    if (session.user.role === 'RESELLER') {
      return { success: false as const, error: 'Anda sudah terdaftar sebagai Reseller resmi.' }
    }

    // Check if user has a pending application
    const existing = await prisma.b2BDeal.findFirst({
      where: {
        ownerId: session.user.id,
        dealName: 'Reseller Application',
        stage: { in: ['PROSPECTING', 'NEGOTIATION'] }
      }
    })

    if (existing) {
      return {
        success: false as const,
        error: 'Pendaftaran Reseller Anda sebelumnya masih dalam antrean/sedang diproses.'
      }
    }

    // Fetch user phone/email
    const userObj = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { phone: true, email: true, name: true }
    })

    if (!userObj?.phone) {
      return {
        success: false as const,
        error: 'Nomor WhatsApp wajib diisi di profil Anda sebelum mendaftar Reseller.'
      }
    }

    const newDeal = await prisma.b2BDeal.create({
      data: {
        companyName: parsed.data.companyName,
        contactName: userObj.name || 'Pelanggan',
        phone: userObj.phone,
        email: userObj.email || null,
        dealName: 'Reseller Application',
        notes: `Alamat Bisnis: ${parsed.data.address}\n\nCatatan Tambahan: ${parsed.data.notes || '-'}`,
        stage: 'PROSPECTING',
        ownerId: session.user.id
      }
    })

    return { success: true as const, data: newDeal }
  } catch (err) {
    console.error('[RESELLER_APPLY_ERROR]', err)
    return { success: false as const, error: 'Gagal mengirimkan pendaftaran reseller.' }
  }
}

// RAG Source: src/features/crm/actions.ts
export const applyForResellerAction = authActionClient
  .schema(resellerApplySchema)
  .action(async ({ parsedInput, ctx }) => {
    const { userId } = ctx
    const { companyName, address, notes } = parsedInput

    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { role: true }
      })

      if (user?.role === 'RESELLER') {
        throw new Error('Anda sudah terdaftar sebagai Reseller resmi.')
      }

      const existing = await prisma.b2BDeal.findFirst({
        where: {
          ownerId: userId,
          dealName: 'Reseller Application',
          stage: { in: ['PROSPECTING', 'NEGOTIATION'] }
        }
      })

      if (existing) {
        throw new Error('Pendaftaran Reseller Anda sebelumnya masih dalam antrean/sedang diproses.')
      }

      const userObj = await prisma.user.findUnique({
        where: { id: userId },
        select: { phone: true, email: true, name: true }
      })

      if (!userObj?.phone) {
        throw new Error('Nomor WhatsApp wajib diisi di profil Anda sebelum mendaftar Reseller.')
      }

      const newDeal = await prisma.b2BDeal.create({
        data: {
          companyName,
          contactName: userObj.name || 'Pelanggan',
          phone: userObj.phone,
          email: userObj.email || null,
          dealName: 'Reseller Application',
          notes: `Alamat Bisnis: ${address}\n\nCatatan Tambahan: ${notes || '-'}`,
          stage: 'PROSPECTING',
          ownerId: userId
        }
      })

      return { success: true as const, data: newDeal }
    } catch (err: any) {
      console.error('[RESELLER_APPLY_ERROR]', err)
      return {
        success: false as const,
        error: err.message || 'Gagal mengirimkan pendaftaran reseller.'
      }
    }
  })
