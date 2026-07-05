// app/(user)/profile/orders/[id]/page.tsx
// Protected Order Invoice Page
// RAG Source: app/(user)/profile/layout.tsx (auth session check)
// RAG Source: prisma/schema.prisma (Order, OrderItem, Payment, User)

import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { auth } from '@/src/auth'
import ProfileOrderDetailClient from './ProfileOrderDetailClient'

export const metadata: Metadata = {
  title: 'Detail Pesanan | Pisang Van Java',
  description: 'Informasi tagihan dan invoice rincian pembelian Anda.'
}

export const revalidate = 0

const KITCHEN_ROLES = ['SUPER_ADMIN', 'ADMIN', 'CASHIER', 'KITCHEN'] as const

interface SerializedOrderItem {
  id: string
  baseType: string
  quantity: number
  unitPrice: number
  subtotal: number
  variant: {
    id: string
    flavorName: string
    imageUrl: string | null
  } | null
  toppings: Array<{
    id: string
    name: string
    price: number
  }>
}

export default async function ProfileOrderDetailPage({
  params
}: {
  params: Promise<{ id: string }>
}) {
  const session = await auth()
  if (!session?.user) {
    redirect('/member-login?callbackUrl=/profile')
  }

  const { id } = await params

  // Query order with full relations
  const order = await prisma.order.findUnique({
    where: { id },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          name: true
        }
      },
      payment: {
        select: {
          status: true,
          paymentType: true
        }
      },
      items: {
        include: {
          variant: {
            select: {
              id: true,
              flavorName: true,
              imageUrl: true
            }
          },
          toppings: {
            select: {
              id: true,
              name: true,
              price: true
            }
          }
        }
      },
      reviews: {
        select: {
          id: true,
          rating: true,
          comment: true
        }
      }
    }
  })

  if (!order) {
    redirect('/profile/pesanan')
  }

  // Enforce IDOR/BOLA security checks at server level
  const isOwner = order.userId === session.user.id
  const isStaff = KITCHEN_ROLES.includes(session.user.role as (typeof KITCHEN_ROLES)[number])

  if (!isOwner && !isStaff) {
    return (
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-8 text-center max-w-lg mx-auto my-12">
        <div className="text-5xl mb-4">🚫</div>
        <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">Akses Terbatas</h2>
        <p className="text-sm text-zinc-500 mt-2">
          Anda tidak diizinkan untuk melihat detail pesanan ini.
        </p>
        <div className="mt-6">
          <Link
            href="/profile/pesanan"
            className="px-6 py-2.5 bg-amber-600 hover:bg-amber-500 text-white text-sm font-bold rounded-lg transition-all"
          >
            Kembali ke Riwayat Pesanan
          </Link>
        </div>
      </div>
    )
  }

  // Serialize date & data fields to pass safely down to the Client Component
  const serializedOrder = {
    id: order.id,
    status: order.status,
    totalPrice: order.totalPrice,
    createdAt: order.createdAt.toISOString(),
    deliveryMethod: order.deliveryMethod,
    deliveryFee: order.deliveryFee,
    discountAmount: order.discountAmount,
    customerName: order.customerName,
    customerPhone: order.customerPhone,
    notes: order.notes,
    user: order.user,
    payment: order.payment,
    reviews: order.reviews,
    items: order.items.map(
      (item: {
        id: string
        baseType: string
        quantity: number
        unitPrice: number
        subtotal: number
        variant: { id: string; flavorName: string; imageUrl: string | null } | null
        toppings: Array<{ id: string; name: string; price: number }>
      }) => ({
        id: item.id,
        baseType: item.baseType,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        subtotal: item.subtotal,
        variant: item.variant,
        toppings: item.toppings.map((t: { id: string; name: string; price: number }) => ({
          id: t.id,
          name: t.name,
          price: t.price
        }))
      })
    ) as SerializedOrderItem[]
  }

  return <ProfileOrderDetailClient order={serializedOrder} />
}
