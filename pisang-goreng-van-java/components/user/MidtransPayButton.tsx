'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { CreditCard, Loader2 } from 'lucide-react'

interface Props {
  snapToken: string;
}

export default function MidtransPayButton({ snapToken }: Props) {
  const router = useRouter()
  const [isReady, setIsReady] = useState(false)
  const [isPaying, setIsPaying] = useState(false)

  useEffect(() => {
    // Load Midtrans Snap script
    const isProduction = process.env.NEXT_PUBLIC_MIDTRANS_IS_PRODUCTION === 'true'
    const scriptUrl = isProduction 
      ? 'https://app.midtrans.com/snap/snap.js'
      : 'https://app.sandbox.midtrans.com/snap/snap.js'
    
    // We need to pass the client key from env, but since it's client-side, we must use NEXT_PUBLIC_
    // However, Midtrans Snap token generation is done server-side. For the frontend snap.js script,
    // Midtrans actually uses `data-client-key` attribute.
    const clientKey = process.env.NEXT_PUBLIC_MIDTRANS_CLIENT_KEY || ''
    
    const script = document.createElement('script')
    script.src = scriptUrl
    script.setAttribute('data-client-key', clientKey)
    script.onload = () => setIsReady(true)
    document.body.appendChild(script)

    return () => {
      document.body.removeChild(script)
    }
  }, [])

  const handlePay = () => {
    if (!isReady || !window.snap) return
    setIsPaying(true)

    window.snap.pay(snapToken, {
      onSuccess: function(result: any) {
        setIsPaying(false)
        router.push('/profile')
      },
      onPending: function(result: any) {
        setIsPaying(false)
        router.push('/profile')
      },
      onError: function(result: any) {
        setIsPaying(false)
        console.error('Payment failed', result)
      },
      onClose: function() {
        setIsPaying(false)
      }
    })
  }

  return (
    <button
      onClick={handlePay}
      disabled={!isReady || isPaying}
      className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#D4802A] px-4 py-3 text-sm font-bold text-white transition-colors hover:bg-[#b56d24] shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {isPaying ? (
        <><Loader2 className="h-4 w-4 animate-spin" /> Membuka Pembayaran...</>
      ) : (
        <><CreditCard className="h-4 w-4" aria-hidden="true" /> Bayar Sekarang</>
      )}
    </button>
  )
}

// Add TypeScript definition for window.snap
declare global {
  interface Window {
    snap: any;
  }
}
