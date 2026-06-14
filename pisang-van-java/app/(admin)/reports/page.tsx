// app/(admin)/reports/page.tsx

import { redirect } from 'next/navigation'
import AdminSidebar from '@/components/admin/AdminSidebar'
import ReportsClient from '@/components/admin/ReportsClient'
import { prisma } from '@/lib/prisma'
import { auth } from '@/src/auth'

export default async function ReportsPage(props: { searchParams: Promise<{ range?: string }> }) {
  const searchParams = await props.searchParams
  const session = await auth()
  if (!session) redirect('/member-login')

  const range = searchParams.range || '30'
  const now = new Date()
  let start: Date | undefined
  if (range !== 'all') {
    start = new Date(now)
    start.setDate(now.getDate() - parseInt(range, 10))
  }

  const [orders, totalVariants, totalToppings] = await Promise.all([
    prisma.order.findMany({
      where: start ? { createdAt: { gte: start } } : undefined,
      include: { items: { include: { variant: true } } }
    }),
    prisma.menuVariant.count({ where: { isDeleted: false } }),
    prisma.topping.count({ where: { isActive: true } })
  ])

  const formattedOrders = orders.map((o: any) => ({
    ...o,
    items: o.items.map((item: any) => ({
      ...item,
      variant: {
        flavorName: item.variant.flavorName
      }
    }))
  }))

  return (
    <div className="flex min-h-screen">
      <AdminSidebar />
      <main className="flex-1 p-6 sm:p-8 bg-cream-100 overflow-y-auto">
        <ReportsClient
          orders={JSON.parse(JSON.stringify(formattedOrders))}
          totalVariants={totalVariants}
          totalToppings={totalToppings}
          currentRange={range}
        />
      </main>
    </div>
  )
}
