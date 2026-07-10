// Smoke test: 1 virtual user, 1 iterasi, hanya memastikan endpoint kritis
// masih hidup dan merespons dalam batas wajar. Jalankan ini SEBELUM
// storefront-browse.js yang lebih berat — kalau smoke test ini saja gagal,
// tidak ada gunanya lanjut ke load test penuh.
//
// Cakupan sengaja dibatasi ke endpoint publik/read-only. Lihat
// load-testing/README.md bagian "Cakupan saat ini" untuk alasannya.
import http from 'k6/http'
import { check } from 'k6'

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000'

export const options = {
  vus: 1,
  iterations: 1,
  thresholds: {
    http_req_failed: ['rate==0'],
    http_req_duration: ['p(95)<1000']
  }
}

const ENDPOINTS = [
  { name: 'homepage', url: `${BASE_URL}/` },
  { name: 'menu-spesial', url: `${BASE_URL}/menu-spesial` },
  { name: 'api-menu', url: `${BASE_URL}/api/menu` },
  { name: 'api-toppings', url: `${BASE_URL}/api/toppings` },
  { name: 'api-health', url: `${BASE_URL}/api/health` }
]

export default function () {
  for (const endpoint of ENDPOINTS) {
    const res = http.get(endpoint.url, { tags: { name: endpoint.name } })
    check(res, {
      [`${endpoint.name}: status is 200`]: (r) => r.status === 200
    })
  }
}
