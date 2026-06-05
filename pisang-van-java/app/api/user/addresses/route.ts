import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/src/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const addressSchema = z.object({
  label: z.string().min(1, "Label alamat wajib diisi"),
  fullAddress: z.string().min(5, "Alamat lengkap wajib diisi"),
  latitude: z.number().nullable().optional(),
  longitude: z.number().nullable().optional(),
  notes: z.string().nullable().optional(),
  isDefault: z.boolean().default(false),
});

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    const userId = session?.user?.id;
    if (!session || !userId) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    const addresses = await prisma.address.findMany({
      where: { userId },
      orderBy: [
        { isDefault: 'desc' },
        { createdAt: 'desc' },
      ],
    });

    return NextResponse.json({ success: true, data: addresses });
  } catch (error) {
    console.error("GET /api/user/addresses Error:", error);
    return NextResponse.json({ success: false, message: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    const userId = session?.user?.id;
    if (!session || !userId) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const parsed = addressSchema.safeParse(body);
    
    if (!parsed.success) {
      return NextResponse.json({
        success: false,
        message: parsed.error.issues[0]?.message || "Data tidak valid"
      }, { status: 400 });
    }

    const { label, fullAddress, latitude, longitude, notes, isDefault } = parsed.data;

    // Jika user set ini sebagai default, unset default yang lain
    if (isDefault) {
      await prisma.address.updateMany({
        where: { userId, isDefault: true },
        data: { isDefault: false },
      });
    }

    // Jika ini adalah alamat pertama user, paksa jadikan default
    const existingCount = await prisma.address.count({ where: { userId } });
    const finalIsDefault = existingCount === 0 ? true : isDefault;

    const newAddress = await prisma.address.create({
      data: {
        userId,
        label,
        fullAddress,
        latitude: latitude ?? null,
        longitude: longitude ?? null,
        notes: notes ?? null,
        isDefault: finalIsDefault,
      },
    });

    return NextResponse.json({ success: true, data: newAddress });
  } catch (error) {
    console.error("POST /api/user/addresses Error:", error);
    return NextResponse.json({ success: false, message: "Internal Server Error" }, { status: 500 });
  }
}
