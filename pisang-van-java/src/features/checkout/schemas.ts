import { OrderStatus } from '@prisma/client'
import { z } from 'zod'

export const ROLE_VALUES = [
  'SUPER_ADMIN',
  'ADMIN',
  'CUSTOMER',
  'RESELLER',
  'KITCHEN',
  'CASHIER'
] as const
export const BASE_TYPE_VALUES = ['kembung', 'lumpia', 'krispy'] as const
export const ORDER_STATUS_VALUES = [
  'PENDING_PAYMENT',
  'PROCESSING',
  'READY',
  'OUT_FOR_DELIVERY',
  'DELIVERED',
  'COMPLETED',
  'CANCELED'
] as const
export const PAYMENT_METHOD_VALUES = ['WHATSAPP', 'ONLINE'] as const

const resourceIdSchema = z
  .string()
  .min(8)
  .max(64)
  .regex(/^[a-zA-Z0-9_-]+$/)

const phoneSchema = z
  .string()
  .trim()
  .min(9)
  .max(20)
  .regex(/^(\+62|62|0)8[1-9][0-9]{6,10}$/)

const moneySchema = z.number().finite().int().min(0).max(100_000_000)

const voucherCodeSchema = z
  .string()
  .trim()
  .min(3)
  .max(50)
  .regex(/^[a-zA-Z0-9_-]+$/)
  .transform((value) => value.toUpperCase())

const checkoutRoleSchema = z.enum(ROLE_VALUES)
export const checkoutActorSchema = z
  .object({
    userId: resourceIdSchema,
    role: checkoutRoleSchema,
    email: z.string().max(254).nullable()
  })
  .strict()

export const validateVoucherInputSchema = z
  .object({
    code: voucherCodeSchema,
    cartTotal: moneySchema.min(1)
  })
  .strict()

export const checkoutItemInputSchema = z
  .object({
    variantId: resourceIdSchema,
    toppingIds: z.array(resourceIdSchema).max(5).default([]),
    baseType: z.enum(BASE_TYPE_VALUES),
    quantity: z.number().int().min(1).max(99),
    notes: z.string().trim().max(160).nullable().optional()
  })
  .strict()

export const createOrderInputSchema = z
  .object({
    idempotencyKey: z.string().uuid(),
    customerName: z
      .string()
      .trim()
      .min(3)
      .max(60)
      .regex(/^[A-Za-z\s]+$/),
    customerPhone: phoneSchema,
    deliveryMethod: z.enum(['PICKUP', 'DELIVERY']),
    paymentMethod: z.enum(PAYMENT_METHOD_VALUES),
    notes: z.string().trim().max(500).nullable().optional(),
    voucherCode: voucherCodeSchema.nullable().optional(),
    usePoints: z.boolean().default(false),
    deliveryCoordinates: z
      .string()
      .trim()
      .regex(/^-?[0-9.]+,\s*-?[0-9.]+$/)
      .optional()
      .nullable(),
    courierCode: z.string().trim().max(50).optional().nullable(),
    courierService: z.string().trim().max(50).optional().nullable(),
    addressId: z.string().min(8).max(64).optional().nullable(),
    items: z.array(checkoutItemInputSchema).min(1).max(40)
  })
  .strict()
  .superRefine((value, context) => {
    const notes = value.notes
    if (
      value.deliveryMethod === 'DELIVERY' &&
      (notes === undefined || notes === null || notes.length === 0)
    ) {
      context.addIssue({
        code: 'custom',
        path: ['notes'],
        message: 'Delivery address is required.'
      })
    }

    if (value.usePoints && value.voucherCode) {
      context.addIssue({
        code: 'custom',
        path: ['usePoints'],
        message: 'Tidak dapat menggabungkan koin dan voucher secara bersamaan.'
      })
    }
  })

export const orderQueryInputSchema = z
  .object({
    status: z.enum(ORDER_STATUS_VALUES).optional(),
    page: z.coerce.number().int().min(1).max(500).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20)
  })
  .strict()

export const paymentFormInputSchema = z
  .object({
    orderId: resourceIdSchema
  })
  .strict()

export const orderStatusInputSchema = z.enum(ORDER_STATUS_VALUES)

export const ALLOWED_STATUS_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  PENDING_PAYMENT: ['PROCESSING', 'CANCELED'],
  PROCESSING: ['READY', 'CANCELED'],
  READY: ['OUT_FOR_DELIVERY', 'COMPLETED', 'CANCELED'],
  OUT_FOR_DELIVERY: ['DELIVERED', 'CANCELED'],
  DELIVERED: ['COMPLETED', 'CANCELED'],
  COMPLETED: [],
  CANCELED: []
}

export const deliveryUpdateSchema = z
  .object({
    status: z.enum(ORDER_STATUS_VALUES).optional(),
    courierPhone: z.string().trim().max(20).optional().nullable(),
    etaMinutes: z.number().int().min(0).max(1440).optional().nullable(),
    proofPhotoUrl: z.string().url().max(500).optional().nullable(),
    tipAmount: z.number().finite().min(0).max(10_000_000).optional()
  })
  .strict()

export type CheckoutRole = z.infer<typeof checkoutRoleSchema>
export type BaseType = z.infer<typeof checkoutItemInputSchema>['baseType']
export type ValidateVoucherInput = z.infer<typeof validateVoucherInputSchema>
export type CreateOrderInput = z.infer<typeof createOrderInputSchema>
export type OrderQueryInput = z.infer<typeof orderQueryInputSchema>

export interface CheckoutActor {
  userId: string
  role: CheckoutRole
  email: string | null
}

export interface VoucherRecord {
  id: string
  code: string
  isActive: boolean
  startDate: Date
  endDate: Date
  usageLimit: number
  usedCount: number
  minPurchase: number
  applicableTo: string
  discountType: string
  discountValue: number
  maxDiscount: number | null
}

export interface VoucherApplication {
  voucherId: string
  code: string
  discountAmount: number
  usageLimit: number
}

export interface VariantRecord {
  id: string
  flavorName: string
  priceKembung: number
  priceLumpia: number
  priceKrispy: number
  wholesaleKembung: number
  wholesaleLumpia: number
  wholesaleKrispy: number
  isActive: boolean
  isAvailable: boolean
  isDeleted: boolean
  stock: number
  version: number
}

export interface ToppingRecord {
  id: string
  name: string
  price: number
  emoji: string | null
  isActive: boolean
}

export interface PreparedOrderItem {
  variantId: string
  toppingIds: string[]
  baseType: BaseType
  quantity: number
  unitPrice: number
  subtotal: number
  name: string
  whatsappLine: string
}

export interface CreateCheckoutOrderResult {
  orderId: string
  redirectType: 'WHATSAPP' | 'PAYMENT' | 'CASHLESS_SUCCESS'
  redirectUrl: string
  totalPrice: number
  subtotal?: number
  discountAmount?: number
  deliveryFee?: number
  preparedItems?: PreparedOrderItem[]
  source?: string
}

export interface VoucherValidationSuccess {
  success: true
  data: {
    code: string
    discountAmount: number
    message: string
  }
}

export interface VoucherValidationFailure {
  success: false
  error: string
}

export type VoucherValidationResult = VoucherValidationSuccess | VoucherValidationFailure

export interface PaymentOrderView {
  id: string
  customerName: string
  customerPhone: string
  totalPrice: number
  status: string
  source: string
  midtransToken: string | null
  voucherCode: string | null
  discountAmount: number
  deliveryMethod: string
  deliveryFee: number
  createdAt: Date
  items: Array<{
    id: string
    quantity: number
    baseType: string
    subtotal: number
    variant: {
      flavorName: string
    }
    toppings: Array<{
      name: string
      emoji: string | null
    }>
  }>
}

export class CheckoutSecurityError extends Error {
  readonly statusCode: number

  constructor(statusCode: number) {
    super('CHECKOUT_SECURITY_REJECTION')
    this.name = 'CheckoutSecurityError'
    this.statusCode = statusCode
  }
}
