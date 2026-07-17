import type { Metadata } from 'next'
import { unstable_cache } from 'next/cache'
import { redirect } from 'next/navigation'
import AdminHeader from '@/components/admin/AdminHeader'
import AdminSidebar from '@/components/admin/AdminSidebar'
import { prisma } from '@/lib/prisma'
import { formatPrice, formatPriceShort } from '@/lib/utils'
import { auth } from '@/src/auth'

export const metadata: Metadata = { title: 'Dashboard' }

async function getDashboardDataInternal() {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  // Hitung grafik penjualan 7 hari terakhir
  const last7Days = Array.from({ length: 7 }).map((_, i) => {
    const d = new Date()
    d.setDate(d.getDate() - (6 - i))
    d.setHours(0, 0, 0, 0)
    return d
  })
  const weekStart = new Date(last7Days[0])

  // PERFORMANCE (backend & data audit — "ngacir" pass): weekOrders previously
  // ran as its own `await` *after* this Promise.all resolved, even though it
  // doesn't depend on any of the other four queries' results — folded in here
  // so a dashboard cache-miss costs one round-trip batch instead of two.
  const [totalProducts, recentOrders, todaysOrdersAggregation, pendingOrders, weekOrders] =
    await Promise.all([
      prisma.menuVariant.count({ where: { isDeleted: false } }),
      prisma.order.findMany({
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: {
          id: true,
          customerName: true,
          source: true,
          totalPrice: true,
          createdAt: true,
          items: {
            select: {
              id: true
            }
          }
        }
      }),
      prisma.order.aggregate({
        where: { createdAt: { gte: today } },
        _sum: { totalPrice: true },
        _count: { id: true }
      }),
      prisma.order.count({
        where: { status: 'PENDING_PAYMENT' }
      }),
      prisma.order.findMany({
        where: { createdAt: { gte: weekStart } },
        select: { createdAt: true, totalPrice: true }
      })
    ])

  const todayRevenue = todaysOrdersAggregation._sum.totalPrice || 0
  const todaysOrdersCount = todaysOrdersAggregation._count.id || 0

  const chartData = last7Days.map((date) => {
    const dayOrders = weekOrders.filter((o: any) => {
      const oDate = new Date(o.createdAt)
      return oDate.getDate() === date.getDate() && oDate.getMonth() === date.getMonth()
    })
    return {
      date: date.toLocaleDateString('id-ID', { weekday: 'short' }),
      total: dayOrders.reduce((sum: any, o: any) => sum + o.totalPrice, 0),
      count: dayOrders.length
    }
  })

  return {
    totalProducts,
    recentOrders,
    todaysOrders: todaysOrdersCount,
    todayRevenue,
    pendingOrders,
    chartData
  }
}

// Wrap with unstable_cache for 2-minute revalidation TTL
const getCachedDashboardData = unstable_cache(
  async () => {
    return getDashboardDataInternal()
  },
  ['admin-dashboard-stats-cache'],
  {
    revalidate: 120, // 2 minutes TTL
    tags: ['admin-dashboard']
  }
)

export default async function DashboardPage() {
  const session = await auth()
  if (!session || !['ADMIN', 'SUPER_ADMIN'].includes(session.user.role)) redirect('/member-login')

  const data = await getCachedDashboardData()

  const metrics = [
    {
      label: 'Pendapatan Hari Ini',
      value: formatPrice(data.todayRevenue),
      icon: '💰',
      sub: `${data.todaysOrders} pesanan hari ini`
    },
    {
      label: 'Pesanan Menunggu',
      value: data.pendingOrders,
      icon: '⏳',
      sub: 'Perlu konfirmasi segera'
    },
    { label: 'Total Varian Menu', value: data.totalProducts, icon: '🍌', sub: 'Aktif dijual' }
  ]

  const maxRevenue = Math.max(...data.chartData.map((d) => d.total), 1)

  return (
    <div className="flex">
      <AdminSidebar />
      <main className="flex-1 p-6 sm:p-8 overflow-y-auto min-h-screen bg-cream-100">
        <div className="bg-brown-700 rounded-[4px] p-6 mb-6 flex items-center justify-between text-white shadow-sm">
          <div>
            <h2 className="font-serif text-xl font-bold">
              Selamat datang, {session.user?.name || 'Admin'}! 👋
            </h2>
            <p className="text-cream-200/70 text-sm mt-1">
              Pantau pesanan dan pendapatan Pisang Goreng Van Java
            </p>
          </div>
          <span className="text-5xl drop-shadow-md">🍌</span>
        </div>

        <AdminHeader title="Dashboard" subtitle="Ringkasan data hari ini" />

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          {metrics.map(({ label, value, icon, sub }) => (
            <div
              key={label}
              className="bg-white rounded-[4px] p-5 border border-cream-200 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow"
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-[4px] bg-cream-100 flex items-center justify-center text-xl">
                  {icon}
                </div>
                <div className="text-xs font-bold text-brown-400 uppercase tracking-wider">
                  {label}
                </div>
              </div>
              <div>
                <div className="font-serif text-3xl font-bold text-brown-700">{value}</div>
                <div className="text-xs text-brown-400 mt-1">{sub}</div>
              </div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          <div className="lg:col-span-2 bg-white rounded-[4px] border border-cream-200 shadow-sm p-6">
            <h3 className="font-serif text-lg font-bold text-brown-700 mb-6">
              Grafik Penjualan 7 Hari Terakhir
            </h3>
            <div className="h-48 flex items-end gap-2 sm:gap-4">
              {data.chartData.map((d, i) => {
                const height = Math.max((d.total / maxRevenue) * 100, 5)
                const barClassName = `db-chart-bar-${i}`
                return (
                  <div key={d.date} className="flex-1 flex flex-col items-center group">
                    <div className="relative w-full flex justify-center h-full items-end">
                      <style>{`
                        .${barClassName} {
                          height: ${height}%;
                        }
                      `}</style>
                      <div
                        className={`w-full max-w-[40px] bg-amber-brand/80 group-hover:bg-amber-brand rounded-t-md transition-all duration-300 cursor-pointer relative ${barClassName}`}
                      >
                        {/* bar height is a runtime-computed % from revenue data; Tailwind cannot express dynamic JS values */}
                        <div className="opacity-0 group-hover:opacity-100 absolute -top-10 left-1/2 -translate-x-1/2 bg-brown-700 text-white text-[10px] py-1 px-2 rounded pointer-events-none whitespace-nowrap z-10 transition-opacity">
                          {formatPriceShort(d.total)} ({d.count} ord)
                        </div>
                      </div>
                    </div>
                    <div className="text-[10px] sm:text-xs text-brown-400 font-semibold mt-3 uppercase tracking-wider">
                      {d.date}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          <div className="bg-white rounded-[4px] border border-cream-200 shadow-sm p-6 flex flex-col">
            <h3 className="font-serif text-lg font-bold text-brown-700 mb-4">Aktivitas Terkini</h3>
            <div className="flex-1 space-y-4 overflow-y-auto max-h-[220px] pr-2 custom-scrollbar">
              {data.recentOrders.length === 0 ? (
                <div className="h-full flex items-center justify-center text-brown-300 text-sm">
                  Belum ada pesanan masuk
                </div>
              ) : (
                data.recentOrders.map((order: any) => (
                  <div
                    key={order.id}
                    className="flex items-start gap-3 border-b border-cream-100 pb-3 last:border-0 last:pb-0"
                  >
                    <div className="w-8 h-8 rounded-[4px] bg-blue-50 text-blue-500 flex items-center justify-center text-xs shrink-0 mt-0.5">
                      {order.source === 'whatsapp' ? '💬' : '🚶'}
                    </div>
                    <div>
                      <div className="text-sm font-bold text-brown-700">{order.customerName}</div>
                      <div className="text-xs text-brown-400 mt-0.5">
                        {order.items.length} item • {formatPrice(order.totalPrice)}
                      </div>
                      <div className="text-[10px] text-brown-300 mt-1">
                        {new Date(order.createdAt).toLocaleTimeString('id-ID', {
                          hour: '2-digit',
                          minute: '2-digit'
                        })}{' '}
                        WIB
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
