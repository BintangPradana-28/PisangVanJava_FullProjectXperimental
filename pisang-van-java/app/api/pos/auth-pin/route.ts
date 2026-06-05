import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/src/auth";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { z } from "zod";

const PIN_SETTING_KEY = "pos_manager_pin";

// --- VALIDATION SCHEMAS ---
const verifyPinSchema = z.object({
  pin: z.string().length(4, "PIN harus 4 digit"),
});

const updatePinSchema = z.object({
  oldPin: z.string().optional(), // Optional if it's the first time
  newPin: z.string().length(4, "PIN Baru harus 4 digit").regex(/^\d+$/, "Hanya angka"),
});

// Helper to generate a short-lived Approval Token (HMAC)
function generateApprovalToken() {
  const secret = process.env.NEXTAUTH_SECRET || "fallback_secret_for_local_only";
  const exp = Date.now() + 60 * 1000; // 60 seconds validity
  const payload = `pos_override|${exp}`;
  const signature = crypto.createHmac("sha256", secret).update(payload).digest("hex");
  return `${payload}.${signature}`;
}

// Helper to check Authorization
async function getAdminUser() {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") return null;
  return session.user;
}

// 1. GET: Check if PIN is configured
export async function GET(req: NextRequest) {
  const admin = await getAdminUser();
  if (!admin) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

  try {
    const setting = await prisma.siteSetting.findUnique({
      where: { key: PIN_SETTING_KEY },
    });
    return NextResponse.json({ success: true, isConfigured: !!setting });
  } catch (error) {
    return NextResponse.json({ success: false, error: "Internal Error" }, { status: 500 });
  }
}

// 2. POST: Verify PIN for POS Override
export async function POST(req: NextRequest) {
  const admin = await getAdminUser();
  if (!admin) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const { pin } = verifyPinSchema.parse(body);

    const setting = await prisma.siteSetting.findUnique({
      where: { key: PIN_SETTING_KEY },
    });

    if (!setting) {
      return NextResponse.json({ success: false, error: "PIN Manajer belum diatur." }, { status: 400 });
    }

    const isValid = await bcrypt.compare(pin, setting.value);
    if (!isValid) {
      return NextResponse.json({ success: false, error: "PIN Salah." }, { status: 401 });
    }

    const approvalToken = generateApprovalToken();
    return NextResponse.json({ success: true, approvalToken });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 400 });
  }
}

// 3. PUT: Update/Set PIN
export async function PUT(req: NextRequest) {
  const admin = await getAdminUser();
  if (!admin) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const { oldPin, newPin } = updatePinSchema.parse(body);

    const setting = await prisma.siteSetting.findUnique({
      where: { key: PIN_SETTING_KEY },
    });

    // If setting exists, enforce oldPin check
    if (setting) {
      if (!oldPin) {
        return NextResponse.json({ success: false, error: "PIN Lama wajib diisi." }, { status: 400 });
      }
      const isOldValid = await bcrypt.compare(oldPin, setting.value);
      if (!isOldValid) {
        return NextResponse.json({ success: false, error: "PIN Lama salah." }, { status: 401 });
      }
    }

    // Hash new PIN securely
    const hashedPin = await bcrypt.hash(newPin, 12);

    await prisma.siteSetting.upsert({
      where: { key: PIN_SETTING_KEY },
      update: { value: hashedPin },
      create: {
        key: PIN_SETTING_KEY,
        value: hashedPin,
        label: "POS Manager PIN",
        group: "pos_security",
      },
    });

    return NextResponse.json({ success: true, message: "PIN berhasil diperbarui." });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 400 });
  }
}
