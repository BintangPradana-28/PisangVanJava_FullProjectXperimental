import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { requireCheckoutActor } from "@/src/features/checkout/service";

const trackOrderQuerySchema = z
  .object({
    phone: z
      .string()
      .trim()
      .min(9)
      .max(20)
      .regex(/^(\+62|62|0)8[1-9][0-9]{6,10}$/),
  })
  .strict();

export async function GET(req: NextRequest) {
  const actor = await requireCheckoutActor();
  if (actor === null) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const parsedQuery = trackOrderQuerySchema.safeParse({
    phone: req.nextUrl.searchParams.get("phone") ?? "",
  });

  if (!parsedQuery.success) {
    return NextResponse.json({ success: false, error: "Invalid request" }, { status: 400 });
  }

  try {
    const orders = await prisma.order.findMany({
      where: {
        userId: actor.userId,
        customerPhone: parsedQuery.data.phone,
      },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: {
        id: true,
        customerName: true,
        status: true,
        totalPrice: true,
        createdAt: true,
        items: {
          select: {
            id: true,
            baseType: true,
            quantity: true,
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

    return NextResponse.json({ success: true, data: orders });
  } catch (error) {
    console.error("[SECURITY] Failed to track order.", error);
    return NextResponse.json({ success: false, error: "Server error" }, { status: 500 });
  }
}
