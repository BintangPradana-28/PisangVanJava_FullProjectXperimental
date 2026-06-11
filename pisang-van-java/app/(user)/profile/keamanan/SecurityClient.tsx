'use client'

import { BellRing, ShieldCheck, Smartphone, Trash2 } from 'lucide-react'
import Image from 'next/image'
import { useState, useEffect } from 'react'
import { toast } from 'react-hot-toast'
import {
  deleteAccount,
  disable2FA,
  enable2FA,
  generate2FASecret,
  revokeDeviceSession,
  updateNotificationPrefs
} from '@/app/actions/security'
import { useLanguage } from '@/context/LanguageContext'

interface Props {
  initialPrefs: { email: boolean; push: boolean; promo: boolean; order: boolean }
  twoFactorEnabled: boolean
  activeSessions: any[]
  hasPassword: boolean
}

export default function SecurityClient({
  initialPrefs,
  twoFactorEnabled: init2FA,
  activeSessions: initSessions,
  hasPassword
}: Props) {
  const { t } = useLanguage()
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  const [prefs, setPrefs] = useState(initialPrefs)
  const [is2FAEnabled, setIs2FAEnabled] = useState(init2FA)
  const [sessions, setSessions] = useState(initSessions)

  // 2FA Setup State
  const [show2FA, setShow2FA] = useState(false)
  const [qrCodeUrl, setQrCodeUrl] = useState('')
  const [secret, setSecret] = useState('')
  const [otpInput, setOtpInput] = useState('')

  // Delete Account State
  const [showDelete, setShowDelete] = useState(false)

  const handlePrefChange = async (key: keyof typeof prefs) => {
    const newPrefs = { ...prefs, [key]: !prefs[key] }
    setPrefs(newPrefs)
    try {
      await updateNotificationPrefs(newPrefs)
      toast.success('Preferensi notifikasi diperbarui.')
    } catch {
      toast.error('Gagal memperbarui preferensi.')
      setPrefs(prefs) // rollback
    }
  }

  const handleSetup2FA = async () => {
    try {
      const res = await generate2FASecret()
      setSecret(res.secret)
      setQrCodeUrl(res.qrCodeDataUrl)
      setShow2FA(true)
    } catch (err: any) {
      toast.error(err.message || 'Gagal membuat sesi 2FA')
    }
  }

  const handleEnable2FA = async () => {
    if (otpInput.length !== 6) return toast.error('OTP harus 6 digit')
    try {
      await enable2FA(otpInput)
      toast.success('2FA berhasil diaktifkan!')
      setIs2FAEnabled(true)
      setShow2FA(false)
    } catch (err: any) {
      toast.error(err.message || 'OTP Salah')
    }
  }

  const handleDisable2FA = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    const pwd = formData.get('password') as string
    try {
      await disable2FA(pwd)
      toast.success('2FA dinonaktifkan.')
      setIs2FAEnabled(false)
    } catch (err: any) {
      toast.error(err.message || 'Gagal menonaktifkan 2FA')
    }
  }

  const handleRevoke = async (sessionId: string) => {
    try {
      await revokeDeviceSession(sessionId)
      setSessions((prev) => prev.filter((s) => s.sessionId !== sessionId))
      toast.success('Sesi perangkat telah dicabut.')
    } catch (err: any) {
      toast.error(err.message || 'Gagal mencabut sesi.')
    }
  }

  const handleDeleteAccount = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    try {
      await deleteAccount(formData)
      toast.success('Akun berhasil dihapus.')
      window.location.href = '/'
    } catch (err: any) {
      toast.error(err.message || 'Gagal menghapus akun.')
    }
  }

  return (
    <div className="space-y-10">
      <div className="mb-8">
        <h2 className="text-xl md:text-2xl font-bold mb-4 font-serif text-zinc-900 dark:text-zinc-100">
          {t('security_title')}
        </h2>
        <p className="text-sm md:text-base text-zinc-600 dark:text-zinc-400">
          {t('security_subtitle')}
        </p>
      </div>

      {/* 1. Preferensi Notifikasi */}
      <section className="bg-white dark:bg-zinc-900 rounded-3xl p-6 md:p-8 shadow-sm border border-zinc-200/50 dark:border-zinc-800/80">
        <div className="flex items-center gap-3 mb-6 pb-6 border-b border-zinc-100 dark:border-zinc-800">
          <div className="w-12 h-12 rounded-full bg-[#D4802A]/10 text-[#D4802A] flex items-center justify-center">
            <BellRing className="w-6 h-6" />
          </div>
          <h3 className="text-xl font-bold font-serif text-zinc-900 dark:text-zinc-100">{t('security_prefs_title')}</h3>
        </div>
        <div className="space-y-4">
          <ToggleItem
            label={t('security_pref_promo')}
            desc={t('security_pref_promo_desc')}
            checked={prefs.promo}
            onChange={() => handlePrefChange('promo')}
          />
          <ToggleItem
            label={t('security_pref_order')}
            desc={t('security_pref_order_desc')}
            checked={prefs.order}
            onChange={() => handlePrefChange('order')}
          />
          <ToggleItem
            label={t('security_pref_push')}
            desc={t('security_pref_push_desc')}
            checked={prefs.push}
            onChange={() => handlePrefChange('push')}
          />
        </div>
      </section>

      {/* 2. Keamanan 2 Langkah (2FA) */}
      <section className="bg-white dark:bg-zinc-900 rounded-3xl p-6 md:p-8 shadow-sm border border-zinc-200/50 dark:border-zinc-800/80">
        <div className="flex items-center gap-3 mb-6 pb-6 border-b border-zinc-100 dark:border-zinc-800">
          <div className="w-12 h-12 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-xl font-bold font-serif text-zinc-900 dark:text-zinc-100">{t('security_totp_title')}</h3>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              {t('security_totp_desc')}
            </p>
          </div>
        </div>

        {!is2FAEnabled ? (
          <div>
            <button
              onClick={handleSetup2FA}
              className="bg-zinc-900 dark:bg-zinc-100 hover:bg-zinc-800 dark:hover:bg-zinc-200 text-white dark:text-zinc-900 px-6 py-3 rounded-xl text-sm font-bold transition-all"
            >
              {t('security_totp_enable_btn')}
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <span className="inline-flex items-center gap-2 px-3 py-1.5 bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400 text-sm font-bold rounded-full">
              <span className="w-2 h-2 rounded-full bg-green-500"></span> {t('security_totp_active')}
            </span>
            <form onSubmit={handleDisable2FA} className="flex gap-3 items-center">
              {hasPassword && (
                <input
                  type="password"
                  name="password"
                  placeholder={t('security_danger_password_placeholder')}
                  className="px-4 py-2 border border-zinc-200 dark:border-zinc-800 bg-transparent rounded-xl text-sm outline-none focus:ring-2 focus:ring-[#D4802A]/50"
                  required
                />
              )}
              <button type="submit" className="text-sm px-4 py-2 bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/40 font-bold rounded-xl transition-colors">
                {t('security_totp_disable_btn')}
              </button>
            </form>
          </div>
        )}

      </section>

      {/* 3. Manajemen Sesi Aktif */}
      <section className="bg-white dark:bg-zinc-900 rounded-3xl p-6 md:p-8 shadow-sm border border-zinc-200/50 dark:border-zinc-800/80">
        <div className="flex items-center gap-3 mb-6 pb-6 border-b border-zinc-100 dark:border-zinc-800">
          <div className="w-12 h-12 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center">
            <Smartphone className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-xl font-bold font-serif text-zinc-900 dark:text-zinc-100">{t('security_sessions_title')}</h3>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              {t('security_sessions_desc')}
            </p>
          </div>
        </div>

        <div className="space-y-3">
          {sessions.length === 0 && <p className="text-sm text-zinc-500 dark:text-zinc-400">Tidak ada data sesi.</p>}
          {sessions.map((sess) => (
            <div
              key={sess.sessionId}
              className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 bg-zinc-50 dark:bg-zinc-800/30 rounded-2xl border border-zinc-100 dark:border-zinc-800/50"
            >
              <div>
                <p className="font-bold text-sm text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                  {sess.device || 'Unknown Browser'}
                  {sess.current && (
                    <span className="text-[10px] bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 px-2.5 py-0.5 rounded-full font-bold">
                      {t('security_sessions_current')}
                    </span>
                  )}
                </p>
                {mounted && (
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                    Login sejak: {new Date(sess.createdAt).toLocaleString('id-ID')}
                  </p>
                )}
              </div>
              {!sess.current && (
                <button
                  onClick={() => handleRevoke(sess.sessionId)}
                  className="mt-3 sm:mt-0 text-xs px-4 py-2 border border-red-200 dark:border-red-900/50 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-colors font-bold"
                >
                  {t('security_sessions_revoke_btn')}
                </button>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* 4. Hapus Akun */}
      <section className="bg-red-50/50 dark:bg-red-900/10 rounded-3xl p-6 md:p-8 border border-red-100 dark:border-red-900/30">
        <div className="flex items-center gap-3 mb-6 pb-6 border-b border-red-100 dark:border-red-900/30">
          <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center">
            <Trash2 className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-xl font-bold font-serif text-red-600 dark:text-red-400">{t('security_danger_title')}</h3>
            <p className="text-sm text-red-500 dark:text-red-400/80">
              {t('security_danger_desc')}
            </p>
          </div>
        </div>

        {!showDelete ? (
          <button
            onClick={() => setShowDelete(true)}
            className="text-sm text-white bg-red-600 hover:bg-red-700 px-6 py-3 rounded-xl font-bold transition-all"
          >
            {t('security_danger_delete_btn')}
          </button>
        ) : (
          <form
            onSubmit={handleDeleteAccount}
            className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-red-200 dark:border-red-900/50"
          >
            <p className="text-sm font-bold mb-4 text-red-600 dark:text-red-400">{t('security_danger_confirm_title')}</p>
            {hasPassword && (
              <input
                type="password"
                name="password"
                placeholder={t('security_danger_password_placeholder')}
                className="w-full px-4 py-3 border border-zinc-200 dark:border-zinc-800 bg-transparent rounded-xl text-sm mb-4 focus:ring-2 focus:ring-red-500 outline-none transition-all"
                required
              />
            )}
            <div className="flex gap-3">
              <button
                type="submit"
                className="bg-red-600 text-white px-6 py-3 rounded-xl text-sm font-bold hover:bg-red-700 transition"
              >
                {t('security_danger_confirm_btn')}
              </button>
              <button
                type="button"
                onClick={() => setShowDelete(false)}
                className="text-zinc-600 dark:text-zinc-400 text-sm px-6 py-3 font-bold hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl transition-colors"
              >
                {t('security_danger_cancel_btn')}
              </button>
            </div>
          </form>
        )}
      </section>

      {/* 2FA Setup Modal (Moved outside to escape stacking context) */}
      {show2FA && (
        <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-zinc-900 p-6 md:p-8 rounded-3xl max-w-sm w-full shadow-2xl relative">
            <button
              onClick={() => setShow2FA(false)}
              className="absolute top-6 right-6 text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
            >
              ✕
            </button>
            <h4 className="text-xl font-bold text-zinc-900 dark:text-zinc-100 mb-2 font-serif">Setup Authenticator</h4>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-6">
              Pindai kode QR ini menggunakan aplikasi Google Authenticator atau Authy.
            </p>

            <div className="bg-white p-4 rounded-2xl flex justify-center mb-4 border border-zinc-200 shadow-sm">
              {qrCodeUrl && <Image src={qrCodeUrl} alt="QR Code 2FA" width={200} height={200} />}
            </div>
            <p className="text-xs text-center text-zinc-500 dark:text-zinc-400 font-mono mb-6 break-all">
              Secret: {secret}
            </p>

            <input
              type="text"
              placeholder="Kode 6 Digit"
              value={otpInput}
              onChange={(e) => setOtpInput(e.target.value)}
              maxLength={6}
              className="w-full border border-zinc-200 dark:border-zinc-800 bg-transparent rounded-xl px-4 py-4 text-center tracking-[0.5em] font-mono text-xl mb-4 focus:ring-2 focus:ring-[#D4802A]/50 outline-none transition-all"
            />
            <button
              onClick={handleEnable2FA}
              className="w-full bg-[#D4802A] text-white font-bold py-4 rounded-xl hover:bg-[#b56d24] transition-colors shadow-lg"
            >
              Verifikasi & Aktifkan
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// Komponen Helper
function ToggleItem({
  label,
  desc,
  checked,
  onChange
}: {
  label: string
  desc: string
  checked: boolean
  onChange: () => void
}) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <h4 className="text-sm font-bold text-zinc-800 dark:text-zinc-200">{label}</h4>
        <p className="text-xs text-zinc-500 dark:text-zinc-400 font-medium">{desc}</p>
      </div>
      <div
        onClick={onChange}
        className={`${
          checked ? 'bg-[#D4802A]' : 'bg-zinc-200 dark:bg-zinc-700'
        } relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer shrink-0`}
      >
        <span
          className={`${checked ? 'translate-x-6' : 'translate-x-1'} inline-block h-4 w-4 transform bg-white rounded-full transition-transform`}
        />
      </div>
    </div>
  )
}
