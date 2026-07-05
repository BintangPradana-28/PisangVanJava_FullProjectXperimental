'use client'

import { motion } from 'framer-motion'
import { ChevronRight, Clock, Coins, Ticket } from 'lucide-react'
import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { useLanguage } from '@/context/LanguageContext'

interface VoucherData {
  id: string
  code: string
  discountType: string
  discountValue: number
  minPurchase: number
  maxDiscount: number | null
  endDate: Date
}

interface KoinLogData {
  id: string
  amount: number
  description: string
  createdAt: string
}

export default function VoucherClient({
  koinPisang,
  vouchers,
  koinLogs = []
}: {
  koinPisang: number
  vouchers: VoucherData[]
  koinLogs?: KoinLogData[]
}) {
  const { t } = useLanguage()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const formatPrice = (n: number) =>
    new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0
    }).format(n)

  const formatDate = (d: Date) => {
    if (!mounted) return ''
    return new Intl.DateTimeFormat('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    }).format(new Date(d))
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      {/* ── Koin Pisang ── */}
      <section className="bg-gradient-to-br from-amber-400 to-amber-600 rounded-[4px] p-6 md:p-8 shadow-sm shadow-amber-200 dark:shadow-none text-white relative overflow-hidden">
        <div className="absolute top-0 right-0 -mr-8 -mt-8 w-40 h-40 bg-white/20 rounded-[4px] blur-3xl" />
        <div className="absolute bottom-0 left-0 -ml-8 -mb-8 w-32 h-32 bg-amber-800/20 rounded-[4px] blur-2xl" />

        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-[4px] bg-white/20 flex items-center justify-center backdrop-blur-md border border-white/30 shadow-inner">
              <span className="text-4xl">🪙</span>
            </div>
            <div>
              <h2 className="text-white/90 text-sm font-bold uppercase tracking-wider mb-1">
                {t('voucher_points_title')}
              </h2>
              <p className="text-3xl md:text-4xl font-black drop-shadow-md">
                {formatPrice(koinPisang)}
              </p>
            </div>
          </div>

          <div className="bg-black/10 backdrop-blur-sm border border-white/20 rounded-[4px] p-4 w-full md:w-auto">
            <p className="text-sm text-white/90 font-medium">✨ {t('voucher_points_desc')}</p>
            <p className="text-xs text-white/70 mt-1">{t('voucher_points_info')}</p>
          </div>
        </div>
      </section>

      {/* ── Histori Transaksi Koin ── */}
      <section className="bg-white dark:bg-zinc-900 rounded-[4px] p-6 md:p-8 shadow-sm border border-zinc-200/50 dark:border-zinc-800/80">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-[4px] bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
            <Coins className="w-5 h-5 text-amber-600 dark:text-amber-400" />
          </div>
          <div>
            <h2 className="text-xl font-bold font-serif text-zinc-900 dark:text-zinc-100">
              {t('voucher_history_title')}
            </h2>
            <p className="text-xs text-zinc-500">{t('voucher_history_subtitle')}</p>
          </div>
        </div>

        {koinLogs.length === 0 ? (
          <div className="text-center py-8 text-zinc-500 text-sm">{t('voucher_history_empty')}</div>
        ) : (
          <div className="divide-y divide-zinc-100 dark:divide-zinc-800 max-h-80 overflow-y-auto pr-2 space-y-3">
            {koinLogs.map((log) => {
              const isPositive = log.amount >= 0
              return (
                <div
                  key={log.id}
                  className="flex justify-between items-center py-3 first:pt-0 last:pb-0"
                >
                  <div className="flex flex-col">
                    <span className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
                      {log.description}
                    </span>
                    <span className="text-xs text-zinc-400">
                      {mounted
                        ? new Intl.DateTimeFormat('id-ID', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          }).format(new Date(log.createdAt))
                        : ''}
                    </span>
                  </div>
                  <span
                    className={`text-sm font-bold ${
                      isPositive
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-rose-600 dark:text-rose-400'
                    }`}
                  >
                    {isPositive ? '+' : ''}
                    {new Intl.NumberFormat('id-ID').format(log.amount)}
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </section>

      {/* ── Daftar Voucher ── */}
      <section className="bg-white dark:bg-zinc-900 rounded-[4px] p-6 md:p-8 shadow-sm border border-zinc-200/50 dark:border-zinc-800/80">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-[4px] bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
            <Ticket className="w-5 h-5 text-green-600 dark:text-green-400" />
          </div>
          <div>
            <h2 className="text-xl font-bold font-serif text-zinc-900 dark:text-zinc-100">
              {t('voucher_available_title')}
            </h2>
            <p className="text-xs text-zinc-500">{t('voucher_available_subtitle')}</p>
          </div>
        </div>

        {vouchers.length === 0 ? (
          <div className="flex flex-col items-center justify-center text-center py-12 px-4 border-2 border-dashed border-zinc-200 dark:border-zinc-800 rounded-[4px]">
            <Ticket className="w-12 h-12 text-zinc-300 dark:text-zinc-700 mb-3" />
            <p className="text-zinc-500 font-medium">{t('voucher_available_empty')}</p>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 gap-4">
            {vouchers.map((v, i) => (
              <motion.div
                key={v.id}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.05 }}
                className="group relative bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700/50 rounded-[4px] p-5 hover:border-amber-400 dark:hover:border-amber-500 transition-all overflow-hidden"
              >
                {/* Visual perforations */}
                <div className="absolute top-1/2 -translate-y-1/2 -left-2 w-4 h-4 bg-white dark:bg-zinc-900 rounded-[4px] border-r border-zinc-200 dark:border-zinc-700/50" />
                <div className="absolute top-1/2 -translate-y-1/2 -right-2 w-4 h-4 bg-white dark:bg-zinc-900 rounded-[4px] border-l border-zinc-200 dark:border-zinc-700/50" />

                <div className="flex justify-between items-start mb-3">
                  <div className="bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-400 text-xs font-black uppercase tracking-widest px-3 py-1 rounded-lg border border-amber-200 dark:border-amber-800 font-mono">
                    {v.code}
                  </div>
                  <div className="flex items-center gap-1 text-[10px] font-bold text-zinc-400 uppercase bg-zinc-100 dark:bg-zinc-800 px-2 py-1 rounded-[4px]">
                    <Clock className="w-3 h-3" />
                    Batas: {formatDate(v.endDate)}
                  </div>
                </div>

                <div className="mb-4">
                  <h3 className="text-lg font-black text-zinc-800 dark:text-zinc-100 mb-1">
                    Diskon{' '}
                    {v.discountType === 'PERCENTAGE'
                      ? `${v.discountValue}%`
                      : formatPrice(v.discountValue)}
                  </h3>
                  {v.discountType === 'PERCENTAGE' && v.maxDiscount && (
                    <p className="text-xs text-zinc-500">
                      {t('voucher_max_discount')} {formatPrice(v.maxDiscount)}
                    </p>
                  )}
                  <p className="text-xs text-zinc-500 mt-1">
                    {t('voucher_min_purchase')} {formatPrice(v.minPurchase)}
                  </p>
                </div>

                <div className="pt-3 border-t border-dashed border-zinc-300 dark:border-zinc-700 flex justify-end">
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(v.code)
                      toast.success(
                        t('voucher_copied_alert')?.replace('{code}', v.code) ||
                          `Voucher ${v.code} copied!`
                      )
                    }}
                    className="text-xs font-bold text-amber-600 dark:text-amber-500 hover:text-amber-700 flex items-center gap-1"
                  >
                    {t('voucher_copy_btn')} <ChevronRight className="w-3 h-3" />
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </section>
    </motion.div>
  )
}
