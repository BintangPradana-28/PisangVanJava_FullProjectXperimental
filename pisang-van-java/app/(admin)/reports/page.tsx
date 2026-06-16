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

  const [orders, totalVariants, totalToppings, payments] = await Promise.all([
    prisma.order.findMany({
      where: start ? { createdAt: { gte: start } } : undefined,
      include: { items: { include: { variant: true } } }
    }),
    prisma.menuVariant.count({ where: { isDeleted: false } }),
    prisma.topping.count({ where: { isActive: true } }),
    prisma.payment.findMany({
      where: {
        status: 'SETTLEMENT',
        ...(start ? { order: { createdAt: { gte: start } } } : {})
      },
      select: { paymentType: true, paymentChannel: true, grossAmount: true }
    })
  ])

  // Compute hourly distribution from orders (server-side, has real Date objects)
  const hourlyDist: Record<string, number> = {}
  for (let h = 0; h < 24; h++) hourlyDist[String(h)] = 0
  orders.forEach((o: any) => {
    const hour = new Date(o.createdAt).getHours()
    hourlyDist[String(hour)] = (hourlyDist[String(hour)] || 0) + 1
  })

  // Compute payment type breakdown for MDR calculation
  const paymentMap: Record<string, { totalAmount: number; count: number }> = {}
  payments.forEach((p: any) => {
    const type = (p.paymentType || p.paymentChannel || 'other').toLowerCase()
    if (!paymentMap[type]) paymentMap[type] = { totalAmount: 0, count: 0 }
    paymentMap[type].totalAmount += Number(p.grossAmount)
    paymentMap[type].count += 1
  })
  const paymentBreakdown = Object.entries(paymentMap).map(([paymentType, data]) => ({
    paymentType,
    totalAmount: data.totalAmount,
    count: data.count
  }))

  const formattedOrders = orders.map((o: any) => ({
    ...o,
    items: o.items.map((item: any) => ({
      ...item,
      variant: { flavorName: item.variant.flavorName }
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
          hourlyDistribution={hourlyDist}
          paymentBreakdown={paymentBreakdown}
        />
      </main>
    </div>
  )
}
