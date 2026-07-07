# Observability Playbook — Pisang Van Java

Ditaruh idealnya di `pisang-van-java/docs/observability-playbook.md`, disamping `compliance_backup_policy.md`.

Bagian ini beda karakter dari audit sebelumnya: bukan koreksi drift, tapi ngisi yang **belum ada sama sekali**. Beberapa hal di sini (alert rule, retensi Sentry/PostHog) dikonfigurasi di dashboard masing-masing tool, bukan di kode — jadi ini proposal baseline, bukan hasil audit config yang sudah jalan. Ditandai eksplisit mana yang perlu kamu setup manual di dashboard.

## 1. Alert Routing (Proposed)

Prinsip: solo-dev, jadi cuma alert untuk hal yang butuh tindakan SEKARANG, bukan semua error (hindari alert fatigue — sesuai operating principle agent kalian sendiri).

| Trigger | Kenapa kritis | Rute (disarankan) |
| --- | --- | --- |
| Error rate checkout > 5% dalam 5 menit | Langsung nyentuh target 99.9% reliability di PRD | Sentry Alert Rule → email |
| Webhook Midtrans gagal (4xx/5xx) beruntun ≥3x | Pembayaran sukses di Midtrans tapi order stuck di sistem kalian | Sentry Alert Rule → email, prioritas tertinggi |
| Auth failure spike (banyak 401 dari 1 IP) | Sinyal brute force | Upstash Ratelimit sudah block, tapi worth di-alert biar ke-notice |
| Stock decrement gagal / stock negatif | Oversell langsung, dampak duit | Sentry custom alert |

Email lewat Resend/Sentry native alert cukup buat mulai — WhatsApp webhook (`app/api/webhooks/outgoing/whatsapp/route.ts`) sudah ada di codebase, jadi kalau mau upgrade ke alert WhatsApp untuk yang paling kritis (webhook Midtrans gagal), infra-nya sudah ada, tinggal manfaatin, bukan nambah tool baru.

**Manual setup dashboard yang perlu dicek:** buka Sentry → Alerts, konfirmasi rule di atas ada atau belum. Kalau belum, ini yang paling murah buat langsung dieksekusi karena zero kode tambahan.

## 2. Runbook Mini — 3 Failure Mode Kritis

### A. Checkout gagal / stuck
- **Cek dulu:** Sentry error group untuk `checkout`/`payment`, status transaksi di dashboard Midtrans, log idempotency key di Pino.
- **Kemungkinan penyebab:** timeout API Midtrans, idempotency key ke-reuse secara nggak semestinya, transaksi Prisma gagal di tengah proses decrement stock.
- **Mitigasi:** cek status Midtrans dulu (page.midtrans.com atau dashboard), pastikan retry client TIDAK generate idempotency key baru (harus sama persis per attempt), cek apakah stock sudah ke-decrement duluan sebelum failure (supaya nggak di-decrement dua kali saat retry manual).

### B. Webhook Midtrans: signature invalid
- **Cek dulu:** Pino log di `app/api/payment/midtrans/webhook/route.ts`, log Cloudflare WAF untuk request yang ke-block IP-allowlist.
- **Kemungkinan penyebab:** server key Midtrans di env/Doppler nggak sinkron sama dashboard Midtrans (abis di-rotate), rule IP-allowlist Cloudflare stale (Midtrans ganti/nambah IP), atau beneran ada replay attempt dari luar.
- **Mitigasi:** cross-check server key, cross-check daftar IP resmi Midtrans terbaru vs rule Terraform di `infra/cloudflare/`. **Kalau order sukses di Midtrans tapi status stuck "pending" di sistem — ini prioritas tertinggi**, karena pelanggan sudah bayar tapi pesanan nggak keproses.

### C. Stock decrement race condition / oversell
- **Cek dulu:** history stock di baris Menu/Varian terkait, cari apakah ada order duplikat untuk item yang sama dalam window waktu sempit.
- **Kemungkinan penyebab:** ada code path yang masih pola *check-then-update* (SELECT dulu baru UPDATE) alih-alih atomic decrement di level query (`UPDATE ... SET stock = stock - 1 WHERE stock >= 1`), atau ada mutation stock yang lolos dari `prisma.$transaction`.
- **Mitigasi:** audit ulang semua titik yang mutate stock (bukan cuma checkout — POS/kasir juga bisa jadi sumbernya), pertimbangkan tambah DB constraint `CHECK (stock >= 0)` sebagai safety net terakhir kalau belum ada.

*(Catatan: runbook ini disusun dari desain arsitektur yang didokumentasikan — bukan hasil audit tiap baris kode mutation stock. Kalau mau itu, itu kerjaan Backend Agent buat code review, bukan Docs.)*

## 3. Akses Log Production

**Dikonfirmasi:** `vercel.json` cuma berisi config cron, nggak ada log drain. Nggak ketemu integrasi Axiom/Logtail/Better Stack/Datadog di manapun di project. Artinya Pino log kalian sekarang cuma nyampe ke Vercel default Function Logs — retensinya pendek dan nggak dirancang buat di-query historis (bukan cocok buat "query log terpusat untuk kebutuhan audit" yang disebut ARCHITECTURE.md §8).

**Opsi (pilih salah satu, ini keputusan vendor jadi aku nggak pilihin sepihak):**
- **Sentry Logs/breadcrumbs** — nggak nambah tool baru (Sentry udah terpasang), tapi bukan tempat terbaik buat general-purpose log search.
- **Axiom** — free tier cukup generous, integrasi Vercel Log Drain gampang, tapi nambah 1 vendor lock-in baru.
- **Better Stack (Logtail)** — mirip Axiom, UI query-nya enak.

## 4. PostHog — Event yang Direkomendasikan buat Di-track

Belum ada dokumentasi funnel/event apa yang sebenarnya dipantau. Berdasarkan Success Metrics di PRD §7:

- `cart_viewed` → `checkout_started` → `payment_initiated` → `payment_completed` (funnel utama, langsung ukur drop-off checkout)
- `order_failed` dengan property `reason` (bukan cuma count gagal, tapi kenapa gagal)
- `kasir_order_created` terpisah dari funnel customer (biar nggak nyampur data POS sama storefront)

## 5. Retensi Data — Sentry & PostHog

`compliance_backup_policy.md` udah bagus soal retensi backup database, tapi belum nyentuh data analytics/error-tracking — padahal ini juga data yang berpotensi berisi info pelanggan (event property, error context).

Aku nggak tahu retensi default di plan Sentry/PostHog kalian saat ini (tergantung tier langganan, nggak kelihatan dari kode) — jadi ini bukan sesuatu yang bisa aku audit, cuma bisa aku ingetin: cek setting retention di kedua dashboard, selaraskan sama prinsip minimalisasi data UU PDP yang udah dianut di `compliance_backup_policy.md`.
