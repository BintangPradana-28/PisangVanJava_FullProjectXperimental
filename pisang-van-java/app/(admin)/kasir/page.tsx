import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { auth } from '@/src/auth'
import PosClient from './PosClient'

// Revalidate 0 ensures we always fetch fresh data on full reload
export const revalidate = 0

export default async function KasirPage() {
  const session = await auth()

  const POS_ROLES = ['ADMIN', 'SUPER_ADMIN', 'CASHIER'] as const
  if (!session || !POS_ROLES.includes(session.user.role as (typeof POS_ROLES)[number])) {
    redirect('/member-login')
  }

  // Fetch active products and toppings
  const [products, toppings] = await Promise.all([
    prisma.menuVariant.findMany({
      where: { isDeleted: false, isActive: true },
      orderBy: { flavorName: 'asc' }
    }),
    prisma.topping.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' }
    })
  ])

  return (
    <div className="h-[100dvh] w-full overflow-hidden overscroll-none bg-zinc-50 dark:bg-zinc-950 flex flex-col">
      <PosClient products={products} toppings={toppings} />
    </div>
  )
}
