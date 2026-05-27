/**
 * @deprecated ⚠️ ORPHANED LEGACY FILE — DO NOT USE IN NEW CODE.
 *
 * This Server Action creates orders with a hardcoded `totalPrice: 0` and
 * is NOT connected to the main checkout flow. The production checkout
 * pipeline uses `app/api/orders/route.ts` → `src/features/checkout/service.ts`.
 *
 * Business Risk: If accidentally wired to any UI, every order will be
 * recorded with zero total, causing a complete revenue tracking failure.
 *
 * TODO: This file should be removed after confirming no references remain.
 */
"use server";

import { getServerSession } from "next-auth";
import { authOptions } from "@/src/features/auth/authOptions";
import { prisma } from "@/lib/prisma";
import { checkoutSchema } from "@/src/lib/validations/checkout";
import { randomUUID } from "crypto";

export async function submitCheckoutAction(rawPayload: unknown) {
  try {
    // 1. THE IRON GATE (Auth & Ownership)
    // CISO Rule: Verify session FIRST. Guest checkouts should be explicitly handled if allowed, 
    // but here we enforce authorization to protect the system.
    const session = await getServerSession(authOptions);
    if (!session || !session.user || !session.user.id) {
      return { success: false, error: "Unauthorized: Invalid session state." };
    }

    // 2. ABSOLUTE QUARANTINE (Runtime Validation)
    // CISO Rule: Validate all raw inputs via Zod schema.strict() SECOND.
    const parsed = checkoutSchema.safeParse(rawPayload);
    if (!parsed.success) {
      // CISO Rule: Do not log raw payload to protect PII
      console.warn(`[SECURITY] Invalid checkout payload structure from User ID: ${session.user.id}`);
      return { success: false, error: "Bad Request: Payload validation failed." };
    }

    const { nama, whatsapp, catatan } = parsed.data;

    // 3. SECURE MUTATION (Whitelist Only)
    // Asumsi: Karena ini adalah implementasi standalone form dari junior dev,
    // kita asumsikan membuat pesanan "pending" dengan total 0 jika keranjang tidak disertakan.
    // Untuk implementasi utuh, Action ini harus membaca keranjang dari database.
    const newOrder = await prisma.order.create({
      data: {
        userId: session.user.id, // Bounded secara eksplisit dari session (TIDAK BISA DIPALSUKAN)
        customerName: nama,
        customerPhone: whatsapp,
        notes: catatan !== undefined ? catatan : null,
        status: "pending",
        totalPrice: 0, // Dalam implementasi nyata, hitung ini dari database server-side
        source: "online",
        deliveryMethod: "DELIVERY",
      },
      // 4. DATA MASKING
      // CISO Rule: Select explicit DB fields; NEVER return whole objects.
      select: {
        id: true,
      }
    });

    return { success: true, transactionId: newOrder.id };

  } catch (error) {
    // 5. OPAQUE ERRORS & BLIND LOGGING
    const errorId = randomUUID();
    console.error(`[CRITICAL] Checkout Action Error [ID: ${errorId}] - System failure.`, error);
    return { success: false, error: "Internal Server Error. Please contact support." };
  }
}
