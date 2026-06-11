'use client'

import { BellRing, ShieldCheck, Smartphone, Trash2 } from 'lucide-react'
import Image from 'next/image'
import { useState } from 'react'
import { toast } from 'react-hot-toast'
import {
  deleteAccount,
  disable2FA,
  enable2FA,
  generate2FASecret,
  revokeDeviceSession,
  updateNotificationPrefs
} from '@/app/actions/security'

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
      {/* 1. Preferensi Notifikasi */}
      <section className="bg-white/50 backdrop-blur-md border border-brown-900/10 p-6 rounded-2xl">
        <div className="flex items-center gap-3 mb-4">
          <BellRing className="w-6 h-6 text-amber-brand" />
          <h3 className="text-lg font-semibold text-brown-900">Preferensi Notifikasi</h3>
        </div>
        <div className="space-y-4">
          <ToggleItem
            label="Email Promosi"
            desc="Dapatkan info promo & diskon Koin Pisang via email."
            checked={prefs.promo}
            onChange={() => handlePrefChange('promo')}
          />
          <ToggleItem
            label="Update Status Pesanan"
            desc="Kirim email setiap pesanan diproses atau selesai."
            checked={prefs.order}
            onChange={() => handlePrefChange('order')}
          />
          <ToggleItem
            label="Push Notification"
            desc="Notifikasi instan di browser (Memerlukan izin)."
            checked={prefs.push}
            onChange={() => handlePrefChange('push')}
          />
        </div>
      </section>

      {/* 2. Keamanan 2 Langkah (2FA) */}
      <section className="bg-white/50 backdrop-blur-md border border-brown-900/10 p-6 rounded-2xl">
        <div className="flex items-center gap-3 mb-4">
          <ShieldCheck className="w-6 h-6 text-amber-brand" />
          <h3 className="text-lg font-semibold text-brown-900">Verifikasi 2 Langkah (TOTP)</h3>
        </div>
        <p className="text-sm text-gray-600 mb-4">
          Lindungi akun Anda dengan lapisan keamanan tambahan menggunakan aplikasi seperti Google
          Authenticator.
        </p>

        {!is2FAEnabled ? (
          <div>
            <button
              onClick={handleSetup2FA}
              className="bg-brown-900 text-cream-50 px-4 py-2 rounded-lg text-sm font-semibold hover:bg-black transition"
            >
              Aktifkan 2FA
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <span className="inline-flex items-center gap-2 px-3 py-1 bg-green-100 text-green-800 text-sm font-semibold rounded-full">
              <span className="w-2 h-2 rounded-full bg-green-500"></span> Aktif
            </span>
            <form onSubmit={handleDisable2FA} className="flex gap-2 items-center">
              {hasPassword && (
                <input
                  type="password"
                  name="password"
                  placeholder="Kata Sandi Saat Ini"
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  required
                />
              )}
              <button type="submit" className="text-sm text-red-600 hover:underline font-medium">
                Nonaktifkan
              </button>
            </form>
          </div>
        )}

      </section>

      {/* 3. Manajemen Sesi Aktif */}
      <section className="bg-white/50 backdrop-blur-md border border-brown-900/10 p-6 rounded-2xl">
        <div className="flex items-center gap-3 mb-4">
          <Smartphone className="w-6 h-6 text-amber-brand" />
          <h3 className="text-lg font-semibold text-brown-900">Sesi & Perangkat Aktif</h3>
        </div>
        <p className="text-sm text-gray-600 mb-4">
          Daftar perangkat yang saat ini masuk ke akun Anda. Jika ada perangkat yang tidak dikenali,
          segera cabut aksesnya.
        </p>

        <div className="space-y-3">
          {sessions.length === 0 && <p className="text-sm text-gray-400">Tidak ada data sesi.</p>}
          {sessions.map((sess) => (
            <div
              key={sess.sessionId}
              className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 bg-gray-50/50 rounded-xl border border-gray-100"
            >
              <div>
                <p className="font-medium text-sm text-brown-900 flex items-center gap-2">
                  {sess.device || 'Unknown Browser'}
                  {sess.current && (
                    <span className="text-[10px] bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
                      Perangkat Ini
                    </span>
                  )}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  Login sejak: {new Date(sess.createdAt).toLocaleString('id-ID')}
                </p>
              </div>
              {!sess.current && (
                <button
                  onClick={() => handleRevoke(sess.sessionId)}
                  className="mt-3 sm:mt-0 text-xs px-3 py-1.5 border border-red-200 text-red-600 hover:bg-red-50 rounded-lg transition font-medium"
                >
                  Cabut Akses
                </button>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* 4. Hapus Akun */}
      <section className="bg-red-50/50 backdrop-blur-md border border-red-100 p-6 rounded-2xl">
        <div className="flex items-center gap-3 mb-4">
          <Trash2 className="w-6 h-6 text-red-600" />
          <h3 className="text-lg font-semibold text-red-600">Zona Berbahaya</h3>
        </div>
        <p className="text-sm text-gray-600 mb-4">
          Hapus akun Anda beserta semua data Koin Pisang dan Voucher secara permanen. Tindakan ini
          tidak bisa dibatalkan.
        </p>

        {!showDelete ? (
          <button
            onClick={() => setShowDelete(true)}
            className="text-sm text-red-600 font-bold hover:underline"
          >
            Hapus Akun Saya
          </button>
        ) : (
          <form
            onSubmit={handleDeleteAccount}
            className="bg-white p-4 rounded-xl border border-red-200"
          >
            <p className="text-sm font-medium mb-2 text-red-600">Konfirmasi Hapus Akun</p>
            {hasPassword && (
              <input
                type="password"
                name="password"
                placeholder="Masukkan kata sandi Anda"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm mb-3 focus:ring-red-500"
                required
              />
            )}
            <div className="flex gap-2">
              <button
                type="submit"
                className="bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-red-700 transition"
              >
                Ya, Hapus Permanen
              </button>
              <button
                type="button"
                onClick={() => setShowDelete(false)}
                className="text-gray-500 text-sm px-4 py-2 font-medium hover:bg-gray-100 rounded-lg"
              >
                Batal
              </button>
            </div>
          </form>
        )}
      </section>

      {/* 2FA Setup Modal (Moved outside to escape stacking context) */}
      {show2FA && (
        <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white p-6 rounded-2xl max-w-sm w-full shadow-2xl relative">
            <button
              onClick={() => setShow2FA(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-black"
            >
              ✕
            </button>
            <h4 className="text-lg font-bold text-brown-900 mb-2">Setup Authenticator</h4>
            <p className="text-sm text-gray-600 mb-4">
              Pindai kode QR ini menggunakan aplikasi Google Authenticator atau Authy.
            </p>

            <div className="bg-gray-100 p-4 rounded-xl flex justify-center mb-4">
              {qrCodeUrl && <Image src={qrCodeUrl} alt="QR Code 2FA" width={200} height={200} />}
            </div>
            <p className="text-xs text-center text-gray-500 font-mono mb-4 break-all">
              Secret: {secret}
            </p>

            <input
              type="text"
              placeholder="Kode 6 Digit"
              value={otpInput}
              onChange={(e) => setOtpInput(e.target.value)}
              maxLength={6}
              className="w-full border border-gray-300 rounded-lg px-4 py-2 text-center tracking-[0.5em] font-mono text-lg mb-4 focus:ring-amber-brand outline-none"
            />
            <button
              onClick={handleEnable2FA}
              className="w-full bg-amber-brand text-brown-900 font-bold py-3 rounded-lg hover:brightness-110 transition"
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
        <h4 className="text-sm font-semibold text-gray-800">{label}</h4>
        <p className="text-xs text-gray-700 font-medium">{desc}</p>
      </div>
      <div
        onClick={onChange}
        className={`${
          checked ? 'bg-amber-brand' : 'bg-gray-200'
        } relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer`}
      >
        <span
          className={`${checked ? 'translate-x-6' : 'translate-x-1'} inline-block h-4 w-4 transform bg-white rounded-full transition-transform`}
        />
      </div>
    </div>
  )
}
