import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import {
  CheckoutSecurityError,
  createCheckoutOrder,
  createOrderInputSchema,
  enforceCheckoutRateLimit,
  hasValidSameOriginHeaders,
  orderQueryInputSchema,
  requireCheckoutActor,
} from "@/src/features/checkout/service";

export async function GET(req: NextRequest) {
  const actor = await requireCheckoutActor();
  if (actor === null) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  if (actor.role !== "ADMIN") {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  const parsedQuery = orderQueryInputSchema.safeParse({
    status: req.nextUrl.searchParams.get("status") ?? undefined,
    page: req.nextUrl.searchParams.get("page") ?? undefined,
    limit: req.nextUrl.searchParams.get("limit") ?? undefined,
  });

  if (!parsedQuery.success) {
    return NextResponse.json({ success: false, error: "Invalid query" }, { status: 400 });
  }

  try {
    const { status, page, limit } = parsedQuery.data;
    const where = status === undefined ? {} : { status };
    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          customerName: true,
          customerPhone: true,
          totalPrice: true,
          status: true,
          notes: true,
          source: true,
          voucherCode: true,
          discountAmount: true,
          deliveryMethod: true,
          deliveryFee: true,
          createdAt: true,
          items: {
            select: {
              id: true,
              baseType: true,
              quantity: true,
              unitPrice: true,
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
      }),
      prisma.order.count({ where }),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        orders,
        total,
        page,
        limit,
      },
    });
  } catch (error) {
    console.error("[SECURITY] Failed to list orders.", error);
    return NextResponse.json({ success: false, error: "Server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const actor = await requireCheckoutActor();
  if (actor === null) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  if (!(await hasValidSameOriginHeaders())) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  const withinLimit = await enforceCheckoutRateLimit(actor);
  if (!withinLimit) {
    return NextResponse.json({ success: false, error: "Too many checkout attempts" }, { status: 429 });
  }

  const payload = await readRequestJson(req);
  if (payload === null) {
    return NextResponse.json({ success: false, error: "Invalid request" }, { status: 400 });
  }

  const parsed = createOrderInputSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: "Checkout payload rejected" }, { status: 400 });
  }

  try {
    const orderResult = await createCheckoutOrder(parsed.data, actor);
    return NextResponse.json(
      {
        success: true,
        data: {
          orderId: orderResult.orderId,
          redirectType: orderResult.redirectType,
          redirectUrl: orderResult.redirectUrl,
          totalPrice: orderResult.totalPrice,
        },
      },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof CheckoutSecurityError) {
      return NextResponse.json({ success: false, error: "Checkout rejected" }, { status: error.statusCode });
    }

    console.error("[SECURITY] Order creation failed.", error);
    return NextResponse.json({ success: false, error: "Server error" }, { status: 500 });
  }
}

async function readRequestJson(req: NextRequest): Promise<unknown | null> {
  try {
    return await req.json();
  } catch {
    return null;
  }
}
