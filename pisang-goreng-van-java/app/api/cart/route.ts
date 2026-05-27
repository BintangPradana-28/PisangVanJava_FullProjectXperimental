import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { hasValidSameOriginHeaders, requireCheckoutActor } from "@/src/features/checkout/service";

export const dynamic = "force-dynamic";

const cartItemSyncSchema = z
  .object({
    productId: z.string().min(8).max(64).regex(/^[a-zA-Z0-9_-]+$/),
    toppingId: z.string().min(8).max(64).regex(/^[a-zA-Z0-9_-]+$/).nullable(),
    name: z.string().min(1).max(160),
    quantity: z.number().int().min(1).max(99),
    notes: z.string().max(160),
    baseType: z.string().max(20).nullable(),
  })
  .strict();

const cartSyncSchema = z
  .object({
    items: z.array(cartItemSyncSchema).max(40),
  })
  .strict();

type StoredBaseType = "Kembung" | "Lumpia" | "Krispy";

export async function GET(_: NextRequest) {
  try {
    const actor = await requireCheckoutActor();
    if (actor === null) {
      return noStoreJson({ success: false, data: [] });
    }

    const cart = await prisma.cart.findUnique({
      where: { userId: actor.userId },
      select: {
        items: {
          select: {
            variantId: true,
            toppingId: true,
            baseType: true,
            quantity: true,
            notes: true,
            variant: {
              select: {
                flavorName: true,
                priceKembung: true,
                priceLumpia: true,
                priceKrispy: true,
                wholesaleKembung: true,
                wholesaleLumpia: true,
                wholesaleKrispy: true,
                isDeleted: true,
                isActive: true,
              },
            },
            topping: {
              select: {
                name: true,
                price: true,
              },
            },
          },
        },
      },
    });

    if (cart === null) {
      return noStoreJson({ success: true, data: [] });
    }

    const formattedItems = cart.items
      .filter((item) => !item.variant.isDeleted && item.variant.isActive)
      .map((item) => {
      const baseType = normalizeStoredBaseType(item.baseType);
      if (baseType === null) {
        throw new Error("INVALID_STORED_CART_BASE_TYPE");
      }

      const basePrice = selectCartBasePrice(item.variant, baseType, actor.role);
      const toppingPrice = item.topping?.price ?? 0;
      const notes = item.notes ?? "";

      return {
        productId: item.variantId,
        name: `${item.variant.flavorName} (${baseType})`,
        basePrice,
        toppingName: item.topping?.name ?? null,
        toppingPrice,
        quantity: item.quantity,
        notes,
        totalPrice: (basePrice + toppingPrice) * item.quantity,
        toppingId: item.toppingId,
        baseType,
      };
    });

    return noStoreJson({ success: true, data: formattedItems });
  } catch (error) {
    console.error("[SECURITY] GET /api/cart failed.", error);
    return NextResponse.json({ success: false, error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const actor = await requireCheckoutActor();
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

    const parsed = cartSyncSchema.safeParse(payload);
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: "Invalid payload" }, { status: 400 });
    }

    const cart = await prisma.cart.upsert({
      where: { userId: actor.userId },
      update: {},
      create: { userId: actor.userId },
      select: { id: true },
    });

    await prisma.cartItem.deleteMany({
      where: { cartId: cart.id },
    });

    if (parsed.data.items.length > 0) {
      const dataToInsert: Array<{
        cartId: string;
        variantId: string;
        toppingId: string | null;
        baseType: StoredBaseType;
        quantity: number;
        notes: string;
      }> = [];
      for (const item of parsed.data.items) {
        const baseType = resolveCartBaseType(item.baseType, item.name);
        if (baseType === null) {
          return NextResponse.json({ success: false, error: "Invalid payload" }, { status: 400 });
        }

        dataToInsert.push({
          cartId: cart.id,
          variantId: item.productId,
          toppingId: item.toppingId,
          baseType,
          quantity: item.quantity,
          notes: item.notes,
        });
      }

      await prisma.cartItem.createMany({
        data: dataToInsert,
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[SECURITY] POST /api/cart failed.", error);
    return NextResponse.json({ success: false, error: "Internal Server Error" }, { status: 500 });
  }
}

function noStoreJson(body: { success: boolean; data: unknown[] }) {
  return NextResponse.json(body, {
    headers: { "Cache-Control": "no-store, max-age=0" },
  });
}

async function readRequestJson(req: NextRequest): Promise<unknown | null> {
  try {
    return await req.json();
  } catch {
    return null;
  }
}

function normalizeStoredBaseType(value: string): StoredBaseType | null {
  const normalized = value.trim().toLowerCase();
  if (normalized === "kembung") return "Kembung";
  if (normalized === "lumpia") return "Lumpia";
  if (normalized === "krispy") return "Krispy";
  return null;
}

function resolveCartBaseType(baseType: string | null, name: string): StoredBaseType | null {
  if (baseType !== null) {
    return normalizeStoredBaseType(baseType);
  }

  const match = name.match(/\((Kembung|Lumpia|Krispy|kembung|lumpia|krispy)\)$/);
  if (match === null) {
    return null;
  }

  return normalizeStoredBaseType(match[1]);
}

function selectCartBasePrice(
  variant: {
    priceKembung: number;
    priceLumpia: number;
    priceKrispy: number;
    wholesaleKembung: number;
    wholesaleLumpia: number;
    wholesaleKrispy: number;
  },
  baseType: StoredBaseType,
  role: "ADMIN" | "CUSTOMER" | "RESELLER",
): number {
  if (baseType === "Lumpia") {
    return role === "RESELLER" && variant.wholesaleLumpia > 0 ? variant.wholesaleLumpia : variant.priceLumpia;
  }

  if (baseType === "Krispy") {
    return role === "RESELLER" && variant.wholesaleKrispy > 0 ? variant.wholesaleKrispy : variant.priceKrispy;
  }

  return role === "RESELLER" && variant.wholesaleKembung > 0 ? variant.wholesaleKembung : variant.priceKembung;
}
