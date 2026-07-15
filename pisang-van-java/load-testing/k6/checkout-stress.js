import { check, sleep } from 'k6'
import http from 'k6/http'

// Define the stress testing stages
export const options = {
  stages: [
    { duration: '30s', target: 5 }, // Smoke Test: warmup to 5 users
    { duration: '2m', target: 20 }, // Normal Load: stay at 20 users
    { duration: '1m', target: 50 }, // Stress Test: ramp-up to 50 users (peak traffic)
    { duration: '1m', target: 50 }, // Stay at peak traffic
    { duration: '30s', target: 0 } // Cooldown
  ],
  thresholds: {
    http_req_duration: ['p(95)<2000'], // 95% of requests must complete under 2 seconds
    http_req_failed: ['rate<0.01'] // Less than 1% of requests should fail
  }
}

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000'
const SESSION_COOKIE = __ENV.SESSION_COOKIE || ''

export default function () {
  // 1. Visit the landing page
  const homeRes = http.get(`${BASE_URL}/`)
  check(homeRes, {
    'home status was 200': (r) => r.status === 200
  })
  sleep(1)

  // 2. Query the special menu page
  const menuRes = http.get(`${BASE_URL}/menu-spesial`)
  check(menuRes, {
    'menu status was 200': (r) => r.status === 200
  })
  sleep(1)

  // 3. Health check endpoint (lightweight check)
  const healthRes = http.get(`${BASE_URL}/api/health`)
  check(healthRes, {
    'health status was 200': (r) => r.status === 200
  })
  sleep(1)

  // 4. Perform checkout if authenticated (session cookie supplied)
  if (SESSION_COOKIE) {
    const params = {
      headers: {
        'Content-Type': 'application/json',
        Cookie: `next-auth.session-token=${SESSION_COOKIE}`
      }
    }

    const payload = JSON.stringify({
      idempotencyKey: `k6-stress-${__VU}-${__ITER}-${Date.now()}`,
      customerName: 'Ksix Load Tester',
      customerPhone: '081234567890',
      deliveryMethod: 'PICKUP',
      paymentMethod: 'ONLINE',
      usePoints: false,
      items: [
        {
          variantId: 'clxxxxxxxxxxxxxxx', // Placeholder to be customized/pre-seeded
          toppingIds: [],
          baseType: 'kembung',
          quantity: 1
        }
      ]
    })

    const checkoutRes = http.post(`${BASE_URL}/api/orders`, payload, params)
    check(checkoutRes, {
      'checkout status was 201 or 400 (if invalid ID)': (r) =>
        r.status === 201 || r.status === 400 || r.status === 409
    })
  }
}
