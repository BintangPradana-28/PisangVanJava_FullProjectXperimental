/**
 * @vitest-environment node
 */
import { describe, expect, it, vi, beforeEach } from 'vitest'

vi.mock('@/src/auth', () => ({
  auth: vi.fn()
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      update: vi.fn()
    },
    order: {
      findUnique: vi.fn(),
      update: vi.fn(),
      aggregate: vi.fn()
    },
    payment: {
      update: vi.fn()
    },
    menuVariant: {
      update: vi.fn()
    },
    $transaction: vi.fn((cb) => cb(prismaMock))
  }
}))

vi.mock('@/lib/notifications', () => ({
  sendWhatsAppNotification: vi.fn()
}))

vi.mock('@/src/features/payment/email', () => ({
  sendOrderStatusEmail: vi.fn().mockResolvedValue({ success: true })
}))

vi.mock('@/lib/push', () => ({
  sendPushNotification: vi.fn().mockResolvedValue({ success: true }),
  buildOrderStatusPushPayload: vi.fn().mockReturnValue({})
}))

vi.mock('@/src/services/biteship.service', () => ({
  cancelBiteshipOrder: vi.fn().mockResolvedValue({ success: true }),
  createBiteshipOrder: vi.fn(),
  getBiteshipTracking: vi.fn()
}))

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn()
}))

import { auth } from '@/src/auth'
import { prisma } from '@/lib/prisma'
import { getUserBudgetStatus, updateMonthlyBudget, cancelOrder } from '../orderHistory'

const prismaMock = prisma as any

describe('orderHistory Server Actions', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    prismaMock.$transaction.mockImplementation((cb: any) => cb(prismaMock))
  })

  describe('updateMonthlyBudget', () => {
    it('should return error if not authenticated', async () => {
      vi.mocked(auth).mockResolvedValue(null)
      const res = await updateMonthlyBudget(150000)
      expect(res.success).toBe(false)
      expect(res.error).toBe('Unauthorized')
    })

    it('should update user budget successfully', async () => {
      vi.mocked(auth).mockResolvedValue({
        user: { id: 'user-123', email: 'test@email.com' }
      } as any)
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        id: 'user-123',
        notificationPrefs: JSON.stringify({ email: true, push: false })
      } as any)

      const res = await updateMonthlyBudget(150000)
      expect(res.success).toBe(true)
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-123' },
        data: {
          notificationPrefs: {
            email: true,
            push: false,
            monthlyBudget: 150000
          }
        }
      })
    })
  })

  describe('getUserBudgetStatus', () => {
    it('should return budget status and total spending', async () => {
      vi.mocked(auth).mockResolvedValue({ user: { id: 'user-123' } } as any)
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        id: 'user-123',
        notificationPrefs: { email: true, monthlyBudget: 200000 }
      } as any)
      vi.mocked(prisma.order.aggregate).mockResolvedValue({
        _sum: { totalPrice: 75000 }
      } as any)

      const res = await getUserBudgetStatus()
      expect(res.success).toBe(true)
      expect(res.data).toEqual({
        monthlyBudget: 200000,
        currentMonthSpending: 75000
      })
    })
  })

  describe('cancelOrder', () => {
    it('should reject cancelation if order not found', async () => {
      vi.mocked(auth).mockResolvedValue({ user: { id: 'user-123' } } as any)
      vi.mocked(prisma.order.findUnique).mockResolvedValue(null)

      const res = await cancelOrder('order-999')
      expect(res.success).toBe(false)
      expect(res.error).toBe('Pesanan tidak ditemukan.')
    })

    it('should reject cancelation if order does not belong to user', async () => {
      vi.mocked(auth).mockResolvedValue({ user: { id: 'user-123' } } as any)
      vi.mocked(prisma.order.findUnique).mockResolvedValue({
        id: 'order-111',
        userId: 'other-user',
        status: 'PENDING_PAYMENT'
      } as any)

      const res = await cancelOrder('order-111')
      expect(res.success).toBe(false)
      expect(res.error).toBe('Akses ditolak. Anda bukan pemilik pesanan ini.')
    })

    it('should reject cancelation if order is not in PENDING_PAYMENT status', async () => {
      vi.mocked(auth).mockResolvedValue({ user: { id: 'user-123' } } as any)
      vi.mocked(prisma.order.findUnique).mockResolvedValue({
        id: 'order-111',
        userId: 'user-123',
        status: 'PROCESSING'
      } as any)

      const res = await cancelOrder('order-111')
      expect(res.success).toBe(false)
      expect(res.error).toBe('Hanya pesanan yang menunggu pembayaran yang dapat dibatalkan.')
    })

    it('should cancel order, restore stock, and send notifications', async () => {
      vi.mocked(auth).mockResolvedValue({ user: { id: 'user-123' } } as any)
      vi.mocked(prisma.order.findUnique).mockResolvedValue({
        id: 'order-111',
        userId: 'user-123',
        status: 'PENDING_PAYMENT',
        customerPhone: '0812345678',
        customerName: 'Budi',
        items: [
          { variantId: 'variant-1', quantity: 2 },
          { variantId: 'variant-2', quantity: 1 }
        ],
        payment: { id: 'payment-1' }
      } as any)

      const res = await cancelOrder('order-111')
      expect(res.success).toBe(true)

      // Verify stock restore updates
      expect(prisma.menuVariant.update).toHaveBeenCalledWith({
        where: { id: 'variant-1' },
        data: { stock: { increment: 2 } }
      })
      expect(prisma.menuVariant.update).toHaveBeenCalledWith({
        where: { id: 'variant-2' },
        data: { stock: { increment: 1 } }
      })

      // Verify order update status to CANCELED
      expect(prisma.order.update).toHaveBeenCalledWith({
        where: { id: 'order-111' },
        data: { status: 'CANCELED' }
      })

      // Verify payment update status to CANCELED
      expect(prisma.payment.update).toHaveBeenCalledWith({
        where: { orderId: 'order-111' },
        data: { status: 'CANCELED' }
      })
    })
  })
})
