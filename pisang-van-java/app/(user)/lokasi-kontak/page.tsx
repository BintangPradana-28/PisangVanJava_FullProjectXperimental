'use client'

import { AnimatePresence, motion } from 'framer-motion'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { useState } from 'react'
import toast, { Toaster } from 'react-hot-toast'
import Footer from '@/components/user/Footer'
import { useLanguage } from '@/context/LanguageContext'
import { useSettings } from '@/context/SettingsContext'

const MapEmbed = dynamic(() => import('@/components/ui/MapEmbed'), { ssr: false })

// ── SVG Brand Icons ──────────────────────────────────────────────────────────
const InstagramIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
  </svg>
)

const TikTokIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z" />
  </svg>
)

const WhatsAppIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
  </svg>
)

// ── Data ─────────────────────────────────────────────────────────────────────

// ── Component ─────────────────────────────────────────────────────────────────
export default function LokasiKontakPage() {
  const { t } = useLanguage()
  const { getSetting } = useSettings()
  const [form, setForm] = useState({ nama: '', email: '', phone: '', pesan: '' })
  const [sending, setSend] = useState(false)
  const [consent, setConsent] = useState(false)
  const [openFaq, setFaq] = useState<number | null>(null)

  const faqs = [
    { q: t('faq_q1'), a: t('faq_a1') },
    { q: t('faq_q2'), a: t('faq_a2') },
    { q: t('faq_q3'), a: t('faq_a3') },
    { q: t('faq_q4'), a: t('faq_a4') }
  ]

  const socials = [
    {
      label: 'Instagram',
      handle:
        getSetting('instagram', 'https://instagram.com/pisanggorengvanjava').split('/').pop() ||
        '@pisanggorengvanjava',
      href: getSetting('instagram', 'https://instagram.com/pisanggorengvanjava'),
      icon: InstagramIcon,
      textColor: 'text-[#E1306C]',
      bg: 'linear-gradient(45deg,#f09433,#e6683c,#dc2743,#cc2366,#bc1888)',
      soon: false
    },
    {
      label: 'TikTok',
      handle:
        getSetting('tiktok', 'https://tiktok.com/@pisanggorengvanjava').split('/').pop() ||
        '@vanjava.official',
      href: getSetting('tiktok', 'https://tiktok.com/@pisanggorengvanjava'),
      icon: TikTokIcon,
      textColor: 'text-black dark:text-white',
      bg: '#010101',
      soon: false
    },
    {
      label: 'WhatsApp',
      handle: `Hubungi Admin`,
      href: `#`,
      icon: WhatsAppIcon,
      textColor: 'text-[#25D366]',
      bg: '#25D366',
      soon: false,
      onClick: (e: React.MouseEvent) => {
        e.preventDefault()
        document.getElementById('contact-name')?.focus()
      }
    }
  ]

  const infoCards = [
    {
      id: 'alamat',
      label: t('location_address_label'),
      val: getSetting('alamat', t('location_address_val')),
      soon: false,
      svgPath:
        'M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z',
      iconColor: '#D4802A'
    },
    {
      id: 'jam',
      label: t('location_hours_label'),
      val: getSetting('jam_operasional', t('location_hours_val')),
      soon: false,
      svgPath:
        'M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67V7z',
      iconColor: '#D4802A'
    },
    {
      id: 'antar',
      label: t('location_delivery_label'),
      val: t('location_delivery_val'),
      soon: false,
      svgPath:
        'M19 7c0-1.1-.9-2-2-2h-3v2h3v2.65L13.52 14H10V9H6c-2.21 0-4 1.79-4 4v3h2c0 1.66 1.34 3 3 3s3-1.34 3-3h4.48L19 10.35V7zM7 17c-.55 0-1-.45-1-1h2c0 .55-.45 1-1 1z M20 15h-1v-4h1m1 4h-3m1-5v5',
      iconColor: '#D4802A'
    }
  ]

  const handleWA = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.nama.trim() || !form.email.trim() || !form.phone.trim() || !form.pesan.trim()) {
      toast.error(t('kontak_toast_error'))
      return
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(form.email.trim())) {
      toast.error(t('kontak_toast_error'))
      return
    }

    if (form.phone.trim().length < 8) {
      toast.error(t('kontak_toast_error'))
      return
    }

    if (!consent) {
      toast.error(t('kontak_consent_label') || 'Anda harus menyetujui Kebijakan Privasi')
      return
    }
    setSend(true)

    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nama: form.nama,
          email: form.email,
          phone: form.phone,
          pesan: form.pesan,
          consent
        })
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Gagal memproses formulir')
      }

      window.open(data.redirectUrl, '_blank')
      setForm({ nama: '', email: '', phone: '', pesan: '' })
      setConsent(false)
      toast.success(t('kontak_toast_success'))
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Gagal memproses formulir')
    } finally {
      setSend(false)
    }
  }

  return (
    <div className="min-h-screen bg-[var(--background-custom)] text-primary dark:text-zinc-100 transition-colors duration-300">
      <Toaster
        position="top-center"
        toastOptions={{ className: '!rounded-[4px] !text-sm !font-medium !shadow-sm' }}
      />

      {/* ── Hero — compact ──────────────────────────────────────────────── */}
      <section className="relative pt-28 pb-12 overflow-hidden bg-cream-50 dark:bg-zinc-900 border-b border-outline-variant/20 dark:border-zinc-800">
        <div className="absolute inset-0 bg-hero-pattern opacity-40 pointer-events-none" />
        {/* decorative blobs */}
        <div className="absolute -top-24 -right-16 w-96 h-96 rounded-[4px] opacity-10 pointer-events-none bg-[radial-gradient(circle,_var(--tw-gradient-stops))] from-amber-600 to-transparent" />
        <div className="absolute -bottom-16 -left-16 w-72 h-72 rounded-[4px] opacity-10 pointer-events-none bg-[radial-gradient(circle,_var(--tw-gradient-stops))] from-amber-600 to-transparent" />

        <div className="max-w-[1200px] mx-auto px-6 relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-6"
          >
            <div>
              <span className="inline-block text-xs font-bold tracking-[0.22em] uppercase px-4 py-1.5 rounded-[4px] mb-5 bg-amber-600/10 text-amber-700 dark:text-amber-500">
                {t('kontak_title_section')}
              </span>
              <h1 className="font-serif text-5xl sm:text-6xl lg:text-7xl font-bold leading-[1.1] text-brown-900 dark:text-zinc-100">
                {t('kontak_hero_title')}
                <br />
                <span className="text-amber-700 dark:text-amber-500 italic font-normal">
                  {t('kontak_hero_subtitle')}
                </span>
              </h1>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── Contact Form + Map ───────────────────────────────────────────── */}
      <section className="py-16 bg-white dark:bg-zinc-950">
        <div className="max-w-[1200px] mx-auto px-6 grid lg:grid-cols-2 gap-12 items-start">
          {/* ── Left: Form + Socials ── */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
          >
            {/* Form */}
            <div className="rounded-[4px] p-8 bg-cream-50 dark:bg-zinc-900 border border-cream-200/60 dark:border-zinc-800 shadow-sm">
              <h2 className="font-serif text-2xl font-bold mb-1 text-brown-900 dark:text-zinc-100">
                {t('kontak_send_message')}
              </h2>
              <p className="text-sm mb-6 text-brown-600 dark:text-zinc-400">
                {t('kontak_send_message_desc')}
              </p>

              <form onSubmit={handleWA} className="space-y-4">
                <div>
                  <label
                    htmlFor="contact-name"
                    className="block text-[11px] font-bold tracking-widest uppercase mb-1.5 text-amber-700 dark:text-amber-500"
                  >
                    {t('kontak_label_name')}
                  </label>
                  <input
                    id="contact-name"
                    type="text"
                    value={form.nama}
                    onChange={(e) => setForm((p) => ({ ...p, nama: e.target.value }))}
                    placeholder={t('kontak_placeholder_name')}
                    className="w-full px-4 py-3 text-sm rounded-[4px] outline-none transition-all bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 focus:ring-2 focus:ring-amber-500 focus:border-transparent text-zinc-800 dark:text-zinc-100"
                  />
                </div>
                <div>
                  <label
                    htmlFor="contact-email"
                    className="block text-[11px] font-bold tracking-widest uppercase mb-1.5 text-amber-700 dark:text-amber-500"
                  >
                    {t('kontak_label_email')}
                  </label>
                  <input
                    id="contact-email"
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
                    placeholder={t('kontak_placeholder_email')}
                    className="w-full px-4 py-3 text-sm rounded-[4px] outline-none transition-all bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 focus:ring-2 focus:ring-amber-500 focus:border-transparent text-zinc-800 dark:text-zinc-100"
                  />
                </div>
                <div>
                  <label
                    htmlFor="contact-phone"
                    className="block text-[11px] font-bold tracking-widest uppercase mb-1.5 text-amber-700 dark:text-amber-500"
                  >
                    {t('kontak_label_phone')}
                  </label>
                  <input
                    id="contact-phone"
                    type="tel"
                    value={form.phone}
                    onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
                    placeholder={t('kontak_placeholder_phone')}
                    className="w-full px-4 py-3 text-sm rounded-[4px] outline-none transition-all bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 focus:ring-2 focus:ring-amber-500 focus:border-transparent text-zinc-800 dark:text-zinc-100"
                  />
                </div>
                <div>
                  <label
                    htmlFor="contact-message"
                    className="block text-[11px] font-bold tracking-widest uppercase mb-1.5 text-amber-700 dark:text-amber-500"
                  >
                    {t('kontak_label_message')}
                  </label>
                  <textarea
                    id="contact-message"
                    rows={4}
                    value={form.pesan}
                    onChange={(e) => setForm((p) => ({ ...p, pesan: e.target.value }))}
                    placeholder={t('kontak_placeholder_message')}
                    className="w-full px-4 py-3 text-sm rounded-[4px] outline-none transition-all resize-none bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 focus:ring-2 focus:ring-amber-500 focus:border-transparent text-zinc-800 dark:text-zinc-100"
                  />
                </div>

                <div className="flex items-start gap-3 py-2">
                  <input
                    type="checkbox"
                    id="consent"
                    checked={consent}
                    onChange={(e) => setConsent(e.target.checked)}
                    className="mt-1 shrink-0 accent-amber-brand w-4 h-4 rounded-sm cursor-pointer"
                  />
                  <label
                    htmlFor="consent"
                    className="text-xs cursor-pointer select-none text-brown-700 dark:text-zinc-400"
                  >
                    {t('kontak_consent_label')}
                  </label>
                </div>

                <button
                  type="submit"
                  disabled={sending}
                  className="w-full py-3.5 rounded-[4px] text-sm font-bold tracking-wide transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2 bg-amber-brand hover:bg-amber-brand/90 text-white shadow-sbx-card hover:shadow-sm"
                >
                  {sending ? (
                    <>
                      <svg
                        className="w-4 h-4 animate-spin text-current"
                        fill="none"
                        viewBox="0 0 24 24"
                      >
                        <title>Loading</title>
                        <circle
                          className="opacity-30"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        />
                        <path
                          className="opacity-80"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                        />
                      </svg>
                      {t('kontak_btn_submitting')}
                    </>
                  ) : (
                    <>
                      <WhatsAppIcon className="w-4 h-4 text-current" />
                      {t('kontak_btn_submit')}
                    </>
                  )}
                </button>
              </form>
            </div>

            {/* Social links */}
            <div className="mt-6">
              <p className="text-[11px] font-bold tracking-widest uppercase mb-4 text-amber-700 dark:text-amber-500">
                {t('kontak_follow_us')}
              </p>
              <div className="flex flex-wrap gap-3">
                {socials.map(({ label, icon: Icon, href, textColor, soon }) => (
                  <a
                    key={label}
                    href={href}
                    target={href === '#' ? undefined : '_blank'}
                    rel={href === '#' ? undefined : 'noopener noreferrer'}
                    onClick={(e) => {
                      if (soon) {
                        e.preventDefault()
                        toast(t('kontak_toast_soon'), { icon: '⏳' })
                      } else if (label === 'WhatsApp') {
                        e.preventDefault()
                        document.getElementById('contact-name')?.focus()
                        toast.success('Silakan isi formulir terlebih dahulu untuk keamanan', {
                          icon: '🛡️'
                        })
                      }
                    }}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-[4px] transition-all group ${soon ? 'cursor-default opacity-70' : 'hover:-translate-y-0.5 hover:shadow-sm hover:bg-cream-100/30 dark:hover:bg-zinc-800 bg-cream-50 dark:bg-zinc-900 border border-cream-200 dark:border-zinc-800'}`}
                  >
                    <Icon className={`w-4 h-4 ${textColor}`} />
                    <span className="text-xs font-bold text-zinc-800 dark:text-zinc-200">
                      {label} {soon && '(Soon)'}
                    </span>
                  </a>
                ))}
              </div>
            </div>
          </motion.div>

          {/* ── Right: Map + Info Cards ── */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="space-y-4"
          >
            {/* Map */}
            <div className="rounded-[4px] overflow-hidden border border-cream-200 dark:border-zinc-800 shadow-sm h-[320px]">
              <MapEmbed
                address={getSetting(
                  'alamat',
                  'Jl. Raya Cilangkap l Rt.2/Rw.5, Cilangkap, Kec. Cipayung, Kota Jakarta Timur'
                )}
              />
            </div>

            {/* Info Cards */}
            {infoCards.map(({ id, label, val, svgPath, iconColor, soon }) => (
              <div
                key={id}
                className="flex gap-4 items-start p-5 rounded-[4px] transition-all hover:shadow-sm bg-cream-50 dark:bg-zinc-900 border border-cream-200 dark:border-zinc-800"
              >
                {/* Icon */}
                <div className="w-10 h-10 rounded-[4px] flex items-center justify-center shrink-0 bg-amber-600/10 dark:bg-amber-500/10">
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill={iconColor} aria-hidden="true">
                    <path d={svgPath} />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-500">
                      {label}
                    </span>
                    {soon && (
                      <span className="text-[9px] font-bold px-2 py-0.5 rounded-[4px] bg-amber-600/10 text-amber-700 dark:text-amber-500">
                        {t('kontak_soon')}
                      </span>
                    )}
                  </div>
                  <p className="text-sm font-medium leading-snug text-zinc-800 dark:text-zinc-200">
                    {val}
                  </p>
                </div>
              </div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ── FAQ ─────────────────────────────────────────────────────────── */}
      <section className="py-20 bg-cream-50 dark:bg-zinc-900/50 border-t border-outline-variant/10 dark:border-zinc-900">
        <div className="max-w-[760px] mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <div className="text-xs font-bold tracking-[0.22em] uppercase mb-3 text-amber-700 dark:text-amber-500">
              {t('faq_subtitle')}
            </div>
            <h2 className="font-serif text-3xl sm:text-4xl font-bold text-brown-900 dark:text-zinc-100">
              {t('faq_title')}
            </h2>
          </motion.div>

          <div className="space-y-3">
            {faqs.map(({ q, a }, i) => (
              <motion.div
                key={q}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.07 }}
                className="rounded-[4px] overflow-hidden bg-white dark:bg-zinc-900 border border-cream-200/80 dark:border-zinc-800 shadow-sm"
              >
                <button
                  type="button"
                  id={`faq-btn-${i}`}
                  aria-expanded={openFaq === i}
                  aria-controls={`faq-answer-${i}`}
                  className="w-full flex items-center justify-between px-6 py-4 text-left font-semibold text-sm transition-colors text-zinc-800 dark:text-zinc-200 hover:bg-cream-50/50 dark:hover:bg-zinc-800/50"
                  onClick={() => setFaq(openFaq === i ? null : i)}
                >
                  <span className="pr-4">{q}</span>
                  <span
                    className={`text-xl shrink-0 font-light transition-transform duration-300 text-amber-600 ${openFaq === i ? 'rotate-45' : 'rotate-0'}`}
                  >
                    +
                  </span>
                </button>
                <AnimatePresence initial={false}>
                  {openFaq === i && (
                    <motion.div
                      key="answer"
                      id={`faq-answer-${i}`}
                      role="region"
                      aria-labelledby={`faq-btn-${i}`}
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.25, ease: 'easeInOut' }}
                      className="overflow-hidden"
                    >
                      <div className="px-6 pb-5 pt-1 text-sm leading-relaxed border-t border-cream-100 dark:border-zinc-800 text-zinc-650 dark:text-zinc-400">
                        {a}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA strip ───────────────────────────────────────────────────── */}
      <section className="py-20 text-white text-center bg-gradient-to-br from-brown-800 to-brown-950 dark:from-zinc-900 dark:to-black">
        <div className="max-w-xl mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <div className="text-4xl mb-4">🍌</div>
            <h2 className="font-serif text-2xl sm:text-3xl font-bold mb-3">
              {t('kontak_cta_ready')}
            </h2>
            <p className="text-white/70 mb-6">{t('kontak_cta_desc')}</p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <button
                type="button"
                onClick={() => {
                  const element = document.getElementById('contact-name')
                  element?.focus()
                  window.scrollTo({
                    top: (element?.offsetTop ?? 0) - 200,
                    behavior: 'smooth'
                  })
                }}
                className="inline-flex items-center justify-center gap-2 px-8 py-3.5 rounded-[4px] font-bold text-sm transition-all active:scale-[0.98] hover:shadow-sm bg-green-wa hover:bg-green-wa/90 text-white"
              >
                <WhatsAppIcon className="w-4 h-4" /> {t('kontak_chat_now')}
              </button>
              <Link
                href="/menu-spesial"
                className="px-8 py-3.5 rounded-[4px] font-bold text-sm transition-all active:scale-[0.98] border border-white/30 hover:bg-white/10"
              >
                🍌 {t('hero_menu_btn')}
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      <Footer />
    </div>
  )
}
