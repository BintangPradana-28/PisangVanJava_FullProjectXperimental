import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { hasValidSameOriginHeaders, requireCheckoutActor } from "@/src/features/checkout/service";

const voucherIdSchema = z.string().min(8).max(64).regex(/^[a-zA-Z0-9_-]+$/);
const voucherCodeSchema = z.string().trim().min(3).max(50).regex(/^[a-zA-Z0-9_-]+$/).transform((value) => value.toUpperCase());
const dateStringSchema = z.string().refine((value) => !Number.isNaN(Date.parse(value)));

const createVoucherSchema = z
  .object({
    code: voucherCodeSchema,
    discountType: z.enum(["PERCENTAGE", "FIXED"]),
    discountValue: z.number().finite().positive().max(100_000_000),
    minPurchase: z.number().finite().min(0).max(100_000_000),
    maxDiscount: z.number().finite().min(0).max(100_000_000).nullable(),
    startDate: dateStringSchema,
    endDate: dateStringSchema,
    usageLimit: z.number().int().min(0).max(1_000_000),
    isActive: z.boolean(),
    applicableTo: z.enum(["ALL", "CUSTOMER", "RESELLER"]),
  })
  .strict()
  .superRefine((value, context) => {
    const startDate = new Date(value.startDate);
    const endDate = new Date(value.endDate);
    if (endDate <= startDate) {
      context.addIssue({
        code: "custom",
        path: ["endDate"],
        message: "Invalid date range.",
      });
    }

    if (value.discountType === "PERCENTAGE" && value.discountValue > 100) {
      context.addIssue({
        code: "custom",
        path: ["discountValue"],
        message: "Invalid percentage discount.",
      });
    }
  });

const patchVoucherSchema = z
  .object({
    id: voucherIdSchema,
    isActive: z.boolean(),
  })
  .strict();

export async function GET(_: NextRequest) {
  const actor = await requireAdminActor();
  if (actor === null) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const vouchers = await prisma.voucher.findMany({
      orderBy: { createdAt: "desc" },
      select: voucherSelect,
    });

    return NextResponse.json({ success: true, data: vouchers });
  } catch (error) {
    console.error("[SECURITY] GET /api/admin/vouchers failed.", error);
    return NextResponse.json({ success: false, error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const actor = await requireAdminActor();
  if (actor === null) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  if (!hasValidSameOriginHeaders()) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  const payload = await readRequestJson(req);
  if (payload === null) {
    return NextResponse.json({ success: false, error: "Invalid payload" }, { status: 400 });
  }

  const parsed = createVoucherSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: "Invalid payload" }, { status: 400 });
  }

  try {
    const existing = await prisma.voucher.findUnique({
      where: { code: parsed.data.code },
      select: { id: true },
    });

    if (existing !== null) {
      return NextResponse.json({ success: false, error: "Voucher already exists" }, { status: 409 });
    }

    const voucher = await prisma.voucher.create({
      data: {
        code: parsed.data.code,
        discountType: parsed.data.discountType,
        discountValue: parsed.data.discountValue,
        minPurchase: parsed.data.minPurchase,
        maxDiscount: parsed.data.maxDiscount,
        startDate: new Date(parsed.data.startDate),
        endDate: new Date(parsed.data.endDate),
        usageLimit: parsed.data.usageLimit,
        isActive: parsed.data.isActive,
        applicableTo: parsed.data.applicableTo,
      },
      select: voucherSelect,
    });

    return NextResponse.json({ success: true, data: voucher }, { status: 201 });
  } catch (error) {
    console.error("[SECURITY] POST /api/admin/vouchers failed.", error);
    return NextResponse.json({ success: false, error: "Internal Server Error" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const actor = await requireAdminActor();
  if (actor === null) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  if (!hasValidSameOriginHeaders()) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  const payload = await readRequestJson(req);
  if (payload === null) {
    return NextResponse.json({ success: false, error: "Invalid payload" }, { status: 400 });
  }

  const parsed = patchVoucherSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: "Invalid payload" }, { status: 400 });
  }

  try {
    const voucher = await prisma.voucher.update({
      where: { id: parsed.data.id },
      data: { isActive: parsed.data.isActive },
      select: voucherSelect,
    });

    return NextResponse.json({ success: true, data: voucher });
  } catch (error) {
    console.error("[SECURITY] PATCH /api/admin/vouchers failed.", error);
    return NextResponse.json({ success: false, error: "Internal Server Error" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const actor = await requireAdminActor();
  if (actor === null) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  if (!hasValidSameOriginHeaders()) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  const parsedId = voucherIdSchema.safeParse(req.nextUrl.searchParams.get("id"));
  if (!parsedId.success) {
    return NextResponse.json({ success: false, error: "Invalid request" }, { status: 400 });
  }

  try {
    await prisma.voucher.delete({
      where: { id: parsedId.data },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[SECURITY] DELETE /api/admin/vouchers failed.", error);
    return NextResponse.json({ success: false, error: "Internal Server Error" }, { status: 500 });
  }
}

const voucherSelect = {
  id: true,
  code: true,
  discountType: true,
  discountValue: true,
  minPurchase: true,
  maxDiscount: true,
  startDate: true,
  endDate: true,
  usageLimit: true,
  usedCount: true,
  isActive: true,
  applicableTo: true,
  createdAt: true,
};

async function requireAdminActor() {
  const actor = await requireCheckoutActor();
  if (actor === null || actor.role !== "ADMIN") {
    return null;
  }

  return actor;
}

async function readRequestJson(req: NextRequest): Promise<unknown | null> {
  try {
    return await req.json();
  } catch {
    return null;
  }
}
