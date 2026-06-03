'use client'

import React, { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import toast from 'react-hot-toast'
import { Camera, Loader2, Save } from 'lucide-react'
import Image from 'next/image'

// SCHEMA
const profileSchema = z.object({
  name: z.string().min(3, 'Nama minimal 3 karakter').max(60),
  phone: z.string().regex(/^(\+62|62|0)8[1-9][0-9]{6,11}$/, 'Format nomor telepon tidak valid'),
})
type ProfileValues = z.infer<typeof profileSchema>

const passwordSchema = z.object({
  oldPassword: z.string().min(1, 'Password lama wajib diisi'),
  newPassword: z.string().min(6, 'Password baru minimal 6 karakter'),
  confirmPassword: z.string().min(1, 'Konfirmasi password wajib diisi'),
}).refine(data => data.newPassword === data.confirmPassword, {
  message: "Password baru dan konfirmasi tidak cocok",
  path: ["confirmPassword"],
})
type PasswordValues = z.infer<typeof passwordSchema>

export default function ProfilPage() {
  const { data: session, update } = useSession()
  const [isUploading, setIsUploading] = useState(false)
  
  // Data Diri Form
  const { register: registerProfile, handleSubmit: handleProfileSubmit, reset: resetProfile, formState: { errors: profileErrors, isSubmitting: isProfileSubmitting } } = useForm<ProfileValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: { name: '', phone: '' }
  })

  // Password Form
  const { register: registerPassword, handleSubmit: handlePasswordSubmit, reset: resetPassword, formState: { errors: passwordErrors, isSubmitting: isPasswordSubmitting } } = useForm<PasswordValues>({
    resolver: zodResolver(passwordSchema)
  })

  useEffect(() => {
    if (session?.user) {
      // Fetch fresh profile data to get latest phone and name
      fetch('/api/user/profile')
        .then(res => res.json())
        .then(data => {
          if (data.success) {
            resetProfile({
              name: data.data.name || '',
              phone: data.data.phone || '',
            })
          }
        })
    }
  }, [session, resetProfile])

  const onUpdateProfile = async (data: ProfileValues) => {
    try {
      const res = await fetch('/api/user/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      const result = await res.json()
      if (res.ok && result.success) {
        toast.success('Data diri berhasil diperbarui!')
        await update({ name: data.name }) // update next-auth session
      } else {
        toast.error(result.message || 'Gagal memperbarui data diri')
      }
    } catch (error) {
      toast.error('Terjadi kesalahan jaringan')
    }
  }

  const onUpdatePassword = async (data: PasswordValues) => {
    try {
      const res = await fetch('/api/user/password', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ oldPassword: data.oldPassword, newPassword: data.newPassword }),
      })
      const result = await res.json()
      if (res.ok && result.success) {
        toast.success('Password berhasil diubah!')
        resetPassword()
      } else {
        toast.error(result.message || 'Gagal mengubah password')
      }
    } catch (error) {
      toast.error('Terjadi kesalahan jaringan')
    }
  }

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (file.size > 2 * 1024 * 1024) {
      toast.error('Ukuran maksimal foto 2MB')
      return
    }

    setIsUploading(true)
    const formData = new FormData()
    formData.append('file', file)

    try {
      const res = await fetch('/api/user/profile/avatar', {
        method: 'POST',
        body: formData,
      })
      const result = await res.json()
      if (res.ok && result.success) {
        toast.success('Foto profil berhasil diunggah!')
        await update({ image: result.data.url })
      } else {
        toast.error(result.message || 'Gagal mengunggah foto')
      }
    } catch (error) {
      toast.error('Terjadi kesalahan saat mengunggah')
    } finally {
      setIsUploading(false)
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-white mb-2">Data Diri</h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">Kelola informasi profil dan keamanan akun Anda di sini.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        
        {/* Kolom Kiri: Foto Profil */}
        <div className="md:col-span-1 flex flex-col items-center">
          <div className="relative group">
            <div className="w-32 h-32 rounded-full overflow-hidden bg-zinc-100 dark:bg-zinc-800 border-4 border-white dark:border-zinc-900 shadow-xl relative">
              {session?.user?.image ? (
                <Image src={session.user.image} alt="Avatar" fill className="object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-4xl bg-amber-100 text-amber-600">
                  {session?.user?.name?.charAt(0).toUpperCase() || 'U'}
                </div>
              )}
              {isUploading && (
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                  <Loader2 className="w-8 h-8 text-white animate-spin" />
                </div>
              )}
            </div>
            <label className="absolute bottom-0 right-0 w-10 h-10 bg-[#D4802A] text-white rounded-full flex items-center justify-center cursor-pointer shadow-lg hover:bg-[#b56d24] transition-all hover:scale-105 active:scale-95">
              <Camera className="w-5 h-5" />
              <input type="file" accept="image/png, image/jpeg, image/jpg, image/webp" className="hidden" onChange={handleAvatarUpload} disabled={isUploading} />
            </label>
          </div>
          <p className="mt-4 text-xs text-zinc-500 text-center">Format JPEG/PNG/WEBP<br/>Maksimal 2MB</p>
        </div>

        {/* Kolom Kanan: Forms */}
        <div className="md:col-span-2 space-y-10">
          
          {/* Form Biodata */}
          <section>
            <h2 className="text-lg font-bold text-zinc-800 dark:text-zinc-100 border-b border-zinc-100 dark:border-zinc-800 pb-3 mb-5">Biodata Pribadi</h2>
            <form onSubmit={handleProfileSubmit(onUpdateProfile)} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-zinc-600 dark:text-zinc-400 mb-1.5">Email</label>
                <input type="email" value={session?.user?.email || ''} disabled className="w-full px-4 py-2.5 bg-zinc-100 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 rounded-xl text-sm text-zinc-500 cursor-not-allowed" />
                <p className="text-[10px] text-zinc-400 mt-1">Email tidak dapat diubah saat ini.</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-zinc-600 dark:text-zinc-400 mb-1.5">Nama Lengkap</label>
                  <input {...registerProfile('name')} type="text" className={`w-full px-4 py-2.5 bg-white dark:bg-zinc-900 border rounded-xl text-sm focus:ring-2 focus:outline-none transition-all ${profileErrors.name ? 'border-red-400 focus:ring-red-200' : 'border-zinc-200 dark:border-zinc-700 focus:border-[#D4802A] focus:ring-[#D4802A]/20'}`} />
                  {profileErrors.name && <p className="text-xs text-red-500 mt-1">{profileErrors.name.message}</p>}
                </div>
                <div>
                  <label className="block text-sm font-semibold text-zinc-600 dark:text-zinc-400 mb-1.5">Nomor WhatsApp</label>
                  <input {...registerProfile('phone')} type="text" placeholder="08123456789" className={`w-full px-4 py-2.5 bg-white dark:bg-zinc-900 border rounded-xl text-sm focus:ring-2 focus:outline-none transition-all ${profileErrors.phone ? 'border-red-400 focus:ring-red-200' : 'border-zinc-200 dark:border-zinc-700 focus:border-[#D4802A] focus:ring-[#D4802A]/20'}`} />
                  {profileErrors.phone && <p className="text-xs text-red-500 mt-1">{profileErrors.phone.message}</p>}
                </div>
              </div>
              <div className="flex justify-end pt-2">
                <button type="submit" disabled={isProfileSubmitting} className="flex items-center gap-2 px-6 py-2.5 bg-[#D4802A] text-white font-bold rounded-xl text-sm hover:bg-[#b56d24] transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed">
                  {isProfileSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  Simpan Perubahan
                </button>
              </div>
            </form>
          </section>

          {/* Form Ganti Password */}
          <section>
            <h2 className="text-lg font-bold text-zinc-800 dark:text-zinc-100 border-b border-zinc-100 dark:border-zinc-800 pb-3 mb-5">Keamanan Akun</h2>
            <form onSubmit={handlePasswordSubmit(onUpdatePassword)} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-zinc-600 dark:text-zinc-400 mb-1.5">Password Lama</label>
                <input {...registerPassword('oldPassword')} type="password" placeholder="••••••••" className={`w-full px-4 py-2.5 bg-white dark:bg-zinc-900 border rounded-xl text-sm focus:ring-2 focus:outline-none transition-all ${passwordErrors.oldPassword ? 'border-red-400 focus:ring-red-200' : 'border-zinc-200 dark:border-zinc-700 focus:border-[#D4802A] focus:ring-[#D4802A]/20'}`} />
                {passwordErrors.oldPassword && <p className="text-xs text-red-500 mt-1">{passwordErrors.oldPassword.message}</p>}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-zinc-600 dark:text-zinc-400 mb-1.5">Password Baru</label>
                  <input {...registerPassword('newPassword')} type="password" placeholder="Minimal 6 karakter" className={`w-full px-4 py-2.5 bg-white dark:bg-zinc-900 border rounded-xl text-sm focus:ring-2 focus:outline-none transition-all ${passwordErrors.newPassword ? 'border-red-400 focus:ring-red-200' : 'border-zinc-200 dark:border-zinc-700 focus:border-[#D4802A] focus:ring-[#D4802A]/20'}`} />
                  {passwordErrors.newPassword && <p className="text-xs text-red-500 mt-1">{passwordErrors.newPassword.message}</p>}
                </div>
                <div>
                  <label className="block text-sm font-semibold text-zinc-600 dark:text-zinc-400 mb-1.5">Konfirmasi Password Baru</label>
                  <input {...registerPassword('confirmPassword')} type="password" placeholder="Ulangi password baru" className={`w-full px-4 py-2.5 bg-white dark:bg-zinc-900 border rounded-xl text-sm focus:ring-2 focus:outline-none transition-all ${passwordErrors.confirmPassword ? 'border-red-400 focus:ring-red-200' : 'border-zinc-200 dark:border-zinc-700 focus:border-[#D4802A] focus:ring-[#D4802A]/20'}`} />
                  {passwordErrors.confirmPassword && <p className="text-xs text-red-500 mt-1">{passwordErrors.confirmPassword.message}</p>}
                </div>
              </div>
              <div className="flex justify-end pt-2">
                <button type="submit" disabled={isPasswordSubmitting} className="flex items-center gap-2 px-6 py-2.5 bg-zinc-800 text-white font-bold rounded-xl text-sm hover:bg-zinc-900 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed">
                  {isPasswordSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  Ubah Password
                </button>
              </div>
            </form>
          </section>

        </div>
      </div>
    </div>
  )
}
