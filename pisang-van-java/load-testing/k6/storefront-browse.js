// Load test jalur browsing publik: homepage -> menu-spesial -> data menu
// (API, ISR-cached) -> data topping. TIDAK menyentuh cart/checkout/auth —
// lihat load-testing/README.md bagian "Cakupan saat ini" untuk alasannya
// dan apa yang perlu disiapkan sebelum jalur checkout ditambahkan.
import http from 'k6/http'
import { check, group, sleep } from 'k6'
import { Rate, Trend } from 'k6/metrics'

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000'

// Metrik custom biar kelihatan terpisah dari agregat global — kalau nanti
// skenario checkout/cart ditambahkan sebagai file lain, angka jalur
// browsing ini tidak tercampur dengan angka checkout.
const browseErrorRate = new Rate('browse_errors')
const menuApiDuration = new Trend('menu_api_duration', true)

export const options = {
  scenarios: {
    storefront_browsing: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '30s', target: 20 }, // ramp naik pelan-pelan
        { duration: '2m', target: 20 }, // tahan di beban stabil
        { duration: '30s', target: 50 }, // simulasi lonjakan (mis. promo di WA)
        { duration: '1m', target: 50 },
        { duration: '30s', target: 0 } // ramp turun
      ]
    }
  },
  thresholds: {
    // Selaraskan dengan target keandalan di PRD.md — tapi ini mengukur
    // jalur browsing publik, BUKAN checkout (lihat README).
    http_req_failed: ['rate<0.01'], // <1% request gagal
    http_req_duration: ['p(95)<500'], // p95 di bawah 500ms
    browse_errors: ['rate<0.01']
  }
}

export default function () {
  group('Kunjungan homepage', () => {
    const res = http.get(`${BASE_URL}/`, { tags: { name: 'homepage' } })
    const ok = check(res, { 'homepage: status 200': (r) => r.status === 200 })
    browseErrorRate.add(!ok)
  })

  sleep(Math.random() * 2 + 1) // simulasi waktu baca user, 1-3 detik

  group('Buka menu spesial', () => {
    const res = http.get(`${BASE_URL}/menu-spesial`, { tags: { name: 'menu-spesial-page' } })
    const ok = check(res, { 'menu-spesial: status 200': (r) => r.status === 200 })
    browseErrorRate.add(!ok)
  })

  sleep(Math.random() * 2 + 1)

  group('Fetch data menu (API, ISR-cached 60s)', () => {
    const res = http.get(`${BASE_URL}/api/menu`, { tags: { name: 'api-menu' } })
    menuApiDuration.add(res.timings.duration)
    const ok = check(res, {
      'api/menu: status 200': (r) => r.status === 200,
      'api/menu: body ada isinya': (r) => r.body && r.body.length > 2
    })
    browseErrorRate.add(!ok)
  })

  sleep(Math.random() * 1.5 + 0.5)

  group('Fetch data topping', () => {
    const res = http.get(`${BASE_URL}/api/toppings`, { tags: { name: 'api-toppings' } })
    const ok = check(res, { 'api/toppings: status 200': (r) => r.status === 200 })
    browseErrorRate.add(!ok)
  })

  sleep(Math.random() * 3 + 2) // jeda sebelum "user" berikutnya browsing lagi
}
