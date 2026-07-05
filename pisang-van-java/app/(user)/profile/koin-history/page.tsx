import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { auth } from '@/src/auth'
import KoinHistoryClient from './KoinHistoryClient'

export const metadata = {
  title: 'Riwayat Koin Pisang | Pisang Goreng Van Java'
}

export default async function KoinHistoryPage() {
  const session = await auth()
  if (!session?.user?.id) {
    redirect('/login?callbackUrl=/profile/koin-history')
  }

  const logs = await prisma.koinPisangLog.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      amount: true,
      description: true,
      createdAt: true
    }
  })

  // Format Date objects to ISO strings for safe serialization across Client/Server boundaries
  const serializedLogs = logs.map(
    (log: { id: string; amount: number; description: string; createdAt: Date }) => ({
      ...log,
      createdAt: log.createdAt.toISOString()
    })
  )

  return <KoinHistoryClient logs={serializedLogs} />
}
