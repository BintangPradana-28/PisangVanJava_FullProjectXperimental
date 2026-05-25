"use server";

import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { redis } from "@/lib/redis";
import { Ratelimit } from "@upstash/ratelimit";
import { headers } from "next/headers";
import { getServerSession } from "next-auth";
import { authOptions } from "@/src/features/auth/authOptions";

// 1. Zod Schemas for Validation
const validateVoucherSchema = z.object({
  code: z.string().min(3, "Kode terlalu pendek").max(20, "Kode terlalu panjang").toUpperCase(),
  cartTotal: z.number().positive("Total keranjang tidak valid").int("Gunakan tipe integer untuk total"),
}).strict();

// 2. Custom Rate Limiter for Voucher Brute-Force (CISO Rule: 5 per minute)
const voucherRateLimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(5, '1 m'),
  analytics: true,
  prefix: "ratelimit_voucher",
});

export async function validateVoucher(rawCode: string, rawCartTotal: number) {
  try {
    // A. Absolute Quarantine: Validate all raw inputs via Zod SECOND
    const parsed = validateVoucherSchema.safeParse({ code: rawCode, cartTotal: rawCartTotal });
    
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0].message };
    }

    const { code, cartTotal } = parsed.data;

    // B. The Iron Gate: Rate Limiting by IP or Session
    const headerList = headers();
    const ip = headerList.get("x-forwarded-for") || "unknown_ip";
    const session = await getServerSession(authOptions);
    const identifier = session?.user?.email || ip; // Gunakan email jika login, jika tidak gunakan IP

    const { success: rateLimitSuccess } = await voucherRateLimit.limit(identifier);
    if (!rateLimitSuccess) {
      return { success: false, error: "Terlalu banyak percobaan. Silakan coba lagi dalam 1 menit." };
    }

    // C. Prisma Query (Parameterized implicitly)
    const voucher = await prisma.voucher.findUnique({
      where: { code },
      select: {
        id: true,
        isActive: true,
        startDate: true,
        endDate: true,
        usageLimit: true,
        usedCount: true,
        minPurchase: true,
        discountType: true,
        discountValue: true,
        maxDiscount: true,
      }
    });

    if (!voucher) {
      return { success: false, error: "Kode voucher tidak ditemukan." };
    }

    if (!voucher.isActive) {
      return { success: false, error: "Kode voucher sudah tidak aktif." };
    }

    const now = new Date();
    if (now < voucher.startDate) {
      return { success: false, error: "Kode voucher belum bisa digunakan." };
    }

    if (now > voucher.endDate) {
      return { success: false, error: "Kode voucher telah kedaluwarsa." };
    }

    if (voucher.usageLimit > 0 && voucher.usedCount >= voucher.usageLimit) {
      return { success: false, error: "Kuota voucher telah habis digunakan." };
    }

    if (cartTotal < voucher.minPurchase) {
      return { success: false, error: `Minimal belanja untuk voucher ini adalah Rp ${voucher.minPurchase.toLocaleString("id-ID")}` };
    }

    // D. Safe Calculation (Business Analyst Rule)
    let calculatedDiscount = 0;
    if (voucher.discountType === "FIXED") {
      calculatedDiscount = voucher.discountValue;
    } else if (voucher.discountType === "PERCENTAGE") {
      calculatedDiscount = Math.floor(cartTotal * (voucher.discountValue / 100));
      if (voucher.maxDiscount && calculatedDiscount > voucher.maxDiscount) {
        calculatedDiscount = voucher.maxDiscount;
      }
    }

    // Protect against negative totals (Business Analyst Rule)
    if (calculatedDiscount > cartTotal) {
      calculatedDiscount = cartTotal;
    }

    // E. Data Masking: Only return what is strictly needed
    return {
      success: true,
      discountAmount: calculatedDiscount,
      code: code,
      message: `Voucher berhasil digunakan! Diskon Rp ${calculatedDiscount.toLocaleString("id-ID")}`
    };

  } catch (error) {
    console.error("[Voucher Validation Error]:", error);
    return { success: false, error: "Terjadi kesalahan internal saat memvalidasi voucher." };
  }
}
