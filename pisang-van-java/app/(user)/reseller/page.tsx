// app/(user)/reseller/page.tsx
// Reseller & B2B Partner Portal — Registration & Dashboard
// RAG Source: prisma/schema.prisma (MenuVariant, B2BDeal, Role)
// RAG Source: src/features/crm/actions.ts (applyForReseller)

import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { auth } from '@/src/auth'
import ResellerClient from './ResellerClient'

export const metadata: Metadata = {
  title: 'Kemitraan Reseller | Pisang Van Java',
  description: 'Bergabung sebagai Reseller resmi Pisang Van Java dan nikmati keuntungan harga grosir khusus.'
}

export const revalidate = 0

export default async function ResellerPage() {
  const session = await auth()

  // 1. Fetch Special Wholesale Price List
  const products = await prisma.menuVariant.findMany({
    where: { isDeleted: false, isActive: true },
    select: {
      id: true,
      flavorName: true,
      priceKembung: true,
      priceLumpia: true,
      priceKrispy: true,
      wholesaleKembung: true,
      wholesaleLumpia: true,
      wholesaleKrispy: true,
      imageUrl: true
    }
  })

  let pendingApplication = null
  let resellerOrders: any[] = []
  let userPhone = ''

  if (session?.user?.id) {
    // 2. Fetch User Profile for WhatsApp validation
    const userProfile = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { phone: true }
    })
    userPhone = userProfile?.phone || ''

    // 3. Fetch Reseller Application Status if customer
    if (session.user.role === 'CUSTOMER') {
      pendingApplication = await prisma.b2BDeal.findFirst({
        where: {
          ownerId: session.user.id,
          dealName: 'Reseller Application',
          stage: { in: ['PROSPECTING', 'NEGOTIATION'] }
        },
        select: {
          id: true,
          stage: true,
          createdAt: true
        }
      })
    }

    // 4. Fetch Reseller Orders if already reseller
    if (session.user.role === 'RESELLER') {
      resellerOrders = await prisma.order.findMany({
        where: { userId: session.user.id },
        orderBy: { createdAt: 'desc' },
        take: 15,
        select: {
          id: true,
          totalPrice: true,
          status: true,
          createdAt: true,
          deliveryMethod: true
        }
      })
    }
  }

  // Format dates for Client component
  const serializedOrders = resellerOrders.map((o) => ({
    ...o,
    createdAt: o.createdAt.toISOString()
  }))

  const serializedPending = pendingApplication
    ? {
        ...pendingApplication,
        createdAt: pendingApplication.createdAt.toISOString()
      }
    : null

  return (
    <ResellerClient
      session={session}
      products={products}
      pendingApplication={serializedPending}
      resellerOrders={serializedOrders}
      userPhone={userPhone}
    />
  )
}
