"use server";

import { redirect } from "next/navigation";

import {
  hasValidSameOriginHeaders,
  paymentFormInputSchema,
  processPaymentForActor,
  requireCheckoutActor,
  validateVoucherForActor,
  validateVoucherInputSchema,
  type VoucherValidationResult,
} from "@/src/features/checkout/service";

export async function validateVoucher(rawCode: string, rawCartTotal: number): Promise<VoucherValidationResult> {
  const actor = await requireCheckoutActor();
  if (actor === null) {
    return {
      success: false,
      error: "Sesi pelanggan diperlukan untuk memakai voucher.",
    };
  }

  if (!(await hasValidSameOriginHeaders())) {
    return {
      success: false,
      error: "Permintaan voucher ditolak.",
    };
  }

  const parsed = validateVoucherInputSchema.safeParse({
    code: rawCode,
    cartTotal: rawCartTotal,
  });

  if (!parsed.success) {
    return {
      success: false,
      error: "Voucher tidak dapat digunakan untuk pesanan ini.",
    };
  }

  return validateVoucherForActor(parsed.data, actor);
}

export async function processPayment(rawFormData: FormData): Promise<void> {
  const actor = await requireCheckoutActor();
  if (actor === null) {
    redirect("/member-login");
  }

  if (!(await hasValidSameOriginHeaders())) {
    redirect("/track-order?payment=failed");
  }

  const parsed = paymentFormInputSchema.safeParse({
    orderId: rawFormData.get("orderId"),
  });

  if (!parsed.success) {
    redirect("/track-order?payment=failed");
  }

  const processed = await processPaymentForActor(parsed.data.orderId, actor);
  if (!processed) {
    redirect(`/payment/${parsed.data.orderId}?payment=failed`);
  }

  redirect("/track-order?payment=success");
}
