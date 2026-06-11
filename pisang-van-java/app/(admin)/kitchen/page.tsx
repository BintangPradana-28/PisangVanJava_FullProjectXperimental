// app/(admin)/kitchen/page.tsx
// KDS Server Component — fetches initial active orders and renders KitchenClient
// RAG Source: app/(admin)/kasir/page.tsx, app/(admin)/orders/page.tsx, prisma/schema.prisma

import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { auth } from '@/src/auth'
import KitchenClient from './KitchenClient'

export const metadata: Metadata = {
  title: 'Kitchen Display | Pisang Van Java',
  description: 'Tampilan dapur real-time untuk memantau dan memproses pesanan.'
}

export const revalidate = 0

// Allowed roles for kitchen access (matches middleware.ts RBAC)
const KITCHEN_ROLES = ['SUPER_ADMIN', 'ADMIN', 'KITCHEN'] as const

interface KitchenDbOrder {
  id: string
  customerName: string
  status: string
  notes: string | null
  source: string
  deliveryMethod: string
  createdAt: Date
  items: {
    id: string
    baseType: string
    quantity: number
    variant: {
      flavorName: string
    } | null
    toppings: {
      name: string
      emoji: string | null
    }[]
  }[]
}

export default async function KitchenPage() {
  const session = await auth()

  if (!session || !KITCHEN_ROLES.includes(session.user.role as (typeof KITCHEN_ROLES)[number])) {
    redirect('/login')
  }

  // Fetch active orders (PROCESSING and READY) — N+1 prevention via nested select
  const orders = (await prisma.order.findMany({
    where: {
      status: { in: ['PROCESSING', 'READY', 'PENDING_PAYMENT'] }
    },
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      customerName: true,
      status: true,
      notes: true,
      source: true,
      deliveryMethod: true,
      createdAt: true,
      items: {
        select: {
          id: true,
          baseType: true,
          quantity: true,
          variant: {
            select: {
              flavorName: true
            }
          },
          toppings: {
            select: {
              name: true,
              emoji: true
            }
          }
        }
      }
    }
  })) as unknown as KitchenDbOrder[]

  // Serialize dates for client component boundary
  const serializedOrders = orders.map((o: KitchenDbOrder) => ({
    ...o,
    createdAt: o.createdAt.toISOString()
  }))

  return <KitchenClient initialOrders={serializedOrders} />
}
