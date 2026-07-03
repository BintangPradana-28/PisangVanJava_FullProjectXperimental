import { OrderStatus, type Prisma } from '@prisma/client'
import { type NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { env } from '@/src/env'
import { logger } from '@/src/lib/logger'

export async function GET(req: NextRequest) {
  // Validate CRON_SECRET if set
  const authHeader = req.headers.get('authorization')
  const cronSecret = env.CRON_SECRET
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const task = searchParams.get('task')

  try {
    const results: Record<string, any> = {}

    // Task 1: Expire Orders older than 24 hours
    if (!task || task === 'expire-orders') {
      const expiredThreshold = new Date(Date.now() - 24 * 60 * 60 * 1000)

      // Fetch expired orders
      const expiredOrders = await prisma.order.findMany({
        where: {
          status: OrderStatus.PENDING_PAYMENT,
          createdAt: { lt: expiredThreshold }
        },
        include: { items: true }
      })

      let expiredCount = 0
      if (expiredOrders.length > 0) {
        await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
          for (const order of expiredOrders) {
            const updated = await tx.order.updateMany({
              where: { id: order.id, status: OrderStatus.PENDING_PAYMENT },
              data: { status: OrderStatus.CANCELED }
            })

            if (updated.count > 0) {
              expiredCount++
              if (order.items) {
                await Promise.all(
                  order.items
                    .filter(
                      (item: { variantId: string | null; quantity: number }) => item.variantId
                    )
                    .map((item: { variantId: string | null; quantity: number }) =>
                      tx.menuVariant.update({
                        where: { id: item.variantId! },
                        data: { stock: { increment: item.quantity } }
                      })
                    )
                )
              }
            }
          }
        })
      }
      results.expireOrders = { checked: expiredOrders.length, expired: expiredCount }
      logger.info(`[CRON] Expired ${expiredCount} orders.`)
    }

    // Task 2: Cleanup logs older than 90 days
    if (!task || task === 'cleanup-logs') {
      const logsThreshold = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)

      const deletedAudit = await prisma.auditLog.deleteMany({
        where: { createdAt: { lt: logsThreshold } }
      })

      const deletedAuth = await prisma.authLog.deleteMany({
        where: { createdAt: { lt: logsThreshold } }
      })

      results.cleanupLogs = {
        deletedAudit: deletedAudit.count,
        deletedAuth: deletedAuth.count
      }
      logger.info(
        `[CRON] Cleaned up ${deletedAudit.count} audit logs and ${deletedAuth.count} auth logs.`
      )
    }

    return NextResponse.json({ success: true, results })
  } catch (error) {
    logger.error(error as Error, '[CRON ERROR] Scheduled task failed')
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 })
  }
}
