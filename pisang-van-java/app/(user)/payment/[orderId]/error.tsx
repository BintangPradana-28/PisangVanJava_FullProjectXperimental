'use client'

import * as Sentry from '@sentry/nextjs'
import { ClipboardList, CreditCard, RefreshCw } from 'lucide-react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useEffect } from 'react'
import { Button } from '@/components/ui/button'

interface PaymentErrorProps {
  error: Error & { digest?: string }
  reset: () => void
}

export default function PaymentError({ error, reset }: PaymentErrorProps) {
  // Graceful fallback mechanism to prevent infinite React Error loops
  const handleRecover = () => {
    reset()
    // Fallback: If React reset fails to clear the cache/error state, force a hard document reload
    setTimeout(() => {
      window.location.reload()
    }, 800)
  }
  const params = useParams()
  const orderId = typeof params?.orderId === 'string' ? params.orderId : null

  useEffect(() => {
    Sentry.captureException(error, {
      tags: {
        boundary: 'payment',
        digest: error.digest ?? 'unknown'
      },
      extra: {
        orderId: orderId ?? 'unknown',
        hasDigest: !!error.digest
      }
    })
  }, [error, orderId])

  return (
    <div className="min-h-screen bg-[var(--background-custom)] flex items-center justify-center px-4 text-primary dark:text-zinc-100 transition-colors duration-300">
      <div className="w-full max-w-md bg-white rounded-[4px] shadow-sbx-card border border-cream-200/60 p-8 text-center dark:bg-zinc-900 dark:border-zinc-800">
        <div className="w-16 h-16 bg-amber-brand/10 rounded-[4px] flex items-center justify-center mx-auto mb-6">
          <CreditCard className="w-8 h-8 text-amber-brand" />
        </div>

        <h1 className="text-xl font-serif font-bold text-brown-900 dark:text-zinc-100 mb-2">
          Halaman Pembayaran Gagal Dimuat
        </h1>

        <div className="bg-green-50 border border-green-200/60 rounded-[4px] px-4 py-3 mb-4 dark:bg-green-950/20 dark:border-green-900">
          <p className="text-green-800 text-sm font-semibold dark:text-green-400">
            ✅ Pesanan Anda sudah berhasil dibuat
          </p>
          <p className="text-green-700 text-xs mt-1 dark:text-green-500">
            Data pesanan aman tersimpan di sistem kami. Anda bisa melanjutkan pembayaran dari
            halaman pesanan.
          </p>
        </div>

        <p className="text-brown-600 dark:text-zinc-400 text-sm mb-6">
          Terjadi gangguan saat memuat gateway pembayaran. Silakan coba lagi atau bayar melalui
          halaman pesanan Anda.
        </p>

        {error.digest && (
          <p className="text-xs text-brown-400 font-mono mb-6 dark:text-zinc-500">
            Kode error: {error.digest}
          </p>
        )}

        <div className="flex flex-col gap-3">
          <Button
            onClick={handleRecover}
            className="w-full bg-amber-brand hover:bg-amber-600 text-white rounded-[4px] py-3 font-semibold flex items-center justify-center gap-2 shadow-sm"
          >
            <RefreshCw className="w-4 h-4" />
            Muat Ulang Pembayaran
          </Button>

          <Button
            asChild
            variant="outline"
            className="w-full rounded-[4px] py-3 font-semibold flex items-center justify-center gap-2 border-cream-200 text-brown-700 hover:bg-cream-50 dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            <Link
              href={orderId ? `/profile?tab=orders&highlight=${orderId}` : '/profile?tab=orders'}
            >
              <ClipboardList className="w-4 h-4" />
              Lihat Status Pesanan
            </Link>
          </Button>

          <p className="text-xs text-brown-400 mt-2 dark:text-zinc-500">
            Perlu bantuan?{' '}
            <a
              href={`https://wa.me/6281234567890?text=Halo%2C%20saya%20butuh%20bantuan%20pembayaran%20pesanan%20${
                orderId ?? ''
              }`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-amber-brand font-bold underline hover:text-amber-600"
            >
              Chat CS kami
            </a>
          </p>
        </div>
      </div>
    </div>
  )
}
