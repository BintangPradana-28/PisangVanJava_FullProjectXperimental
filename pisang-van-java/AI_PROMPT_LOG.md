# AI Prompt Log

File ini mendokumentasikan instruksi-instruksi utama yang diberikan kepada AI selama pengembangan sistem ini.

### 20-Mei-2026: Inisialisasi Refactoring & Standar Enterprise

- **Instruksi User:** Meminta penyelarasan proyek dengan dokumen SRS, Wireframe, Class Diagram, serta penerapan puluhan aturan _Enterprise-Grade_ (termasuk Zod, NextAuth, Sentry, Prisma Transactions, Feature-Sliced Design, Zero Trust, Global Error Handling, dll).
- **Hasil/Keputusan:** Mengadopsi arsitektur _Feature-Sliced Design_ di `src/features`, memperbarui Prisma Schema dengan _Soft Deletes_ & _Indexing_, dan merombak tampilan UI agar sesuai dengan desain kartu (1-harga).

### 02-Juli-2026: Audit Docs & Observability

- **Instruksi User:** Audit menyeluruh konsistensi dokumentasi (README, ARCHITECTURE, PRD, CONTRIBUTING, SECURITY, AI_PROMPT_LOG) terhadap kode aktual, plus setup observability (Sentry, PostHog, Pino).
- **Hasil/Keputusan:**
  - `SECURITY.md` ditulis ulang & dipindah ke `pisang-van-java/` (sebelumnya placeholder default GitHub yang kosong, nyasar di root wrapper).
  - `ARCHITECTURE.md` §2 dikoreksi: `bcryptjs` → `@node-rs/argon2`, dikonfirmasi ke `package.json` dan kode aktual di `src/features/auth/`.
  - Ditemukan, belum di-fix (open items): tidak ada CHANGELOG.md; section "Observabilitas" di ARCHITECTURE.md §4 belum menyebut Sentry/PostHog meski README sudah; Doppler & AWS KMS dipakai nyata tapi absen dari Stack list di Shared Project Context; `docs/compliance_backup_policy.md` isinya solid tapi tidak di-link dari README/ARCHITECTURE; Sentry server trace sampling 100% flat (client sudah environment-aware); file demo `sentry-example-api`/`sentry-example-page` masih nempel; PRD.md masih versi 1.0.0 "Final/Approved" walau scope sudah bertambah (compliance/backup, observability).
  - Log ini sendiri kosong 44 hari (20-Mei → 02-Jul) meski development jelas berlanjut — dijadikan pengingat untuk update tiap sesi AI yang signifikan, bukan cuma di awal proyek.
- **Lanjutan (masih 02-Juli-2026), setelah izin eksekusi eksplisit dari user:**
  - `ARCHITECTURE.md` §1 dikoreksi juga (`hashing (Bcrypt)` → `hashing (Argon2)`) — ternyata ada 2 mention bcrypt yang salah, bukan cuma 1.
  - `ARCHITECTURE.md` §4 ditambah 2 bullet baru (APM/Error Tracking Sentry, Product Analytics PostHog) pakai fakta yang sudah diverifikasi ke config file aktual — bukan cuma nulis ulang judul section.
  - `sentry.server.config.ts`: `tracesSampleRate` dibuat environment-aware (0.1 production / 1 dev, sebelumnya 100% flat), komentar sisa `// RAG Source: ...` (artefak AI-generation lama) dibuang.
  - `CHANGELOG.md` dibuat baru, sengaja mulai dari hari ini saja — tidak merekonstruksi histori lama karena tidak ada sumber yang bisa dipercaya untuk itu.
  - **Temuan baru, belum di-fix:** kemungkinan `pisang-van-java/.github/workflows/ci.yml` tidak pernah ke-discover oleh GitHub Actions kalau ternyata folder `pisang-van-java/` bukan root repo yang sebenarnya (workflow harus ada di root repo, bukan di subfolder) — ada `.gitignore` terpisah di kedua level yang bikin ini ambigu dari isi zip saja. **Ini perlu dicek manual oleh Bintang langsung di GitHub**, bukan sesuatu yang bisa disimpulkan dari file lokal.
  - **Temuan baru, belum di-fix:** `src/lib/posthog.ts` tidak punya safeguard PII eksplisit setara `sendDefaultPii: false` di Sentry — belum tentu bermasalah (tergantung properti yang dikirim tiap `capture()` call), tapi belum diverifikasi ke 6 titik pemakaiannya satu-satu.
- **Lanjutan kedua (masih 02-Juli-2026):** dibuat `docs/observability-playbook.md` — proposal baseline untuk 5 hal yang sebelumnya nggak ada sama sekali (bukan drift, tapi kosong): alert routing, runbook mini 3 failure mode kritis, akses log production (dikonfirmasi: `vercel.json` nggak ada log drain), event PostHog yang direkomendasikan, dan gap retensi data Sentry/PostHog. Bagian alert-rule & retensi tetap perlu disetup manual di dashboard masing-masing tool — nggak bisa diverifikasi dari kode.
