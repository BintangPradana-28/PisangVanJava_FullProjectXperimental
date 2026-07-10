# 0003. Cloudflare WAF IP-allowlist untuk webhook Midtrans

**Status:** Accepted
**Tanggal:** (tidak tercatat — direkonstruksi Juli 2026)
**Konteks penulisan:** Didokumentasikan retroaktif dari `ARCHITECTURE.md` §7
dan `infra/cloudflare/`.

## Konteks

Endpoint webhook Midtrans (`/api/payment/midtrans/webhook`) menerima
notifikasi status pembayaran dari luar tanpa sesi user biasa — kalau
endpoint ini bisa dipanggil siapa saja dengan payload yang ditebak atau
dipalsukan, status order bisa dimanipulasi (mis. ditandai "sudah dibayar"
tanpa pembayaran asli terjadi). Verifikasi HMAC signature di level aplikasi
sudah ada, tapi itu cuma satu lapis pertahanan — untuk endpoint yang
langsung menyentuh uang, satu lapis saja belum cukup (defense-in-depth).

## Keputusan

Tambahkan lapisan jaringan di depan verifikasi HMAC aplikasi: Cloudflare WAF
Rule yang mencocokkan IP pengirim request dengan daftar IP resmi Midtrans,
sehingga request dari luar daftar itu ditolak sebelum sampai ke aplikasi
sama sekali. Aturan ini didefinisikan sebagai Terraform IaC di
`infra/cloudflare/` supaya perubahan aturan (mis. saat Midtrans memperbarui
daftar IP mereka) terlacak lewat version control, bukan diubah manual di
dashboard Cloudflare.

## Alternatif yang Dipertimbangkan

- **Hanya andalkan verifikasi HMAC signature di level aplikasi** — ditolak
  sebagai satu-satunya lapisan: kalau ada bug di kode verifikasi, atau
  `MIDTRANS_SERVER_KEY` bocor, tidak ada lapisan kedua yang menahan.
- **Ubah aturan IP-allowlist manual lewat Cloudflare dashboard tanpa IaC** —
  ditolak: perubahan tidak terlacak, gampang salah konfigurasi tanpa review,
  dan hilang begitu saja kalau environment perlu dibangun ulang.

## Konsekuensi

**Positif:**
- Dua lapis pertahanan independen (network-level IP allowlist +
  application-level HMAC) untuk endpoint yang langsung menyentuh transaksi
  uang.
- Perubahan aturan keamanan terlacak lewat git history — siapa mengubah
  apa, kapan, dan kenapa.

**Negatif / trade-off yang diterima secara sadar:**
- Daftar IP resmi Midtrans bisa berubah sewaktu-waktu di sisi mereka —
  kalau `infra/cloudflare/` tidak diperbarui mengikuti, webhook asli justru
  bisa ikut ter-block (false positive). Ini sudah dicatat sebagai salah satu
  skenario kegagalan kritis di `docs/observability-playbook.md` bagian
  "Webhook Midtrans: signature invalid".
- Menambah satu dependency operasional lagi (Terraform state, Cloudflare
  API token) yang perlu dijaga di luar kode aplikasi utama.

## Referensi

- `ARCHITECTURE.md` §7
- `infra/cloudflare/main.tf`, `infra/cloudflare/variables.tf`
- `docs/observability-playbook.md` (bagian "Webhook Midtrans: signature
  invalid")
