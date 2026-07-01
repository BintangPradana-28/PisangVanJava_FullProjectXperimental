'use client'

import { CheckCircle, Copy, Gift, Loader2, Users } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { applyReferralCode, generateMyReferralCode, getReferralStats } from '@/app/actions/referral'

export default function ReferralPage() {
  const [stats, setStats] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [referralInput, setReferralInput] = useState('')
  const [isApplying, setIsApplying] = useState(false)

  const fetchStats = useCallback(async () => {
    try {
      const data = await getReferralStats()
      setStats(data)
    } catch (error: any) {
      toast.error(error.message || 'Gagal memuat data referral.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    if (!cancelled) {
      fetchStats()
    }
    return () => {
      cancelled = true
    }
  }, [fetchStats])

  const handleGenerateCode = async () => {
    try {
      const res = await generateMyReferralCode()
      if (res.code) {
        toast.success('Kode referral berhasil dibuat!')
        await fetchStats()
      }
    } catch (error: any) {
      toast.error(error.message)
    }
  }

  const handleApplyCode = async () => {
    if (!referralInput) return
    try {
      setIsApplying(true)
      const formData = new FormData()
      formData.append('code', referralInput)
      const res = await applyReferralCode(formData)
      if (res.success) {
        toast.success(res.message)
        setReferralInput('')
      }
    } catch (error: any) {
      toast.error(error.message)
    } finally {
      setIsApplying(false)
    }
  }

  const copyToClipboard = () => {
    if (!stats?.myCode) return
    navigator.clipboard.writeText(stats.myCode)
    toast.success('Kode disalin ke clipboard!')
  }

  if (loading) {
    return (
      <div className="h-64 flex flex-col items-center justify-center space-y-4">
        <Loader2 className="w-8 h-8 animate-spin text-[#D4802A]" />
        <span className="text-zinc-500 font-medium">Memuat data referral...</span>
      </div>
    )
  }

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div>
        <h1 className="text-2xl font-bold font-serif text-zinc-900 dark:text-zinc-100 flex items-center gap-3">
          <Gift className="w-7 h-7 text-[#D4802A]" />
          Ajak Teman
        </h1>
        <p className="text-zinc-500 dark:text-zinc-400 mt-1">
          Dapatkan 5.000 Koin Pisang untuk setiap teman yang mendaftar dan menyelesaikan pesanan
          pertama mereka.
        </p>
      </div>

      {/* Box Kode Sendiri */}
      <div className="bg-gradient-to-r from-[#D4802A] to-[#b56d24] rounded-[4px] p-6 md:p-8 text-white shadow-sm relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white opacity-5 rounded-[4px] blur-3xl -translate-y-1/2 translate-x-1/4"></div>
        <div className="relative flex flex-col md:flex-row justify-between items-center gap-6">
          <div>
            <h2 className="text-xl font-bold">Kode Referral Anda</h2>
            <p className="text-orange-100 text-sm mt-1">
              Bagikan kode ini ke teman-teman Anda untuk mendapatkan koin bersama.
            </p>
          </div>
          {stats?.myCode ? (
            <div className="flex items-center gap-3 bg-white/20 p-2 pl-6 rounded-[4px] backdrop-blur-md border border-white/20 shadow-inner">
              <span className="font-mono text-2xl font-bold tracking-widest">{stats.myCode}</span>
              <button
                onClick={copyToClipboard}
                className="p-3 bg-white text-[#D4802A] rounded-[4px] hover:bg-orange-50 active:scale-95 transition-all shadow-sm"
                aria-label="Salin kode referral"
                title="Salin kode referral"
              >
                <Copy className="w-5 h-5" />
              </button>
            </div>
          ) : (
            <button
              onClick={handleGenerateCode}
              className="px-8 py-3.5 bg-white text-[#D4802A] font-bold rounded-[4px] hover:bg-orange-50 active:scale-95 transition-all shadow-md"
            >
              Buat Kode Saya
            </button>
          )}
        </div>
      </div>

      {/* Statistik */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="p-6 bg-white dark:bg-zinc-900 border border-zinc-200/50 dark:border-zinc-800/80 rounded-[4px] flex items-center gap-5 shadow-sm">
          <div className="p-4 bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400 rounded-[4px] shrink-0">
            <Users className="w-7 h-7" />
          </div>
          <div>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 font-medium">Teman Bergabung</p>
            <p className="text-3xl font-bold text-zinc-900 dark:text-zinc-100">
              {stats?.invitedCount || 0}
            </p>
          </div>
        </div>
        <div className="p-6 bg-white dark:bg-zinc-900 border border-zinc-200/50 dark:border-zinc-800/80 rounded-[4px] flex items-center gap-5 shadow-sm">
          <div className="p-4 bg-green-50 text-green-600 dark:bg-green-900/20 dark:text-green-400 rounded-[4px] shrink-0">
            <CheckCircle className="w-7 h-7" />
          </div>
          <div>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 font-medium">
              Sukses Order (Koin Cair)
            </p>
            <p className="text-3xl font-bold text-zinc-900 dark:text-zinc-100">
              {stats?.successfulOrdersCount || 0}
            </p>
          </div>
        </div>
      </div>

      {/* Box Input Kode Teman */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200/50 dark:border-zinc-800/80 rounded-[4px] p-6 md:p-8 shadow-sm">
        <h3 className="font-bold text-lg text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
          Punya Kode Undangan?
        </h3>
        <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1 mb-6">
          Masukkan kode dari teman Anda sebelum melakukan pesanan pertama untuk mendapatkan
          perlakuan spesial.
        </p>
        <div className="flex flex-col sm:flex-row gap-3">
          <input
            type="text"
            value={referralInput}
            onChange={(e) => setReferralInput(e.target.value.toUpperCase())}
            placeholder="CONTOH: PVJ-X9A2"
            className="flex-1 px-5 py-3.5 rounded-[4px] border border-zinc-200 dark:border-zinc-800 bg-transparent focus:ring-2 focus:ring-[#D4802A]/50 outline-none transition-all font-mono tracking-widest text-lg"
          />
          <button
            onClick={handleApplyCode}
            disabled={isApplying || !referralInput}
            className="px-8 py-3.5 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 font-bold rounded-[4px] hover:bg-zinc-800 dark:hover:bg-zinc-200 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed min-w-[140px] flex justify-center items-center"
          >
            {isApplying ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Terapkan'}
          </button>
        </div>
      </div>
    </div>
  )
}
