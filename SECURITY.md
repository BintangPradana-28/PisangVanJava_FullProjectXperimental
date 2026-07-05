# Security Policy

## Supported Versions

Proyek ini berjalan sebagai aplikasi live (bukan versioned library) — yang menerima security patch hanya deployment production di branch `main` (Vercel). Fork/branch lama tidak didukung.

| Deployment | Status |
| --- | --- |
| `main` (production) | ✅ Didukung |
| Branch/fork lain | ❌ Tidak didukung |

## Melaporkan Kerentanan

Kalau menemukan celah keamanan (bypass auth, IDOR, bypass signature webhook Midtrans, kebocoran data pelanggan, dll) — **jangan buka GitHub issue publik**. Laporkan langsung ke `[isi email/kontak maintainer di sini]` dengan langkah reproduksi sedetail mungkin.

Target respons awal: 48 jam. Kerentanan yang dikonfirmasi akan diperbaiki dulu sebelum diumumkan (coordinated disclosure).

## Ringkasan Postur Keamanan Teknis

- **Password hashing:** `@node-rs/argon2` — lihat `ARCHITECTURE.md` §2.
- **Validasi input:** Zod di semua form & URL params sebelum menyentuh database.
- **Webhook Midtrans:** wajib signature verification + Cloudflare WAF IP-allowlist (`infra/cloudflare/`).
- **Rate limiting:** Upstash Ratelimit di endpoint login, checkout, dan webhook.
- **Secret management:** Doppler untuk dev/build; `secretlint` + husky pre-commit mencegah secret masuk commit; `.env.example` tidak pernah berisi value asli.
- **Data pelanggan (UU PDP/UU ITE):** kebijakan enkripsi & retensi lengkap ada di [`docs/compliance_backup_policy.md`](./docs/compliance_backup_policy.md) — AES-256-GCM, rotasi key tahunan, backup terenkripsi.
- **Observability:** `sentry.server.config.ts` di-set `sendDefaultPii: false` — data pribadi pelanggan tidak terkirim ke Sentry.
- **Soft delete only:** tidak ada perintah `DELETE` — mengurangi risiko kehilangan data permanen akibat bug/serangan.

## Dependency Security

Dependency di-cek lewat `pnpm audit` dan pipeline di `.github/workflows/ci.yml`. Update dependency dengan CVE aktif diprioritaskan di luar jadwal rilis normal.

---
*Dokumen ini dibuat 02-Juli-2026 menggantikan placeholder SECURITY.md default yang sebelumnya kosong dan salah lokasi (ada di root wrapper, bukan di sini). Isi kontak di bagian "Melaporkan Kerentanan" masih perlu diisi manual.*
