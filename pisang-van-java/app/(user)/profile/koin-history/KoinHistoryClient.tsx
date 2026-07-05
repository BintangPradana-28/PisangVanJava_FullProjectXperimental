'use client'

import { ArrowLeft, Clock, Coins, Gift } from 'lucide-react'
import { useRouter } from 'next/navigation'

interface KoinLog {
  id: string
  amount: number
  description: string
  createdAt: Date | string
}

export default function KoinHistoryClient({ logs }: { logs: KoinLog[] }) {
  const router = useRouter()

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center gap-4">
        <button
          onClick={() => router.push('/profile')}
          className="p-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-[4px] hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-400 transition-colors"
          title="Kembali"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div>
          <h1 className="text-xl font-bold font-serif text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
            <Coins className="w-5 h-5 text-amber-500" />
            Riwayat Koin Pisang
          </h1>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
            Daftar transaksi perolehan dan penukaran Koin Pisang Anda.
          </p>
        </div>
      </div>

      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-[4px] shadow-sm overflow-hidden">
        {logs.length === 0 ? (
          <div className="p-16 text-center text-zinc-400">
            <Gift className="w-12 h-12 mx-auto mb-3 opacity-30 text-amber-500" />
            <p className="font-semibold text-sm">Belum ada riwayat transaksi koin</p>
            <p className="text-xs mt-1">
              Lakukan transaksi belanja pertama Anda untuk mengumpulkan koin.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {logs.map((log) => {
              const isPositive = log.amount > 0
              const dateStr = new Date(log.createdAt).toLocaleDateString('id-ID', {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              })

              return (
                <div
                  key={log.id}
                  className="p-4 flex items-center justify-between hover:bg-zinc-50 dark:hover:bg-zinc-800/30 transition-colors"
                >
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
                      {log.description}
                    </p>
                    <p className="text-xs text-zinc-400 flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" />
                      {dateStr}
                    </p>
                  </div>
                  <div
                    className={`text-base font-bold shrink-0 ${isPositive ? 'text-green-600 dark:text-green-400' : 'text-red-500 dark:text-red-400'}`}
                  >
                    {isPositive ? `+${log.amount}` : log.amount}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
