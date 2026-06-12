// app/api/pos/orders/route.ts
// RAG Source: prisma/schema.prisma (Order, MenuVariant, Payment, AuditLog models)
// RAG Source: src/lib/midtrans.ts (coreApi for dynamic QRIS charge)
// RAG Source: src/features/pos/utils/verifyApprovalToken.ts
// RAG Source: lib/audit.ts (logAudit function)

import { type NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { logAudit } from '@/lib/audit'
import { prisma } from '@/lib/prisma'
import { auth } from '@/src/auth'
import { verifyApprovalToken } from '@/src/features/pos/utils/verifyApprovalToken'
import { coreApi } from '@/src/lib/midtrans'

// ─── Validation Schemas ─────────────────────────────────────

const orderItemSchema = z.object({
  variantId: z.string().cuid('Invalid Variant ID'),
  toppingId: z.string().cuid('Invalid Topping ID').nullable().optional(),
  baseType: z.enum(['Kembung', 'Lumpia', 'Krispy']),
  quantity: z.number().int().min(1, 'Minimal 1 porsi').max(99),
  unitPrice: z.number().min(0),
  subtotal: z.number().min(0)
})

const posOrderSchema = z.object({
  offlineId: z.string().optional(),
  customerName: z
    .string()
    .min(1, 'Nama Pelanggan wajib diisi')
    .max(100)
    .default('Walk-in Customer'),
  customerPhone: z.string().max(20).default('-'),
  items: z.array(orderItemSchema).min(1, 'Keranjang tidak boleh kosong').max(40),
  totalPrice: z.number().min(0),
  paymentMethod: z.enum(['CASH', 'QRIS']),
  notes: z.string().max(500).optional(),
  discountAmount: z.number().min(0).max(10_000_000).default(0),
  approvalToken: z.string().optional()
})

// ─── Authorization ──────────────────────────────────────────

const POS_ROLES = ['ADMIN', 'SUPER_ADMIN', 'CASHIER'] as const
type PosRole = (typeof POS_ROLES)[number]

async function requirePosUser(): Promise<{
  id: string
  role: PosRole
  name: string | null
} | null> {
  const session = await auth()
  if (!session?.user?.id || !POS_ROLES.includes(session.user.role as PosRole)) {
    return null
  }
  return {
    id: session.user.id,
    role: session.user.role as PosRole,
    name: session.user.name ?? null
  }
}

// ─── POST Handler ───────────────────────────────────────────

export async function POST(req: NextRequest): Promise<NextResponse> {
  const user = await requirePosUser()
  if (!user) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const rawData = await req.json()
    const parseResult = posOrderSchema.safeParse(rawData)

    if (!parseResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Data transaksi tidak valid',
          details: parseResult.error.format()
        },
        { status: 400 }
      )
    }

    const data = parseResult.data

    // ── Security: CASHIER discount requires Manager PIN approval ──
    if (data.discountAmount > 0 && user.role === 'CASHIER') {
      if (!data.approvalToken || !verifyApprovalToken(data.approvalToken)) {
        return NextResponse.json(
          {
            success: false,
            error: 'Otorisasi Manajer diperlukan untuk memberikan diskon.'
          },
          { status: 403 }
        )
      }
    }

    // ── Prisma $transaction: Atomicity + Race Condition Prevention ──
    const result = await prisma.$transaction(async (tx: any) => {
      // 0. Idempotency Check (Offline Sync Armor)
      if (data.offlineId) {
        const existingOrder = await tx.order.findUnique({
          where: { id: data.offlineId }
        })
        if (existingOrder) {
          return { order: existingOrder, isIdempotent: true }
        }
      }

      // 1. Stock validation for all items
      for (const item of data.items) {
        const variant = await tx.menuVariant.findUnique({
          where: { id: item.variantId },
          select: { stock: true, flavorName: true }
        })

        if (!variant) {
          throw new Error(`Produk dengan ID ${item.variantId} tidak ditemukan.`)
        }

        if (variant.stock < item.quantity) {
          throw new Error(
            `Stok ${variant.flavorName} habis atau tidak mencukupi. Sisa: ${variant.stock}`
          )
        }
      }

      // 2. Determine order status based on payment method
      const isCash = data.paymentMethod === 'CASH'
      const orderStatus = isCash ? 'COMPLETED' : 'PENDING_PAYMENT'

      // 3. Server-side recalculate total (Zero-Trust: never trust client totalPrice)
      const serverTotal = data.items.reduce(
        (sum: number, item: { subtotal: number }) => sum + item.subtotal,
        0
      )
      const safeDiscount = Math.min(data.discountAmount, serverTotal)
      const finalPrice = Math.max(0, serverTotal - safeDiscount)

      // 4. Create the Order
      const newOrder = await tx.order.create({
        data: {
          ...(data.offlineId ? { id: data.offlineId } : {}),
          customerName: data.customerName,
          customerPhone: data.customerPhone,
          totalPrice: finalPrice,
          source: 'walk-in',
          status: orderStatus,
          deliveryMethod: 'DINE_IN',
          userId: user.id,
          notes: data.notes,
          discountAmount: safeDiscount,
          items: {
            create: data.items.map((item) => ({
              variantId: item.variantId,
              toppings: item.toppingId ? { connect: [{ id: item.toppingId }] } : undefined,
              baseType: item.baseType,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              subtotal: item.subtotal
            }))
          }
        }
      })

      // 5. Atomic Decrement of Stock
      for (const item of data.items) {
        await tx.menuVariant.update({
          where: { id: item.variantId },
          data: {
            stock: {
              decrement: item.quantity
            }
          }
        })
      }

      return { order: newOrder, isIdempotent: false, finalPrice }
    })

    // ── Audit Log ──
    if (!result.isIdempotent) {
      await logAudit('POS_CREATE_ORDER', 'Order', result.order.id, {
        cashierId: user.id,
        cashierRole: user.role,
        paymentMethod: data.paymentMethod,
        discountAmount: data.discountAmount,
        hasManagerApproval: !!data.approvalToken
      })
    }

    // ── QRIS: Create Midtrans charge and return QR data ──
    if (data.paymentMethod === 'QRIS' && !result.isIdempotent) {
      try {
        const midtransOrderId = `PVJ-${result.order.id}-${Date.now()}`
        const chargeResponse = (await coreApi.charge({
          payment_type: 'qris',
          transaction_details: {
            order_id: midtransOrderId,
            gross_amount: Math.round(result.finalPrice)
          },
          qris: {
            acquirer: 'gopay'
          }
        })) as any

        // Create Payment record for webhook reconciliation
        await prisma.payment.create({
          data: {
            orderId: result.order.id,
            midtransOrderId,
            grossAmount: result.finalPrice,
            status: 'PENDING',
            paymentType: 'qris',
            currency: 'IDR',
            transactionId: chargeResponse.transaction_id ?? null,
            expiryTime: chargeResponse.expiry_time ? new Date(chargeResponse.expiry_time) : null
          }
        })

        return NextResponse.json({
          success: true,
          data: {
            ...result.order,
            qris: {
              midtransOrderId,
              transactionId: chargeResponse.transaction_id,
              qrString: chargeResponse.actions?.find((a: any) => a.name === 'generate-qr-code')
                ?.url,
              expiryTime: chargeResponse.expiry_time
            }
          }
        })
      } catch (qrisError: any) {
        // If QRIS creation fails, cancel the order and restore stock
        console.error('[POS] QRIS charge failed:', qrisError?.message)
        await prisma.$transaction(async (tx: any) => {
          const orderWithItems = await tx.order.findUnique({
            where: { id: result.order.id },
            include: { items: true }
          })
          if (orderWithItems) {
            for (const item of orderWithItems.items) {
              if (item.variantId) {
                await tx.menuVariant.update({
                  where: { id: item.variantId },
                  data: { stock: { increment: item.quantity } }
                })
              }
            }
            await tx.order.update({
              where: { id: result.order.id },
              data: { status: 'CANCELED' }
            })
          }
        })
        return NextResponse.json(
          {
            success: false,
            error: 'Gagal membuat pembayaran QRIS. Pesanan dibatalkan. Silakan coba lagi.'
          },
          { status: 500 }
        )
      }
    }

    // ── CASH: Return success immediately ──
    return NextResponse.json({ success: true, data: result.order })
  } catch (error: any) {
    console.error('POS Transaction Error:', error)
    const message = error.message || 'Gagal memproses transaksi kasir.'
    return NextResponse.json({ success: false, error: message }, { status: 400 })
  }
}
