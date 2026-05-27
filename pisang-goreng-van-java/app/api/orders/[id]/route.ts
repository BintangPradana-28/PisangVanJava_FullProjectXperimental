import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { sendWhatsAppNotification } from "@/lib/notifications";
import {
  hasValidSameOriginHeaders,
  orderStatusInputSchema,
  paymentFormInputSchema,
  requireCheckoutActor,
} from "@/src/features/checkout/service";

interface OrderRouteContext {
  params: Promise<{
    id: string;
  }>;
}

const updateOrderStatusSchema = orderStatusInputSchema;

export async function GET(_: NextRequest, { params }: OrderRouteContext) {
  const { id } = await params;
  const actor = await requireCheckoutActor();
  if (actor === null) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  if (actor.role !== "ADMIN") {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  const parsedParams = paymentFormInputSchema.safeParse({ orderId: id });
  if (!parsedParams.success) {
    return NextResponse.json({ success: false, error: "Invalid order" }, { status: 400 });
  }

  try {
    const order = await prisma.order.findUnique({
      where: { id: parsedParams.data.orderId },
      select: orderDetailSelect,
    });

    if (order === null) {
      return NextResponse.json({ success: false, error: "Order not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: order });
  } catch (error) {
    console.error("[SECURITY] Failed to read order.", error);
    return NextResponse.json({ success: false, error: "Server error" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: OrderRouteContext) {
  const { id } = await params;
  const actor = await requireCheckoutActor();
  if (actor === null) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  if (actor.role !== "ADMIN") {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  if (!(await hasValidSameOriginHeaders())) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  const parsedParams = paymentFormInputSchema.safeParse({ orderId: id });
  if (!parsedParams.success) {
    return NextResponse.json({ success: false, error: "Invalid order" }, { status: 400 });
  }

  const payload = await readRequestJson(req);
  if (payload === null || typeof payload !== "object" || Array.isArray(payload)) {
    return NextResponse.json({ success: false, error: "Invalid request" }, { status: 400 });
  }

  const statusCandidate = "status" in payload ? payload.status : undefined;
  const parsedStatus = updateOrderStatusSchema.safeParse(statusCandidate);
  if (!parsedStatus.success) {
    return NextResponse.json({ success: false, error: "Invalid status" }, { status: 400 });
  }

  try {
    const order = await prisma.order.update({
      where: { id: parsedParams.data.orderId },
      data: { status: parsedStatus.data },
      select: {
        id: true,
        customerName: true,
        customerPhone: true,
        status: true,
      },
    });

    await logAudit("UPDATE_ORDER_STATUS", "Order", order.id, { newStatus: parsedStatus.data });

    if (parsedStatus.data === "confirmed" || parsedStatus.data === "ready" || parsedStatus.data === "cancelled") {
      await sendWhatsAppNotification(order.customerPhone, order.customerName, parsedStatus.data, order.id);
    }

    return NextResponse.json({
      success: true,
      data: {
        id: order.id,
        status: order.status,
      },
    });
  } catch (error) {
    console.error("[SECURITY] Failed to update order.", error);
    return NextResponse.json({ success: false, error: "Server error" }, { status: 500 });
  }
}

export async function DELETE(_: NextRequest, { params }: OrderRouteContext) {
  const { id } = await params;
  const actor = await requireCheckoutActor();
  if (actor === null) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  if (actor.role !== "ADMIN") {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  if (!(await hasValidSameOriginHeaders())) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  const parsedParams = paymentFormInputSchema.safeParse({ orderId: id });
  if (!parsedParams.success) {
    return NextResponse.json({ success: false, error: "Invalid order" }, { status: 400 });
  }

  try {
    await prisma.order.delete({
      where: { id: parsedParams.data.orderId },
    });

    await logAudit("DELETE_ORDER", "Order", parsedParams.data.orderId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[SECURITY] Failed to delete order.", error);
    return NextResponse.json({ success: false, error: "Server error" }, { status: 500 });
  }
}

const orderDetailSelect = {
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
};

async function readRequestJson(req: NextRequest): Promise<unknown | null> {
  try {
    return await req.json();
  } catch {
    return null;
  }
}
