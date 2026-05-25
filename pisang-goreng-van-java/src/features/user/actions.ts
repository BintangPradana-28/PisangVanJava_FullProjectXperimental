"use server";

import { getServerSession } from "next-auth/next";
import { authOptions } from "@/src/features/auth/authOptions";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { revalidatePath } from "next/cache";

const sessionUserSchema = z.object({
  id: z.string().min(1),
  name: z.string().nullable().optional(),
  email: z.string().nullable().optional(),
  role: z.string().optional(),
}).passthrough();

const deleteAccountSchema = z.object({
  confirmationString: z.string()
    .refine(val => val === "HAPUS AKUN SAYA", { message: "String konfirmasi harus persis 'HAPUS AKUN SAYA'" }),
}).strict();

export async function deleteAccountPermanently(formData: FormData) {
  try {
    // 1. The Iron Gate: Verify Session FIRST
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return { success: false, error: "Akses ditolak. Anda harus login." };
    }

    const parsedSession = sessionUserSchema.safeParse(session.user);
    if (!parsedSession.success) {
      return { success: false, error: "Sesi tidak valid atau telah rusak." };
    }

    const userId = parsedSession.data.id;
    const userEmail = parsedSession.data.email;

    // 2. Absolute Quarantine: Validate all raw inputs via Zod SECOND
    const rawConfirmation = formData.get("confirmationString");
    const parsedInput = deleteAccountSchema.safeParse({
      confirmationString: rawConfirmation,
    });

    if (!parsedInput.success) {
      return { success: false, error: parsedInput.error.issues[0].message };
    }

    // 3. Ensure the user exists
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, phone: true },
    });

    if (!user) {
      return { success: false, error: "Pengguna tidak ditemukan." };
    }

    // 4. Data Erasure: Execute the permanent deletion (Right to be Forgotten)
    // We use a transaction to ensure atomicity. If they have matching Orders based on phone, we anonymize them.
    await prisma.$transaction(async (tx) => {
      // If user had a phone number, anonymize their PII in legacy Orders
      if (user.phone) {
        await tx.order.updateMany({
          where: { customerPhone: user.phone },
          data: {
            customerName: "Deleted User",
            customerPhone: "00000000000",
            notes: "Data anonymized due to account deletion",
          },
        });
      }

      // Hard-delete the user. This cascades to Accounts, Favorites, Reviews, and Cart.
      await tx.user.delete({
        where: { id: userId },
      });

      // Insert Audit Log for Enterprise tracking (System-level action)
      await tx.auditLog.create({
        data: {
          action: "DELETE",
          resource: "User",
          resourceId: userId,
          userId: "SYSTEM",
          details: JSON.stringify({ reason: "Right to be Forgotten requested", targetEmail: userEmail }),
        },
      });
    });

    return { success: true, message: "Akun Anda beserta seluruh data sensitif telah dihapus secara permanen." };
  } catch (error) {
    // 5. Data Masking: Return generic opaque errors to the client
    console.error("[RightToBeForgotten Error]:", error);
    return { success: false, error: "Terjadi kesalahan sistem saat menghapus akun. Silakan hubungi dukungan teknis." };
  }
}
