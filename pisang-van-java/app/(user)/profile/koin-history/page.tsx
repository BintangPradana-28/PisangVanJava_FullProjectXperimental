import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { auth } from '@/src/auth'
import KoinHistoryClient from './KoinHistoryClient'

export const metadata = {
  title: 'Riwayat Koin Pisang | Pisang Goreng Van Java'
}

export default async function KoinHistoryPage(props: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const session = await auth()
  if (!session?.user?.id) {
    redirect('/login?callbackUrl=/profile/koin-history')
  }

  const searchParams = await props.searchParams
  const page = Math.max(parseInt((searchParams.page as string) || '1', 10), 1)
  const limit = 10
  const skip = (page - 1) * limit

  const [logs, totalCount] = await prisma.$transaction([
    prisma.koinPisangLog.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
      select: {
        id: true,
        amount: true,
        description: true,
        createdAt: true
      }
    }),
    prisma.koinPisangLog.count({
      where: { userId: session.user.id }
    })
  ])

  // Format Date objects to ISO strings for safe serialization across Client/Server boundaries
  const serializedLogs = logs.map(
    (log: { id: string; amount: number; description: string; createdAt: Date }) => ({
      ...log,
      createdAt: log.createdAt.toISOString()
    })
  )

  return (
    <KoinHistoryClient logs={serializedLogs} page={page} limit={limit} totalCount={totalCount} />
  )
}
