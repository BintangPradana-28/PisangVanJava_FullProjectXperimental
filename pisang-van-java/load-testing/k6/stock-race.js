import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  scenarios: {
    concurrent_checkouts: {
      executor: 'per-vu-iterations',
      vus: 30, // 30 concurrent users
      iterations: 1, // each user attempts 1 checkout
      maxDuration: '30s',
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.50'], // Allow fails (400 empty stock) but verify concurrency
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const SESSION_COOKIE = __ENV.SESSION_COOKIE || '';
const VARIANT_ID = __ENV.VARIANT_ID || 'clxxxxxxxxxxxxxxx'; // Target variant ID for race condition testing

export default function () {
  if (!SESSION_COOKIE) {
    // If not authenticated, cannot test race condition on checkout directly without session
    // Log once and request public health check instead as a fallback
    const res = http.get(`${BASE_URL}/api/health`);
    check(res, { 'status is 200': (r) => r.status === 200 });
    return;
  }

  const params = {
    headers: {
      'Content-Type': 'application/json',
      'Cookie': `next-auth.session-token=${SESSION_COOKIE}`,
    },
  };

  const payload = JSON.stringify({
    idempotencyKey: `k6-race-${__VU}-${__ITER}-${Date.now()}`,
    customerName: 'Race Condition Tester',
    customerPhone: '081234567890',
    deliveryMethod: 'PICKUP',
    paymentMethod: 'ONLINE',
    usePoints: false,
    items: [
      {
        variantId: VARIANT_ID,
        toppingIds: [],
        baseType: 'kembung',
        quantity: 1,
      },
    ],
  });

  const res = http.post(`${BASE_URL}/api/orders`, payload, params);

  // Assertions: 201 Created or 400 Bad Request (stok habis) are expected,
  // but we shouldn't get 500 Server Error or 504 Gateway Timeout.
  check(res, {
    'response status is valid (201, 400, or 409)': (r) => r.status === 201 || r.status === 400 || r.status === 409,
    'not a 500 error': (r) => r.status !== 500,
  });
}
