# 0002. Dua storage provider: Cloudinary + Supabase Storage

**Status:** Accepted
**Tanggal:** (tidak tercatat — direkonstruksi Juli 2026)
**Konteks penulisan:** Didokumentasikan retroaktif dari `ARCHITECTURE.md` §5.

## Konteks

Ada dua jenis aset yang perlu disimpan dengan kebutuhan yang sangat berbeda:
(1) foto menu/varian produk yang perlu transformasi gambar cepat (crop,
resize, konversi format modern) demi performa web publik, dan (2) dokumen
transaksional privat (invoice PDF, avatar pengguna) yang perlu kontrol akses
ketat per baris data, bukan sekadar file publik yang bisa diakses siapa saja
yang tahu URL-nya.

## Keputusan

Pisahkan penyimpanan berdasarkan jenis data:
- **Cloudinary** untuk foto menu/varian — dipilih karena transformasi
  dinamis (auto-crop, auto-format AVIF/WebP, auto-quality) langsung dari CDN
  tanpa kerja tambahan di server aplikasi.
- **Supabase Storage** untuk invoice PDF dan avatar — dipilih karena
  terintegrasi langsung dengan Row Level Security (RLS) PostgreSQL Supabase
  yang sudah dipakai untuk database, jadi kontrol akses per-baris konsisten
  dengan satu sumber kebenaran (Supabase Auth + RLS), bukan sistem otorisasi
  terpisah.

## Alternatif yang Dipertimbangkan

- **Satu provider untuk semua aset** (semua di Supabase Storage, atau semua
  di Cloudinary) — ditolak: Supabase Storage tidak punya transformasi
  gambar real-time sekuat Cloudinary untuk kebutuhan performa storefront
  publik; Cloudinary sebaliknya tidak terintegrasi RLS Postgres untuk
  kontrol akses dokumen privat.
- **Self-hosted storage** (mis. S3-compatible di VPS sendiri) — ditolak:
  menambah beban operasional (backup, CDN, scaling, patching) yang tidak
  sepadan untuk tim satu orang dibanding pakai managed service.

## Konsekuensi

**Positif:**
- Tiap jenis aset dapat karakteristik penyimpanan yang paling cocok tanpa
  kompromi di salah satu sisi.
- Kontrol akses dokumen privat konsisten dengan model RLS yang sudah dipakai
  di database — tidak ada sistem izin kedua yang harus dijaga sinkron.

**Negatif / trade-off yang diterima secara sadar:**
- Dua vendor = dua tempat untuk memantau kuota/biaya/downtime, bukan satu.
- Kalau Cloudinary API key bocor atau salah konfigurasi, itu titik kegagalan
  terpisah dari Supabase — perlu dua jalur monitoring yang berbeda, bukan
  satu (relevan untuk `docs/observability-playbook.md`).

## Referensi

- `ARCHITECTURE.md` §5
- Konfigurasi Cloudinary dan Supabase Storage di kode aplikasi
