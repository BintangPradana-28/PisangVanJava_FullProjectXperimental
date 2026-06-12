// app/(user)/track-order/[id]/page.tsx
// Public KDS-Linked Order Tracking Page
// RAG Source: prisma/schema.prisma (Order, OrderItem, Topping, MenuVariant)
// RAG Source: lib/wa-link.ts (WhatsApp link integration helper)

import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import TrackOrderDetailClient from './TrackOrderDetailClient'

export const metadata: Metadata = {
  title: 'Lacak Pesanan | Pisang Van Java',
  description: 'Pantau status persiapan pisang goreng Anda secara real-time langsung dari dapur kami.'
}

export const revalidate = 0

// Mask name: "Ahmad Syarif" -> "A***d S***f" to protect client identity
function maskName(name: string): string {
  const parts = name.trim().split(/\s+/)
  return parts
    .map((part) => {
      if (part.length <= 2) return part[0] + '*'.repeat(part.length - 1)
      return part[0] + '*'.repeat(part.length - 2) + part[part.length - 1]
    })
    .join(' ')
}

export default async function TrackOrderDetailPage({
  params
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  // Fetch the order. Select only non-sensitive columns
  const order = await prisma.order.findUnique({
    where: { id },
    select: {
      id: true,
      customerName: true,
      status: true,
      totalPrice: true,
      deliveryMethod: true,
      source: true,
      createdAt: true,
      confirmedAt: true,
      updatedAt: true,
      notes: true,
      items: {
        select: {
          id: true,
          baseType: true,
          quantity: true,
          subtotal: true,
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
  })

  if (!order) {
    notFound()
  }

  // Retrieve store WhatsApp contact link from settings
  const settingWa = await prisma.siteSetting.findUnique({
    where: { key: 'nomor_wa' }
  })
  const storePhone = settingWa?.value || '6281312167554'

  // Map to a strictly masked/safe DTO to guarantee zero PII data leaks
  const maskedOrder = {
    id: order.id,
    customerName: maskName(order.customerName),
    status: order.status,
    totalPrice: order.totalPrice,
    createdAt: order.createdAt.toISOString(),
    confirmedAt: order.confirmedAt ? order.confirmedAt.toISOString() : null,
    updatedAt: order.updatedAt.toISOString(),
    deliveryMethod: order.deliveryMethod,
    source: order.source,
    notes: order.notes,
    items: order.items.map((item: {
      id: string
      baseType: string
      quantity: number
      subtotal: number
      variant: { flavorName: string } | null
      toppings: Array<{ name: string; emoji: string | null }>
    }) => ({
      id: item.id,
      baseType: item.baseType,
      quantity: item.quantity,
      subtotal: item.subtotal,
      variantName: item.variant?.flavorName || 'Menu Terhapus',
      toppings: item.toppings.map((t: { name: string; emoji: string | null }) => ({
        name: t.name,
        emoji: t.emoji
      }))
    }))
  }

  return <TrackOrderDetailClient order={maskedOrder} storePhone={storePhone} />
}
