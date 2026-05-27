import { NextRequest, NextResponse } from "next/server";

import {
  hasValidSameOriginHeaders,
  requireCheckoutActor,
  validateVoucherForActor,
  validateVoucherInputSchema,
} from "@/src/features/checkout/service";

export async function POST(req: NextRequest) {
  const actor = await requireCheckoutActor();
  if (actor === null) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  if (!hasValidSameOriginHeaders()) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  const payload = await readRequestJson(req);
  if (payload === null) {
    return NextResponse.json({ success: false, error: "Invalid request" }, { status: 400 });
  }

  const parsed = validateVoucherInputSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: "Voucher rejected" }, { status: 400 });
  }

  try {
    const result = await validateVoucherForActor(parsed.data, actor);
    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      data: {
        code: result.data.code,
        discountAmount: result.data.discountAmount,
        message: result.data.message,
      },
    });
  } catch (error) {
    console.error("[SECURITY] Voucher validation failed.", error);
    return NextResponse.json({ success: false, error: "Server error" }, { status: 500 });
  }
}

async function readRequestJson(req: NextRequest): Promise<unknown | null> {
  try {
    return await req.json();
  } catch {
    return null;
  }
}
