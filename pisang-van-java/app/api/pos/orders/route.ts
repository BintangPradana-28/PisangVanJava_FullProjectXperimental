import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/src/features/auth/authOptions";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

// Schema for individual cart items
const orderItemSchema = z.object({
  variantId: z.string().cuid("Invalid Variant ID"),
  toppingId: z.string().cuid("Invalid Topping ID").nullable().optional(),
  baseType: z.enum(["Kembung", "Lumpia", "Krispy"]),
  quantity: z.number().int().min(1, "Minimal 1 porsi"),
  unitPrice: z.number().min(0),
  subtotal: z.number().min(0),
});

// Schema for the entire POS order payload
const posOrderSchema = z.object({
  customerName: z.string().min(1, "Nama Pelanggan wajib diisi").default("Walk-in Customer"),
  customerPhone: z.string().default("-"),
  items: z.array(orderItemSchema).min(1, "Keranjang tidak boleh kosong"),
  totalPrice: z.number().min(0),
  paymentMethod: z.enum(["CASH", "QRIS"]),
  notes: z.string().optional(),
});

async function checkCashierOrAdmin() {
  const session = await getServerSession(authOptions);
  // Assuming 'ADMIN' handles POS for now. Can be expanded to 'CASHIER' if role exists.
  if (!session || session.user.role !== "ADMIN") return null;
  return session.user;
}

export async function POST(req: NextRequest) {
  const user = await checkCashierOrAdmin();
  if (!user) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

  try {
    const rawData = await req.json();
    const parseResult = posOrderSchema.safeParse(rawData);

    if (!parseResult.success) {
      return NextResponse.json(
        { success: false, error: "Data transaksi tidak valid", details: parseResult.error.format() },
        { status: 400 }
      );
    }

    const data = parseResult.data;

    // Use Prisma $transaction to ensure Atomicity and prevent Race Conditions
    const result = await prisma.$transaction(async (tx) => {
      // 1. Double check stock for all items
      for (const item of data.items) {
        const variant = await tx.menuVariant.findUnique({
          where: { id: item.variantId },
          select: { stock: true, flavorName: true },
        });

        if (!variant) {
          throw new Error(`Produk dengan ID ${item.variantId} tidak ditemukan.`);
        }

        if (variant.stock < item.quantity) {
          // If out of stock, throw error with specific message for UI notification
          throw new Error(`Stok ${variant.flavorName} habis atau tidak mencukupi. Sisa: ${variant.stock}`);
        }
      }

      // 2. Create the Order
      const newOrder = await tx.order.create({
        data: {
          customerName: data.customerName,
          customerPhone: data.customerPhone,
          totalPrice: data.totalPrice,
          source: "walk-in", // Indicates POS
          status: "paid",    // POS transactions are paid upfront
          deliveryMethod: "DINE_IN", // Or TAKEAWAY
          userId: user.id,   // Record the cashier/admin
          notes: data.notes,
          items: {
            create: data.items.map((item) => ({
              variantId: item.variantId,
              toppingId: item.toppingId || undefined,
              baseType: item.baseType,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              subtotal: item.subtotal,
            })),
          },
        },
      });

      // 3. Atomic Decrement of Stock (Concurrency Safe)
      for (const item of data.items) {
        await tx.menuVariant.update({
          where: { id: item.variantId },
          data: {
            stock: {
              decrement: item.quantity,
            },
          },
        });
      }

      return newOrder;
    });

    return NextResponse.json({ success: true, data: result });
  } catch (error: any) {
    console.error("POS Transaction Error:", error);
    // Return the specific stock error message if caught from the transaction
    const message = error.message || "Gagal memproses transaksi kasir.";
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}
