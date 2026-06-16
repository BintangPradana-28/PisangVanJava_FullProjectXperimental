'use client'

/**
 * components/push/PushNotificationManager.tsx
 *
 * Subscribe / unsubscribe toggle for Web Push notifications.
 * Designed to drop into the profile page as a new <section>.
 *
 * Security Strategy : NEXT_PUBLIC_VAPID_PUBLIC_KEY only — no server secrets exposed.
 *                     fetch() calls are auth-gated server-side.
 * Style Alignment   : LoRA PVJ UI — lucide-react icons, react-hot-toast, amber palette,
 *                     rounded-[4px] corners, matching app/(user)/profile/page.tsx sections.
 * State Source      : RAG — public/sw.js (SW registration), app/api/push/subscribe/,
 *                     app/api/push/unsubscribe/
 *
 * Placement: Add inside app/(user)/profile/page.tsx as a new <section> block.
 * The component self-hides when Push API is unsupported.
 */

import { Bell, BellOff, Loader2, ShieldCheck } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import toast from 'react-hot-toast'

// NEXT_PUBLIC_ prefix — safe to expose; used only for SW subscription, not sending
const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? ''

type State = 'checking' | 'unsupported' | 'denied' | 'unsubscribed' | 'subscribed' | 'loading'

/**
 * Convert VAPID public key from URL-safe base64 to Uint8Array.
 * Required by PushManager.subscribe() applicationServerKey.
 * Source: MDN Push API documentation (standard utility).
 */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; i++) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray
}

export function PushNotificationManager() {
  const [state, setState] = useState<State>('checking')

  // ── Mount: detect support & check current subscription ───────────────────────
  useEffect(() => {
    // Guard: VAPID key must be configured
    if (!VAPID_PUBLIC_KEY) {
      setState('unsupported')
      return
    }
    // Guard: browser must support SW + Push API
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      setState('unsupported')
      return
    }
    // Guard: permission explicitly denied (can't re-prompt)
    if (Notification.permission === 'denied') {
      setState('denied')
      return
    }

    // Check if an active push subscription already exists
    async function checkCurrentSubscription() {
      try {
        const registration = await navigator.serviceWorker.ready
        const existing = await registration.pushManager.getSubscription()
        setState(existing !== null ? 'subscribed' : 'unsubscribed')
      } catch {
        setState('unsubscribed')
      }
    }

    checkCurrentSubscription()
  }, [])

  // ── Subscribe handler ─────────────────────────────────────────────────────────
  const handleSubscribe = useCallback(async () => {
    setState('loading')
    try {
      const registration = await navigator.serviceWorker.ready

      // Prompt permission + create subscription
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true, // W3C requirement: must always show notification
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      })

      // Persist to server (auth-gated API route)
      const res = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(subscription.toJSON()),
      })

      if (!res.ok) {
        const json = (await res.json()) as { error?: string }
        throw new Error(json?.error ?? 'Gagal menyimpan subscription')
      }

      setState('subscribed')
      toast.success('Notifikasi pesanan diaktifkan! 🔔')
    } catch (err: unknown) {
      console.error('[PUSH] Subscribe error:', err)

      if (Notification.permission === 'denied') {
        setState('denied')
        toast.error('Izin notifikasi ditolak di browser.')
      } else {
        setState('unsubscribed')
        toast.error('Gagal mengaktifkan notifikasi. Coba lagi.')
      }
    }
  }, [])

  // ── Unsubscribe handler ───────────────────────────────────────────────────────
  const handleUnsubscribe = useCallback(async () => {
    setState('loading')
    try {
      const registration = await navigator.serviceWorker.ready
      const subscription = await registration.pushManager.getSubscription()
      // Unsubscribe from push service (browser-side)
      if (subscription) {
        await subscription.unsubscribe()
      }
      // Remove from Redis (server-side)
      await fetch('/api/push/unsubscribe', { method: 'DELETE' })

      setState('unsubscribed')
      toast.success('Notifikasi pesanan dimatikan.')
    } catch (err: unknown) {
      console.error('[PUSH] Unsubscribe error:', err)
      setState('subscribed')
      toast.error('Gagal menonaktifkan notifikasi.')
    }
  }, [])

  // ── Render: self-hide when unsupported ───────────────────────────────────────
  if (state === 'checking' || state === 'unsupported') return null

  return (
    <section className="bg-white dark:bg-zinc-900 rounded-[4px] p-6 md:p-8 shadow-sm border border-zinc-200/50 dark:border-zinc-800/80">
      {/* Section Header — matches app/(user)/profile/page.tsx section style */}
      <div className="flex items-center gap-4 mb-6 pb-6 border-b border-zinc-100 dark:border-zinc-800">
        <div className="w-12 h-12 rounded-[4px] bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 flex items-center justify-center">
          <Bell className="w-6 h-6" />
        </div>
        <div>
          <h2 className="text-xl font-bold font-serif text-zinc-900 dark:text-zinc-100">
            Notifikasi Pesanan
          </h2>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Aktifkan notifikasi push agar Anda tahu saat status pesanan berubah.
          </p>
        </div>
      </div>

      {/* Permission denied state */}
      {state === 'denied' && (
        <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-900/50 rounded-[4px] p-5 flex items-start gap-3">
          <ShieldCheck className="w-5 h-5 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-bold text-amber-800 dark:text-amber-300 mb-1">
              Izin Notifikasi Ditolak
            </p>
            <p className="text-sm text-amber-700 dark:text-amber-400">
              Browser Anda memblokir notifikasi dari situs ini. Ubah izin di{' '}
              <strong>Pengaturan Browser → Privasi & Keamanan → Notifikasi</strong>.
            </p>
          </div>
        </div>
      )}

      {/* Active toggle */}
      {state !== 'denied' && (
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-zinc-50 dark:bg-zinc-800/30 p-5 rounded-[4px] border border-zinc-100 dark:border-zinc-800">
          <div className="flex items-center gap-3">
            {state === 'subscribed' ? (
              <Bell className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0" />
            ) : (
              <BellOff className="w-5 h-5 text-zinc-400 shrink-0" />
            )}
            <div>
              <p className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                {state === 'subscribed'
                  ? 'Notifikasi Aktif'
                  : 'Notifikasi Tidak Aktif'}
              </p>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                {state === 'subscribed'
                  ? 'Anda akan menerima update status pesanan secara real-time.'
                  : 'Aktifkan untuk menerima update saat pesanan diproses, siap, atau dibatalkan.'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={state === 'subscribed' ? handleUnsubscribe : handleSubscribe}
            disabled={state === 'loading'}
            className={[
              'shrink-0 flex items-center gap-2 px-5 py-2.5 rounded-[4px] font-bold text-sm',
              'transition-all disabled:opacity-50 disabled:cursor-not-allowed',
              state === 'subscribed'
                ? 'bg-zinc-200 hover:bg-zinc-300 dark:bg-zinc-700 dark:hover:bg-zinc-600 text-zinc-800 dark:text-zinc-200'
                : 'bg-amber-600 hover:bg-amber-700 text-white',
            ].join(' ')}
            aria-label={
              state === 'subscribed'
                ? 'Matikan notifikasi pesanan'
                : 'Aktifkan notifikasi pesanan'
            }
          >
            {state === 'loading' ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : state === 'subscribed' ? (
              <BellOff className="w-4 h-4" />
            ) : (
              <Bell className="w-4 h-4" />
            )}
            <span>
              {state === 'loading'
                ? 'Memproses...'
                : state === 'subscribed'
                  ? 'Matikan Notifikasi'
                  : 'Aktifkan Notifikasi'}
            </span>
          </button>
        </div>
      )}
    </section>
  )
}
