// public/sw.js
// RAG Source: public/sw.js (existing cache/fetch logic preserved)
// Added: Web Push API handler + notificationclick handler
// Security: No sensitive data in SW scope. VAPID auth is server-side only.

const CACHE = 'vanjava-v1'
const STATIC = ['/']

// ─── INSTALL: Pre-cache shell ────────────────────────────────────────────────
self.addEventListener('install', (e) =>
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(STATIC)))
)

// ─── FETCH: Network-first with offline fallback ───────────────────────────────
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return
  e.respondWith(fetch(e.request).catch(() => caches.match(e.request)))
})

// ─── PUSH: Handle incoming Web Push notification ─────────────────────────────
// RAG Source: W3C Push API spec + lib/notifications.ts message pattern
self.addEventListener('push', (e) => {
  // Guard: skip if no payload (ping-only pushes)
  if (!e.data) return

  let payload
  try {
    payload = e.data.json()
  } catch {
    // Fallback for non-JSON push data
    payload = {
      title: 'Pisang Van Java 🍌',
      body: e.data.text(),
      url: '/profile/pesanan',
    }
  }

  const { title, body, url, icon, badge } = payload

  e.waitUntil(
    self.registration.showNotification(title ?? 'Pisang Van Java', {
      body: body ?? '',
      icon: icon ?? '/icons/icon-192.png',
      badge: badge ?? '/icons/icon-192.png',
      // data.url: passed to notificationclick handler below
      data: { url: url ?? '/profile/pesanan' },
      // tag deduplicates: same tag replaces the previous notification bubble
      // so a rapid PROCESSING → READY update won't stack 2 notifications
      tag: 'pvj-order-update',
      renotify: true, // vibrate/sound even if replacing same tag
    })
  )
})

// ─── NOTIFICATION CLICK: Navigate to order page ───────────────────────────────
self.addEventListener('notificationclick', (e) => {
  e.notification.close()

  const targetUrl = e.notification.data?.url ?? '/profile/pesanan'

  e.waitUntil(
    // Find an existing open tab for this origin and navigate it
    clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if (
            typeof client.url === 'string' &&
            client.url.startsWith(self.location.origin) &&
            'focus' in client
          ) {
            client.navigate(targetUrl)
            return client.focus()
          }
        }
        // No existing tab — open a new window
        if (clients.openWindow) {
          return clients.openWindow(targetUrl)
        }
      })
  )
})
