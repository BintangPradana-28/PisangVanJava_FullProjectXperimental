# Arsitektur & Standar Teknis: Warung Pisang Goreng Van Java

Proyek ini dibangun dengan standar **Enterprise-Grade Engineering** untuk mencegah masalah *vibe coding* seperti *Spaghetti Code*, *God Component*, dan celah keamanan.

## 1. Feature-Sliced Design (Domain-Driven)
Kami meninggalkan struktur folder monolitik berbasis tipe (seperti memisahkan semua UI di `components/` dan semua logika di `lib/`). Kode sekarang dikelompokkan berdasarkan **Fitur/Domain**:

- `src/features/auth/`: Segala sesuatu tentang login, hashing (Bcrypt), *session*, dan *middleware* NextAuth.
- `src/features/menu/`: Komponen katalog menu, UI Kartu, logika CRUD menu, dan *upload* gambar.
- `src/features/settings/`: Konfigurasi warung, integrasi UI peta, dan WhatsApp.

Prinsip Karantina (Isolation): Komponen dalam satu fitur tidak boleh mengimpor *internal logic* fitur lain secara langsung tanpa melalui kontrak API yang jelas.

## 2. Zero Trust Security & Validasi
- **Validasi Zod:** Semua *input form* dan *URL Parameters* harus divalidasi dengan skema Zod sebelum diproses atau menyentuh *database*.
- **Otorisasi Middleware:** Setiap akses *endpoint API* mutasi data (POST, PUT, DELETE) wajib melewati pengecekan token/sesi.
- **Enkripsi:** Password selalu di-hash satu arah menggunakan `bcryptjs`. Tidak ada password *plain-text*.

## 3. Flawless Database (Prisma)
- **Soft Deletes:** Tidak menggunakan perintah `DELETE`. Rekaman ditandai dengan flag `isDeleted = true`.
- **Indexing:** Kolom yang sering di-query seperti `username` dan `nama_varian` menggunakan `@@index`.
- **Transactions (ACID):** Penyimpanan entitas bersarang atau operasi multi-tabel (seperti simpan menu + unggah gambar) wajib menggunakan `prisma.$transaction`.
- **N+1 Prevention:** Menggunakan fitur *include/select* bawaan Prisma dan Query Agregasi.

## 4. UI/UX & Observabilitas
- **Dumb UI Components:** Komponen UI murni (*stateless*) untuk menjaga modularitas.
- **Skeleton Loading & Optimistic UI:** Menghindari layar kosong saat antarmuka menunggu balasan server.
- **Global Error Handling:** Semua *error* ditangkap, dicatat di server, dan hanya mengembalikan pesan *"Terjadi kesalahan pada server"* kepada klien (tanpa *stack trace* bocor).

## 5. Dual Storage Providers (Decoupled Architecture)
Kami memisahkan penyimpanan aset berdasarkan jenis data dan kebutuhan optimasi:
- **Cloudinary:** Khusus untuk foto menu/varian produk. Digunakan karena performa transformasi dinamis (auto-crop, format modern avif/webp, auto-quality) yang krusial bagi web performance.
- **Supabase Storage:** Khusus untuk dokumen transaksional privat (Invoice PDF) dan avatar pengguna. Digunakan karena terintegrasi langsung dengan aturan Row Level Security (RLS) PostgreSQL Supabase.

## 6. Dual PDF Generation Engines
- **jsPDF + jspdf-autotable (Client-Side):** Digunakan untuk generate struk pemesanan instan langsung di browser sisi kasir/pengguna tanpa membebani daya CPU server.
- **@react-pdf/renderer (Server-Side):** Digunakan untuk rendering PDF invoice secara terjadwal di sisi server menggunakan NodeJS Streams untuk kemudian diunggah secara otomatis ke Supabase Storage.

## 7. Cloudflare WAF & Midtrans Protection
Pencegahan bypass webhook Midtrans diimplementasikan menggunakan Cloudflare WAF Rules yang mencocokkan IP Address pengirim webhook dengan daftar IP resmi Midtrans. Terraform IaC disediakan di folder `infra/` untuk standarisasi penyebaran aturan keamanan tersebut.

## 8. Structured Logging & E2E Testing
- **Pino Logger:** Penanganan pencatatan log pada handler sensitif (autentikasi, webhook, transaksi) dialihkan dari standard `console` ke Pino structured JSON logger. Ini memudahkan query log terpusat dan menjaga postur kepatuhan audit.
- **Playwright E2E Testing:** Happy path serta error handling kritis disimulasikan menggunakan skenario pengujian Playwright berbasis Network Mock Routing untuk menjamin keandalan pipeline CI/CD tanpa ketergantungan database state.

