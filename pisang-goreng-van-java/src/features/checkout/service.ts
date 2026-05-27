import { Ratelimit } from "@upstash/ratelimit";
import { getServerSession } from "next-auth";
import { headers } from "next/headers";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { redis } from "@/lib/redis";
import xss from "xss";
import { authOptions } from "@/src/features/auth/authOptions";
import { generateSnapToken } from "@/src/features/payment/service";
import type { Prisma } from "@prisma/client";

const ROLE_VALUES = ["ADMIN", "CUSTOMER", "RESELLER"] as const;
const BASE_TYPE_VALUES = ["kembung", "lumpia", "krispy"] as const;
const ORDER_STATUS_VALUES = ["pending", "paid", "confirmed", "ready", "done", "cancelled"] as const;
const PAYMENT_METHOD_VALUES = ["WHATSAPP", "ONLINE"] as const;

const resourceIdSchema = z
  .string()
  .min(8)
  .max(64)
  .regex(/^[a-zA-Z0-9_-]+$/);

const phoneSchema = z
  .string()
  .trim()
  .min(9)
  .max(20)
  .regex(/^(\+62|62|0)8[1-9][0-9]{6,10}$/);

const moneySchema = z
  .number()
  .finite()
  .int()
  .min(0)
  .max(100_000_000);

const voucherCodeSchema = z
  .string()
  .trim()
  .min(3)
  .max(50)
  .regex(/^[a-zA-Z0-9_-]+$/)
  .transform((value) => value.toUpperCase());

const checkoutRoleSchema = z.enum(ROLE_VALUES);
const checkoutActorSchema = z
  .object({
    userId: resourceIdSchema,
    role: checkoutRoleSchema,
    email: z.string().max(254).nullable(),
  })
  .strict();

export const validateVoucherInputSchema = z
  .object({
    code: voucherCodeSchema,
    cartTotal: moneySchema.min(1),
  })
  .strict();

export const checkoutItemInputSchema = z
  .object({
    variantId: resourceIdSchema,
    toppingId: resourceIdSchema.nullable(),
    baseType: z.enum(BASE_TYPE_VALUES),
    quantity: z.number().int().min(1).max(99),
    notes: z.string().trim().max(160).nullable().optional(),
  })
  .strict();

export const createOrderInputSchema = z
  .object({
    customerName: z.string().trim().min(3).max(60).regex(/^[A-Za-z\s]+$/),
    customerPhone: phoneSchema,
    deliveryMethod: z.enum(["PICKUP", "DELIVERY"]),
    paymentMethod: z.enum(PAYMENT_METHOD_VALUES),
    notes: z.string().trim().max(500).nullable().optional(),
    voucherCode: voucherCodeSchema.nullable().optional(),
    items: z.array(checkoutItemInputSchema).min(1).max(40),
  })
  .strict()
  .superRefine((value, context) => {
    const notes = value.notes;
    if (value.deliveryMethod === "DELIVERY" && (notes === undefined || notes === null || notes.length === 0)) {
      context.addIssue({
        code: "custom",
        path: ["notes"],
        message: "Delivery address is required.",
      });
    }
  });

export const orderQueryInputSchema = z
  .object({
    status: z.enum(ORDER_STATUS_VALUES).optional(),
    page: z.coerce.number().int().min(1).max(500).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
  })
  .strict();

export const paymentFormInputSchema = z
  .object({
    orderId: resourceIdSchema,
  })
  .strict();

export const orderStatusInputSchema = z.enum(ORDER_STATUS_VALUES);

type CheckoutRole = z.infer<typeof checkoutRoleSchema>;
type BaseType = z.infer<typeof checkoutItemInputSchema>["baseType"];
type ValidateVoucherInput = z.infer<typeof validateVoucherInputSchema>;
export type CreateOrderInput = z.infer<typeof createOrderInputSchema>;
export type OrderQueryInput = z.infer<typeof orderQueryInputSchema>;

export interface CheckoutActor {
  userId: string;
  role: CheckoutRole;
  email: string | null;
}

interface VoucherRecord {
  id: string;
  code: string;
  isActive: boolean;
  startDate: Date;
  endDate: Date;
  usageLimit: number;
  usedCount: number;
  minPurchase: number;
  applicableTo: string;
  discountType: string;
  discountValue: number;
  maxDiscount: number | null;
}

interface VoucherApplication {
  voucherId: string;
  code: string;
  discountAmount: number;
  usageLimit: number;
}

interface VariantRecord {
  id: string;
  flavorName: string;
  priceKembung: number;
  priceLumpia: number;
  priceKrispy: number;
  wholesaleKembung: number;
  wholesaleLumpia: number;
  wholesaleKrispy: number;
  isActive: boolean;
  isAvailable: boolean;
  isDeleted: boolean;
}

interface ToppingRecord {
  id: string;
  name: string;
  price: number;
  emoji: string | null;
  isActive: boolean;
}

interface PreparedOrderItem {
  variantId: string;
  toppingId: string | null;
  baseType: BaseType;
  quantity: number;
  unitPrice: number;
  subtotal: number;
  name: string;
  whatsappLine: string;
}

export interface CreateCheckoutOrderResult {
  orderId: string;
  redirectType: "WHATSAPP" | "PAYMENT";
  redirectUrl: string;
  totalPrice: number;
}

export interface VoucherValidationSuccess {
  success: true;
  data: {
    code: string;
    discountAmount: number;
    message: string;
  };
}

export interface VoucherValidationFailure {
  success: false;
  error: string;
}

export type VoucherValidationResult = VoucherValidationSuccess | VoucherValidationFailure;

export interface PaymentOrderView {
  id: string;
  customerName: string;
  customerPhone: string;
  totalPrice: number;
  status: string;
  source: string;
  midtransToken: string | null;
  voucherCode: string | null;
  discountAmount: number;
  deliveryMethod: string;
  deliveryFee: number;
  createdAt: Date;
  items: Array<{
    id: string;
    quantity: number;
    baseType: string;
    subtotal: number;
    variant: {
      flavorName: string;
    };
    topping: {
      name: string;
      emoji: string | null;
    } | null;
  }>;
}

export class CheckoutSecurityError extends Error {
  readonly statusCode: number;

  constructor(statusCode: number) {
    super("CHECKOUT_SECURITY_REJECTION");
    this.name = "CheckoutSecurityError";
    this.statusCode = statusCode;
  }
}

const voucherRateLimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(5, "1 m"),
  analytics: true,
  prefix: "ratelimit_checkout_voucher",
});

const checkoutRateLimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(8, "10 m"),
  analytics: true,
  prefix: "ratelimit_checkout_order",
});

const paymentRateLimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(5, "5 m"),
  analytics: true,
  prefix: "ratelimit_checkout_payment",
});

export async function requireCheckoutActor(): Promise<CheckoutActor | null> {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return null;
  }

  const parsed = checkoutActorSchema.safeParse({
    userId: session.user.id,
    role: session.user.role,
    email: session.user.email ?? null,
  });

  if (!parsed.success) {
    return null;
  }

  return {
    userId: parsed.data.userId,
    role: parsed.data.role,
    email: parsed.data.email,
  };
}

export async function hasValidSameOriginHeaders(): Promise<boolean> {
  const headerStore = await headers();
  const origin = headerStore.get("origin");
  const host = headerStore.get("host");

  if (origin === null || host === null) {
    return false;
  }

  try {
    const originUrl = new URL(origin);
    return originUrl.host === host;
  } catch {
    return false;
  }
}

export async function getRateLimitIdentifier(scope: string, actor: CheckoutActor): Promise<string> {
  const headerStore = await headers();
  const forwardedFor = headerStore.get("x-forwarded-for");
  const clientIp = forwardedFor?.split(",")[0]?.trim();
  const networkPart = clientIp && clientIp.length > 0 ? clientIp : "unknown";
  return `${scope}:${actor.userId}:${networkPart}`;
}

export async function enforceCheckoutRateLimit(actor: CheckoutActor): Promise<boolean> {
  const identifier = await getRateLimitIdentifier("order", actor);
  return isRateAllowed(checkoutRateLimit, identifier);
}

export async function enforcePaymentRateLimit(actor: CheckoutActor): Promise<boolean> {
  const identifier = await getRateLimitIdentifier("payment", actor);
  return isRateAllowed(paymentRateLimit, identifier);
}

async function isRateAllowed(limiter: Ratelimit, identifier: string): Promise<boolean> {
  try {
    const result = await limiter.limit(identifier);
    return result.success;
  } catch (error) {
    // CISO Note: Fail-OPEN when Redis is unavailable.
    // Rationale: Failing CLOSED is a self-imposed DoS attack — every checkout
    // is blocked any time Upstash has a hiccup. The business impact of blocking
    // legitimate customers EXCEEDS the risk of a brief gap in rate limiting.
    // Structured alert logged here for SIEM/monitoring visibility.
    console.warn("[SECURITY] Rate limiter unavailable; failing open. Identifier:", identifier, "Error:", error instanceof Error ? error.message : "unknown");
    return true;
  }
}

export async function validateVoucherForActor(
  input: ValidateVoucherInput,
  actor: CheckoutActor,
): Promise<VoucherValidationResult> {
  const identifier = await getRateLimitIdentifier("voucher", actor);
  const allowed = await isRateAllowed(voucherRateLimit, identifier);
  if (!allowed) {
    return {
      success: false,
      error: "Terlalu banyak percobaan voucher. Silakan coba lagi nanti.",
    };
  }

  const voucher = await prisma.voucher.findUnique({
    where: { code: input.code },
    select: voucherSelect,
  });

  const application = evaluateVoucher(voucher, input.cartTotal, actor.role);
  if (application === null) {
    return {
      success: false,
      error: "Voucher tidak dapat digunakan untuk pesanan ini.",
    };
  }

  return {
    success: true,
    data: {
      code: application.code,
      discountAmount: application.discountAmount,
      message: `Voucher diterapkan. Diskon Rp ${application.discountAmount.toLocaleString("id-ID")}.`,
    },
  };
}

export async function createCheckoutOrder(
  input: CreateOrderInput,
  actor: CheckoutActor,
): Promise<CreateCheckoutOrderResult> {
  const result = await prisma.$transaction(async (tx) => {
    const variantIds = Array.from(new Set(input.items.map((item) => item.variantId)));
    const toppingIds = Array.from(
      new Set(
        input.items
          .map((item) => item.toppingId)
          .filter((toppingId): toppingId is string => toppingId !== null),
      ),
    );

    const variants = await tx.menuVariant.findMany({
      where: { id: { in: variantIds } },
      select: {
        id: true,
        flavorName: true,
        priceKembung: true,
        priceLumpia: true,
        priceKrispy: true,
        wholesaleKembung: true,
        wholesaleLumpia: true,
        wholesaleKrispy: true,
        isActive: true,
        isAvailable: true,
        isDeleted: true,
        stock: true,
        version: true,
      },
    });

    const toppings = await tx.topping.findMany({
      where: { id: { in: toppingIds } },
      select: {
        id: true,
        name: true,
        price: true,
        emoji: true,
        isActive: true,
      },
    });

    const variantById = new Map<string, VariantRecord>(variants.map((variant) => [variant.id, variant]));
    const toppingById = new Map<string, ToppingRecord>(toppings.map((topping) => [topping.id, topping]));
    const preparedItems: PreparedOrderItem[] = [];
    let subtotal = 0;

    for (const item of input.items) {
      const variant = variantById.get(item.variantId);
      if (variant === undefined || !variant.isActive || !variant.isAvailable || variant.isDeleted || variant.stock < item.quantity) {
        throw new CheckoutSecurityError(400);
      }

      let topping: ToppingRecord | null = null;
      if (item.toppingId !== null) {
        const selectedTopping = toppingById.get(item.toppingId);
        if (selectedTopping === undefined || !selectedTopping.isActive) {
          throw new CheckoutSecurityError(400);
        }
        topping = selectedTopping;
      }

      const basePrice = selectBasePrice(variant, item.baseType, actor.role);
      const toppingPrice = topping === null ? 0 : topping.price;
      const unitPrice = basePrice + toppingPrice;
      const itemSubtotal = unitPrice * item.quantity;
      const notes = normalizeNullableText(item.notes);
      subtotal += itemSubtotal;

      preparedItems.push({
        variantId: item.variantId,
        toppingId: item.toppingId,
        baseType: item.baseType,
        quantity: item.quantity,
        unitPrice,
        subtotal: itemSubtotal,
        name: `${variant.flavorName} (${item.baseType})${topping ? ` + ${topping.name}` : ''}`,
        whatsappLine: buildWhatsAppItemLine(variant.flavorName, item.baseType, item.quantity, topping, itemSubtotal, notes),
      });
    }

    const deliveryFee = await resolveDeliveryFee(input.deliveryMethod, tx);
    const voucherApplication = await resolveVoucherApplication(input.voucherCode, subtotal, actor.role, tx);
    const discountAmount = voucherApplication?.discountAmount ?? 0;
    const totalPrice = subtotal - discountAmount + deliveryFee;

    if (!Number.isSafeInteger(totalPrice) || totalPrice < 0) {
      throw new CheckoutSecurityError(400);
    }

    if (voucherApplication !== null) {
      const voucherUpdate = await tx.voucher.updateMany({
        where: {
          id: voucherApplication.voucherId,
          OR: [{ usageLimit: 0 }, { usedCount: { lt: voucherApplication.usageLimit } }],
        },
        data: {
          usedCount: {
            increment: 1,
          },
        },
      });

      if (voucherUpdate.count !== 1) {
        throw new CheckoutSecurityError(409);
      }
    }

    // OCC: Optimistic Concurrency Control for Inventory
    const variantQuantities = new Map<string, number>();
    for (const item of input.items) {
      variantQuantities.set(item.variantId, (variantQuantities.get(item.variantId) || 0) + item.quantity);
    }

    for (const [variantId, totalQuantity] of Array.from(variantQuantities.entries())) {
      const variant = variantById.get(variantId)!;
      const updateResult = await tx.menuVariant.updateMany({
        where: {
          id: variantId,
          version: variant.version,
          stock: { gte: totalQuantity },
        },
        data: {
          stock: { decrement: totalQuantity },
          version: { increment: 1 },
        },
      });

      if (updateResult.count === 0) {
        throw new CheckoutSecurityError(409); // Conflict: Stock changed or insufficient
      }
    }

    const source = input.paymentMethod === "ONLINE" ? "online" : "whatsapp";
    const order = await tx.order.create({
      data: {
        userId: actor.userId,
        customerName: xss(input.customerName),
        customerPhone: input.customerPhone,
        totalPrice,
        status: "pending",
        notes: normalizeNullableText(input.notes) ? xss(normalizeNullableText(input.notes) as string) : null,
        source,
        voucherCode: voucherApplication?.code ?? null,
        discountAmount,
        deliveryMethod: input.deliveryMethod,
        deliveryFee,
        items: {
          create: preparedItems.map((item) => ({
            variantId: item.variantId,
            toppingId: item.toppingId,
            baseType: item.baseType,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            subtotal: item.subtotal,
          })),
        },
      },
      select: {
        id: true,
        totalPrice: true,
      },
    });

    // ATOMIC CART ANNIHILATION
    // Destroy all items in this user's cart synchronously within the transaction.
    // This prevents "Ghost Carts" if the user disconnects before the client sends a DELETE request.
    await tx.cartItem.deleteMany({
      where: {
        cart: {
          userId: actor.userId,
        },
      },
    });

    return {
      orderId: order.id,
      source,
      totalPrice: order.totalPrice,
      subtotal,
      discountAmount,
      deliveryFee,
      preparedItems,
    };
  });

  if (input.paymentMethod === "ONLINE") {
    // Zero-Trust: Generate Midtrans Snap Token securely from backend
    const snapToken = await generateSnapToken({
      orderId: result.orderId,
      grossAmount: result.totalPrice,
      customerName: input.customerName,
      customerPhone: input.customerPhone,
      items: result.preparedItems.map(item => ({
        id: item.variantId,
        price: item.unitPrice,
        quantity: item.quantity,
        name: item.name
      }))
    });

    if (snapToken) {
      await prisma.order.update({
        where: { id: result.orderId },
        data: { midtransToken: snapToken }
      });
    }

    return {
      orderId: result.orderId,
      redirectType: "PAYMENT",
      redirectUrl: `/payment/${result.orderId}`,
      totalPrice: result.totalPrice,
    };
  }

  const whatsappNumber = await resolveWhatsAppNumber();
  if (whatsappNumber === null) {
    throw new CheckoutSecurityError(500);
  }

  const message = buildWhatsAppMessage({
    orderId: result.orderId,
    customerName: input.customerName,
    customerPhone: input.customerPhone,
    deliveryMethod: input.deliveryMethod,
    notes: normalizeNullableText(input.notes),
    subtotal: result.subtotal,
    discountAmount: result.discountAmount,
    deliveryFee: result.deliveryFee,
    totalPrice: result.totalPrice,
    voucherCode: input.voucherCode ?? null,
    itemLines: result.preparedItems.map((item) => item.whatsappLine),
  });

  return {
    orderId: result.orderId,
    redirectType: "WHATSAPP",
    redirectUrl: `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(message)}`,
    totalPrice: result.totalPrice,
  };
}

export async function getPaymentOrderForActor(
  orderId: string,
  actor: CheckoutActor,
): Promise<PaymentOrderView | null> {
  return prisma.order.findFirst({
    where: {
      id: orderId,
      userId: actor.userId,
      source: "online",
    },
    select: {
      id: true,
      customerName: true,
      customerPhone: true,
      totalPrice: true,
      status: true,
      source: true,
      midtransToken: true,
      voucherCode: true,
      discountAmount: true,
      deliveryMethod: true,
      deliveryFee: true,
      createdAt: true,
      items: {
        select: {
          id: true,
          quantity: true,
          baseType: true,
          subtotal: true,
          variant: {
            select: {
              flavorName: true,
            },
          },
          topping: {
            select: {
              name: true,
              emoji: true,
            },
          },
        },
      },
    },
  });
}

export async function processPaymentForActor(orderId: string, actor: CheckoutActor): Promise<boolean> {
  const allowed = await enforcePaymentRateLimit(actor);
  if (!allowed) {
    return false;
  }

  const updateResult = await prisma.order.updateMany({
    where: {
      id: orderId,
      userId: actor.userId,
      source: "online",
      status: "pending",
    },
    data: {
      status: "paid",
    },
  });

  return updateResult.count === 1;
}

const voucherSelect = {
  id: true,
  code: true,
  isActive: true,
  startDate: true,
  endDate: true,
  usageLimit: true,
  usedCount: true,
  minPurchase: true,
  applicableTo: true,
  discountType: true,
  discountValue: true,
  maxDiscount: true,
} satisfies Prisma.VoucherSelect;

function normalizeNullableText(value: string | null | undefined): string | null {
  if (value === undefined || value === null || value.length === 0) {
    return null;
  }

  return value;
}

function evaluateVoucher(
  voucher: VoucherRecord | null,
  cartTotal: number,
  role: CheckoutRole,
): VoucherApplication | null {
  if (voucher === null || !voucher.isActive) {
    return null;
  }

  if (
    !Number.isSafeInteger(voucher.usageLimit) ||
    voucher.usageLimit < 0 ||
    !Number.isSafeInteger(voucher.usedCount) ||
    voucher.usedCount < 0 ||
    !Number.isFinite(voucher.minPurchase) ||
    voucher.minPurchase < 0
  ) {
    return null;
  }

  const now = new Date();
  if (now < voucher.startDate || now > voucher.endDate) {
    return null;
  }

  if (voucher.usageLimit > 0 && voucher.usedCount >= voucher.usageLimit) {
    return null;
  }

  if (cartTotal < voucher.minPurchase) {
    return null;
  }

  if (voucher.applicableTo !== "ALL" && voucher.applicableTo !== role) {
    return null;
  }

  const discountAmount = calculateDiscount(voucher, cartTotal);
  if (discountAmount === null) {
    return null;
  }

  return {
    voucherId: voucher.id,
    code: voucher.code,
    discountAmount,
    usageLimit: voucher.usageLimit,
  };
}

function calculateDiscount(voucher: VoucherRecord, cartTotal: number): number | null {
  if (!Number.isFinite(voucher.discountValue) || voucher.discountValue <= 0) {
    return null;
  }

  if (voucher.maxDiscount !== null && (!Number.isFinite(voucher.maxDiscount) || voucher.maxDiscount < 0)) {
    return null;
  }

  if (voucher.discountType === "FIXED") {
    return Math.min(cartTotal, Math.floor(voucher.discountValue));
  }

  if (voucher.discountType === "PERCENTAGE") {
    if (voucher.discountValue > 100) {
      return null;
    }

    const uncappedDiscount = Math.floor(cartTotal * (voucher.discountValue / 100));
    const cappedDiscount = voucher.maxDiscount === null ? uncappedDiscount : Math.min(uncappedDiscount, voucher.maxDiscount);
    return Math.min(cartTotal, Math.floor(cappedDiscount));
  }

  return null;
}

function selectBasePrice(variant: VariantRecord, baseType: BaseType, role: CheckoutRole): number {
  if (baseType === "lumpia") {
    return role === "RESELLER" && variant.wholesaleLumpia > 0 ? variant.wholesaleLumpia : variant.priceLumpia;
  }

  if (baseType === "krispy") {
    return role === "RESELLER" && variant.wholesaleKrispy > 0 ? variant.wholesaleKrispy : variant.priceKrispy;
  }

  return role === "RESELLER" && variant.wholesaleKembung > 0 ? variant.wholesaleKembung : variant.priceKembung;
}

async function resolveDeliveryFee(
  deliveryMethod: CreateOrderInput["deliveryMethod"],
  tx: Prisma.TransactionClient,
): Promise<number> {
  if (deliveryMethod === "PICKUP") {
    return 0;
  }

  const setting = await tx.siteSetting.findUnique({
    where: { key: "store_delivery_fee" },
    select: { value: true },
  });

  if (setting === null) {
    throw new CheckoutSecurityError(500);
  }

  const deliveryFee = parseCurrencySetting(setting.value);
  if (deliveryFee === null) {
    throw new CheckoutSecurityError(500);
  }

  return deliveryFee;
}

async function resolveVoucherApplication(
  voucherCode: string | null | undefined,
  subtotal: number,
  role: CheckoutRole,
  tx: Prisma.TransactionClient,
): Promise<VoucherApplication | null> {
  if (voucherCode === undefined || voucherCode === null) {
    return null;
  }

  const voucher = await tx.voucher.findUnique({
    where: { code: voucherCode },
    select: voucherSelect,
  });

  const application = evaluateVoucher(voucher, subtotal, role);
  if (application === null) {
    throw new CheckoutSecurityError(400);
  }

  return application;
}

async function resolveWhatsAppNumber(): Promise<string | null> {
  const settings = await prisma.siteSetting.findMany({
    where: {
      key: {
        in: ["kontak_whatsapp", "nomor_wa"],
      },
    },
    select: {
      key: true,
      value: true,
    },
  });

  const orderedKeys = ["kontak_whatsapp", "nomor_wa"];
  for (const key of orderedKeys) {
    const setting = settings.find((candidate) => candidate.key === key);
    const value = setting?.value.trim();
    if (value !== undefined && /^62[1-9][0-9]{7,14}$/.test(value)) {
      return value;
    }
  }

  return null;
}

function parseCurrencySetting(value: string): number | null {
  const trimmed = value.trim();
  if (!/^[0-9]{1,9}$/.test(trimmed)) {
    return null;
  }

  const parsed = Number(trimmed);
  if (!Number.isSafeInteger(parsed) || parsed < 0 || parsed > 100_000_000) {
    return null;
  }

  return parsed;
}

function buildWhatsAppItemLine(
  flavorName: string,
  baseType: BaseType,
  quantity: number,
  topping: ToppingRecord | null | undefined,
  subtotal: number,
  notes: string | null,
): string {
  let line = `- ${quantity}x ${flavorName} (${baseType})\n`;
  if (topping !== null && topping !== undefined) {
    line += `  Topping: ${topping.name}\n`;
  }
  if (notes !== null) {
    line += `  Catatan: "${notes}"\n`;
  }
  line += `  Subtotal: ${formatPrice(subtotal)}\n`;
  return line;
}

function buildWhatsAppMessage(input: {
  orderId: string;
  customerName: string;
  customerPhone: string;
  deliveryMethod: CreateOrderInput["deliveryMethod"];
  notes: string | null;
  subtotal: number;
  discountAmount: number;
  deliveryFee: number;
  totalPrice: number;
  voucherCode: string | null;
  itemLines: string[];
}): string {
  const shortOrderId = input.orderId.length > 6 ? input.orderId.slice(-6) : input.orderId;
  let message = `Halo Pisang Goreng Van Java, saya ingin melakukan pemesanan (Order ID: #${shortOrderId}):\n\n`;
  message += `Nama: ${input.customerName}\n`;
  message += `No HP: ${input.customerPhone}\n`;
  message += `Metode: ${input.deliveryMethod}\n\n`;
  message += input.itemLines.join("\n");
  message += "\nRingkasan Pembayaran:\n";
  message += `Total Pesanan: ${formatPrice(input.subtotal)}\n`;
  if (input.voucherCode !== null && input.discountAmount > 0) {
    message += `Diskon Voucher (${input.voucherCode}): -${formatPrice(input.discountAmount)}\n`;
  }
  if (input.deliveryMethod === "DELIVERY" && input.deliveryFee > 0) {
    message += `Ongkos Kirim: ${formatPrice(input.deliveryFee)}\n`;
  }
  message += `Total Akhir: ${formatPrice(input.totalPrice)}\n`;

  if (input.notes !== null) {
    message += `\nCatatan/Alamat: ${input.notes}\n`;
  }

  return message;
}

function formatPrice(amount: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(amount);
}
