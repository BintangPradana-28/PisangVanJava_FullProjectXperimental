# Architecture Decision Records (ADR)

Folder ini mencatat keputusan arsitektur penting beserta alasan di baliknya —
bukan cuma "apa" yang diputuskan, tapi "kenapa", termasuk alternatif yang
ditolak dan trade-off yang diterima secara sadar.

## Kenapa ini penting

`ARCHITECTURE.md` di root project menjelaskan arsitektur *saat ini* dengan
baik, tapi tidak mencatat riwayat keputusan: kenapa Feature-Sliced Design
dipilih dibanding folder berbasis tipe, kenapa dua storage provider dipakai
sekaligus, dsb. Enam bulan dari sekarang — atau begitu ada kontributor baru —
pertanyaan "kenapa dulu begini?" akan lebih sering muncul daripada "gimana
cara kerjanya?", dan `ARCHITECTURE.md` tidak menjawab itu.

## Status awal (Juli 2026)

Semua ADR awal di folder ini **didokumentasikan retroaktif** — keputusannya
sudah diambil dan diimplementasikan sebelum ADR ini ditulis, jadi isinya
direkonstruksi dari `ARCHITECTURE.md` dan kode yang sudah ada, bukan dicatat
real-time saat keputusan diambil. Ini ditandai eksplisit di setiap file lewat
kolom "Konteks penulisan", dan tanggal keputusan aslinya memang tidak
diketahui — hanya tanggal rekonstruksinya yang tercatat.

## Index

| No | Judul | Status |
|----|-------|--------|
| [0001](./0001-feature-sliced-design.md) | Feature-Sliced Design dibanding folder berbasis tipe | Accepted (retroaktif) |
| [0002](./0002-dual-storage-providers.md) | Dua storage provider: Cloudinary + Supabase Storage | Accepted (retroaktif) |
| [0003](./0003-cloudflare-waf-midtrans-ip-allowlist.md) | Cloudflare WAF IP-allowlist untuk webhook Midtrans | Accepted (retroaktif) |
| [0004](./0004-dual-pdf-engine.md) | Dual PDF Generation Engines | Accepted (retroaktif) |
| [0005](./0005-prisma-db-push.md) | Prisma db push vs migrate dev | Accepted (retroaktif) |
| [0006](./0006-argon2id-hashing.md) | Hashing Password via Argon2id over bcrypt | Accepted (retroaktif) |
| [0007](./0007-edge-runtime-middleware.md) | CSP Nonce Generation at Edge Middleware | Accepted (retroaktif) |

## Cara menambah ADR baru

1. Copy `0000-template.md`, rename jadi `000X-judul-singkat.md` (nomor urut
   berikutnya, tiga digit).
2. Isi Konteks → Keputusan → Alternatif → Konsekuensi. Idealnya ditulis
   **sebelum** implementasi (real-time saat keputusan diambil) — jauh lebih
   akurat daripada direkonstruksi belakangan seperti ADR pertama ini.
3. Tambahkan satu baris baru di tabel index di atas.
4. ADR tidak pernah diedit lagi setelah statusnya "Accepted". Kalau
   keputusan berubah di kemudian hari, buat ADR baru dengan status
   "Supersedes ADR-000X" — riwayatnya tetap harus bisa dibaca, bukan
   ditimpa.
