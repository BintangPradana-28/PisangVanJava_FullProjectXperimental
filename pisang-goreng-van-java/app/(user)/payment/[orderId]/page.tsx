import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, CheckCircle2, CreditCard, ReceiptText, ShieldCheck } from "lucide-react";
import { z } from "zod";

import { processPayment } from "@/src/features/checkout/actions";
import {
  getPaymentOrderForActor,
  paymentFormInputSchema,
  requireCheckoutActor,
} from "@/src/features/checkout/service";
import MidtransPayButton from "@/components/user/MidtransPayButton";

interface PaymentPageProps {
  params: {
    orderId: string;
  };
  searchParams?: {
    payment?: string | string[];
  };
}

const paymentSearchSchema = z
  .object({
    payment: z.union([z.literal("failed"), z.array(z.literal("failed"))]).optional(),
  })
  .strict();

export default async function PaymentPage({ params, searchParams }: PaymentPageProps) {
  const actor = await requireCheckoutActor();
  if (actor === null) {
    redirect("/member-login");
  }

  const parsedParams = paymentFormInputSchema.safeParse({
    orderId: params.orderId,
  });

  if (!parsedParams.success) {
    notFound();
  }

  const parsedSearch = paymentSearchSchema.safeParse({
    payment: searchParams?.payment,
  });
  const paymentFailed = parsedSearch.success && parsedSearch.data.payment === "failed";

  const order = await getPaymentOrderForActor(parsedParams.data.orderId, actor);
  if (order === null) {
    notFound();
  }

  const canPay = order.status === "pending";
  const alreadyPaid = order.status === "paid";

  return (
    <section className="min-h-screen bg-zinc-50 px-4 py-10 dark:bg-zinc-950">
      <div className="mx-auto flex max-w-4xl flex-col gap-6">
        <Link href="/menu-spesial" className="inline-flex w-fit items-center gap-2 text-sm font-semibold text-zinc-600 hover:text-zinc-950 dark:text-zinc-300 dark:hover:text-white">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Kembali
        </Link>

        <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
          <div className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <div className="mb-6 flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-zinc-400">Secure Checkout</p>
                <h1 className="mt-1 font-serif text-2xl font-bold text-zinc-950 dark:text-white">Pembayaran Pesanan</h1>
              </div>
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[#D4802A]/10 text-[#D4802A]">
                <CreditCard className="h-5 w-5" aria-hidden="true" />
              </div>
            </div>

            {paymentFailed && (
              <div className="mb-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
                Pembayaran tidak dapat diproses. Periksa status pesanan atau coba beberapa saat lagi.
              </div>
            )}

            {alreadyPaid && (
              <div className="mb-5 flex items-center gap-3 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm font-medium text-green-700 dark:border-green-900 dark:bg-green-950/40 dark:text-green-300">
                <CheckCircle2 className="h-5 w-5" aria-hidden="true" />
                Pembayaran pesanan ini sudah tercatat.
              </div>
            )}

            <div className="space-y-3">
              {order.items.map((item) => (
                <div key={item.id} className="flex items-start justify-between gap-4 border-b border-zinc-100 pb-3 last:border-b-0 dark:border-zinc-800">
                  <div>
                    <p className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                      {item.quantity}x {item.variant.flavorName} ({item.baseType})
                    </p>
                    {item.topping !== null && (
                      <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                        Topping: {item.topping.emoji} {item.topping.name}
                      </p>
                    )}
                  </div>
                  <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{formatPrice(item.subtotal)}</span>
                </div>
              ))}
            </div>

            <div className="mt-6 space-y-2 rounded-lg bg-zinc-50 p-4 dark:bg-zinc-950">
              {order.discountAmount > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-zinc-500 dark:text-zinc-400">Diskon {order.voucherCode}</span>
                  <span className="font-semibold text-green-700 dark:text-green-400">-{formatPrice(order.discountAmount)}</span>
                </div>
              )}
              {order.deliveryMethod === "DELIVERY" && order.deliveryFee > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-zinc-500 dark:text-zinc-400">Ongkos Kirim</span>
                  <span className="font-semibold text-zinc-900 dark:text-zinc-100">{formatPrice(order.deliveryFee)}</span>
                </div>
              )}
              <div className="flex justify-between border-t border-zinc-200 pt-3 dark:border-zinc-800">
                <span className="font-bold text-zinc-900 dark:text-zinc-100">Total</span>
                <span className="font-serif text-2xl font-bold text-blue-700 dark:text-blue-300">{formatPrice(order.totalPrice)}</span>
              </div>
            </div>
          </div>

          <aside className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <div className="mb-5 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300">
                <ReceiptText className="h-5 w-5" aria-hidden="true" />
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-zinc-400">Order</p>
                <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">#{order.id.slice(-8)}</p>
              </div>
            </div>

            <div className="mb-5 space-y-2 text-sm">
              <div className="flex justify-between gap-4">
                <span className="text-zinc-500 dark:text-zinc-400">Nama</span>
                <span className="text-right font-semibold text-zinc-900 dark:text-zinc-100">{order.customerName}</span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-zinc-500 dark:text-zinc-400">Status</span>
                <span className="text-right font-semibold text-zinc-900 dark:text-zinc-100">{order.status}</span>
              </div>
            </div>

            <div className="mb-5 flex items-start gap-3 rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-xs text-zinc-600 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-green-700 dark:text-green-400" aria-hidden="true" />
              <span>Pembayaran diproses dengan aman oleh Midtrans.</span>
            </div>

            {canPay ? (
              order.midtransToken ? (
                <MidtransPayButton snapToken={order.midtransToken} />
              ) : (
                <div className="w-full text-center p-3 text-sm text-red-600 font-bold bg-red-50 rounded-lg border border-red-200">
                  Gagal membuat sesi pembayaran (Token Missing).
                </div>
              )
            ) : (
              <Link href="/track-order" className="flex w-full items-center justify-center gap-2 rounded-lg bg-zinc-900 px-4 py-3 text-sm font-bold text-white transition-colors hover:bg-zinc-800 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-200">
                <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                Lihat Riwayat Pesanan
              </Link>
            )}
          </aside>
        </div>
      </div>
    </section>
  );
}

function formatPrice(amount: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(amount);
}
