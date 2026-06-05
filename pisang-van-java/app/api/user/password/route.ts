import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/src/auth";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { z } from "zod";

const passwordSchema = z.object({
  oldPassword: z.string().min(1, "Password lama wajib diisi"),
  newPassword: z.string().min(6, "Password baru minimal 6 karakter"),
});

export async function PUT(req: NextRequest) {
  try {
    const session = await auth();
    const userId = session?.user?.id;
    if (!session || !userId) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const parsed = passwordSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({
        success: false,
        message: parsed.error.issues[0]?.message || "Data tidak valid"
      }, { status: 400 });
    }

    const { oldPassword, newPassword } = parsed.data;

    // Ambil password lama dari DB
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { passwordHash: true }
    });

    if (!user) {
      return NextResponse.json({ success: false, message: "User not found" }, { status: 404 });
    }

    // Jika pengguna login dengan OAuth dan tidak punya password sebelumnya
    if (!user.passwordHash) {
      return NextResponse.json({ success: false, message: "Akun ini didaftarkan menggunakan Google/OAuth. Anda tidak dapat mengubah password." }, { status: 400 });
    }

    // Verifikasi password lama
    const isPasswordValid = await bcrypt.compare(oldPassword, user.passwordHash);
    if (!isPasswordValid) {
      return NextResponse.json({ success: false, message: "Password lama tidak sesuai." }, { status: 400 });
    }

    // Hash password baru
    const salt = await bcrypt.genSalt(10);
    const hashedNewPassword = await bcrypt.hash(newPassword, salt);

    // Simpan ke database
    await prisma.user.update({
      where: { id: userId },
      data: { passwordHash: hashedNewPassword },
    });

    return NextResponse.json({ success: true, message: "Password berhasil diubah." });
  } catch (error) {
    console.error("PUT /api/user/password Error:", error);
    return NextResponse.json({ success: false, message: "Internal Server Error" }, { status: 500 });
  }
}
