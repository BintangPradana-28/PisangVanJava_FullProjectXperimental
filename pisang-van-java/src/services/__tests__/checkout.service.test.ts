/**
 * @vitest-environment node
 */
import { describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => {
  return {}
})

vi.mock('@/src/auth', () => {
  return {
    auth: vi.fn()
  }
})

vi.mock('@/lib/redis', () => {
  return {
    redis: {
      get: vi.fn(),
      set: vi.fn(),
      del: vi.fn()
    }
  }
})

vi.mock('@upstash/ratelimit', () => {
  return {
    Ratelimit: class MockRatelimit {
      static slidingWindow = vi.fn()
      limit = vi.fn().mockResolvedValue({ success: true })
    }
  }
})

vi.mock('@/lib/prisma', () => {
  return {
    prisma: {
      order: {
        findUnique: vi.fn()
      }
    }
  }
})

import { prisma } from '@/lib/prisma'
import { getPaymentOrderForActor } from '../checkout.service'

describe('getPaymentOrderForActor', () => {
  it('should return null if order is not found', async () => {
    vi.mocked(prisma.order.findUnique).mockResolvedValue(null)

    const result = await getPaymentOrderForActor('orderId', null)
    expect(result).toBeNull()
  })

  it('should return null if order source is not online', async () => {
    vi.mocked(prisma.order.findUnique).mockResolvedValue({
      id: 'orderId',
      userId: null,
      source: 'whatsapp'
    } as any)

    const result = await getPaymentOrderForActor('orderId', null)
    expect(result).toBeNull()
  })

  it('should return the order for guest (userId is null) even when actor is null', async () => {
    const mockOrderDetails = {
      id: 'orderId',
      customerName: 'Bintang',
      customerPhone: '628123456789',
      totalPrice: 24000,
      status: 'PENDING_PAYMENT',
      source: 'online',
      userId: null,
      items: []
    }

    vi.mocked(prisma.order.findUnique)
      .mockResolvedValueOnce({
        id: 'orderId',
        userId: null,
        source: 'online'
      } as any)
      .mockResolvedValueOnce(mockOrderDetails as any)

    const result = await getPaymentOrderForActor('orderId', null)
    expect(result).toEqual(mockOrderDetails)
  })

  it('should reject guest (actor is null) if the order belongs to a registered member (userId is not null)', async () => {
    vi.mocked(prisma.order.findUnique).mockResolvedValue({
      id: 'orderId',
      userId: 'user-123',
      source: 'online'
    } as any)

    const result = await getPaymentOrderForActor('orderId', null)
    expect(result).toBeNull()
  })

  it('should allow registered member if actor userId matches order userId', async () => {
    const mockOrderDetails = {
      id: 'orderId',
      customerName: 'Bintang',
      customerPhone: '628123456789',
      totalPrice: 24000,
      status: 'PENDING_PAYMENT',
      source: 'online',
      userId: 'user-123',
      items: []
    }

    vi.mocked(prisma.order.findUnique)
      .mockResolvedValueOnce({
        id: 'orderId',
        userId: 'user-123',
        source: 'online'
      } as any)
      .mockResolvedValueOnce(mockOrderDetails as any)

    const actor = {
      userId: 'user-123',
      role: 'CUSTOMER' as const,
      email: 'member@test.com'
    }

    const result = await getPaymentOrderForActor('orderId', actor)
    expect(result).toEqual(mockOrderDetails)
  })

  it('should allow staff to view member order even if actor userId does not match', async () => {
    const mockOrderDetails = {
      id: 'orderId',
      customerName: 'Bintang',
      customerPhone: '628123456789',
      totalPrice: 24000,
      status: 'PENDING_PAYMENT',
      source: 'online',
      userId: 'user-123',
      items: []
    }

    vi.mocked(prisma.order.findUnique)
      .mockResolvedValueOnce({
        id: 'orderId',
        userId: 'user-123',
        source: 'online'
      } as any)
      .mockResolvedValueOnce(mockOrderDetails as any)

    const actor = {
      userId: 'staff-456',
      role: 'ADMIN' as const,
      email: 'admin@test.com'
    }

    const result = await getPaymentOrderForActor('orderId', actor)
    expect(result).toEqual(mockOrderDetails)
  })
})
