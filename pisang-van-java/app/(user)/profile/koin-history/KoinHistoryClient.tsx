'use client'

import { ArrowLeft, ChevronLeft, ChevronRight, Clock, Coins, Gift } from 'lucide-react'
import { useRouter } from 'next/navigation'

interface KoinLog {
  id: string
  amount: number
  description: string
  createdAt: Date | string
}

interface KoinHistoryClientProps {
  logs: KoinLog[]
  page: number
  limit: number
  totalCount: number
}

export default function KoinHistoryClient({
  logs,
  page,
  limit,
  totalCount
}: KoinHistoryClientProps) {
  const router = useRouter()
  const totalPages = Math.ceil(totalCount / limit)

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

        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-zinc-100 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-4 py-3 sm:px-6">
            <div className="flex flex-1 justify-between sm:hidden">
              <button
                type="button"
                onClick={() => router.push(`?page=${page - 1}`)}
                disabled={page <= 1}
                className="relative inline-flex items-center rounded-md border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-4 py-2 text-xs font-bold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-55 dark:hover:bg-zinc-800 disabled:opacity-50"
              >
                Sebelumnya
              </button>
              <button
                type="button"
                onClick={() => router.push(`?page=${page + 1}`)}
                disabled={page >= totalPages}
                className="relative ml-3 inline-flex items-center rounded-md border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-4 py-2 text-xs font-bold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-55 dark:hover:bg-zinc-800 disabled:opacity-50"
              >
                Selanjutnya
              </button>
            </div>
            <div className="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
              <div>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  Menampilkan{' '}
                  <span className="font-semibold">
                    {Math.min(totalCount, (page - 1) * limit + 1)}
                  </span>{' '}
                  sampai <span className="font-semibold">{Math.min(totalCount, page * limit)}</span>{' '}
                  dari <span className="font-semibold">{totalCount}</span> transaksi
                </p>
              </div>
              <div>
                <nav
                  className="isolate inline-flex -space-x-px rounded-md shadow-sm"
                  aria-label="Pagination"
                >
                  <button
                    type="button"
                    onClick={() => router.push(`?page=${page - 1}`)}
                    disabled={page <= 1}
                    className="relative inline-flex items-center rounded-l-md px-2 py-2 text-zinc-400 dark:text-zinc-500 ring-1 ring-inset ring-zinc-200 dark:ring-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-850 focus:z-20 focus:outline-offset-0 disabled:opacity-50"
                  >
                    <span className="sr-only">Previous</span>
                    <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                  </button>
                  <span className="relative inline-flex items-center px-4 py-2 text-xs font-semibold text-zinc-900 dark:text-zinc-100 ring-1 ring-inset ring-zinc-200 dark:ring-zinc-800 focus:outline-none">
                    Halaman {page} dari {totalPages}
                  </span>
                  <button
                    type="button"
                    onClick={() => router.push(`?page=${page + 1}`)}
                    disabled={page >= totalPages}
                    className="relative inline-flex items-center rounded-r-md px-2 py-2 text-zinc-400 dark:text-zinc-500 ring-1 ring-inset ring-zinc-200 dark:ring-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-850 focus:z-20 focus:outline-offset-0 disabled:opacity-50"
                  >
                    <span className="sr-only">Next</span>
                    <ChevronRight className="h-4 w-4" aria-hidden="true" />
                  </button>
                </nav>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
