'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AnimatePresence, motion } from 'framer-motion'
import {
  Camera,
  CheckCircle2,
  KeyRound,
  Loader2,
  Mail,
  ShieldCheck,
  Trash2,
  User
} from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { FetchError } from 'ofetch'
import { useCallback, useEffect, useState } from 'react'
import Cropper from 'react-easy-crop'
import { useForm } from 'react-hook-form'
import toast from 'react-hot-toast'
import { z } from 'zod'
import { requestEmailOTP, verifyAndChangeEmail } from '@/app/actions/emailChange'
import { PushNotificationManager } from '@/components/push/PushNotificationManager'
import { useLanguage } from '@/context/LanguageContext'
import { api } from '@/src/lib/api'
import getCroppedImg from '@/src/lib/cropImage'

// --- Schemas ---
const profileSchema = z.object({
  name: z.string().min(1, 'Nama tidak boleh kosong'),
  phone: z
    .string()
    .optional()
    .refine((val) => !val || /^(\+62|62|0)8[1-9][0-9]{6,11}$/.test(val), {
      message: 'Nomor WhatsApp tidak valid.'
    })
})

const passwordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Password saat ini wajib diisi'),
    newPassword: z.string().min(8, 'Password baru minimal 8 karakter'),
    confirmPassword: z.string().min(1, 'Konfirmasi password wajib diisi')
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: 'Konfirmasi password tidak cocok',
    path: ['confirmPassword']
  })

const emailSchema = z.object({
  newEmail: z.string().email('Format email tidak valid')
})

type ProfileFormValues = z.infer<typeof profileSchema>
type PasswordFormValues = z.infer<typeof passwordSchema>
type EmailFormValues = z.infer<typeof emailSchema>

export default function ProfileDataDiriPage() {
  const { data: session, status, update } = useSession()
  const { t } = useLanguage()
  const router = useRouter()
  const queryClient = useQueryClient()

  // Avatar state
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [isOAuth, setIsOAuth] = useState(false)
  const [imageToCrop, setImageToCrop] = useState<string | null>(null)
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null)

  // Email state
  const [emailMode, setEmailMode] = useState<'idle' | 'otp' | 'newEmail'>('idle')
  const [otpValue, setOtpValue] = useState('')
  const [isEmailLoading, setIsEmailLoading] = useState(false)

  const {
    register: registerProfile,
    handleSubmit: handleProfileSubmit,
    setValue: setProfileValue,
    formState: { errors: profileErrors, isValid: isProfileValid }
  } = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    mode: 'onChange',
    defaultValues: { name: '', phone: '' }
  })

  const {
    register: registerPassword,
    handleSubmit: handlePasswordSubmit,
    reset: resetPasswordForm,
    formState: { errors: passwordErrors, isValid: isPasswordValid }
  } = useForm<PasswordFormValues>({
    resolver: zodResolver(passwordSchema),
    mode: 'onChange'
  })

  const {
    register: registerEmail,
    handleSubmit: handleEmailSubmit,
    formState: { errors: emailErrors, isValid: isEmailValid }
  } = useForm<EmailFormValues>({
    resolver: zodResolver(emailSchema),
    mode: 'onChange'
  })

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/member-login?callbackUrl=/profile')
    }
  }, [status, router])

  const { data: profileData, isLoading: isQueryLoading } = useQuery({
    queryKey: ['profile'],
    queryFn: async () => {
      const data = await api<{ success: boolean; data: any }>('/api/user/profile')
      if (!data.success) throw new Error('Gagal mengambil data profil')
      return data.data
    },
    enabled: status === 'authenticated',
    staleTime: 2 * 60 * 1000
  })

  useEffect(() => {
    if (status === 'authenticated' && session?.user?.name && !profileData?.name) {
      setProfileValue('name', session.user.name)
    }
  }, [status, session, setProfileValue, profileData])

  useEffect(() => {
    if (profileData) {
      if (profileData.name) setProfileValue('name', profileData.name)
      if (profileData.phone) setProfileValue('phone', profileData.phone)
      if (profileData.image) setAvatarUrl(profileData.image)
      if (profileData.accounts && profileData.accounts.length > 0) setIsOAuth(true)
    }
  }, [profileData, setProfileValue])

  // --- Profile Name & Phone ---
  const profileMutation = useMutation({
    mutationFn: async (data: ProfileFormValues) => {
      const resData = await api<{ success: boolean; message?: string }>('/api/user/profile', {
        method: 'PUT',
        body: { name: data.name, phone: data.phone ? data.phone : undefined }
      })
      if (!resData.success) throw new Error(resData.message || 'Gagal menyimpan profil')
      return data
    },
    onSuccess: async (data) => {
      toast.success('Profil berhasil diperbarui!')
      await update({ name: data.name })
      queryClient.invalidateQueries({ queryKey: ['profile'] })
    },
    onError: (error: FetchError | Error) => {
      const msg =
        error instanceof FetchError
          ? error.data?.message || 'Gagal menyimpan profil'
          : error.message
      toast.error(msg || 'Terjadi kesalahan jaringan')
    }
  })

  const onProfileSubmit = (data: ProfileFormValues) => profileMutation.mutate(data)

  // --- Avatar Logic ---
  const onFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0]
      if (file.size > 2 * 1024 * 1024) {
        toast.error('Ukuran maksimal 2MB')
        return
      }
      const reader = new FileReader()
      reader.addEventListener('load', () => setImageToCrop(reader.result as string))
      reader.readAsDataURL(file)
      e.target.value = '' // reset input
    }
  }

  const onCropComplete = useCallback((_croppedArea: any, croppedAreaPixels: any) => {
    setCroppedAreaPixels(croppedAreaPixels)
  }, [])

  const avatarMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      const resData = await api<{ success: boolean; data: { url: string }; message?: string }>(
        '/api/user/profile/avatar',
        {
          method: 'POST',
          body: formData
        }
      )
      if (!resData.success) throw new Error(resData.message || 'Gagal mengubah foto profil')
      return resData.data.url
    },
    onSuccess: async (url) => {
      toast.success('Foto profil berhasil diubah!')
      setAvatarUrl(url)
      await update({ image: url })
      setImageToCrop(null)
      queryClient.invalidateQueries({ queryKey: ['profile'] })
      setIsUploading(false)
    },
    onError: (error: FetchError | Error) => {
      setIsUploading(false)
      const msg =
        error instanceof FetchError
          ? error.data?.message || 'Gagal mengubah foto profil'
          : error.message
      toast.error(msg || 'Terjadi kesalahan sistem')
    }
  })

  const handleCropSave = async () => {
    if (!imageToCrop || !croppedAreaPixels) return
    setIsUploading(true)
    try {
      const croppedImageBlob = await getCroppedImg(imageToCrop, croppedAreaPixels)
      if (!croppedImageBlob) throw new Error('Gagal memproses gambar')
      const formData = new FormData()
      formData.append('file', croppedImageBlob, 'avatar.jpg')
      avatarMutation.mutate(formData)
    } catch (e: any) {
      setIsUploading(false)
      toast.error(e.message || 'Terjadi kesalahan sistem')
    }
  }

  const deleteAvatarMutation = useMutation({
    mutationFn: async () => {
      const data = await api<{ success: boolean; message?: string }>('/api/user/profile/avatar', {
        method: 'DELETE'
      })
      if (!data.success) throw new Error(data.message || 'Gagal menghapus foto')
      return true
    },
    onSuccess: async () => {
      toast.success('Foto berhasil dihapus')
      setAvatarUrl(null)
      await update({ image: null })
      queryClient.invalidateQueries({ queryKey: ['profile'] })
      setIsUploading(false)
    },
    onError: (error: FetchError | Error) => {
      setIsUploading(false)
      const msg =
        error instanceof FetchError ? error.data?.message || 'Gagal menghapus foto' : error.message
      toast.error(msg || 'Kesalahan jaringan')
    }
  })

  const handleAvatarDelete = () => {
    if (!confirm('Apakah Anda yakin ingin menghapus foto profil?')) return
    setIsUploading(true)
    deleteAvatarMutation.mutate()
  }

  // --- Email Logic ---
  const handleRequestEmailOTP = async () => {
    setIsEmailLoading(true)
    const res = await requestEmailOTP()
    if (res.success) {
      toast.success(res.message ? String(res.message) : 'Berhasil')
      setEmailMode('otp')
    } else {
      toast.error(res.error ? String(res.error) : 'Gagal mengirim OTP')
    }
    setIsEmailLoading(false)
  }

  const handleVerifyAndChangeEmail = async (data: EmailFormValues) => {
    setIsEmailLoading(true)
    const res = await verifyAndChangeEmail(otpValue, data.newEmail)
    if (res.success) {
      toast.success(res.message ? String(res.message) : 'Berhasil')
      setEmailMode('idle')
      setOtpValue('')
      await update() // refresh session
    } else {
      toast.error(res.error ? String(res.error) : 'Gagal verifikasi')
    }
    setIsEmailLoading(false)
  }

  // --- Password Logic ---
  const passwordMutation = useMutation({
    mutationFn: async (data: PasswordFormValues) => {
      const resData = await api<{ success: boolean; message?: string }>('/api/user/password', {
        method: 'PUT',
        body: {
          oldPassword: data.currentPassword,
          newPassword: data.newPassword
        }
      })
      if (!resData.success) throw new Error(resData.message || 'Gagal mengubah password')
      return resData
    },
    onSuccess: () => {
      toast.success('Password berhasil diubah!')
      resetPasswordForm()
    },
    onError: (error: FetchError | Error) => {
      const msg =
        error instanceof FetchError
          ? error.data?.message || 'Gagal mengubah password'
          : error.message
      toast.error(msg || 'Terjadi kesalahan jaringan')
    }
  })

  const onPasswordSubmit = (data: PasswordFormValues) => passwordMutation.mutate(data)

  if (isQueryLoading || status === 'loading') {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-[#D4802A]" />
      </div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-8 pb-10"
    >
      {/* CROP MODAL */}
      <AnimatePresence>
        {imageToCrop && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
          >
            <div className="bg-white dark:bg-zinc-900 rounded-[4px] w-full max-w-md overflow-hidden shadow-sm flex flex-col">
              <div className="p-4 border-b border-zinc-100 dark:border-zinc-800 flex justify-between items-center">
                <h3 className="font-bold text-zinc-900 dark:text-zinc-100">Sesuaikan Foto</h3>
                <button
                  type="button"
                  onClick={() => setImageToCrop(null)}
                  className="text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
                >
                  Batal
                </button>
              </div>
              <div className="relative h-80 w-full bg-zinc-100 dark:bg-zinc-950">
                <Cropper
                  image={imageToCrop}
                  crop={crop}
                  zoom={zoom}
                  aspect={1}
                  cropShape="round"
                  showGrid={false}
                  onCropChange={setCrop}
                  onCropComplete={onCropComplete}
                  onZoomChange={setZoom}
                />
              </div>
              <div className="p-4 border-t border-zinc-100 dark:border-zinc-800 flex items-center gap-4">
                <span className="text-xs font-bold text-zinc-500">Zoom</span>
                <input
                  type="range"
                  min={1}
                  max={3}
                  step={0.1}
                  value={zoom}
                  onChange={(e) => setZoom(Number(e.target.value))}
                  className="w-full accent-[#D4802A]"
                  aria-label="Zoom"
                  title="Zoom"
                />
              </div>
              <div className="p-4 bg-zinc-50 dark:bg-zinc-800/50">
                <button
                  type="button"
                  onClick={handleCropSave}
                  disabled={isUploading}
                  className="w-full bg-[#D4802A] hover:bg-[#b56d24] text-white font-bold py-3 rounded-[4px] transition-all flex justify-center items-center gap-2"
                >
                  {isUploading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Simpan Foto'}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* DATA DIRI SECTION */}
      <section className="bg-white dark:bg-zinc-900 rounded-[4px] p-6 md:p-8 shadow-sm border border-zinc-200/50 dark:border-zinc-800/80">
        {/* Koin Pisang Loyalty Balance Card */}
        {profileData?.koinPisang !== undefined && (
          <div className="bg-gradient-to-r from-amber-500 to-amber-600 dark:from-amber-600 dark:to-amber-700 text-white rounded-[4px] p-5 shadow-sm mb-6 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-xs uppercase font-bold tracking-wider opacity-90">
                Koin Pisang Anda
              </span>
              <div className="flex items-baseline gap-1.5">
                <span className="text-3xl font-black font-serif">
                  🍌 {profileData.koinPisang.toLocaleString('id-ID')}
                </span>
                <span className="text-xs opacity-75">Koin</span>
              </div>
            </div>
            <Link
              href="/profile/koin-history"
              className="text-xs bg-white text-amber-700 px-4 py-2 rounded-[4px] font-bold shadow-sm hover:bg-amber-50 hover:scale-105 active:scale-95 transition-all focus:outline-none"
            >
              Riwayat Koin
            </Link>
          </div>
        )}

        <div className="flex items-center gap-4 mb-6 pb-6 border-b border-zinc-100 dark:border-zinc-800">
          <div className="w-12 h-12 rounded-[4px] bg-[#D4802A]/10 text-[#D4802A] flex items-center justify-center">
            <User className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold font-serif text-zinc-900 dark:text-zinc-100">
              {t('profile_title')}
            </h2>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">{t('profile_subtitle')}</p>
          </div>
        </div>

        <form onSubmit={handleProfileSubmit(onProfileSubmit)} className="space-y-5">
          {/* Avatar Upload */}
          <div className="flex flex-col md:flex-row items-center md:items-start gap-6 mb-8 bg-zinc-50 dark:bg-zinc-800/30 p-6 rounded-[4px] border border-zinc-100 dark:border-zinc-800">
            <div className="relative group shrink-0">
              <div className="w-24 h-24 md:w-28 md:h-28 rounded-full overflow-hidden bg-zinc-200 dark:bg-zinc-800 border-4 border-white dark:border-zinc-900 shadow-md relative">
                {avatarUrl || session?.user?.image ? (
                  <Image
                    src={avatarUrl || session?.user?.image || ''}
                    alt="Avatar"
                    fill
                    className="object-cover"
                  />
                ) : (
                  <User className="w-12 h-12 text-zinc-400 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
                )}
                {isUploading && !imageToCrop && (
                  <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                    <Loader2 className="w-6 h-6 text-white animate-spin" />
                  </div>
                )}
              </div>
              <label
                htmlFor="avatar-input"
                className="absolute bottom-0 right-0 p-2.5 bg-[#D4802A] text-white rounded-full cursor-pointer shadow-sm hover:bg-[#b56d24] transition-all hover:scale-105 active:scale-95 group-hover:ring-4 ring-white dark:ring-zinc-900"
              >
                <Camera className="w-4 h-4" />
                <input
                  id="avatar-input"
                  type="file"
                  className="hidden"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={onFileChange}
                  disabled={isUploading}
                  aria-label="Upload Avatar"
                  title="Upload Avatar"
                />
              </label>
            </div>
            <div className="text-center md:text-left flex-1">
              <h3 className="font-bold text-zinc-900 dark:text-zinc-100 text-lg">
                {t('profile_avatar_title')}
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 max-w-sm">
                {t('profile_avatar_desc')}
              </p>

              {(avatarUrl || session?.user?.image) && (
                <button
                  type="button"
                  onClick={handleAvatarDelete}
                  disabled={isUploading}
                  className="mt-3 text-sm text-red-500 hover:text-red-600 font-bold flex items-center gap-1.5 mx-auto md:mx-0 transition-colors"
                >
                  <Trash2 className="w-4 h-4" /> {t('profile_avatar_delete')}
                </button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label
                htmlFor="profile-name"
                className="block text-sm font-bold text-zinc-700 dark:text-zinc-300 mb-2"
              >
                {t('profile_name_label')}
              </label>
              <input
                id="profile-name"
                type="text"
                {...registerProfile('name')}
                className="w-full p-3.5 rounded-[4px] border border-zinc-200 dark:border-zinc-800 bg-transparent focus:ring-2 focus:ring-[#D4802A]/50 outline-none transition-all"
                placeholder={t('profile_name_placeholder')}
              />
              {profileErrors.name && (
                <p className="text-xs text-red-500 mt-1.5">{profileErrors.name.message}</p>
              )}
            </div>

            <div>
              <label
                htmlFor="profile-phone"
                className="block text-sm font-bold text-zinc-700 dark:text-zinc-300 mb-2"
              >
                {t('profile_phone_label')}
              </label>
              <input
                id="profile-phone"
                type="tel"
                {...registerProfile('phone')}
                className="w-full p-3.5 rounded-[4px] border border-zinc-200 dark:border-zinc-800 bg-transparent focus:ring-2 focus:ring-[#D4802A]/50 outline-none transition-all"
                placeholder={t('profile_phone_placeholder')}
              />
              {profileErrors.phone && (
                <p className="text-xs text-red-500 mt-1.5">{profileErrors.phone.message}</p>
              )}
            </div>
          </div>

          <div className="pt-4 flex justify-end">
            <button
              type="submit"
              disabled={profileMutation.isPending || !isProfileValid}
              className="bg-[#D4802A] hover:bg-[#b56d24] text-white font-bold py-3 px-8 rounded-[4px] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {profileMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                t('profile_save_btn')
              )}
            </button>
          </div>
        </form>
      </section>

      {/* CONDITIONAL RENDER: EMAIL & PASSWORD OR OAUTH INFO */}
      {isOAuth ? (
        <section className="bg-white dark:bg-zinc-900 rounded-[4px] p-6 md:p-8 shadow-sm border border-zinc-200/50 dark:border-zinc-800/80">
          <div className="flex items-center gap-4 mb-6 pb-6 border-b border-zinc-100 dark:border-zinc-800">
            <div className="w-12 h-12 rounded-[4px] bg-blue-100 text-blue-600 flex items-center justify-center">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold font-serif text-zinc-900 dark:text-zinc-100">
                {t('profile_oauth_title')}
              </h2>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                {t('profile_oauth_subtitle')}
              </p>
            </div>
          </div>

          <div className="bg-blue-50 dark:bg-blue-900/10 p-6 rounded-[4px] border border-blue-100 dark:border-blue-900/50 flex flex-col md:flex-row items-center gap-6">
            <div className="w-16 h-16 bg-white dark:bg-zinc-800 rounded-[4px] shadow-sm flex items-center justify-center shrink-0">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="w-8 h-8">
                <title>Google Logo</title>
                <path
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  fill="#4285F4"
                />
                <path
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  fill="#34A853"
                />
                <path
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  fill="#FBBC05"
                />
                <path
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  fill="#EA4335"
                />
                <path d="M1 1h22v22H1z" fill="none" />
              </svg>
            </div>
            <div>
              <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 mb-1">
                Terhubung dengan Google
              </h3>
              <p className="text-zinc-600 dark:text-zinc-400 text-sm leading-relaxed max-w-xl">
                {t('profile_oauth_desc').replace('{email}', session?.user?.email || '')}
              </p>
            </div>
          </div>
        </section>
      ) : (
        <>
          {/* GANTI EMAIL SECTION (ZERO-TRUST OTP) */}
          <section className="bg-white dark:bg-zinc-900 rounded-[4px] p-6 md:p-8 shadow-sm border border-zinc-200/50 dark:border-zinc-800/80">
            <div className="flex items-center gap-4 mb-6 pb-6 border-b border-zinc-100 dark:border-zinc-800">
              <div className="w-12 h-12 rounded-[4px] bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400 flex items-center justify-center">
                <Mail className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-xl font-bold font-serif text-zinc-900 dark:text-zinc-100">
                  {t('profile_email_title')}
                </h2>
                <p className="text-sm text-zinc-500 dark:text-zinc-400">
                  {t('profile_email_subtitle')}
                </p>
              </div>
            </div>

            <div className="max-w-lg space-y-5">
              {emailMode === 'idle' && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
                  <div>
                    <label
                      htmlFor="current-email-input"
                      className="block text-sm font-bold text-zinc-700 dark:text-zinc-300 mb-2"
                    >
                      {t('profile_email_current')}
                    </label>
                    <div className="flex flex-col sm:flex-row gap-3">
                      <input
                        id="current-email-input"
                        type="email"
                        value={session?.user?.email || ''}
                        disabled
                        placeholder="Current Email"
                        title="Current Email"
                        aria-label="Current Email"
                        className="flex-1 p-3.5 rounded-[4px] border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50 text-zinc-500 cursor-not-allowed outline-none w-full"
                      />
                      <button
                        type="button"
                        onClick={handleRequestEmailOTP}
                        disabled={isEmailLoading}
                        className="w-full sm:w-auto px-6 py-3.5 bg-zinc-900 dark:bg-zinc-100 hover:bg-zinc-800 dark:hover:bg-zinc-200 text-white dark:text-zinc-900 font-bold rounded-[4px] transition-all disabled:opacity-50 whitespace-nowrap flex items-center justify-center"
                      >
                        {isEmailLoading ? (
                          <Loader2 className="w-5 h-5 animate-spin" />
                        ) : (
                          t('profile_email_change_btn')
                        )}
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}

              {emailMode === 'otp' && (
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="space-y-4 bg-blue-50 dark:bg-blue-900/10 p-5 rounded-[4px] border border-blue-100 dark:border-blue-900/50"
                >
                  <div className="flex gap-3 text-blue-700 dark:text-blue-400 mb-2">
                    <ShieldCheck className="w-5 h-5 shrink-0" />
                    {/* SECURITY FIX (audit QA & Security): sebelumnya dangerouslySetInnerHTML
                        menyisipkan session.user.email mentah ke string HTML tanpa escaping.
                        Email berasal dari input pengguna saat registrasi/OAuth — meski saat ini
                        kemungkinan dibatasi validator .email() Zod, mengandalkan efek samping
                        validator lain untuk mencegah XSS itu rapuh. JSX di bawah otomatis
                        meng-escape teks, jadi aman terlepas dari isi email-nya. */}
                    <p className="text-sm">
                      {t('profile_email_otp_sent').split('{email}')[0]}
                      <strong>{session?.user?.email}</strong>
                      {t('profile_email_otp_sent').split('{email}')[1]}
                    </p>
                  </div>
                  <div>
                    <input
                      type="text"
                      maxLength={6}
                      value={otpValue}
                      onChange={(e) => setOtpValue(e.target.value.replace(/\D/g, ''))}
                      className="w-full text-center tracking-[0.5em] font-mono text-2xl p-4 rounded-[4px] border border-blue-200 dark:border-blue-800 bg-white dark:bg-zinc-950 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                      placeholder="------"
                    />
                  </div>
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => setEmailMode('idle')}
                      className="flex-1 p-3 text-zinc-600 dark:text-zinc-400 font-bold hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-[4px] transition-colors"
                    >
                      {t('address_cancel_btn')}
                    </button>
                    <button
                      type="button"
                      onClick={() => setEmailMode('newEmail')}
                      disabled={otpValue.length !== 6}
                      className="flex-1 p-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-[4px] transition-all disabled:opacity-50"
                    >
                      {t('profile_email_otp_verify_btn')}
                    </button>
                  </div>
                </motion.div>
              )}

              {emailMode === 'newEmail' && (
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="space-y-4"
                >
                  <div className="flex items-center gap-2 text-green-600 dark:text-green-400 mb-2">
                    <CheckCircle2 className="w-5 h-5" />
                    <p className="text-sm font-bold">{t('profile_email_otp_verified')}</p>
                  </div>
                  <form
                    onSubmit={handleEmailSubmit(handleVerifyAndChangeEmail)}
                    className="space-y-4"
                  >
                    <div>
                      <label
                        htmlFor="new-email-input"
                        className="block text-sm font-bold text-zinc-700 dark:text-zinc-300 mb-2"
                      >
                        {t('profile_email_new_label')}
                      </label>
                      <input
                        id="new-email-input"
                        type="email"
                        {...registerEmail('newEmail')}
                        className="w-full p-3.5 rounded-[4px] border border-zinc-200 dark:border-zinc-800 bg-transparent focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                        placeholder={t('profile_email_new_placeholder')}
                        title={t('profile_email_new_label')}
                        aria-label={t('profile_email_new_label')}
                      />
                      {emailErrors.newEmail && (
                        <p className="text-xs text-red-500 mt-1.5">
                          {emailErrors.newEmail.message}
                        </p>
                      )}
                    </div>
                    <div className="flex gap-3 pt-2">
                      <button
                        type="button"
                        onClick={() => setEmailMode('idle')}
                        className="flex-1 p-3 text-zinc-600 dark:text-zinc-400 font-bold hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-[4px] transition-colors"
                      >
                        {t('address_cancel_btn')}
                      </button>
                      <button
                        type="submit"
                        disabled={isEmailLoading || !isEmailValid}
                        className="flex-1 p-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-[4px] transition-all disabled:opacity-50 flex justify-center"
                      >
                        {isEmailLoading ? (
                          <Loader2 className="w-5 h-5 animate-spin" />
                        ) : (
                          t('profile_email_save_btn')
                        )}
                      </button>
                    </div>
                  </form>
                </motion.div>
              )}
            </div>
          </section>

          {/* GANTI PASSWORD SECTION */}
          <section className="bg-white dark:bg-zinc-900 rounded-[4px] p-6 md:p-8 shadow-sm border border-zinc-200/50 dark:border-zinc-800/80">
            <div className="flex items-center gap-4 mb-6 pb-6 border-b border-zinc-100 dark:border-zinc-800">
              <div className="w-12 h-12 rounded-[4px] bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 flex items-center justify-center">
                <KeyRound className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-xl font-bold font-serif text-zinc-900 dark:text-zinc-100">
                  {t('profile_password_title')}
                </h2>
                <p className="text-sm text-zinc-500 dark:text-zinc-400">
                  {t('profile_password_subtitle')}
                </p>
              </div>
            </div>

            <form onSubmit={handlePasswordSubmit(onPasswordSubmit)} className="space-y-5 max-w-lg">
              <div>
                <label
                  htmlFor="currentPassword"
                  className="block text-sm font-bold text-zinc-700 dark:text-zinc-300 mb-2"
                >
                  {t('profile_password_current')}
                </label>
                <input
                  id="currentPassword"
                  type="password"
                  {...registerPassword('currentPassword')}
                  className="w-full p-3.5 rounded-[4px] border border-zinc-200 dark:border-zinc-800 bg-transparent focus:ring-2 focus:ring-[#D4802A]/50 outline-none transition-all"
                  placeholder={t('profile_password_current_placeholder')}
                />
                {passwordErrors.currentPassword && (
                  <p className="text-xs text-red-500 mt-1.5">
                    {passwordErrors.currentPassword.message}
                  </p>
                )}
              </div>

              <div>
                <label
                  htmlFor="newPassword"
                  className="block text-sm font-bold text-zinc-700 dark:text-zinc-300 mb-2"
                >
                  {t('profile_password_new')}
                </label>
                <input
                  id="newPassword"
                  type="password"
                  {...registerPassword('newPassword')}
                  className="w-full p-3.5 rounded-[4px] border border-zinc-200 dark:border-zinc-800 bg-transparent focus:ring-2 focus:ring-[#D4802A]/50 outline-none transition-all"
                  placeholder={t('profile_password_new_placeholder')}
                />
                {passwordErrors.newPassword && (
                  <p className="text-xs text-red-500 mt-1.5">
                    {passwordErrors.newPassword.message}
                  </p>
                )}
              </div>

              <div>
                <label
                  htmlFor="confirmPassword"
                  className="block text-sm font-bold text-zinc-700 dark:text-zinc-300 mb-2"
                >
                  {t('profile_password_confirm')}
                </label>
                <input
                  id="confirmPassword"
                  type="password"
                  {...registerPassword('confirmPassword')}
                  className="w-full p-3.5 rounded-[4px] border border-zinc-200 dark:border-zinc-800 bg-transparent focus:ring-2 focus:ring-[#D4802A]/50 outline-none transition-all"
                  placeholder={t('profile_password_confirm_placeholder')}
                />
                {passwordErrors.confirmPassword && (
                  <p className="text-xs text-red-500 mt-1.5">
                    {passwordErrors.confirmPassword.message}
                  </p>
                )}
              </div>

              <div className="pt-4 flex justify-end">
                <button
                  type="submit"
                  disabled={passwordMutation.isPending || !isPasswordValid}
                  className="bg-zinc-900 dark:bg-zinc-100 hover:bg-zinc-800 dark:hover:bg-zinc-200 text-white dark:text-zinc-900 font-bold py-3 px-8 rounded-[4px] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {passwordMutation.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    t('profile_password_save_btn')
                  )}
                </button>
              </div>
            </form>
          </section>

          {/* RAG Source: app/(user)/profile/page.tsx (relocated Push Notification section) */}
          <section className="bg-white dark:bg-zinc-900 rounded-[4px] p-6 md:p-8 shadow-sm border border-zinc-200/50 dark:border-zinc-800/80 mt-6">
            <h2 className="text-xl font-bold font-serif text-zinc-900 dark:text-zinc-100 mb-2">
              Notifikasi Web Push
            </h2>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-6">
              Aktifkan notifikasi web push untuk menerima informasi status pesanan Anda secara
              real-time.
            </p>
            <PushNotificationManager />
          </section>
        </>
      )}
    </motion.div>
  )
}
