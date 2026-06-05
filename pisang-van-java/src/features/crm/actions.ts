'use server'

import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { auth } from "@/src/auth";

export async function requireAdminActor() {
  const session = await auth()
  if (!session?.user?.id) {
    return null
  }
  
  if (session.user.role !== 'ADMIN') {
    return null
  }

  return { userId: session.user.id }
}

const createDealSchema = z.object({
  companyName: z.string().min(2, 'Nama perusahaan terlalu pendek').max(100),
  contactName: z.string().min(2, 'Nama kontak terlalu pendek').max(100),
  phone: z.string().min(8, 'Nomor HP tidak valid').max(20),
  email: z.string().email('Email tidak valid').optional().or(z.literal('')),
  dealName: z.string().min(5, 'Nama deal terlalu pendek').max(150),
  amount: z.coerce.number().nonnegative('Nominal tidak boleh negatif').optional().nullable(),
  notes: z.string().max(1000).optional().nullable()
}).strict()

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
        ownerId: admin.userId,
      }
    })
    return { success: true as const, data: newDeal }
  } catch (err) {
    console.error('[CRM_CREATE_ERROR]', err)
    return { success: false as const, error: 'Failed to create B2B deal.' }
  }
}

const updateDealStatusSchema = z.object({
  dealId: z.string().cuid(),
  stage: z.enum(['PROSPECTING', 'NEGOTIATION', 'CLOSED_WON', 'CLOSED_LOST'])
}).strict()

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
    const updated = await prisma.b2BDeal.update({
      where: { id: parsed.data.dealId },
      data: { stage: parsed.data.stage }
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
