'use server'

import { getServerSession } from "next-auth";
import { authOptions } from "@/src/features/auth/authOptions";
import { revalidatePath, revalidateTag, unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";

// ── Dead Code Eliminasi ───────────────────────────────────────────────────────
// Fungsi usang (updateMenuVariant & mockDb) telah dihapus dari sistem ini.
// Dasbor Admin kini sepenuhnya menggunakan rute REST produksi di `/api/admin/menu`
// untuk keamanan yang lebih tinggi dan validasi Zod yang tersentralisasi.

export async function toggleAvailability(id: string, isAvailable: boolean) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return { success: false, error: "Akses ditolak. Sesi tidak valid." };
    }

    const updatedRecord = await prisma.menuVariant.update({
      where: { id },
      data: { isAvailable },
    });

    // Revalidate customer-facing pages
    revalidatePath("/");
    revalidatePath("/menu-spesial");
    revalidatePath("/(user)", "layout");
    // revalidateTag("menu-data");

    // Audit Log
    await logAudit("TOGGLE_AVAILABILITY", "MenuVariant", updatedRecord.id, { isAvailable });

    return {
      success: true,
      message: `Status ketersediaan '${updatedRecord.flavorName}' diperbarui.`,
      data: updatedRecord
    };
  } catch (error) {
    console.error("[CRITICAL BACKEND ERROR]: Toggle availability failed", error);
    return {
      success: false,
      error: "Terjadi kegagalan sistem internal. Operasi dibatalkan."
    };
  }
}

/**
 * 📦 1. MESIN PEMBACA (The Cache Engine)
 * Dioptimalkan dengan Zero-Trust Data Masking.
 */
export const getCachedMenu = unstable_cache(
  async () => {
    console.log("[CACHE MISS] Menghubungi database Prisma Supabase...");

    // CISO Rule: Select explicit DB fields; NEVER return whole objects.
    const menu = await prisma.menuVariant.findMany({
      where: {
        isDeleted: false,
        isActive: true,
        isAvailable: true
      },
      select: {
        id: true,
        flavorName: true,
        priceKembung: true,
        priceLumpia: true,
        priceKrispy: true,
        imageUrl: true,
        tags: true
      },
    });

    return menu;
  },
  ['daftar-menu-pisang'], // Kunci Cache
  {
    tags: ['menu-data'], // Tag untuk revalidasi spesifik (Sniper)
    revalidate: 3600 // TTL 1 jam
  }
);