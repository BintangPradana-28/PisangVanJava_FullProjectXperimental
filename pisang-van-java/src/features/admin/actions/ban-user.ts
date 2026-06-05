"use server";

import { auth } from "@/src/auth";
import { prisma } from "@/lib/prisma";
import { redis } from "@/lib/redis";
import * as Sentry from "@sentry/nextjs";

export async function banUser(targetUserId: string) {
  try {
    const session = await auth();

    // Pastikan yang melakukan aksi adalah ADMIN
    if (session?.user?.role !== "ADMIN") {
      throw new Error("Unauthorized");
    }

    // Gunakan transaction untuk memastikan konsistensi DB
    await prisma.$transaction([
      // 1. Set isBanned di database PostgreSQL
      prisma.user.update({
        where: { id: targetUserId },
        data: { isBanned: true },
      }),

      // 2. Hapus semua active sessions milik user tersebut
      prisma.session.deleteMany({
        where: { userId: targetUserId },
      }),

      // 3. Catat aksi di AuthLog
      prisma.authLog.create({
        data: {
          userId: targetUserId,
          event: "BAN",
          ip: "admin_action",
          userAgent: "admin_panel",
        },
      }),
    ]);

    // 4. Blacklist di Redis untuk edge-level blocking seketika
    await redis.setex(
      `banned:${targetUserId}`,
      60 * 60 * 24 * 365, // 1 tahun
      "1"
    );

    return { success: true };
  } catch (error) {
    console.error("Gagal melakukan ban user:", error);
    Sentry.captureException(error);
    return { error: "Terjadi kesalahan saat melakukan ban user" };
  }
}

export async function unbanUser(targetUserId: string) {
  try {
    const session = await auth();

    if (session?.user?.role !== "ADMIN") {
      throw new Error("Unauthorized");
    }

    await prisma.$transaction([
      prisma.user.update({
        where: { id: targetUserId },
        data: { isBanned: false },
      }),
      prisma.authLog.create({
        data: {
          userId: targetUserId,
          event: "UNBAN",
          ip: "admin_action",
          userAgent: "admin_panel",
        },
      }),
    ]);

    await redis.del(`banned:${targetUserId}`);

    return { success: true };
  } catch (error) {
    console.error("Gagal melakukan unban user:", error);
    Sentry.captureException(error);
    return { error: "Terjadi kesalahan saat melakukan unban user" };
  }
}
