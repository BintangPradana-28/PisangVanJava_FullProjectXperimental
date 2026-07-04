# Catatan Perubahan — Audit Docs & Observability (02-Juli-2026)

Cara pakai: copy folder `pisang-van-java/` di dalam zip ini, timpa (overwrite) file dengan nama sama di project asli kamu. Semua perubahan di sini murni dokumentasi + 1 config kecil (Sentry sample rate) — **tidak ada yang menyentuh schema database atau auth middleware**, jadi aman langsung dipakai tanpa review mendalam.

## Isi zip

- `pisang-van-java/SECURITY.md` — baru, isi lengkap, ganti placeholder lama.
- `pisang-van-java/ARCHITECTURE.md` — 3 koreksi: 2x bcrypt→argon2, tambahan section Sentry/PostHog di §4.
- `pisang-van-java/AI_PROMPT_LOG.md` — entri 02-Juli-2026 ditambah, mencatat semua yang di-fix + yang masih open.
- `pisang-van-java/CHANGELOG.md` — baru, mulai dari hari ini (bukan rekonstruksi histori lama).
- `pisang-van-java/sentry.server.config.ts` — `tracesSampleRate` dibuat environment-aware, komentar sisa AI-generation dibuang.

## Perlu tindakan manual dari kamu (nggak bisa/nggak seharusnya aku putuskan sendiri)

1. **Isi kontak di `SECURITY.md`** — bagian "Melaporkan Kerentanan" masih placeholder `[isi email/kontak maintainer di sini]`, aku nggak nemu email asli di project buat diisi otomatis.

2. **Hapus 2 file demo Sentry** (bukan sesuatu yang bisa dikirim lewat zip perubahan — cuma perlu dihapus):
   `app/api/sentry-example-api/route.ts` dan `app/sentry-example-page/page.tsx`

3. **Cek status GitHub Actions `ci.yml` langsung di GitHub** — dari isi zip aja aku nggak bisa mastiin apakah `pisang-van-java/` itu root repo yang sebenarnya atau subfolder. Kalau ternyata subfolder, `ci.yml` di `pisang-van-java/.github/workflows/` kemungkinan **nggak pernah ke-discover GitHub Actions** (workflow harus di root repo). Cek tab "Actions" di GitHub — kalau ci.yml nggak pernah kelihatan jalan di sana, itu konfirmasi masalahnya.

4. **Tambah 1 baris ke `PVJ_6_AI_Agent_System_Prompts.md`** (dokumen agent prompt, di luar `pisang-van-java/`) — di blok `Stack:`, setelah baris `Security tooling`, tambahkan:

   ```
   - Secrets/Key management: Doppler (env & build), AWS KMS (backup encryption key)
   ```

   Nggak aku regenerate seluruh dokumennya (draft ulang ~9000 kata berisiko salah ketik/drift) — cukup satu baris ini.

5. **`docs/compliance_backup_policy.md`** isinya udah bagus tapi nggak di-link dari README/ARCHITECTURE — aku nggak sentuh README.md karena belum baca isinya secara penuh (nggak mau edit dokumen yang belum aku verifikasi utuh). Kalau mau, kasih tau di mana enaknya nyantumin link-nya.

6. **Belum diverifikasi, worth dicek:** isi tracking `posthog.capture()` di 6 titik pemakaian (apakah ada PII yang ke-log), dan versi `PRD.md` yang masih "1.0.0 Final" walau scope udah nambah.

## Yang sengaja nggak disentuh sama sekali

Isi `GEMINI.md`, `DESIGN.md`, `debugger.md`, `fullstack-developer.md`, `.agents/skills/`, `.bolt/mcp.json` — itu instruksi buat tool AI lain (Gemini, Bolt, dll), bukan bagian dari Docs & Observability project ini. Cuma dicatat eksistensinya di audit awal.
