// app/(admin)/orders/page.tsx
import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/src/features/auth/authOptions'
import AdminSidebar from '@/components/admin/AdminSidebar'
import OrdersClient from '@/components/admin/OrdersClient'
import { Toaster } from 'react-hot-toast'

export default async function OrdersPage() {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'ADMIN') redirect('/member-login')
  const orders = await prisma.order.findMany({
    orderBy: { createdAt: 'desc' },
    take: 50,
    select: {
      id: true,
      customerName: true,
      customerPhone: true,
      totalPrice: true,
      status: true,
      notes: true,
      source: true,
      createdAt: true,
      deliveryMethod: true,
      deliveryFee: true,
      items: {
        select: {
          id: true,
          baseType: true,
          quantity: true,
          unitPrice: true,
          subtotal: true,
          variant: {
            select: {
              flavorName: true,
            },
          },
          topping: {
            select: {
              name: true,
              emoji: true,
            },
          },
        },
      },
    },
  })

  const formattedOrders = orders.map(o => ({
    id: o.id,
    customerName: o.customerName,
    customerPhone: o.customerPhone,
    totalPrice: o.totalPrice,
    status: o.status,
    notes: o.notes,
    source: o.source,
    createdAt: o.createdAt.toISOString(),
    deliveryMethod: o.deliveryMethod,
    deliveryFee: o.deliveryFee,
    items: o.items.map(item => ({
      id: item.id,
      baseType: item.baseType,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      subtotal: item.subtotal,
      variant: {
        flavorName: item.variant.flavorName,
      },
      topping: item.topping === null ? null : {
        name: item.topping.name,
        emoji: item.topping.emoji,
      },
    }))
  }))

  return (
    <div className="flex min-h-screen">
      <AdminSidebar />
      <main className="flex-1 p-6 sm:p-8 bg-cream-100 overflow-y-auto">
        <Toaster position="top-right" />
        <OrdersClient initialOrders={formattedOrders} />
      </main>
    </div>
  )
}
