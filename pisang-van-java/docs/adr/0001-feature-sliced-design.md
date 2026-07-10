# 0001. Feature-Sliced Design dibanding folder berbasis tipe

**Status:** Accepted
**Tanggal:** (tidak tercatat — direkonstruksi Juli 2026)
**Konteks penulisan:** Didokumentasikan retroaktif dari `ARCHITECTURE.md` §1
dan struktur folder `src/features/` yang sudah ada di kode.

## Konteks

Struktur folder monolitik berbasis tipe (semua UI di `components/`, semua
logic di `lib/`) gampang berubah jadi spaghetti code begitu jumlah fitur
bahari/domain bertambah — perubahan pada satu fitur (misal menu) gampang menyentuh file
yang sebenarnya dipakai fitur lain (misal auth) tanpa disadari, karena tidak
ada batas yang jelas antar fitur. Untuk project solo-dev yang scope-nya
tumbuh cepat (storefront + POS + KDS + B2B CRM dalam satu monorepo), risiko
ini nyata: tidak ada tim lain yang bakal menyadari kalau satu perubahan kecil
merembet ke fitur yang tidak berhubungan.

## Keputusan

Kode dikelompokkan berdasarkan fitur/domain di `src/features/` (mis.
`auth/`, `menu/`, `settings/`), bukan berdasarkan tipe file. Prinsip
karantina (isolation): komponen dalam satu fitur tidak mengimpor internal
logic fitur lain secara langsung tanpa melalui kontrak/API yang jelas.

## Alternatif yang Dipertimbangkan

- **Struktur berbasis tipe** (`components/`, `lib/`, `hooks/` semua di top
  level) — ditolak karena tidak scale dengan baik ketika jumlah fitur
  bertambah; batas antar fitur jadi implisit dan gampang dilanggar tanpa
  disadari.
- **Microservices / multi-repo per fitur** — ditolak karena overhead
  operasional (deployment, versioning, observability lintas service) tidak
  sepadan untuk tim satu orang dibanding pakai managed service; masalah yang sedang dihadapi
  bukan scaling organisasi, jadi solusinya juga tidak perlu sebesar itu.

## Konsekuensi

**Positif:**
- Perubahan pada satu fitur (mis. menu) punya blast radius yang jelas dan
  kecil.
- Onboarding kontributor baru lebih cepat: struktur folder = peta domain
  bisnis, bukan peta tipe file.

**Negatif / trade-off yang diterima secara sadar:**
- Butuh disiplin menjaga batas fitur — belum ada penegakan otomatis di
  level tooling (`.dependency-cruiser.cjs` yang sudah ada saat ini belum
  punya rule spesifik yang menolak import lintas-fitur). Ini kandidat
  perbaikan lanjutan, bukan sesuatu yang ditegakkan hari ini.

## Referensi

- `ARCHITECTURE.md` §1
- `src/features/`
