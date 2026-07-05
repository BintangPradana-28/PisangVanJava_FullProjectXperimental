'use client'

import { motion } from 'framer-motion'
import { AlertCircle, Edit2, Info, PiggyBank, Plus, Trash2, Wallet } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { getUserBudgetStatus, updateMonthlyBudget } from '@/app/actions/orderHistory'
import OrderHistory from '@/components/user/OrderHistory'
import { useLanguage } from '@/context/LanguageContext'

export default function AnggaranPage() {
  const { t } = useLanguage()
  const [isLoading, setIsLoading] = useState(true)
  const [budget, setBudget] = useState<number | null>(null)
  const [spending, setSpending] = useState<number>(0)
  const [isEditing, setIsEditing] = useState(false)
  const [inputValue, setInputValue] = useState('')

  const fetchBudgetStatus = useCallback(async () => {
    setIsLoading(true)
    try {
      const res = await getUserBudgetStatus()
      if (res.success && res.data) {
        setBudget(res.data.monthlyBudget)
        setSpending(res.data.currentMonthSpending)
        if (res.data.monthlyBudget !== null) {
          setInputValue(res.data.monthlyBudget.toString())
        }
      } else {
        toast.error(res.error || t('budget_toast_error') || 'Gagal memuat status anggaran.')
      }
    } catch {
      toast.error('Terjadi kesalahan koneksi saat memuat data anggaran.')
    } finally {
      setIsLoading(false)
    }
  }, [t])

  useEffect(() => {
    fetchBudgetStatus()
  }, [fetchBudgetStatus])

  const handleSaveBudget = async () => {
    const val = Number.parseInt(inputValue.trim(), 10)
    if (Number.isNaN(val) || val <= 0) {
      toast.error('Masukkan nominal anggaran yang valid (angka positif)')
      return
    }

    try {
      const res = await updateMonthlyBudget(val)
      if (res.success) {
        toast.success(t('budget_toast_success') || 'Anggaran bulanan berhasil diperbarui')
        setBudget(val)
        setIsEditing(false)
        fetchBudgetStatus()
      } else {
        toast.error(res.error || t('budget_toast_error') || 'Gagal memperbarui anggaran')
      }
    } catch {
      toast.error('Gagal memperbarui anggaran. Coba lagi.')
    }
  }

  const handleRemoveBudget = async () => {
    if (!window.confirm(`${t('budget_remove_btn')}?`)) return

    try {
      const res = await updateMonthlyBudget(null)
      if (res.success) {
        toast.success(t('budget_toast_removed') || 'Anggaran bulanan berhasil dihapus')
        setBudget(null)
        setInputValue('')
        setIsEditing(false)
        fetchBudgetStatus()
      } else {
        toast.error(res.error || t('budget_toast_error') || 'Gagal memperbarui anggaran')
      }
    } catch {
      toast.error('Gagal menghapus anggaran. Coba lagi.')
    }
  }

  const formatPrice = (n: number) =>
    new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0
    }).format(n)

  // Calculate percentage & status
  const budgetPercentage = budget ? Math.min((spending / budget) * 100, 100) : 0
  const remaining = budget ? budget - spending : 0
  const isOverBudget = remaining < 0

  let progressColor = 'bg-emerald-500 dark:bg-emerald-400'
  if (budgetPercentage >= 70 && budgetPercentage < 100) {
    progressColor = 'bg-amber-500 dark:bg-amber-400'
  } else if (budgetPercentage >= 100 || isOverBudget) {
    progressColor = 'bg-rose-500 dark:bg-rose-400'
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      {/* Header */}
      <div className="flex items-center gap-4 bg-white dark:bg-zinc-900 rounded-[4px] p-6 shadow-sm border border-zinc-200/50 dark:border-zinc-800/80">
        <div className="w-12 h-12 rounded-[4px] bg-orange-50 dark:bg-orange-900/20 flex items-center justify-center">
          <Wallet className="w-6 h-6 text-[#D4802A]" />
        </div>
        <div>
          <h2 className="text-xl font-bold font-serif text-zinc-900 dark:text-zinc-100">
            {t('budget_title') || 'Budget & History'}
          </h2>
          <p className="text-sm text-zinc-500">
            {t('budget_subtitle') || 'Atur anggaran bulanan dan pantau riwayat belanja Anda'}
          </p>
        </div>
      </div>

      {/* Budget Card */}
      <div className="bg-white dark:bg-zinc-900 rounded-[4px] p-6 shadow-sm border border-zinc-200/50 dark:border-zinc-800/80 space-y-6">
        <div className="flex items-center justify-between">
          <h3 className="font-bold font-serif text-lg text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
            <PiggyBank className="w-5 h-5 text-zinc-400" />
            Kontrol Anggaran Bulanan
          </h3>
          {!isLoading && budget !== null && !isEditing && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsEditing(true)}
                className="inline-flex items-center gap-1.5 text-xs font-bold text-zinc-600 dark:text-zinc-400 hover:text-[#D4802A] dark:hover:text-amber-400 transition-colors px-3 py-1.5 border border-zinc-200 dark:border-zinc-800 rounded-[4px]"
              >
                <Edit2 className="w-3 h-3" />
                {t('budget_edit_btn') || 'Edit'}
              </button>
              <button
                type="button"
                onClick={handleRemoveBudget}
                className="inline-flex items-center gap-1.5 text-xs font-bold text-rose-600 hover:text-rose-700 transition-colors px-3 py-1.5 border border-rose-200 dark:border-rose-950 rounded-[4px]"
              >
                <Trash2 className="w-3 h-3" />
                {t('budget_remove_btn') || 'Hapus'}
              </button>
            </div>
          )}
        </div>

        {isLoading ? (
          <div className="space-y-3 animate-pulse">
            <div className="h-4 w-1/3 bg-zinc-100 dark:bg-zinc-800 rounded" />
            <div className="h-8 w-1/2 bg-zinc-100 dark:bg-zinc-800 rounded" />
            <div className="h-3 w-full bg-zinc-100 dark:bg-zinc-800 rounded" />
          </div>
        ) : budget === null ? (
          // Empty State Budget
          <div className="text-center py-6 border border-dashed border-zinc-200 dark:border-zinc-800 rounded-[4px]">
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-4">
              {t('budget_status_info') ||
                'Bantu diri Anda mengontrol pengeluaran belanja jajanan bulanan.'}
            </p>
            {isEditing ? (
              <div className="max-w-md mx-auto flex gap-2 px-4">
                <input
                  type="number"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  placeholder={t('budget_input_placeholder') || 'Nominal Anggaran'}
                  className="flex-1 px-3 py-2 text-sm border border-zinc-200 dark:border-zinc-850 bg-white dark:bg-zinc-950 rounded-[4px] focus:outline-none focus:border-[#D4802A]"
                />
                <button
                  type="button"
                  onClick={handleSaveBudget}
                  className="bg-[#D4802A] hover:bg-[#b56d24] text-white px-4 py-2 rounded-[4px] text-xs font-bold transition-all"
                >
                  {t('budget_save_btn') || 'Simpan'}
                </button>
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800 px-4 py-2 rounded-[4px] text-xs font-bold transition-all"
                >
                  {t('budget_cancel_btn') || 'Batal'}
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setIsEditing(true)}
                className="inline-flex items-center gap-2 bg-[#D4802A] hover:bg-[#b56d24] text-white px-5 py-2.5 rounded-[4px] text-xs font-bold transition-all shadow-md active:scale-95"
              >
                <Plus className="w-4 h-4" />
                {t('budget_set_btn') || 'Setel Anggaran'}
              </button>
            )}
          </div>
        ) : (
          // Active Budget Stats
          <div className="space-y-5">
            {isEditing ? (
              <div className="max-w-md flex gap-2">
                <input
                  type="number"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  placeholder="Nominal Anggaran"
                  className="flex-1 px-3 py-2 text-sm border border-zinc-200 dark:border-zinc-850 bg-white dark:bg-zinc-950 rounded-[4px] focus:outline-none focus:border-[#D4802A]"
                />
                <button
                  type="button"
                  onClick={handleSaveBudget}
                  className="bg-[#D4802A] hover:bg-[#b56d24] text-white px-4 py-2 rounded-[4px] text-xs font-bold transition-all"
                >
                  {t('budget_save_btn') || 'Simpan'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsEditing(false)
                    setInputValue(budget.toString())
                  }}
                  className="border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800 px-4 py-2 rounded-[4px] text-xs font-bold transition-all"
                >
                  {t('budget_cancel_btn') || 'Batal'}
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-zinc-500 font-medium">
                    {t('budget_limit_label') || 'Anggaran Bulanan Anda'}
                  </p>
                  <p className="text-2xl font-bold text-zinc-950 dark:text-white mt-1">
                    {formatPrice(budget)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-zinc-500 font-medium">
                    {t('budget_spent_label') || 'Telah Dibelanjakan'}
                  </p>
                  <p className="text-2xl font-bold text-zinc-950 dark:text-white mt-1">
                    {formatPrice(spending)}
                  </p>
                </div>
              </div>
            )}

            {/* Progress Bar */}
            <div className="space-y-2">
              <div className="h-3 w-full bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${budgetPercentage}%` }}
                  transition={{ duration: 0.5, ease: 'easeOut' }}
                  className={`h-full rounded-full ${progressColor}`}
                />
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-zinc-500 font-medium">
                  {budgetPercentage.toFixed(0)}% Terpakai
                </span>
                <span
                  className={`font-semibold ${isOverBudget ? 'text-rose-600 dark:text-rose-400' : 'text-zinc-700 dark:text-zinc-300'}`}
                >
                  {isOverBudget
                    ? `${t('budget_over_label') || 'Melebihi Anggaran'} ${formatPrice(Math.abs(remaining))}`
                    : `${t('budget_remaining_label') || 'Sisa Anggaran'} ${formatPrice(remaining)}`}
                </span>
              </div>
            </div>

            {/* Warning banner */}
            {isOverBudget && (
              <div className="flex items-start gap-3 p-4 bg-rose-50 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/50 rounded-[4px]">
                <AlertCircle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-bold text-rose-800 dark:text-rose-400">
                    Batas Anggaran Terlewati
                  </p>
                  <p className="text-xs text-rose-700 dark:text-rose-400/80 mt-1">
                    Anda telah membelanjakan melebihi anggaran bulanan yang ditentukan.
                    Pertimbangkan untuk membatasi pengeluaran Anda berikutnya.
                  </p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* History Card */}
      <div className="bg-white dark:bg-zinc-900 rounded-[4px] p-6 shadow-sm border border-zinc-200/50 dark:border-zinc-800/80 space-y-6">
        <h3 className="font-bold font-serif text-lg text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
          <Info className="w-5 h-5 text-zinc-400" />
          Riwayat Pembelian & Pembatalan
        </h3>

        {/* Render modular OrderHistory component */}
        <OrderHistory useAuth={true} />
      </div>
    </motion.div>
  )
}
