# Load & Stress Testing (k6)

## Kenapa k6, bukan Artillery

Dipilih k6 karena: scripting-nya JavaScript (konsisten dengan seluruh stack
kalian yang TypeScript-heavy — tidak perlu belajar DSL baru), output-nya
gampang diarahkan ke Grafana Cloud k6 atau sekadar summary JSON di CI, dan
untuk beban kerja HTTP murni (bukan WebSocket/gRPC kompleks) k6 adalah
pilihan paling umum dipakai tim di 2026. Artillery lebih unggul kalau butuh
skenario multi-step yang sangat kompleks atau testing WebSocket — belum jadi
kebutuhan utama kalian sekarang, jadi tidak dipilih.

## Cakupan saat ini: HANYA jalur publik/read-only

Script di folder ini SENGAJA cuma menyentuh endpoint publik yang tidak butuh
auth dan tidak mengubah data:

- `GET /`
- `GET /menu-spesial`
- `GET /api/menu`
- `GET /api/toppings`
- `GET /api/health`

Ini bukan kelalaian — ini keputusan sadar. Alasannya: project ini toko
sungguhan dengan integrasi sungguhan (Midtrans, Fonnte WhatsApp, Resend
email). Load test yang menyentuh endpoint checkout/cart/POS tanpa persiapan
bisa memicu efek samping nyata — email/WA beneran terkirim, transaksi
Midtrans beneran tercatat (bahkan di sandbox, itu tetap mengotori data test
ke database production kalau tidak hati-hati).

Cakupan checkout SENGAJA belum dibuat sampai tiga hal ini disiapkan:

1. **Akun test yang di-seed khusus** — bukan akun pelanggan asli, ditandai
   supaya mudah dibedakan dan dibersihkan dari data asli.
2. **Cara membedakan "order test" dari order asli** — entah lewat flag di
   DB (mis. `isLoadTest: true` di model `Order`), atau menjalankan seluruh
   skenario ini hanya di environment staging terpisah dengan Midtrans
   sandbox key, bukan production key.
3. **Script pembersihan (cleanup)** yang menghapus data test setelah run
   selesai, supaya tidak mengotori dashboard admin/laporan asli.

Kalau prioritasnya berubah dan skenario checkout mau ditambahkan, itu bukan
sekadar tambah baris kode k6 — tiga syarat di atas perlu disiapkan dulu.

## Menjalankan lokal

Butuh k6 CLI (`brew install k6` di macOS, lihat
https://k6.io/docs/get-started/installation/ untuk platform lain). TIDAK
butuh instalasi npm package — k6 adalah binary Go standalone, bukan
package Node, jadi tidak perlu masuk `package.json`.

```bash
# Smoke test cepat: 1 iterasi, cuma ngecek endpoint kritis masih hidup
k6 run load-testing/k6/smoke.js

# Load test penuh: ramping virtual users, lihat skenario di file-nya
k6 run load-testing/k6/storefront-browse.js

# Arahkan ke environment lain (default: localhost:3000)
BASE_URL=https://pisang-van-java-full-project-vg1z.vercel.app k6 run load-testing/k6/storefront-browse.js
```

Jalankan `smoke.js` dulu sebelum `storefront-browse.js` — kalau smoke test
saja gagal, tidak ada gunanya lanjut ke load test yang lebih berat.

## Threshold yang dipakai

`storefront-browse.js` diset gagal (exit code non-zero) kalau:

- p95 response time > 500ms
- Error rate (request gagal) > 1%

Ini SENGAJA lebih longgar dari target keandalan checkout 99.9% di
`PRD.md` — karena script ini mengukur jalur browsing publik, bukan
checkout. Threshold khusus checkout baru relevan kalau skenario checkout
sudah dibuat (lihat bagian "Cakupan saat ini" di atas).

## Menjalankan di CI

Lewat GitHub Actions, manual trigger saja (`workflow_dispatch`) di
`.github/workflows/load-test.yml` — SENGAJA tidak dijadwalkan otomatis
(`schedule`), karena ini toko kecil sungguhan: load test rutin ke production
tanpa alasan jelas cuma buang-buang kuota Vercel/Supabase tanpa manfaat
sepadan. Jalankan manual dari tab Actions sebelum momen yang diperkirakan
ramai (promo, jam makan siang, dsb).
