import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { auth } from '@/src/auth'
import LaporFormClient from './LaporFormClient'

export const metadata = {
  title: 'Lapor Kendala Pesanan | Pisang Goreng Van Java'
}

export default async function LaporPage() {
  const session = await auth()
  if (!session?.user?.id) {
    redirect('/login?callbackUrl=/profile/bantuan/lapor')
  }

  // Load the 10 most recent orders for dropdown context
  const orders = await prisma.order.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: 'desc' },
    take: 10,
    select: {
      id: true,
      totalPrice: true,
      createdAt: true,
      status: true
    }
  })

  return <LaporFormClient orders={orders} />
}
