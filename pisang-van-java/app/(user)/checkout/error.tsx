'use client'

import * as Sentry from '@sentry/nextjs'
import { ArrowLeft, RefreshCw, ShoppingCart } from 'lucide-react'
import Link from 'next/link'
import { useEffect } from 'react'
import { Button } from '@/components/ui/button'

interface CheckoutErrorProps {
  error: Error & { digest?: string }
  reset: () => void
}

export default function CheckoutError({ error, reset }: CheckoutErrorProps) {
  // Graceful fallback mechanism to prevent infinite React Error loops
  const handleRecover = () => {
    reset()
    // Fallback: If React reset fails to clear the cache/error state, force a hard document reload
    setTimeout(() => {
      window.location.reload()
    }, 800)
  }
  useEffect(() => {
    Sentry.captureException(error, {
      tags: {
        boundary: 'checkout',
        digest: error.digest ?? 'unknown'
      },
      extra: {
        hasDigest: !!error.digest
      }
    })
  }, [error])

  return (
    <div className="min-h-screen bg-[#FAF7F2] flex items-center justify-center px-4">
      <div className="w-full max-w-md bg-white rounded-[4px] shadow-sm border border-gray-100 p-8 text-center">
        <div className="w-16 h-16 bg-amber-50 rounded-[4px] flex items-center justify-center mx-auto mb-6">
          <ShoppingCart className="w-8 h-8 text-amber-500" />
        </div>

        <h1 className="text-xl font-semibold text-gray-900 mb-2">Proses Checkout Terganggu</h1>

        <p className="text-gray-500 text-sm leading-relaxed mb-2">
          Maaf, ada gangguan saat memproses pesanan Anda.
        </p>
        <p className="text-amber-700 text-sm font-medium bg-amber-50 rounded-lg px-4 py-2 mb-6">
          🛒 Keranjang Anda masih aman dan belum berubah.
        </p>

        {error.digest && (
          <p className="text-xs text-gray-400 font-mono mb-6">Kode error: {error.digest}</p>
        )}

        <div className="flex flex-col gap-3">
          <Button
            onClick={handleRecover}
            className="w-full bg-amber-500 hover:bg-amber-600 text-white rounded-[4px] py-3 font-medium flex items-center justify-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            Coba Lagi
          </Button>

          <Button
            asChild
            variant="outline"
            className="w-full rounded-[4px] py-3 font-medium flex items-center justify-center gap-2 border-gray-200 text-gray-700"
          >
            <Link href="/keranjang">
              <ArrowLeft className="w-4 h-4" />
              Kembali ke Keranjang
            </Link>
          </Button>

          <p className="text-xs text-gray-400 mt-2">
            Masalah berlanjut?{' '}
            <a
              href="https://wa.me/6285773728748?text=Halo%2C%20saya%20mengalami%20masalah%20saat%20checkout"
              target="_blank"
              rel="noopener noreferrer"
              className="text-amber-600 underline"
            >
              Hubungi kami via WhatsApp
            </a>
          </p>
        </div>
      </div>
    </div>
  )
}
