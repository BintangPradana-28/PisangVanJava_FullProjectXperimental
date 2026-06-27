'use server'

import { prisma } from '@/lib/prisma'
import type { Prisma } from '@prisma/client'
import { auth } from '@/src/auth'
import { sendWhatsAppNotification } from '@/lib/notifications'
import { sendOrderStatusEmail } from '@/src/features/payment/email'
import { buildOrderStatusPushPayload, sendPushNotification } from '@/lib/push'
import { revalidatePath } from 'next/cache'
import { cancelBiteshipOrder } from '@/src/services/biteship.service'

export async function getUserOrders() {
  try {
    const session = await auth()
    if (!session || !session.user) {
      return { success: false, error: 'Sesi tidak valid. Silakan login kembali.' }
    }

    // Enterprise-grade query: Fetches exactly what's needed, strictly scoped to the user,
    // limits to 50 for MVP performance, and prevents N+1 via nested includes.
    const orders = await prisma.order.findMany({
      where: {
        userId: session.user.id
      },
      take: 50,
      orderBy: {
        createdAt: 'desc'
      },
      include: {
        items: {
          include: {
            variant: {
              select: {
                id: true,
                flavorName: true,
                imageUrl: true
              }
            },
            toppings: {
              select: {
                id: true,
                name: true,
                price: true
              }
            }
          }
        },
        payment: {
          select: {
            status: true,
            paymentType: true
          }
        }
      }
    })

    return { success: true, data: orders }
  } catch (error) {
    const err = error as Error
    console.error('Error fetching user orders:', err)
    return { success: false, error: 'Gagal memuat riwayat pesanan. Terjadi kesalahan pada server.' }
  }
}

export async function updateMonthlyBudget(budgetValue: number | null) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return { success: false, error: 'Unauthorized' }
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { notificationPrefs: true }
    })

    let currentPrefs: Record<string, unknown> = {}
    if (user?.notificationPrefs) {
      currentPrefs =
        typeof user.notificationPrefs === 'string'
          ? (JSON.parse(user.notificationPrefs) as Record<string, unknown>)
          : (user.notificationPrefs as Record<string, unknown>)
    }

    const updatedPrefs = {
      ...currentPrefs,
      monthlyBudget: budgetValue
    }

    await prisma.user.update({
      where: { id: session.user.id },
      data: { notificationPrefs: updatedPrefs }
    })

    revalidatePath('/profile/anggaran')
    return { success: true, message: 'Anggaran bulanan berhasil diperbarui.' }
  } catch (error) {
    const err = error as Error
    console.error('Error updating monthly budget:', err)
    return { success: false, error: 'Gagal memperbarui anggaran bulanan.' }
  }
}

export async function getUserBudgetStatus() {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return { success: false, error: 'Unauthorized' }
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { notificationPrefs: true }
    })

    let monthlyBudget: number | null = null
    if (user?.notificationPrefs) {
      const prefs =
        typeof user.notificationPrefs === 'string'
          ? (JSON.parse(user.notificationPrefs) as Record<string, unknown>)
          : (user.notificationPrefs as Record<string, unknown>)
      if (typeof prefs === 'object' && prefs !== null && 'monthlyBudget' in prefs) {
        monthlyBudget = prefs.monthlyBudget !== null ? Number(prefs.monthlyBudget) : null
      }
    }

    const startOfMonth = new Date()
    startOfMonth.setDate(1)
    startOfMonth.setHours(0, 0, 0, 0)

    const endOfMonth = new Date()
    endOfMonth.setMonth(endOfMonth.getMonth() + 1)
    endOfMonth.setDate(0)
    endOfMonth.setHours(23, 59, 59, 999)

    const aggregate = await prisma.order.aggregate({
      where: {
        userId: session.user.id,
        status: { not: 'CANCELED' },
        createdAt: {
          gte: startOfMonth,
          lte: endOfMonth
        }
      },
      _sum: {
        totalPrice: true
      }
    })

    const currentMonthSpending = aggregate._sum.totalPrice || 0

    return {
      success: true,
      data: {
        monthlyBudget,
        currentMonthSpending
      }
    }
  } catch (error) {
    const err = error as Error
    console.error('Error fetching budget status:', err)
    return { success: false, error: 'Gagal memuat status anggaran.' }
  }
}

export async function cancelOrder(orderId: string) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return { success: false, error: 'Sesi tidak valid. Silakan login kembali.' }
    }

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { items: true, payment: true }
    })

    if (!order) {
      return { success: false, error: 'Pesanan tidak ditemukan.' }
    }

    if (order.userId !== session.user.id) {
      return { success: false, error: 'Akses ditolak. Anda bukan pemilik pesanan ini.' }
    }

    if (order.status !== 'PENDING_PAYMENT') {
      return {
        success: false,
        error: 'Hanya pesanan yang menunggu pembayaran yang dapat dibatalkan.'
      }
    }

    // Execute database operations transactionally
    await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      // 1. Restore stock
      for (const item of order.items) {
        if (item.variantId) {
          await tx.menuVariant.update({
            where: { id: item.variantId },
            data: { stock: { increment: item.quantity } }
          })
        }
      }

      // 2. Set status to CANCELED
      await tx.order.update({
        where: { id: orderId },
        data: { status: 'CANCELED' }
      })

      // 3. Update payment status to CANCELED if it exists
      if (order.payment) {
        await tx.payment.update({
          where: { orderId },
          data: { status: 'CANCELED' }
        })
      }
    })

    // Cancel Biteship order if registered (outside Prisma transaction to avoid locking database)
    if (order.biteshipOrderId) {
      try {
        const biteshipResult = await cancelBiteshipOrder(order.biteshipOrderId)
        if (!biteshipResult.success) {
          console.warn(`[BITESHIP WARNING] Failed to cancel Biteship order ${order.biteshipOrderId}: ${biteshipResult.error}`)
        }
      } catch (biteshipErr) {
        console.error('[BITESHIP ERROR] Exception during Biteship order cancellation:', biteshipErr)
      }
    }

    // 4. Send notifications (WhatsApp and Email)
    try {
      await sendWhatsAppNotification(
        order.customerPhone,
        order.customerName,
        'CANCELED',
        order.id,
        null,
        null
      )
    } catch (err) {
      console.error('Failed to send WA notification on cancel:', err)
    }

    try {
      await sendOrderStatusEmail(order.id, 'CANCELED')
    } catch (err) {
      console.error('Failed to send email notification on cancel:', err)
    }

    // 5. Send Web Push
    try {
      const pushPayload = buildOrderStatusPushPayload(order.id, 'CANCELED')
      if (pushPayload) {
        await sendPushNotification(session.user.id, pushPayload)
      }
    } catch (err) {
      console.error('Failed to send push notification on cancel:', err)
    }

    revalidatePath('/profile/anggaran')
    revalidatePath('/profile/pesanan')

    return { success: true }
  } catch (error) {
    const err = error as Error
    console.error('Error canceling order:', err)
    return { success: false, error: 'Gagal membatalkan pesanan. Terjadi kesalahan pada server.' }
  }
}
