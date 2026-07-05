# Security Policy — Pisang Van Java

> ADDITION (audit QA & Security): dokumen ini sebelumnya tidak ada. GitHub secara khusus
> mengenali file `SECURITY.md` di root repo dan menampilkannya di tab "Security" repo —
> jadi ini juga berfungsi sebagai kanal disclosure resmi yang terhubung dengan
> `public/.well-known/security.txt`.

## Melaporkan Kerentanan

Jika Anda menemukan kerentanan keamanan di proyek ini, laporkan secara bertanggung jawab:

- **Email:** security@pisangvanjava.com _(TODO: ganti dengan inbox yang benar-benar dipantau tim sebelum publish)_
- **Jangan** membuka GitHub Issue publik untuk kerentanan yang belum diperbaiki.
- Sertakan: langkah reproduksi, dampak yang mungkin terjadi, dan versi/commit yang terpengaruh.

Kami akan berusaha membalas dalam **3 hari kerja** dan memberi update berkala sampai
kerentanan diperbaiki.

## Cakupan

| Termasuk | Tidak termasuk |
|---|---|
| Aplikasi web (semua panel: customer, admin, kasir/POS, kitchen, reseller) | Serangan DoS/volumetrik terhadap infrastruktur pihak ketiga (Midtrans, Biteship, dll) |
| API routes (`/api/*`) | Social engineering terhadap staf |
| Webhook handlers | Kerentanan yang butuh akses fisik ke perangkat |

## Versi yang Didukung

Hanya branch `main` (versi production terbaru) yang menerima patch keamanan.

---

## Incident Response Runbook (Template)

> TODO: lengkapi bagian `[ISI: ...]` dengan kontak dan detail infrastruktur nyata sebelum
> dipakai sebagai acuan operasional.

### 1. Deteksi
Sumber deteksi yang sudah terhubung ke Sentry setelah audit ini:
- Alert `[SECURITY][MISCONFIG]` — webhook/cron kehilangan secret konfigurasi (lihat
  `app/api/webhooks/biteship/route.ts`, `app/api/webhooks/outgoing/whatsapp/route.ts`,
  `app/api/cron/route.ts`).
- Alert `[SECURITY] Account locked out` — kemungkinan brute-force per akun (lihat
  `src/auth.ts`).
- `AuditLog` (tabel Prisma) — jejak semua aksi admin sensitif (ban user, adjust koin,
  perubahan status order).
- `AuthLog` (tabel Prisma) — jejak `FAILED_SIGN_IN` per akun.

### 2. Triase
1. Tentukan tingkat keparahan: Critical (data/uang bocor atau bisa dimanipulasi jarak jauh
   tanpa autentikasi) → Medium (butuh kredensial staf) → Low (butuh interaksi user lain).
2. `[ISI: siapa yang dihubungi pertama kali — on-call engineer / owner]`.
3. Cek `AuditLog`/`AuthLog`/Sentry untuk memperkirakan blast radius (akun mana saja yang
   terpengaruh, sejak kapan).

### 3. Containment (Penahanan)
- Kredensial bocor → rotasi segera: `AUTH_SECRET`, `MIDTRANS_SERVER_KEY`,
  `BITESHIP_WEBHOOK_TOKEN`, `QSTASH_*_SIGNING_KEY`, `CRON_SECRET` (env var terkait ada di
  `.env.example`). Setelah rotasi `AUTH_SECRET`, SEMUA sesi login akan otomatis tidak valid
  (fail-closed by design — lihat `src/env.ts:getAuthSecret`).
- Akun dicurigai dikompromikan → gunakan `banUser` (`src/features/admin/actions/ban-user.ts`)
  untuk memutus sesi aktif secara langsung, bukan cuma ganti password.
- Kerentanan aktif dieksploitasi di production → pertimbangkan matikan sementara
  fitur/route terkait (feature flag atau redeploy dengan route dinonaktifkan) sebelum patch
  siap, daripada membiarkan celah terbuka sampai fix selesai ditest.

### 4. Eradication & Recovery
- Terapkan patch, jalankan penuh test suite (`pnpm test:coverage`) + CI security gates
  (`pnpm audit`, `pnpm depcheck`, `pnpm secretlint`, CodeQL) sebelum deploy ulang.
- Untuk insiden terkait data pelanggan: pertimbangkan kewajiban notifikasi di bawah
  UU PDP (Undang-Undang Pelindungan Data Pribadi) — `[ISI: kontak penasihat hukum/DPO]`.

### 5. Post-Mortem
- Dokumentasikan: kronologi, akar masalah, mengapa tidak tertangkap CI/test sebelumnya,
  dan test/monitoring baru apa yang ditambahkan agar kelas kerentanan yang sama tertangkap
  otomatis di masa depan.

---

## Kontrol Keamanan yang Sudah Aktif (ringkasan untuk auditor eksternal)

- Autentikasi: Argon2id, 2FA (wajib untuk role staff: SUPER_ADMIN/ADMIN/KITCHEN/CASHIER),
  lockout per-akun setelah 5x gagal berturut-turut, rate limit per-IP.
- Otorisasi: RBAC via `middleware.ts` + pengecekan independen di setiap route API
  (defense-in-depth).
- Webhook: verifikasi signature HMAC (Midtrans, QStash) atau token (Biteship), fail-closed
  jika secret tidak dikonfigurasi.
- CI/CD: dependency audit, secret scanning (Secretlint), SAST (CodeQL), container scan
  (Trivy), test coverage reporting.
- Kepatuhan data pribadi (UU PDP): hak hapus akun (`deleteAccount`) dan hak portabilitas
  data (`exportUserData`) tersedia di `/profile/keamanan`.
