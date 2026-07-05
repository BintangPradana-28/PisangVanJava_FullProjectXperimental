'use client'

import { AlertCircle, ArrowLeft, CheckCircle2, Send } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import toast from 'react-hot-toast'
import { formatPrice } from '@/lib/utils'

interface OrderSelection {
  id: string
  totalPrice: number
  createdAt: Date | string
  status: string
}

export default function LaporFormClient({ orders }: { orders: OrderSelection[] }) {
  const router = useRouter()
  const [subject, setSubject] = useState('')
  const [orderId, setOrderId] = useState('')
  const [description, setDescription] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!subject.trim()) {
      toast.error('Judul laporan wajib diisi')
      return
    }
    if (description.trim().length < 10) {
      toast.error('Deskripsi minimal 10 karakter')
      return
    }

    setIsSubmitting(true)
    const tid = toast.loading('Mengirim laporan...')

    try {
      const res = await fetch('/api/complaints', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject: subject.trim(),
          description: description.trim(),
          orderId: orderId || null
        })
      })

      const data = await res.json()

      if (data.success) {
        toast.success('Laporan berhasil terkirim!', { id: tid })
        setIsSuccess(true)
      } else {
        toast.error(data.error || 'Gagal mengirim laporan', { id: tid })
      }
    } catch {
      toast.error('Koneksi bermasalah. Coba lagi.', { id: tid })
    } finally {
      setIsSubmitting(false)
    }
  }

  if (isSuccess) {
    return (
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-8 rounded-[4px] shadow-sm text-center max-w-xl mx-auto space-y-6 animate-in fade-in zoom-in duration-300">
        <div className="w-16 h-16 bg-green-50 dark:bg-green-950/20 text-green-600 dark:text-green-400 rounded-full flex items-center justify-center mx-auto text-4xl">
          <CheckCircle2 className="w-10 h-10" />
        </div>
        <h2 className="font-serif text-2xl font-bold text-zinc-900 dark:text-zinc-100">
          Laporan Berhasil Dikirim!
        </h2>
        <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
          Terima kasih atas laporan Anda. Manajemen kami akan segera mengevaluasi keluhan ini dalam
          waktu maksimal 1x24 jam. Jawaban akan dikirimkan ke email Anda atau dapat dipantau di
          riwayat tiket bantuan.
        </p>
        <button
          onClick={() => router.push('/profile/bantuan')}
          className="px-6 py-2.5 bg-brown-700 text-white font-bold text-xs rounded-[4px] hover:bg-brown-800 transition-all focus:outline-none"
        >
          Kembali ke Pusat Bantuan
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => router.push('/profile/bantuan')}
          className="p-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-[4px] hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-400 transition-colors"
          title="Kembali"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div>
          <h1 className="text-xl font-bold font-serif text-zinc-900 dark:text-zinc-100">
            Lapor Kendala Pesanan
          </h1>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
            Lengkapi formulir di bawah untuk menyampaikan aduan kepada tim kami.
          </p>
        </div>
      </div>

      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-[4px] shadow-sm max-w-2xl overflow-hidden">
        <form onSubmit={handleSubmit} className="p-6 md:p-8 space-y-6">
          {/* Judul Laporan */}
          <div className="space-y-2">
            <label className="block text-xs font-bold text-brown-600 dark:text-amber-brand uppercase tracking-wider">
              Judul Laporan / Keluhan
            </label>
            <input
              type="text"
              placeholder="Contoh: Pesanan Kurang Lengkap, Keterlambatan Pengiriman, dsb."
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full px-4 py-3 text-sm rounded-[4px] outline-none transition-all
                         bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800
                         text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-600
                         focus:ring-2 focus:ring-[#D4802A]/20 focus:border-[#D4802A]"
              required
            />
          </div>

          {/* Hubungkan dengan Pesanan */}
          <div className="space-y-2">
            <label
              htmlFor="order-select"
              className="block text-xs font-bold text-brown-600 dark:text-amber-brand uppercase tracking-wider"
            >
              Pilih Pesanan Terkait (Opsional)
            </label>
            <select
              id="order-select"
              value={orderId}
              onChange={(e) => setOrderId(e.target.value)}
              title="Pilih Pesanan Terkait"
              className="w-full px-4 py-3 text-sm rounded-[4px] outline-none transition-all
                         bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800
                         text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-[#D4802A]/20 focus:border-[#D4802A]"
            >
              <option value="">-- Tidak Terkait Pesanan Tertentu --</option>
              {orders.map((order) => {
                const dateStr = new Date(order.createdAt).toLocaleDateString('id-ID', {
                  day: 'numeric',
                  month: 'short'
                })
                return (
                  <option key={order.id} value={order.id}>
                    Order #{order.id.slice(-6).toUpperCase()} • {dateStr} •{' '}
                    {formatPrice(order.totalPrice)} ({order.status})
                  </option>
                )
              })}
            </select>
            <p className="text-[10px] text-zinc-400">
              Menampilkan hingga 10 pesanan terakhir Anda.
            </p>
          </div>

          {/* Deskripsi Masalah */}
          <div className="space-y-2">
            <label className="block text-xs font-bold text-brown-600 dark:text-amber-brand uppercase tracking-wider">
              Detail Masalah / Deskripsi Lengkap
            </label>
            <textarea
              placeholder="Ceritakan kendala Anda secara detail agar tim kami dapat segera memberikan solusi terbaik..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={5}
              className="w-full px-4 py-3 text-sm rounded-[4px] outline-none transition-all
                         bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800
                         text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-600
                         focus:ring-2 focus:ring-[#D4802A]/20 focus:border-[#D4802A]"
              required
            />
            <p className="text-[10px] text-zinc-400 flex items-center gap-1">
              <AlertCircle className="w-3.5 h-3.5 text-amber-500" />
              Tuliskan detail seperti menu yang bermasalah, perkiraan waktu kejadian, dsb. (Minimal
              10 karakter)
            </p>
          </div>

          {/* Action buttons */}
          <div className="pt-2 flex gap-4">
            <button
              type="button"
              onClick={() => router.push('/profile/bantuan')}
              className="flex-1 py-3 px-4 text-xs font-bold bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 rounded-[4px] hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-all"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 py-3 px-4 text-xs font-bold bg-brown-700 text-white rounded-[4px] hover:bg-brown-800 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <Send className="w-3.5 h-3.5" />
              )}
              Kirim Laporan
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
