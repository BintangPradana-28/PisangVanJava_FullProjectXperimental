/**
 * @vitest-environment node
 *
 * ADDITION (audit QA & Security): regression test untuk perbaikan celah fraud kasir POS.
 * Sebelum fix, endpoint ini mempercayai `unitPrice`/`subtotal` yang dikirim client apa
 * adanya. Test ini memastikan harga SELALU dihitung ulang dari MenuVariant/Topping di DB,
 * bahkan kalau client mengirim harga yang jauh lebih rendah dari harga asli.
 */
import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  transaction: vi.fn(),
  menuVariantFindUnique: vi.fn(),
  toppingFindMany: vi.fn(),
  orderCreate: vi.fn(),
  menuVariantUpdateMany: vi.fn(),
  logAudit: vi.fn()
}))

vi.mock('@/src/auth', () => ({ auth: mocks.auth }))
vi.mock('@/lib/audit', () => ({ logAudit: mocks.logAudit }))
vi.mock('@/src/features/pos/utils/verifyApprovalToken', () => ({
  verifyApprovalToken: vi.fn().mockResolvedValue(true)
}))
vi.mock('@/src/lib/midtrans', () => ({ coreApi: { charge: vi.fn() } }))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    $transaction: mocks.transaction
  }
}))

import { POST } from './route'

const VARIANT_ID = 'clh1a2b3c0000qzrmn831p1qz'
const REAL_PRICE_KEMBUNG = 15_000

function posRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/pos/orders', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' }
  })
}

describe('POST /api/pos/orders — server-side price integrity', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.auth.mockResolvedValue({
      user: { id: 'cashier-1', role: 'CASHIER', name: 'Kasir Test' }
    })

    // Simulasikan prisma.$transaction: jalankan callback dengan mock `tx`.
    mocks.transaction.mockImplementation(async (callback: any) => {
      const tx = {
        menuVariant: {
          findUnique: mocks.menuVariantFindUnique,
          updateMany: mocks.menuVariantUpdateMany,
          update: mocks.menuVariantUpdateMany
        },
        topping: { findMany: mocks.toppingFindMany },
        order: { create: mocks.orderCreate }
      }
      return callback(tx)
    })

    mocks.menuVariantFindUnique.mockResolvedValue({
      stock: 100,
      flavorName: 'Original',
      priceKembung: REAL_PRICE_KEMBUNG,
      priceLumpia: 17_000,
      priceKrispy: 18_000,
      isActive: true,
      isDeleted: false
    })
    mocks.toppingFindMany.mockResolvedValue([])
    mocks.menuVariantUpdateMany.mockResolvedValue({ count: 1 })
    mocks.orderCreate.mockResolvedValue({ id: 'order-1', totalPrice: REAL_PRICE_KEMBUNG })
  })

  it('ignores a manipulated (under-priced) client unitPrice/subtotal and charges the real DB price', async () => {
    const response = await POST(
      posRequest({
        customerName: 'Test Customer',
        items: [
          {
            variantId: VARIANT_ID,
            baseType: 'Kembung',
            quantity: 1,
            // Harga dimanipulasi client jadi Rp100 padahal harga asli Rp15.000
            unitPrice: 100,
            subtotal: 100
          }
        ],
        totalPrice: 100,
        paymentMethod: 'CASH'
      })
    )

    expect(response.status).toBe(200)

    // Order HARUS dibuat dengan harga asli dari DB, bukan harga manipulasi client.
    expect(mocks.orderCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          totalPrice: REAL_PRICE_KEMBUNG,
          items: expect.objectContaining({
            create: [
              expect.objectContaining({
                unitPrice: REAL_PRICE_KEMBUNG,
                subtotal: REAL_PRICE_KEMBUNG
              })
            ]
          })
        })
      })
    )
  })

  it('sums topping prices from DB into the server-computed unit price', async () => {
    const toppingId = 'clh1a2b3c0000qzrmn831p2ab'
    mocks.toppingFindMany.mockResolvedValue([{ id: toppingId, price: 3_000 }])

    const response = await POST(
      posRequest({
        customerName: 'Test Customer',
        items: [
          {
            variantId: VARIANT_ID,
            toppingIds: [toppingId],
            baseType: 'Kembung',
            quantity: 2,
            unitPrice: 1, // diabaikan
            subtotal: 1 // diabaikan
          }
        ],
        totalPrice: 1,
        paymentMethod: 'CASH'
      })
    )

    expect(response.status).toBe(200)

    const expectedUnitPrice = REAL_PRICE_KEMBUNG + 3_000 // 18.000
    const expectedSubtotal = expectedUnitPrice * 2 // 36.000

    expect(mocks.orderCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          totalPrice: expectedSubtotal,
          items: expect.objectContaining({
            create: [
              expect.objectContaining({
                unitPrice: expectedUnitPrice,
                subtotal: expectedSubtotal
              })
            ]
          })
        })
      })
    )
  })

  it('rejects orders for inactive/deleted variants even if client provides a price', async () => {
    mocks.menuVariantFindUnique.mockResolvedValue({
      stock: 100,
      flavorName: 'Original',
      priceKembung: REAL_PRICE_KEMBUNG,
      priceLumpia: 17_000,
      priceKrispy: 18_000,
      isActive: false,
      isDeleted: false
    })

    const response = await POST(
      posRequest({
        customerName: 'Test Customer',
        items: [
          { variantId: VARIANT_ID, baseType: 'Kembung', quantity: 1, unitPrice: 100, subtotal: 100 }
        ],
        totalPrice: 100,
        paymentMethod: 'CASH'
      })
    )

    expect(response.status).toBe(400)
    expect(mocks.orderCreate).not.toHaveBeenCalled()
  })

  it('rejects requests from non-POS roles (e.g. plain CUSTOMER)', async () => {
    mocks.auth.mockResolvedValue({ user: { id: 'user-1', role: 'CUSTOMER', name: 'X' } })

    const response = await POST(
      posRequest({
        customerName: 'Test Customer',
        items: [
          { variantId: VARIANT_ID, baseType: 'Kembung', quantity: 1, unitPrice: 100, subtotal: 100 }
        ],
        totalPrice: 100,
        paymentMethod: 'CASH'
      })
    )

    expect(response.status).toBe(401)
    expect(mocks.transaction).not.toHaveBeenCalled()
  })
})
