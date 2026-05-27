import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyMidtransSignature } from "@/src/features/payment/service";

export async function POST(req: NextRequest) {
  try {
    const payload = await req.json();

    // The Midtrans Webhook Payload contains:
    // order_id, status_code, gross_amount, signature_key, transaction_status, etc.
    const {
      order_id,
      status_code,
      gross_amount,
      signature_key,
      transaction_status,
      transaction_id
    } = payload;

    if (!order_id || !status_code || !gross_amount || !signature_key) {
      return NextResponse.json({ success: false, error: "Invalid payload" }, { status: 400 });
    }

    // Zero-Trust: Verify HMAC Signature Key
    const isValid = verifyMidtransSignature(order_id, status_code, gross_amount, signature_key);
    if (!isValid) {
      console.error("[SECURITY] Invalid Midtrans signature detected for order:", order_id);
      return NextResponse.json({ success: false, error: "Forbidden: Signature mismatch" }, { status: 403 });
    }

    // Verify order exists and amount matches
    const order = await prisma.order.findUnique({
      where: { id: order_id }
    });

    if (!order) {
      console.error("[SECURITY] Midtrans webhook order not found:", order_id);
      return NextResponse.json({ success: false, error: "Order not found" }, { status: 404 });
    }

    // Ensure gross_amount string from Midtrans matches our database value closely
    // Midtrans might send "15000.00", parseFloat handles this.
    if (Math.abs(parseFloat(gross_amount) - order.totalPrice) > 1) {
      console.error("[SECURITY] Midtrans webhook amount mismatch:", { received: gross_amount, expected: order.totalPrice });
      return NextResponse.json({ success: false, error: "Amount mismatch" }, { status: 400 });
    }

    // Determine target order status
    let newStatus = order.status;
    let paymentPaidAt = order.paymentPaidAt;

    if (transaction_status === 'settlement' || transaction_status === 'capture') {
      newStatus = 'paid';
      paymentPaidAt = new Date();
    } else if (transaction_status === 'cancel' || transaction_status === 'expire' || transaction_status === 'deny') {
      newStatus = 'cancelled';
    }

    // Update database
    await prisma.order.update({
      where: { id: order_id },
      data: {
        status: newStatus,
        paymentStatus: transaction_status,
        midtransTransactionId: transaction_id,
        paymentPaidAt
      }
    });

    return NextResponse.json({ success: true, message: "Webhook processed" });
  } catch (error) {
    console.error("[SECURITY] Midtrans webhook processing failed", error);
    return NextResponse.json({ success: false, error: "Internal Server Error" }, { status: 500 });
  }
}
