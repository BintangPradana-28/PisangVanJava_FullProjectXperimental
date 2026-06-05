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

const putAddressSchema = addressSchema.partial();

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: addressId } = await params;
    const session = await auth();
    const userId = session?.user?.id;
    if (!session || !userId) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    
    // Verifikasi kepemilikan
    const existing = await prisma.address.findUnique({ where: { id: addressId } });
    if (!existing || existing.userId !== userId) {
      return NextResponse.json({ success: false, message: "Alamat tidak ditemukan" }, { status: 404 });
    }

    const body = await req.json();
    const parsed = putAddressSchema.safeParse(body);
    
    if (!parsed.success) {
      return NextResponse.json({
        success: false,
        message: parsed.error.issues[0]?.message || "Data tidak valid"
      }, { status: 400 });
    }

    const { label, fullAddress, latitude, longitude, notes, isDefault } = parsed.data;

    if (isDefault && !existing.isDefault) {
      await prisma.address.updateMany({
        where: { userId, isDefault: true },
        data: { isDefault: false },
      });
    }

    // Jika mencoba mematikan default, tapi ini alamat terakhir, jangan izinkan
    let finalIsDefault = isDefault;
    if (!isDefault && existing.isDefault) {
      const existingCount = await prisma.address.count({ where: { userId } });
      if (existingCount === 1) {
        finalIsDefault = true;
      }
    }

    const updated = await prisma.address.update({
      where: { id: addressId },
      data: {
        ...(label !== undefined && { label }),
        ...(fullAddress !== undefined && { fullAddress }),
        ...(latitude !== undefined && { latitude }),
        ...(longitude !== undefined && { longitude }),
        ...(notes !== undefined && { notes }),
        ...(finalIsDefault !== undefined && { isDefault: finalIsDefault }),
      },
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    console.error("PUT /api/user/addresses/[id] Error:", error);
    return NextResponse.json({ success: false, message: "Internal Server Error" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: addressId } = await params;
    const session = await auth();
    const userId = session?.user?.id;
    if (!session || !userId) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    
    const existing = await prisma.address.findUnique({ where: { id: addressId } });
    if (!existing || existing.userId !== userId) {
      return NextResponse.json({ success: false, message: "Alamat tidak ditemukan" }, { status: 404 });
    }

    await prisma.address.delete({ where: { id: addressId } });

    // Jika yang dihapus adalah default address, jadikan address lain sebagai default
    if (existing.isDefault) {
      const remainingAddress = await prisma.address.findFirst({
        where: { userId },
        orderBy: { createdAt: 'desc' }
      });
      if (remainingAddress) {
        await prisma.address.update({
          where: { id: remainingAddress.id },
          data: { isDefault: true }
        });
      }
    }

    return NextResponse.json({ success: true, message: "Alamat dihapus" });
  } catch (error) {
    console.error("DELETE /api/user/addresses/[id] Error:", error);
    return NextResponse.json({ success: false, message: "Internal Server Error" }, { status: 500 });
  }
}
