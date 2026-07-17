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
- **Lanjutan ketiga (05-Juli-2026):** ralat temuan sendiri — sebelumnya diduga rate limiting nggak ada di endpoint checkout/register (dari grep pattern yang kurang luas). Dicek ulang langsung ke kode: `enforceCheckoutRateLimit()` beneran dipanggil di `app/api/orders/route.ts` POST handler, dan `rateLimit.limit()` beneran dipanggil di `app/api/auth/register/route.ts` — keduanya nyata, bukan cuma diimpor. **Sengaja TIDAK ditulis kode baru untuk "fix" gap yang ternyata nggak ada** — ini di luar boundary Docs & Observability Agent juga (itu kerjaan Backend Agent, dan nyentuh auth-adjacent surface yang butuh konfirmasi eksplisit dulu).
  - Ditemukan: 4 file draft notifikasi (`*.tsx.txt`, `*.prisma.txt`, 2 route dengan nama salah) isinya sebenarnya reasonable (pola auth session-scoped, no BOLA) tapi eksplisit masih "MVP scope" & butuh schema Prisma baru yang belum di-merge — **sengaja tidak diintegrasikan**, itu keputusan fitur + schema, bukan docs.
  - Dibersihkan: 42 file di seluruh codebase masih punya sisa komentar `// RAG Source: ...` / `State Source: RAG —...` (artefak proses AI-generation, murni komentar, 0 perubahan logic) — semua dihapus. Satu di antaranya (`src/lib/animations.ts`) ternyata nyimpen path lokal Windows developer (`c:\Users\prada\...`) di komentar yang sekarang jadi "orphan" — sekalian dibersihkan karena itu kebocoran info personal kecil kalau repo ini ditunjukin ke orang lain. File serupa (`docs/cro_audit_full.txt`) juga masih ada path yang sama — disaranin dipindah keluar dari `docs/` atau dihapus, bukan didokumentasikan sebagai referensi.

### 15-Juli-2026: Migrasi Node.js + pnpm ke Bun (Fase 1+2)

- **Instruksi User:** Meminta migrasi menyeluruh dari pnpm + Node.js ke Bun sebagai package manager dan runtime untuk meningkatkan kecepatan development/CI.
- **Hasil/Keputusan:**
  - Melakukan migrasi package manager dari `pnpm` ke `bun` (menghapus `pnpm-lock.yaml`, `pnpm-workspace.yaml`, `.npmrc`, menghasilkan `bun.lock`).
  - Mengganti `@node-rs/argon2` (native addon yang bermasalah di Bun runtime) dengan `Bun.password` API bawaan runtime.
  - Memperbarui `Dockerfile` dan Docker setup menggunakan base image `oven/bun:1-alpine`.
  - Memperbarui file workflow CI/CD (`ci.yml` & `backup.yml`) ke `oven-sh/setup-bun@v2`.
  - Memperbarui seluruh dokumentasi (`GEMINI.md`, `README.md`, `ARCHITECTURE.md`, `SECURITY.md`, `CONTRIBUTING.md`, `BUYER_TECHNICAL_OVERVIEW.md`, `compliance_backup_policy.md`).
  - Menyusun ADR baru (`0008-bun-migration.md`) mendokumentasikan keputusan arsitektur ini.
  - Penundaan Fase 3 (aktifkan Vercel Bun runtime `bunVersion` di production) untuk meminimalkan risiko stabilitas.
  - **Fixes Pasca-Audit (CI/CD & Security)**:
    - Menyelesaikan error build Vercel akibat hilangnya package `dotenv` dengan mengecualikan folder `scripts` dari `tsconfig.json`.
    - Mengamankan file scan budget dari path traversal vulnerability di `check-bundle-budget.js` menggunakan validasi `path.resolve` + `startsWith`.
    - Menyematkan commit SHA absolut (full 40-character SHA) pada GitHub Actions (`setup-bun`, `sbom-action`, `action-baseline`) guna mematuhi security policy Semgrep.
    - Menambahkan environment variable database dummy (`DATABASE_URL` & `DIRECT_URL`) di workflow lint schema Prisma.
    - Menyalin `bun.lock` secara dinamis sebelum building Docker container di workflow `ci.yml` untuk mengatasi error build context.

### 17-Juli-2026: Fix pino-pretty crash di Bun runtime (ditemukan via web research)

- **Instruksi User:** "fix docs and observability errors and bug after bun migration from node.js"
- **Temuan:** `src/lib/logger.ts` masih pakai `transport: { target: 'pino-pretty' }` — pola ini men-spawn worker thread yang butuh dynamic module resolution yang Bun nggak bisa handle dengan benar di bawah `bun --bun`. Ini bug Bun yang terkonfirmasi & masih terbuka (dicek via web search: `oven-sh/bun#4280`, `#23062`, `#10246` — error persis "unable to determine transport target for pino-pretty"/"TypeError: undefined is not an object (evaluating 'callers')", direproduksi dari Bun v0.8 sampai v1.2.22, belum ada fix resmi dari pihak Bun).
- **Fix:** ganti ke pola stream langsung (`pino(options, pretty(prettyOptions))`) — ini alternatif resmi yang didokumentasikan `pino-pretty` sendiri untuk menghindari worker thread sama sekali. Nggak nambah dependency baru (`pino-pretty` udah ada di devDependencies).
- **Dicek, sudah beres duluan (nggak perlu disentuh):** referensi `Bun.password`/Argon2 di ARCHITECTURE.md udah akurat, CI/README/CONTRIBUTING udah konsisten pakai `bun`/`bunx`, `app/robots.ts` udah lengkap & benar (route group admin di-disallow dengan tepat).
- **Belum dicek:** apakah ada pino-pretty error yang sama juga muncul di konteks lain (mis. script CLI terpisah di luar `src/lib/logger.ts`) — baru satu titik yang diverifikasi.
