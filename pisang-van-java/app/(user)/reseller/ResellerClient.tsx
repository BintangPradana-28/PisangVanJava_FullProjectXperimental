'use client'

// app/(user)/reseller/ResellerClient.tsx
// Client view for Reseller / B2B partnership registration & dashboard
// RAG Source: src/features/crm/actions.ts (applyForReseller)
// RAG Source: context/SettingsContext.tsx (getSetting)

import { motion } from 'framer-motion'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useAction } from 'next-safe-action/hooks'
import { useState } from 'react'
import toast, { Toaster } from 'react-hot-toast'
import { applyForResellerAction } from '@/src/features/crm/actions'

interface ProductVariant {
  id: string
  flavorName: string
  priceKembung: number
  priceLumpia: number
  priceKrispy: number
  wholesaleKembung: number
  wholesaleLumpia: number
  wholesaleKrispy: number
  imageUrl: string | null
}

interface ResellerOrder {
  id: string
  totalPrice: number
  status: string
  createdAt: string
  deliveryMethod: string
}

interface ResellerClientProps {
  session: any
  products: ProductVariant[]
  pendingApplication: { id: string; stage: string; createdAt: string } | null
  resellerOrders: ResellerOrder[]
  userPhone: string
}

const formatPrice = (n: number): string =>
  new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0
  }).format(n)

const formatDateTime = (isoStr: string): string => {
  const date = new Date(isoStr)
  return date.toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

const STATUS_BADGES: Record<string, { label: string; style: string }> = {
  PENDING_PAYMENT: {
    label: '⏳ Belum Bayar',
    style: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400'
  },
  PROCESSING: {
    label: '🍳 Dimasak',
    style: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400'
  },
  READY: {
    label: '✅ Siap Ambil',
    style: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400'
  },
  COMPLETED: {
    label: '🎉 Selesai',
    style: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400'
  },
  CANCELED: {
    label: '❌ Batal',
    style: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
  }
}

export default function ResellerClient({
  session,
  products,
  pendingApplication,
  resellerOrders,
  userPhone
}: ResellerClientProps) {
  const router = useRouter()
  const [companyName, setCompanyName] = useState('')
  const [address, setAddress] = useState('')
  const [notes, setNotes] = useState('')

  // RAG Source: app/(user)/reseller/ResellerClient.tsx
  const { execute, isPending } = useAction(applyForResellerAction, {
    onSuccess: ({ data }) => {
      if (data?.success) {
        toast.success('Pendaftaran Anda berhasil dikirim! 🚀')
        router.refresh()
      } else {
        toast.error(data?.error || 'Gagal mengirim pendaftaran')
      }
    },
    onError: ({ error }) => {
      toast.error(error.serverError || 'Terjadi kesalahan koneksi server.')
    }
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!companyName.trim()) {
      toast.error('Nama toko / bisnis wajib diisi.')
      return
    }
    if (address.trim().length < 10) {
      toast.error('Alamat lengkap bisnis minimal 10 karakter.')
      return
    }

    execute({
      companyName: companyName.trim(),
      address: address.trim(),
      notes: notes.trim() || null
    })
  }

  const isLoggedIn = !!session?.user
  const isReseller = session?.user?.role === 'RESELLER'
  const isCustomer = session?.user?.role === 'CUSTOMER'

  // Calculate Reseller Stats
  const totalOrdersCount = resellerOrders.length
  const totalSpent = resellerOrders
    .filter((o) => o.status === 'COMPLETED')
    .reduce((sum, o) => sum + o.totalPrice, 0)

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-white to-orange-50 dark:from-zinc-950 dark:via-zinc-900 dark:to-zinc-950 pt-24 pb-16">
      <Toaster position="top-right" />
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        {/* Header */}
        <header className="mb-12 text-center">
          <h1 className="font-serif text-4xl font-extrabold tracking-tight text-zinc-900 dark:text-zinc-100">
            🤝 Kemitraan Reseller
          </h1>
          <p className="text-zinc-500 dark:text-zinc-400 mt-2 max-w-xl mx-auto">
            Program kemitraan resmi Pisang Van Java. Kembangkan bisnis Anda bersama produk kuliner
            terlaris kami.
          </p>
        </header>

        {/* Main Section */}
        <div className="grid lg:grid-cols-[1fr_400px] gap-8 items-start">
          {/* Left panel: Form, Dashboard, or Info */}
          <div className="space-y-6">
            {/* 1. Unauthenticated view */}
            {!isLoggedIn && (
              <motion.div
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white dark:bg-zinc-900 rounded-[4px] border border-zinc-100 dark:border-zinc-800 p-8 shadow-sm space-y-6"
              >
                <div className="text-4xl text-amber-500">💰</div>
                <h2 className="font-serif text-2xl font-bold text-zinc-900 dark:text-zinc-100">
                  Nikmati Harga Grosir Spesial Reseller
                </h2>
                <p className="text-sm text-zinc-650 dark:text-zinc-400 leading-relaxed">
                  Dapatkan diskon harga hingga 30% untuk setiap varian rasa Pisang Goreng Van Java
                  dengan bergabung menjadi reseller resmi. Tanpa biaya pendaftaran, cukup melakukan
                  minimal order harian/mingguan yang sangat ringan.
                </p>
                <div className="flex gap-4">
                  <Link
                    href="/member-login?callbackUrl=/reseller"
                    className="bg-amber-500 hover:bg-amber-600 text-white font-bold py-3 px-6 rounded-[4px] transition-all shadow-md shadow-amber-200 dark:shadow-none text-sm"
                  >
                    Masuk Akun
                  </Link>
                  <Link
                    href="/member-register?callbackUrl=/reseller"
                    className="bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-100 font-bold py-3 px-6 rounded-[4px] transition-all text-sm"
                  >
                    Daftar Sekarang
                  </Link>
                </div>
              </motion.div>
            )}

            {/* 2. Customer Form or Pending Status */}
            {isLoggedIn &&
              isCustomer &&
              (pendingApplication ? (
                <motion.div
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-amber-500/10 border-2 border-amber-300 dark:border-amber-700/50 rounded-[4px] p-6 text-center space-y-4"
                >
                  <div className="text-5xl">⏳</div>
                  <h2 className="font-serif text-2xl font-bold text-amber-800 dark:text-amber-400">
                    Pendaftaran Sedang Ditinjau
                  </h2>
                  <p className="text-sm text-amber-750 dark:text-amber-300 max-w-lg mx-auto leading-relaxed">
                    Terima kasih atas minat Anda bergabung menjadi reseller Pisang Van Java!
                    Pendaftaran yang Anda ajukan pada{' '}
                    <strong>{formatDateTime(pendingApplication.createdAt)}</strong> saat ini sedang
                    diproses oleh Tim Admin kami. Kami akan menghubungi Anda kembali lewat WhatsApp
                    dalam waktu maksimal 1x24 jam.
                  </p>
                  <div className="pt-2 text-xs text-zinc-400 dark:text-zinc-500">
                    Deal ID: {pendingApplication.id}
                  </div>
                </motion.div>
              ) : (
                <motion.div
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-white dark:bg-zinc-900 rounded-[4px] border border-zinc-100 dark:border-zinc-800 p-8 shadow-sm"
                >
                  <h2 className="font-serif text-2xl font-bold text-zinc-900 dark:text-zinc-100 mb-6">
                    📝 Ajukan Pendaftaran Reseller
                  </h2>

                  {!userPhone ? (
                    <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/50 rounded-[4px] p-5 space-y-3">
                      <div className="text-lg font-bold text-red-700 dark:text-red-400">
                        ⚠️ Nomor WhatsApp Diperlukan
                      </div>
                      <p className="text-xs text-red-650 dark:text-red-350 leading-relaxed">
                        Anda harus menambahkan nomor WhatsApp aktif di profil akun Anda sebelum
                        mendaftar menjadi reseller. Hal ini diperlukan agar tim kami dapat
                        menghubungi Anda untuk proses persetujuan.
                      </p>
                      <Link
                        href="/profile/keamanan"
                        className="inline-block text-xs font-bold text-white bg-red-655 bg-red-600 hover:bg-red-750 hover:bg-red-700 px-4 py-2.5 rounded-[4px] transition-all"
                      >
                        Lengkapi Profil Akun →
                      </Link>
                    </div>
                  ) : (
                    <form onSubmit={handleSubmit} className="space-y-4">
                      <div className="grid sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider mb-1.5" htmlFor="contact-name">
                            Nama Kontak (Pendaftar)
                          </label>
                          <input
                            id="contact-name"
                            type="text"
                            value={session.user.name || ''}
                            disabled
                            placeholder="Nama Kontak"
                            className="w-full px-4 py-3 rounded-[4px] border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-400 dark:text-zinc-500 text-sm focus:outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider mb-1.5" htmlFor="whatsapp-number">
                            Nomor WhatsApp
                          </label>
                          <input
                            id="whatsapp-number"
                            type="text"
                            value={userPhone}
                            disabled
                            placeholder="Nomor WhatsApp"
                            className="w-full px-4 py-3 rounded-[4px] border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-400 dark:text-zinc-500 text-sm focus:outline-none"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-1.5">
                          Nama Bisnis / Toko / Instansi *
                        </label>
                        <input
                          type="text"
                          value={companyName}
                          onChange={(e) => setCompanyName(e.target.value)}
                          placeholder="Contoh: Toko Berkah, Catering Sinar, Koperasi..."
                          className="w-full px-4 py-3 rounded-[4px] border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-100 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 transition-all"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-1.5">
                          Alamat Lengkap Tempat Usaha *
                        </label>
                        <textarea
                          value={address}
                          onChange={(e) => setAddress(e.target.value)}
                          placeholder="Jl. Raya Kemitraan No. 5, RT 02/03, Kelurahan, Kecamatan, Kota..."
                          rows={3}
                          className="w-full px-4 py-3 rounded-[4px] border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-100 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 transition-all resize-none"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-1.5">
                          Keterangan Tambahan / Catatan (Opsional)
                        </label>
                        <textarea
                          value={notes}
                          onChange={(e) => setNotes(e.target.value)}
                          placeholder="Tuliskan pengalaman bisnis Anda atau rencana pemesanan harian..."
                          rows={2}
                          className="w-full px-4 py-3 rounded-[4px] border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-100 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 transition-all resize-none"
                        />
                      </div>

                      <button
                        type="submit"
                        disabled={isPending}
                        className="w-full bg-amber-500 hover:bg-amber-600 text-white font-bold py-3.5 rounded-[4px] transition-all active:scale-[0.98] shadow-sm shadow-amber-200 dark:shadow-none text-sm disabled:opacity-50"
                      >
                        {isPending
                          ? 'Mengirimkan Pendaftaran...'
                          : 'Kirim Pendaftaran Reseller 🚀'}
                      </button>
                    </form>
                  )}
                </motion.div>
              ))}

            {/* 3. Reseller Dashboard View */}
            {isLoggedIn && isReseller && (
              <motion.div
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-6"
              >
                {/* Welcome Card */}
                <div className="bg-amber-500/10 border-2 border-amber-300 dark:border-amber-700/40 rounded-[4px] p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h2 className="text-xl font-bold text-amber-800 dark:text-amber-400 font-serif">
                      Selamat Datang, Reseller Resmi! 🍌
                    </h2>
                    <p className="text-xs text-amber-750 dark:text-amber-300 mt-1 max-w-md">
                      Akun Anda aktif sebagai mitra reseller. Harga grosir otomatis diterapkan saat
                      Anda berbelanja.
                    </p>
                  </div>
                  <Link
                    href="/menu-spesial"
                    className="bg-amber-500 hover:bg-amber-600 text-white font-bold py-3 px-6 rounded-[4px] transition-all text-center text-sm shadow-md shadow-amber-200 dark:shadow-none whitespace-nowrap"
                  >
                    Belanja Grosir 🛍️
                  </Link>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-white dark:bg-zinc-900 rounded-[4px] border border-zinc-100 dark:border-zinc-800 p-5 shadow-xs">
                    <span className="text-xs text-zinc-400 block mb-1">Total Pesanan</span>
                    <span className="text-2xl font-black text-zinc-800 dark:text-zinc-100">
                      {totalOrdersCount}
                    </span>
                  </div>
                  <div className="bg-white dark:bg-zinc-900 rounded-[4px] border border-zinc-100 dark:border-zinc-800 p-5 shadow-xs">
                    <span className="text-xs text-zinc-400 block mb-1">
                      Total Belanja (Selesai)
                    </span>
                    <span className="text-2xl font-black text-amber-600 dark:text-amber-400">
                      {formatPrice(totalSpent)}
                    </span>
                  </div>
                </div>

                {/* Reseller Orders History */}
                <div className="bg-white dark:bg-zinc-900 rounded-[4px] border border-zinc-100 dark:border-zinc-800 p-6 shadow-sm">
                  <h3 className="font-serif text-lg font-bold text-zinc-800 dark:text-zinc-200 mb-4">
                    Riwayat Pembelian Grosir
                  </h3>

                  {resellerOrders.length === 0 ? (
                    <div className="text-center py-10 text-zinc-400 dark:text-zinc-500">
                      Belum ada riwayat pesanan grosir.
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="border-b border-zinc-100 dark:border-zinc-800 text-zinc-400 uppercase font-bold tracking-wider">
                            <th className="py-3">No. Order</th>
                            <th className="py-3">Tanggal</th>
                            <th className="py-3">Metode</th>
                            <th className="py-3 text-right">Total</th>
                            <th className="py-3 text-right">Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {resellerOrders.map((order) => {
                            const badge = STATUS_BADGES[order.status] || {
                              label: order.status,
                              style: 'bg-zinc-100 text-zinc-800'
                            }
                            return (
                              <tr
                                key={order.id}
                                className="border-b border-zinc-50 dark:border-zinc-800/50 last:border-0 hover:bg-zinc-50/50 dark:hover:bg-zinc-800/10"
                              >
                                <td className="py-3.5 font-bold font-mono">
                                  <Link
                                    href={`/track-order?id=${order.id}`}
                                    className="text-amber-600 dark:text-amber-400 hover:underline"
                                  >
                                    #{order.id.slice(-6).toUpperCase()}
                                  </Link>
                                </td>
                                <td className="py-3.5 text-zinc-500 dark:text-zinc-450">
                                  {new Date(order.createdAt).toLocaleDateString('id-ID')}
                                </td>
                                <td className="py-3.5 text-zinc-500 dark:text-zinc-450 font-medium">
                                  {order.deliveryMethod === 'DELIVERY' ? '🛵 Antar' : '🏪 Pickup'}
                                </td>
                                <td className="py-3.5 text-right font-bold text-zinc-800 dark:text-zinc-100">
                                  {formatPrice(order.totalPrice)}
                                </td>
                                <td className="py-3.5 text-right">
                                  <span
                                    className={`px-2 py-1 rounded-[4px] text-[10px] font-bold ${badge.style}`}
                                  >
                                    {badge.label}
                                  </span>
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </motion.div>
            )}

            {/* Price list grid for reference */}
            <div className="bg-white dark:bg-zinc-900 rounded-[4px] border border-zinc-100 dark:border-zinc-800 p-6 shadow-sm">
              <h3 className="font-serif text-lg font-bold text-zinc-800 dark:text-zinc-200 mb-2">
                📋 Daftar Harga Grosir & Retail
              </h3>
              <p className="text-xs text-zinc-400 dark:text-zinc-500 mb-6">
                Bandingkan harga normal dan harga khusus reseller PVJ untuk melihat estimasi
                keuntungan Anda.
              </p>

              <div className="space-y-4">
                {products.map((prod) => (
                  <div
                    key={prod.id}
                    className="border-b border-zinc-100 dark:border-zinc-800/60 last:border-0 pb-4 last:pb-0"
                  >
                    <h4 className="font-sans font-bold text-sm text-zinc-800 dark:text-zinc-100 mb-2">
                      🍌 Varian: {prod.flavorName}
                    </h4>
                    <div className="grid grid-cols-3 gap-2 text-center text-xs">
                      {/* Kembung */}
                      <div className="bg-zinc-50 dark:bg-zinc-800/30 p-2.5 rounded-[4px] border border-zinc-100/50 dark:border-zinc-800/20">
                        <span className="font-bold text-zinc-400 block text-[9px] uppercase tracking-wider mb-1">
                          Base Kembung
                        </span>
                        <span className="text-[10px] text-zinc-500 line-through block">
                          {formatPrice(prod.priceKembung)}
                        </span>
                        <span className="font-bold text-amber-600 dark:text-amber-400 block">
                          {formatPrice(prod.wholesaleKembung)}
                        </span>
                        {prod.priceKembung > prod.wholesaleKembung && (
                          <span className="text-[9px] text-emerald-600 font-extrabold block mt-0.5">
                            Hemat {formatPrice(prod.priceKembung - prod.wholesaleKembung)}
                          </span>
                        )}
                      </div>

                      {/* Lumpia */}
                      <div className="bg-zinc-50 dark:bg-zinc-800/30 p-2.5 rounded-[4px] border border-zinc-100/50 dark:border-zinc-800/20">
                        <span className="font-bold text-zinc-400 block text-[9px] uppercase tracking-wider mb-1">
                          Base Lumpia
                        </span>
                        <span className="text-[10px] text-zinc-500 line-through block">
                          {formatPrice(prod.priceLumpia)}
                        </span>
                        <span className="font-bold text-amber-600 dark:text-amber-400 block">
                          {formatPrice(prod.wholesaleLumpia)}
                        </span>
                        {prod.priceLumpia > prod.wholesaleLumpia && (
                          <span className="text-[9px] text-emerald-600 font-extrabold block mt-0.5">
                            Hemat {formatPrice(prod.priceLumpia - prod.wholesaleLumpia)}
                          </span>
                        )}
                      </div>

                      {/* Krispy */}
                      <div className="bg-zinc-50 dark:bg-zinc-800/30 p-2.5 rounded-[4px] border border-zinc-100/50 dark:border-zinc-800/20">
                        <span className="font-bold text-zinc-400 block text-[9px] uppercase tracking-wider mb-1">
                          Base Krispy
                        </span>
                        <span className="text-[10px] text-zinc-500 line-through block">
                          {formatPrice(prod.priceKrispy)}
                        </span>
                        <span className="font-bold text-amber-600 dark:text-amber-400 block">
                          {formatPrice(prod.wholesaleKrispy)}
                        </span>
                        {prod.priceKrispy > prod.wholesaleKrispy && (
                          <span className="text-[9px] text-emerald-600 font-extrabold block mt-0.5">
                            Hemat {formatPrice(prod.priceKrispy - prod.wholesaleKrispy)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right panel: Benefits list */}
          <aside className="bg-white dark:bg-zinc-900 rounded-[4px] border border-zinc-100 dark:border-zinc-800 p-6 shadow-sm space-y-6">
            <h3 className="font-serif text-lg font-bold text-zinc-800 dark:text-zinc-200">
              💎 Keuntungan Reseller PVJ
            </h3>

            <ul className="space-y-4 text-xs text-zinc-650 dark:text-zinc-400 leading-relaxed">
              <li className="flex gap-2">
                <span className="text-amber-500 shrink-0">💸</span>
                <div>
                  <strong>Harga Khusus Grosir</strong>
                  <p className="mt-0.5 text-[11px] text-zinc-450">
                    Potongan harga khusus reseller langsung terpotong di keranjang hingga Rp 5.000
                    per box.
                  </p>
                </div>
              </li>
              <li className="flex gap-2">
                <span className="text-amber-500 shrink-0">📦</span>
                <div>
                  <strong>Minimal Order Ringan</strong>
                  <p className="mt-0.5 text-[11px] text-zinc-450">
                    Tanpa harus menimbun stok ribuan box. Anda sudah mendapatkan harga grosir dengan
                    minimal pembelian 5 box per order.
                  </p>
                </div>
              </li>
              <li className="flex gap-2">
                <span className="text-amber-500 shrink-0">🚀</span>
                <div>
                  <strong>Prioritas Dapur</strong>
                  <p className="mt-0.5 text-[11px] text-zinc-450">
                    Pesanan grosir reseller diprioritaskan di sistem dapur (KDS) agar hidangan
                    selalu segar dan selesai tepat waktu.
                  </p>
                </div>
              </li>
              <li className="flex gap-2">
                <span className="text-amber-500 shrink-0">📢</span>
                <div>
                  <strong>Materi Promosi Gratis</strong>
                  <p className="mt-0.5 text-[11px] text-zinc-450">
                    Dapatkan akses aset foto HD produk, video marketing, dan katalog digital untuk
                    promosi di sosial media Anda.
                  </p>
                </div>
              </li>
            </ul>

            <div className="border-t border-zinc-100 dark:border-zinc-800 pt-4 text-[10px] text-zinc-400 dark:text-zinc-500">
              💡 Syarat & Ketentuan berlaku. Peninjauan kelayakan akun berhak sepenuhnya oleh
              kebijakan manajemen Pisang Van Java.
            </div>
          </aside>
        </div>
      </div>
    </div>
  )
}
