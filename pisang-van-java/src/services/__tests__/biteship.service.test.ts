/**
 * @vitest-environment node
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { prisma } from '@/lib/prisma'

let mockBiteshipApiKey: string | undefined

vi.mock('@/src/env', () => ({
  get env() {
    return {
      BITESHIP_API_KEY: mockBiteshipApiKey
    }
  }
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    order: {
      findUnique: vi.fn(),
      update: vi.fn()
    }
  }
}))

import { createBiteshipOrder, cancelBiteshipOrder, getBiteshipTracking } from '../biteship.service'

const prismaMock = prisma as any

describe('Biteship Service Unit Tests', () => {
  beforeEach(() => {
    mockBiteshipApiKey = undefined
    vi.restoreAllMocks()
    vi.resetAllMocks()
  })

  describe('createBiteshipOrder', () => {
    it('should fail if BITESHIP_API_KEY is not configured', async () => {
      mockBiteshipApiKey = undefined
      const result = await createBiteshipOrder('test-order-id')
      expect(result.success).toBe(false)
      expect(result.error).toBe('Biteship API Key is not configured.')
    })

    it('should successfully create an order and update DB with Biteship IDs', async () => {
      mockBiteshipApiKey = 'test-api-key'
      
      const mockOrder = {
        id: 'test-order-id',
        customerName: 'John Doe',
        customerPhone: '088888888888',
        deliveryMethod: 'DELIVERY',
        courierName: 'Gojek',
        address: {
          fullAddress: 'Lebak Bulus MRT...',
          latitude: -6.28927,
          longitude: 106.77492
        },
        items: [
          {
            quantity: 1,
            unitPrice: 165000,
            variant: { flavorName: 'Black L' }
          }
        ]
      }

      prismaMock.order.findUnique.mockResolvedValue(mockOrder)
      prismaMock.order.update.mockResolvedValue({ ...mockOrder, biteshipOrderId: '5dd599ebdefcd4158eb8470b', waybillId: 'WYB-1112223333442' })

      const mockResponse = {
        success: true,
        message: 'Order created successfully',
        data: {
          id: '5dd599ebdefcd4158eb8470b',
          courier: {
            company: 'gojek',
            type: 'instant',
            price: 25000,
            waybill_id: 'WYB-1112223333442'
          },
          status: 'allocated'
        }
      }

      const fetchSpy = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockResponse
      })
      vi.stubGlobal('fetch', fetchSpy)

      const result = await createBiteshipOrder('test-order-id')

      expect(fetchSpy).toHaveBeenCalledWith('https://api.biteship.com/v1/orders', expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer test-api-key'
        })
      }))

      expect(prismaMock.order.update).toHaveBeenCalledWith({
        where: { id: 'test-order-id' },
        data: {
          biteshipOrderId: '5dd599ebdefcd4158eb8470b',
          waybillId: 'WYB-1112223333442'
        }
      })

      expect(result.success).toBe(true)
      expect(result.data?.biteshipOrderId).toBe('5dd599ebdefcd4158eb8470b')
      expect(result.data?.waybillId).toBe('WYB-1112223333442')
    })
  })

  describe('cancelBiteshipOrder', () => {
    it('should successfully cancel a Biteship order via DELETE request', async () => {
      mockBiteshipApiKey = 'test-api-key'

      const fetchSpy = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ success: true, message: 'Order successfully cancelled' })
      })
      vi.stubGlobal('fetch', fetchSpy)

      const result = await cancelBiteshipOrder('5dd599ebdefcd4158eb8470b')

      expect(fetchSpy).toHaveBeenCalledWith('https://api.biteship.com/v1/orders/5dd599ebdefcd4158eb8470b', expect.objectContaining({
        method: 'DELETE'
      }))
      expect(result.success).toBe(true)
    })
  })

  describe('getBiteshipTracking', () => {
    it('should retrieve tracking details matching the exact Biteship response format', async () => {
      mockBiteshipApiKey = 'test-api-key'

      // Detailed payload matching the user-provided structure
      const mockTrackingResponse = {
        success: true,
        data: {
          id: '5dd599ebdefcd4158eb8470b',
          status: 'allocated',
          courier: {
            company: 'jnt',
            waybill_id: 'WYB-1112223333442'
          },
          history: [
            {
              service_type: '-',
              status: 'confirmed',
              note: 'Order has been confirmed. Locating nearest driver to pickup.',
              updated_at: '2021-01-11T14:03:41+07:00'
            },
            {
              service_type: '-',
              status: 'allocated',
              note: 'Courier has been allocated. Waiting to pick up.',
              updated_at: '2021-01-11T15:49:25+07:00'
            }
          ]
        }
      }

      const fetchSpy = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockTrackingResponse
      })
      vi.stubGlobal('fetch', fetchSpy)

      const result = await getBiteshipTracking('5dd599ebdefcd4158eb8470b')

      expect(fetchSpy).toHaveBeenCalledWith('https://api.biteship.com/v1/trackings/5dd599ebdefcd4158eb8470b', expect.objectContaining({
        method: 'GET'
      }))
      expect(result.success).toBe(true)
      expect(result.data?.id).toBe('5dd599ebdefcd4158eb8470b')
      expect(result.data?.status).toBe('allocated')
      expect(result.data?.history).toHaveLength(2)
      expect(result.data?.history[0].status).toBe('confirmed')
    })
  })
})
