import { Prisma } from '@prisma/client'
import { ArrowLeft, CheckCircle2, CreditCard, ReceiptText, ShieldCheck } from 'lucide-react'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { z } from 'zod'
import MidtransPayButton from '@/components/user/MidtransPayButton'
import { prisma } from '@/lib/prisma'
import { env } from '@/src/env'
import { processPayment } from '@/src/features/checkout/actions'
import { paymentFormInputSchema } from '@/src/features/checkout/schemas'
import {
  getPaymentOrderForActor,
  requireCheckoutActor
} from '@/src/services/checkout.service'
import { generateSnapToken } from '@/src/features/payment/service'

interface PaymentPageProps {
  params: Promise<{
    orderId: string
  }>
  searchParams?: Promise<{
    payment?: string | string[]
  }>
}

const paymentSearchSchema = z
  .object({
    payment: z.union([z.literal('failed'), z.array(z.literal('failed'))]).optional()
  })
  .strict()

export default async function PaymentPage({ params, searchParams }: PaymentPageProps) {
  const resolvedParams = await params
  const resolvedSearchParams = await searchParams

  const actor = await requireCheckoutActor()
  if (actor === null) {
    redirect('/member-login')
  }

  const parsedParams = paymentFormInputSchema.safeParse({
    orderId: resolvedParams.orderId
  })

  if (!parsedParams.success) {
    notFound()
  }

  const parsedSearch = paymentSearchSchema.safeParse({
    payment: resolvedSearchParams?.payment
  })
  const paymentFailed = parsedSearch.success && parsedSearch.data.payment === 'failed'

  const order = await getPaymentOrderForActor(parsedParams.data.orderId, actor)
  if (order === null) {
    notFound()
  }

  const canPay = order.status === 'PENDING_PAYMENT'
  const alreadyPaid =
    order.status === 'PROCESSING' || order.status === 'READY' || order.status === 'COMPLETED'

  let snapToken = order.midtransToken

  // Check if token has expired (older than 15 minutes) or is missing
  const TOKEN_EXPIRY_MS = 15 * 60 * 1000 // 15 minutes
  const isExpired =
    !order.midtransToken ||
    new Date().getTime() - new Date(order.createdAt).getTime() > TOKEN_EXPIRY_MS

  if (canPay && isExpired) {
    try {
      const midtransOrderId = `PVJ-${order.id}-${Date.now()}`
      const midtransItems: Array<{ id: string; price: number; quantity: number; name: string }> =
        order.items.map((item) => {
          const unitPrice = item.subtotal / item.quantity
          return {
            id: item.variant?.flavorName || 'Pisang',
            price: unitPrice,
            quantity: item.quantity,
            name: `${item.variant?.flavorName || 'Pisang'} (${item.baseType})`
          }
        })

      if (order.deliveryMethod === 'DELIVERY' && order.deliveryFee > 0) {
        midtransItems.push({
          id: 'delivery-fee',
          price: order.deliveryFee,
          quantity: 1,
          name: 'Ongkos Kirim'
        })
      }

      if (order.discountAmount > 0) {
        midtransItems.push({
          id: 'discount',
          price: -order.discountAmount,
          quantity: 1,
          name: order.voucherCode ? `Diskon (${order.voucherCode})` : 'Diskon Koin'
        })
      }

      const newSnapToken = await generateSnapToken({
        orderId: midtransOrderId,
        grossAmount: order.totalPrice,
        customerName: order.customerName,
        customerPhone: order.customerPhone,
        items: midtransItems
      })

      if (newSnapToken) {
        // Update order in database with the new token
        await prisma.order.update({
          where: { id: order.id },
          data: { midtransToken: newSnapToken }
        })

        // Upsert Payment record for webhook reconciliation
        await prisma.payment.upsert({
          where: { orderId: order.id },
          create: {
            orderId: order.id,
            midtransOrderId,
            grossAmount: new Prisma.Decimal(order.totalPrice),
            status: 'PENDING',
            currency: 'IDR'
          },
          update: {
            midtransOrderId,
            grossAmount: new Prisma.Decimal(order.totalPrice),
            status: 'PENDING'
          }
        })

        snapToken = newSnapToken
      }
    } catch (err) {
      console.error('[MIDTRANS] Failed to regenerate expired payment token:', err)
    }
  }

  return (
    <section className="min-h-screen bg-[var(--background-custom)] px-4 py-10 pb-32 md:pb-10 text-primary dark:text-zinc-100 transition-colors duration-300">
      <div className="mx-auto flex max-w-4xl flex-col gap-6">
        <Link
          href="/menu-spesial"
          className="inline-flex w-fit items-center gap-2 text-sm font-semibold text-brown-600 hover:text-brown-950 dark:text-zinc-300 dark:hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Kembali
        </Link>

        <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
          <div className="rounded-[4px] border border-cream-200/60 bg-white p-6 shadow-sbx-card dark:border-zinc-800 dark:bg-zinc-900">
            <div className="mb-6 flex items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-xs font-bold uppercase tracking-wider text-brown-400 dark:text-zinc-500">
                    Secure Checkout
                  </p>
                  {env.NEXT_PUBLIC_MIDTRANS_IS_PRODUCTION !== 'true' && (
                    <span className="px-2 py-0.5 rounded-[4px] bg-error-container text-on-error-container text-[10px] font-bold tracking-widest border border-error/20">
                      🔴 SANDBOX MODE
                    </span>
                  )}
                </div>
                <h1 className="mt-1 font-serif text-2xl font-bold text-brown-900 dark:text-zinc-100">
                  Pembayaran Pesanan
                </h1>
              </div>
              <div className="flex h-11 w-11 items-center justify-center rounded-[4px] bg-amber-brand/10 text-amber-brand">
                <CreditCard className="h-5 w-5" aria-hidden="true" />
              </div>
            </div>

            {paymentFailed && (
              <div className="mb-5 rounded-[4px] border border-error/20 bg-error-container px-4 py-3 text-sm font-medium text-on-error-container">
                Pembayaran tidak dapat diproses. Periksa status pesanan atau coba beberapa saat
                lagi.
              </div>
            )}

            {alreadyPaid && (
              <div className="mb-5 flex items-center gap-3 rounded-[4px] border border-green-200/60 bg-green-50 px-4 py-3 text-sm font-medium text-green-700 dark:border-green-900 dark:bg-green-950/40 dark:text-green-300">
                <CheckCircle2 className="h-5 w-5" aria-hidden="true" />
                Pembayaran pesanan ini sudah tercatat.
              </div>
            )}

            <div className="space-y-3">
              {order.items.map((item) => (
                <div
                  key={item.id}
                  className="flex items-start justify-between gap-4 border-b border-cream-100 pb-3 last:border-b-0 dark:border-zinc-800"
                >
                  <div>
                    <p className="text-sm font-bold text-brown-900 dark:text-zinc-100">
                      {item.quantity}x {item.variant.flavorName} ({item.baseType})
                    </p>
                    {item.toppings && item.toppings.length > 0 && (
                      <div className="mt-1 flex flex-wrap gap-1">
                        {item.toppings.map((t: any, idx: number) => (
                          <span
                            key={idx}
                            className="text-[11px] text-brown-500 dark:text-zinc-400 bg-cream-50 dark:bg-zinc-800/50 px-1.5 py-0.5 rounded-[4px] border border-cream-200/60 dark:border-zinc-800"
                          >
                            Topping: {t.emoji} {t.name}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <span className="text-sm font-semibold text-brown-900 dark:text-zinc-100">
                    {formatPrice(item.subtotal)}
                  </span>
                </div>
              ))}
            </div>

            <div className="mt-6 space-y-2 rounded-[4px] bg-cream-50 p-4 dark:bg-[var(--background-custom)]">
              {order.discountAmount > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-brown-500 dark:text-zinc-400">
                    Diskon {order.voucherCode}
                  </span>
                  <span className="font-semibold text-green-700 dark:text-green-400">
                    -{formatPrice(order.discountAmount)}
                  </span>
                </div>
              )}
              {order.deliveryMethod === 'DELIVERY' && order.deliveryFee > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-brown-500 dark:text-zinc-400">Ongkos Kirim</span>
                  <span className="font-semibold text-brown-900 dark:text-zinc-100">
                    {formatPrice(order.deliveryFee)}
                  </span>
                </div>
              )}
              <div className="flex justify-between border-t border-cream-200 pt-3 dark:border-zinc-800">
                <span className="font-bold text-brown-900 dark:text-zinc-100">Total</span>
                <span className="font-serif text-2xl font-bold text-amber-brand dark:text-amber-500">
                  {formatPrice(order.totalPrice)}
                </span>
              </div>
            </div>
          </div>

          <aside className="rounded-[4px] border border-cream-200/60 bg-white p-6 shadow-sbx-card dark:border-zinc-800 dark:bg-zinc-900">
            <div className="mb-5 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-[4px] bg-amber-brand/10 text-amber-brand dark:bg-amber-950 dark:text-amber-400">
                <ReceiptText className="h-5 w-5" aria-hidden="true" />
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-brown-400 dark:text-zinc-500">
                  Order
                </p>
                <p className="text-sm font-semibold text-brown-900 dark:text-zinc-100">
                  #{order.id.slice(-8)}
                </p>
              </div>
            </div>

            <div className="mb-5 space-y-2 text-sm">
              <div className="flex justify-between gap-4">
                <span className="text-brown-500 dark:text-zinc-400">Nama</span>
                <span className="text-right font-semibold text-brown-900 dark:text-zinc-100">
                  {order.customerName}
                </span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-brown-500 dark:text-zinc-400">Status</span>
                <span
                  className={`text-right text-xs font-bold px-2.5 py-1 rounded-[4px] ${
                    order.status === 'PROCESSING' ||
                    order.status === 'READY' ||
                    order.status === 'COMPLETED'
                      ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                      : order.status === 'PENDING_PAYMENT'
                        ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                        : order.status === 'CANCELED'
                          ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                          : 'bg-cream-100 text-brown-700 dark:bg-zinc-800 dark:text-zinc-300'
                  }`}
                >
                  {order.status === 'PENDING_PAYMENT'
                    ? 'Menunggu Pembayaran'
                    : order.status === 'PROCESSING'
                      ? 'Sedang Diproses'
                      : order.status === 'READY'
                        ? 'Siap Diambil / Dikirim'
                        : order.status === 'COMPLETED'
                          ? 'Selesai'
                          : order.status === 'CANCELED'
                            ? 'Dibatalkan'
                            : order.status}
                </span>
              </div>
            </div>

            {/* ETA Banner if Processing/Paid */}
            {(order.status === 'PROCESSING' || order.status === 'READY') &&
              order.deliveryMethod === 'DELIVERY' && (
                <div className="mb-5 flex items-center gap-3 rounded-[4px] border border-amber-200 bg-amber-50 p-3 text-sm font-semibold text-amber-700 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-400">
                  <span className="text-xl">⏱️</span>
                  <span>Estimasi tiba: 30-45 menit</span>
                </div>
              )}

            <div className="mb-5 flex items-start gap-3 rounded-[4px] border border-cream-200 bg-cream-50 p-3 text-xs text-brown-600 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300">
              <ShieldCheck
                className="mt-0.5 h-4 w-4 shrink-0 text-green-700 dark:text-green-400"
                aria-hidden="true"
              />
              <span>Pembayaran diproses dengan aman oleh Midtrans.</span>
            </div>

            {canPay ? (
              snapToken ? (
                <MidtransPayButton snapToken={snapToken} />
              ) : (
                <div className="w-full text-center p-3 text-sm text-rose-600 font-bold bg-rose-50 rounded-[4px] border border-rose-200">
                  Gagal membuat sesi pembayaran (Token Missing).
                </div>
              )
            ) : (
              <Link
                href="/track-order"
                className="flex w-full items-center justify-center gap-2 rounded-[4px] bg-brown-900 px-4 py-3.5 text-sm font-bold text-white transition-colors hover:bg-brown-800 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-200 active:scale-[0.98]"
              >
                <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                Lihat Riwayat Pesanan
              </Link>
            )}
          </aside>
        </div>
      </div>

      {/* Mobile Sticky Bottom Bar */}
      <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-cream-200 bg-white p-4 px-6 shadow-[0_-10px_40px_rgba(0,0,0,0.06)] dark:border-zinc-800 dark:bg-[var(--surface-custom)] md:hidden pb-safe">
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-xs font-semibold text-brown-500 dark:text-zinc-400">Total Tagihan</p>
            <p className="font-serif text-xl font-bold text-amber-brand dark:text-amber-500">
              {formatPrice(order.totalPrice)}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs font-semibold text-brown-500 dark:text-zinc-400">Order ID</p>
            <p className="text-sm font-bold text-brown-900 dark:text-zinc-100">
              #{order.id.slice(-8)}
            </p>
          </div>
        </div>
        {canPay ? (
          snapToken ? (
            <MidtransPayButton snapToken={snapToken} />
          ) : (
            <div className="w-full text-center p-3 text-sm text-rose-600 font-bold bg-rose-50 rounded-[4px] border border-rose-200">
              Gagal membuat sesi pembayaran (Token Missing).
            </div>
          )
        ) : (
          <Link
            href="/track-order"
            className="flex w-full items-center justify-center gap-2 rounded-[4px] bg-brown-900 px-4 py-3.5 text-sm font-bold text-white transition-colors hover:bg-brown-800 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-200 active:scale-[0.98]"
          >
            <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
            Lihat Riwayat Pesanan
          </Link>
        )}
      </div>
    </section>
  )
}

function formatPrice(amount: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0
  }).format(amount)
}
