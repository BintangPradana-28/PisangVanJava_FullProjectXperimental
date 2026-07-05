/**
 * @vitest-environment node
 */
import { randomUUID } from 'node:crypto'
import { describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => {
  return {}
})

vi.mock('@/src/services/checkout.service', () => {
  return {
    requireCheckoutActor: vi.fn().mockResolvedValue({
      userId: 'cmq1qy5650002lvdod403y8tg', // Valid CUID
      role: 'CUSTOMER',
      email: 'test@example.com'
    }),
    hasValidSameOriginHeaders: vi.fn().mockResolvedValue(true),
    enforceIdempotency: vi.fn().mockResolvedValue(true),
    enforceCheckoutRateLimit: vi.fn().mockResolvedValue(true),
    createCheckoutOrder: vi.fn().mockResolvedValue({
      orderId: 'order-12345678',
      redirectType: 'WHATSAPP',
      redirectUrl: 'https://wa.me/6285773728748',
      totalPrice: 24000
    })
  }
})

vi.mock('@/lib/prisma', () => {
  return {
    prisma: {
      menuVariant: {
        findMany: vi.fn().mockResolvedValue([
          { id: 'cmq1qy9wq0006lvdo61smdksk', flavorName: 'Original', priceKembung: 10000 }
        ])
      },
      topping: {
        findMany: vi.fn().mockResolvedValue([
          { id: 'cmq1qyjad000dlvdo6cz7gy12', name: 'Keju', price: 2000 },
          { id: 'cmq1qyjpw000elvdo9pwls25o', name: 'Sprinkles', price: 2000 }
        ])
      }
    }
  }
})

import { NextRequest } from 'next/server'
import { POST } from '@/app/api/orders/route'
import { prisma } from '@/lib/prisma'

describe('app/api/orders POST Route Integration', () => {
  it('should list DB entities and call POST handler', async () => {
    const dbVariants = await prisma.menuVariant.findMany({ where: { isDeleted: false } })
    const dbToppings = await prisma.topping.findMany({ where: { isActive: true } })

    console.log('=== DB VARIANTS ===')
    console.log(
      dbVariants.map((v: any) => ({ id: v.id, name: v.flavorName, priceKembung: v.priceKembung }))
    )
    console.log('=== DB TOPPINGS ===')
    console.log(dbToppings.map((t: any) => ({ id: t.id, name: t.name, price: t.price })))

    // RAG Source:
    // app/api/orders/route.ts
    // Use dynamically generated randomUUID to avoid hardcoding strings flagged by Gitleaks
    const payload = {
      idempotencyKey: randomUUID(),
      customerName: 'Ahmad Budi',
      customerPhone: '081234567890',
      notes: 'kebayoranbarujaksel',
      deliveryMethod: 'DELIVERY',
      paymentMethod: 'ONLINE',
      voucherCode: null,
      items: [
        {
          variantId: dbVariants[0]?.id || 'cmq1qy9wq0006lvdo61smdksk',
          toppingIds: [dbToppings[0]?.id, dbToppings[1]?.id].filter(Boolean),
          baseType: 'krispy',
          quantity: 1,
          notes: null
        }
      ]
    }

    const req = new NextRequest('http://localhost/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })

    const res = await POST(req)
    const resBody = await res.json()
    console.log('=== POST RESPONSE ===')
    console.log('Status:', res.status)
    console.log('Body:', resBody)

    expect(res.status).toBe(201)
  }, 20000)
})
