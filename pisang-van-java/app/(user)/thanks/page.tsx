'use client'

import { CheckCircle2, Home } from 'lucide-react'
import Link from 'next/link'
import ConfettiCanvas from '@/components/user/ConfettiCanvas'
import { useLanguage } from '@/context/LanguageContext'

export default function ThanksPage() {
  const { t } = useLanguage()

  return (
    <section className="min-h-[80vh] flex flex-col items-center justify-center bg-zinc-50 px-4 py-10 dark:bg-zinc-950">
      <ConfettiCanvas />
      <div className="w-full max-w-md rounded-[4px] bg-white p-8 text-center shadow-sm dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800">
        <div className="mx-auto mb-6 flex h-24 w-24 items-center justify-center rounded-[4px] bg-green-100 dark:bg-green-900/30">
          <CheckCircle2
            className="h-12 w-12 text-green-600 dark:text-green-400"
            aria-hidden="true"
          />
        </div>

        <h1 className="mb-2 font-serif text-3xl font-bold text-zinc-950 dark:text-white">
          {t('thanks_title') || 'Pembayaran Berhasil! 🎉'}
        </h1>

        <p className="mb-8 text-zinc-500 dark:text-zinc-400 text-sm">
          {t('thanks_desc') || 'Terima kasih telah melakukan pembayaran pesanan Anda. Kami sedang memprosesnya!'}
        </p>

        <div className="flex flex-col gap-3">
          <Link
            href="/"
            className="flex w-full items-center justify-center gap-2 rounded-[4px] bg-[#D4802A] px-4 py-3.5 text-sm font-bold text-white transition-colors hover:bg-amber-600 shadow-md active:scale-[0.98]"
          >
            <Home className="h-4 w-4" aria-hidden="true" />
            {t('thanks_btn_home') || 'Kembali ke Beranda'}
          </Link>

          <Link
            href="/track-order"
            className="flex w-full items-center justify-center gap-2 rounded-[4px] bg-zinc-100 px-4 py-3.5 text-sm font-bold text-zinc-700 transition-colors hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700 active:scale-[0.98]"
          >
            {t('thanks_btn_track') || 'Pantau Status Pesanan'}
          </Link>
        </div>
      </div>
    </section>
  )
}
