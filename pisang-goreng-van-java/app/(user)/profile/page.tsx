'use client'

import { useState, useEffect } from 'react'
import { useSession, signOut } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { motion } from 'framer-motion'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { deleteAccountPermanently } from '@/src/features/user/actions'
import OrderHistory from '@/components/user/OrderHistory'

const profileSchema = z.object({
  name: z.string().min(1, "Nama tidak boleh kosong"),
  phone: z.string()
    .min(1, "Nomor WhatsApp tidak boleh kosong")
    .regex(/^(\+62|62|0)8[1-9][0-9]{6,11}$/, "Nomor WhatsApp tidak valid."),
  address: z.string()
    .min(1, "Alamat tidak boleh kosong")
    .max(500, "Alamat maksimal 500 karakter"),
})

type ProfileFormValues = z.infer<typeof profileSchema>

type ProfileTab = 'profil' | 'pesanan'

export default function ProfilePage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<ProfileTab>('profil')
  const [userPhone, setUserPhone] = useState('')
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isValid, isSubmitting }
  } = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    mode: 'onChange',
    defaultValues: {
      name: '',
      phone: '',
      address: ''
    }
  })

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/member-login')
      return
    }

    if (status === 'authenticated') {
      // Hydration: Auto-fill from session initially
      if (session?.user?.name) {
        setValue('name', session.user.name, { shouldValidate: true })
      }

      // Fetch precise data from database
      fetch('/api/user/profile')
        .then(res => res.json())
        .then(data => {
          if (data.success && data.data) {
            if (data.data.name) setValue('name', data.data.name, { shouldValidate: true })
            if (data.data.phone) { setValue('phone', data.data.phone, { shouldValidate: true }); setUserPhone(data.data.phone) }
            if (data.data.address) setValue('address', data.data.address, { shouldValidate: true })
          }
        })
        .catch(() => toast.error('Gagal mengambil data profil'))
        .finally(() => setIsLoading(false))
    }
  }, [status, router, session, setValue])

  const onSubmit = async (data: ProfileFormValues) => {
    try {
      const res = await fetch('/api/user/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      })
      const resData = await res.json()

      if (res.ok && resData.success) {
        toast.success('Profil berhasil diperbarui!')
      } else {
        toast.error(resData.message || 'Gagal menyimpan profil')
      }
    } catch (error) {
      toast.error('Terjadi kesalahan jaringan')
    }
  }

  if (isLoading || status === 'loading') {
    return (
      <div className="min-h-screen pt-28 pb-10 flex items-center justify-center bg-surface-container-low dark:bg-zinc-950">
        <div className="animate-spin w-8 h-8 border-4 border-[#D4802A] border-t-transparent rounded-full" />
      </div>
    )
  }

  return (
    <div className="min-h-screen pt-28 pb-10 bg-surface-container-low dark:bg-zinc-950">
      <div className="max-w-2xl mx-auto px-6">
        {/* Profile Header Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white dark:bg-zinc-900 rounded-3xl p-6 shadow-xl border border-zinc-200/50 dark:border-zinc-800/80 mb-6"
        >
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-amber-200 to-orange-400 text-amber-900 flex items-center justify-center text-3xl font-bold shadow-md">
              {session?.user?.name ? session.user.name[0].toUpperCase() : '👤'}
            </div>
            <div>
              <h1 className="text-2xl font-bold font-serif text-zinc-900 dark:text-zinc-100">{session?.user?.name || 'Pelanggan'}</h1>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">{session?.user?.email}</p>
            </div>
          </div>

          {/* Tab switcher */}
          <div className="flex gap-2 mt-5 p-1 bg-zinc-100 dark:bg-zinc-800 rounded-2xl">
            {([['profil', '👤 Profil'], ['pesanan', '📋 Riwayat Pesanan']] as [ProfileTab, string][]).map(([tab, label]) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex-1 py-2.5 text-sm font-bold rounded-xl transition-all ${
                  activeTab === tab
                    ? 'bg-white dark:bg-zinc-900 shadow-sm text-zinc-900 dark:text-zinc-100'
                    : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </motion.div>

        {/* Tab Content */}
        {activeTab === 'pesanan' ? (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
            <div className="bg-white dark:bg-zinc-900 rounded-3xl p-6 shadow-xl border border-zinc-200/50 dark:border-zinc-800/80">
              <h2 className="font-serif text-lg font-bold text-zinc-800 dark:text-zinc-100 mb-5">Riwayat Pesanan Saya</h2>
              {userPhone ? (
                <OrderHistory phone={userPhone} />
              ) : (
                <div className="text-center py-8 text-zinc-400">
                  <p className="text-sm">Tambahkan nomor WhatsApp di tab Profil untuk melihat riwayat pesanan.</p>
                </div>
              )}
            </div>
          </motion.div>
        ) : (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white dark:bg-zinc-900 rounded-3xl p-8 shadow-xl border border-zinc-200/50 dark:border-zinc-800/80"
        >
          <div className="flex items-center gap-4 mb-8 pb-6 border-b border-zinc-100 dark:border-zinc-800">
            <div className="w-16 h-16 rounded-full bg-[#D4802A]/10 text-[#D4802A] flex items-center justify-center text-3xl">
              👤
            </div>
            <div>
              <h2 className="text-2xl font-bold font-serif text-zinc-900 dark:text-zinc-100">Edit Profil</h2>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">{session?.user?.email}</p>
            </div>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <div>
              <label className="block text-sm font-bold text-zinc-700 dark:text-zinc-300 mb-2">
                Nama Lengkap
              </label>
              <input
                type="text"
                {...register('name')}
                className={`w-full p-4 rounded-xl border bg-transparent text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 transition-all ${
                  errors.name 
                    ? 'border-red-500 focus:ring-red-500/50' 
                    : 'border-zinc-200 dark:border-zinc-800 focus:ring-[#D4802A]/50'
                }`}
                placeholder="Masukkan nama lengkap Anda"
              />
              {errors.name && (
                <p className="text-xs text-red-500 mt-1.5 font-medium">{errors.name.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-bold text-zinc-700 dark:text-zinc-300 mb-2">
                Nomor WhatsApp
              </label>
              <input
                type="tel"
                {...register('phone')}
                className={`w-full p-4 rounded-xl border bg-transparent text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 transition-all ${
                  errors.phone 
                    ? 'border-red-500 focus:ring-red-500/50' 
                    : 'border-zinc-200 dark:border-zinc-800 focus:ring-[#D4802A]/50'
                }`}
                placeholder="Contoh: +6281312167554"
              />
              {errors.phone ? (
                <p className="text-xs text-red-500 mt-1.5 font-medium">{errors.phone.message}</p>
              ) : (
                <p className="text-xs text-zinc-500 mt-1.5">
                  Nomor ini akan otomatis mengisi form saat checkout keranjang belanja.
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-bold text-zinc-700 dark:text-zinc-300 mb-2">
                Alamat Pengiriman (Default)
              </label>
              <textarea
                {...register('address')}
                className={`w-full p-4 rounded-xl border bg-transparent text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 transition-all min-h-[100px] ${
                  errors.address 
                    ? 'border-red-500 focus:ring-red-500/50' 
                    : 'border-zinc-200 dark:border-zinc-800 focus:ring-[#D4802A]/50'
                }`}
                placeholder="Masukkan alamat pengiriman default Anda"
              />
              {errors.address && (
                <p className="text-xs text-red-500 mt-1.5 font-medium">{errors.address.message}</p>
              )}
            </div>

            <div className="pt-4 flex justify-end">
              <button
                type="submit"
                disabled={isSubmitting || !isValid}
                className="bg-[#D4802A] hover:bg-[#b56d24] text-white font-bold py-3.5 px-8 rounded-full shadow-md transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <div className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                    Menyimpan...
                  </>
                ) : 'Simpan Perubahan'}
              </button>
            </div>
          </form>

          {/* DANGER ZONE */}
          <div className="mt-12 pt-8 border-t border-red-500/20">
            <h2 className="text-xl font-bold text-red-600 dark:text-red-500 mb-2">Zona Berbahaya (Danger Zone)</h2>
            <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-6">
              Tindakan di bawah ini tidak dapat dibatalkan. Menghapus akun akan menghapus seluruh data personal, riwayat pesanan, dan preferensi Anda secara permanen.
            </p>
            <button
              onClick={() => setIsDeleteModalOpen(true)}
              className="bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 dark:bg-red-950/30 dark:border-red-900/50 dark:hover:bg-red-900/50 dark:text-red-400 font-bold py-3 px-6 rounded-xl transition-all"
            >
              Hapus Akun Saya Secara Permanen
            </button>
          </div>
        </motion.div>
        )}
      </div>

      {/* DELETE ACCOUNT MODAL */}
      {isDeleteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white dark:bg-zinc-900 rounded-3xl p-8 max-w-md w-full shadow-2xl border border-red-500/30"
          >
            <h3 className="text-2xl font-bold text-red-600 dark:text-red-500 mb-4">Peringatan Terakhir</h3>
            <p className="text-zinc-600 dark:text-zinc-400 mb-6">
              Anda akan kehilangan akses secara permanen. Silakan ketik <strong>HAPUS AKUN SAYA</strong> untuk mengonfirmasi tindakan ini.
            </p>
            
            <form action={async (formData) => {
              setIsDeleting(true);
              const result = await deleteAccountPermanently(formData);
              if (result.success) {
                toast.success(result.message || "Akun berhasil dihapus.");
                await signOut({ callbackUrl: '/' });
              } else {
                toast.error(result.error || "Gagal menghapus akun.");
                setIsDeleting(false);
              }
            }}>
              <input
                type="text"
                name="confirmationString"
                required
                className="w-full p-4 rounded-xl border border-red-200 dark:border-red-900/50 bg-red-50/50 dark:bg-red-950/20 text-red-900 dark:text-red-100 focus:outline-none focus:ring-2 focus:ring-red-500 mb-6"
                placeholder="HAPUS AKUN SAYA"
              />
              <div className="flex gap-4">
                <button
                  type="button"
                  disabled={isDeleting}
                  onClick={() => setIsDeleteModalOpen(false)}
                  className="flex-1 py-3 px-4 rounded-xl border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 font-bold hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-all"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isDeleting}
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white font-bold py-3 px-4 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isDeleting ? (
                    <div className="w-5 h-5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                  ) : 'Ya, Hapus'}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  )
}
