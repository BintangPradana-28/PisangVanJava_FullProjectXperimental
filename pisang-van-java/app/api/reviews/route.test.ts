/**
 * @vitest-environment node
 *
 * ADDITION (audit QA & Security): regression test untuk perbaikan celah review-bombing.
 * Sebelum fix, mengirim orderId yang TIDAK ADA sama sekali tetap lolos (isVerifiedBuyer:
 * false tapi review tetap dibuat). Test ini memastikan orderId wajib merujuk order asli
 * milik user yang login, dan order harus sudah DELIVERED/COMPLETED.
 */
import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  rateLimit: vi.fn().mockResolvedValue({ success: true }),
  orderFindUnique: vi.fn(),
  reviewUpsert: vi.fn(),
  logAudit: vi.fn()
}))

vi.mock('@/src/auth', () => ({ auth: mocks.auth }))
vi.mock('@/lib/audit', () => ({ logAudit: mocks.logAudit }))
vi.mock('@/lib/redis', () => ({ rateLimit: { limit: mocks.rateLimit } }))
vi.mock('@/lib/prisma', () => ({
  prisma: {
    order: { findUnique: mocks.orderFindUnique },
    review: { upsert: mocks.reviewUpsert }
  }
}))

import { POST } from './route'

function reviewRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/reviews', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' }
  })
}

describe('POST /api/reviews — order authenticity', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.rateLimit.mockResolvedValue({ success: true })
    mocks.auth.mockResolvedValue({ user: { id: 'user-1' } })
  })

  it('rejects a review referencing an orderId that does not exist at all', async () => {
    mocks.orderFindUnique.mockResolvedValue(null)

    const response = await POST(
      reviewRequest({ orderId: 'fake-order-does-not-exist', rating: 5, comment: 'Mantap!' })
    )
    const body = await response.json()

    expect(response.status).toBe(403)
    expect(body.success).toBe(false)
    expect(mocks.reviewUpsert).not.toHaveBeenCalled()
  })

  it('rejects a review for an order that belongs to a different user', async () => {
    mocks.orderFindUnique.mockResolvedValue({
      id: 'order-1',
      userId: 'someone-else',
      status: 'COMPLETED'
    })

    const response = await POST(reviewRequest({ orderId: 'order-1', rating: 5 }))

    expect(response.status).toBe(403)
    expect(mocks.reviewUpsert).not.toHaveBeenCalled()
  })

  it('rejects a review for an order that has not been delivered yet', async () => {
    mocks.orderFindUnique.mockResolvedValue({
      id: 'order-1',
      userId: 'user-1',
      status: 'PENDING_PAYMENT'
    })

    const response = await POST(reviewRequest({ orderId: 'order-1', rating: 5 }))
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.success).toBe(false)
    expect(mocks.reviewUpsert).not.toHaveBeenCalled()
  })

  it('allows a review for a real, owned, DELIVERED order', async () => {
    mocks.orderFindUnique.mockResolvedValue({
      id: 'order-1',
      userId: 'user-1',
      status: 'DELIVERED'
    })
    mocks.reviewUpsert.mockResolvedValue({ id: 'review-1', rating: 5 })

    const response = await POST(reviewRequest({ orderId: 'order-1', rating: 5, comment: 'Enak!' }))

    expect(response.status).toBe(201)
    expect(mocks.reviewUpsert).toHaveBeenCalled()
  })
})
