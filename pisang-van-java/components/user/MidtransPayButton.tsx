'use client'

import { env } from '@/src/env'
import { CreditCard, Loader2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

interface Props {
  snapToken: string
}

export default function MidtransPayButton({ snapToken }: Props) {
  const router = useRouter()
  const [isReady, setIsReady] = useState(false)
  const [isPaying, setIsPaying] = useState(false)
  const [hasError, setHasError] = useState(false)

  useEffect(() => {
    // Load Midtrans Snap script
    const isProduction = env.NEXT_PUBLIC_MIDTRANS_IS_PRODUCTION === 'true'
    const scriptUrl = isProduction
      ? 'https://app.midtrans.com/snap/snap.js'
      : 'https://app.sandbox.midtrans.com/snap/snap.js'

    // We need to pass the client key from env, but since it's client-side, we must use NEXT_PUBLIC_
    // However, Midtrans Snap token generation is done server-side. For the frontend snap.js script,
    // Midtrans actually uses `data-client-key` attribute.
    const clientKey = env.NEXT_PUBLIC_MIDTRANS_CLIENT_KEY || ''

    if (window.snap) {
      setIsReady(true)
      return
    }

    // In React Strict Mode, useEffect runs twice. If we append and then immediately remove the script,
    // the browser aborts the fetch and fires onerror. To prevent this, we check if it already exists
    // and we DON'T remove it on cleanup.
    let script = document.querySelector(`script[src="${scriptUrl}"]`) as HTMLScriptElement

    if (!script) {
      script = document.createElement('script')
      script.src = scriptUrl
      script.setAttribute('data-client-key', clientKey)
      document.body.appendChild(script)
    }

    const handleLoad = () => setIsReady(true)
    const handleError = () => setHasError(true)

    script.addEventListener('load', handleLoad)
    script.addEventListener('error', handleError)

    return () => {
      script.removeEventListener('load', handleLoad)
      script.removeEventListener('error', handleError)
    }
  }, [])

  const handlePay = () => {
    if (!isReady || !window.snap) return
    window.navigator.vibrate?.(50) // Haptic feedback
    setIsPaying(true)

    // Defer the heavy Midtrans iframe load to the next event loop tick
    // This allows React to complete the paint of 'isPaying' state (loading spinner)
    // reducing the Interaction to Next Paint (INP) latency significantly.
    setTimeout(() => {
      if (!window.snap) {
        setIsPaying(false)
        return
      }
      window.snap.pay(snapToken, {
        onSuccess: (result: MidtransResult) => {
          setIsPaying(false)
          router.push('/thanks')
        },
        onPending: (result: MidtransResult) => {
          setIsPaying(false)
          router.push('/thanks')
        },
        onError: (result: MidtransResult) => {
          setIsPaying(false)
          console.error('Payment failed', result)
        },
        onClose: () => {
          setIsPaying(false)
        }
      })
    }, 50)
  }

  if (hasError) {
    return (
      <div className="w-full text-center p-3 border border-red-200 bg-red-50 text-red-600 rounded-[4px] text-sm shadow-sm">
        <p className="font-bold flex items-center justify-center gap-2">
          <span className="text-lg">⚠️</span> Sistem Pembayaran Terblokir
        </p>
        <p className="text-xs mt-1 mb-2">
          Harap matikan Adblocker (seperti Adblock Plus) di browser Anda untuk melanjutkan
          pembayaran.
        </p>
        <button
          onClick={() => window.location.reload()}
          className="text-xs font-bold underline text-red-700 hover:text-red-800"
        >
          Muat Ulang Halaman
        </button>
      </div>
    )
  }

  return (
    <button
      onClick={handlePay}
      disabled={!isReady || isPaying}
      className="flex w-full items-center justify-center gap-2 rounded-[4px] bg-amber-brand px-4 py-3.5 text-sm font-bold text-white transition-all hover:bg-amber-600 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]"
    >
      {isPaying ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin" /> Membuka Pembayaran...
        </>
      ) : (
        <>
          <CreditCard className="h-4 w-4" aria-hidden="true" />{' '}
          {isReady ? 'Bayar Sekarang' : 'Memuat Sistem...'}
        </>
      )}
    </button>
  )
}

interface MidtransResult {
  transaction_id: string
  order_id: string
  gross_amount: string
  payment_type: string
  transaction_status: string
  status_code: string
  status_message: string
  [key: string]: unknown
}

interface Snap {
  pay: (
    token: string,
    options: {
      onSuccess?: (result: MidtransResult) => void
      onPending?: (result: MidtransResult) => void
      onError?: (result: MidtransResult) => void
      onClose?: () => void
    }
  ) => void
}

// Add strict TypeScript definition for window.snap
declare global {
  interface Window {
    snap?: Snap
  }
}
