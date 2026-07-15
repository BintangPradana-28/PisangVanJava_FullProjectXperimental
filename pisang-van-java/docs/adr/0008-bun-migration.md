# ADR 0008 — Migrasi dari pnpm + Node.js ke Bun

- **Status:** Accepted
- **Date:** 2026-07-15
- **Decision Maker:** Bintang Pradana
- **Retroactive:** Tidak — keputusan ini dibuat dan di-ADR-kan bersamaan.

## Context

Project menggunakan **pnpm** sebagai package manager dan **Node.js** sebagai runtime. Beberapa pain point yang memotivasi evaluasi:
- Install time pnpm cukup panjang (~30 detik+ di CI)
- `@node-rs/argon2` (native Rust addon untuk password hashing) menyebabkan masalah kompatibilitas lintas platform
- `ts-node`/`tsx` diperlukan sebagai transpiler terpisah untuk menjalankan TypeScript scripts (seed, backup, restore)
- `dotenv` diperlukan untuk memuat `.env` files

## Alternatives Considered

### Option A — Status Quo (pnpm + Node.js)
- **Pro:** Stabil, battle-tested, ekosistem terluas.
- **Con:** Lambat untuk install, butuh transpiler tambahan, native addon `@node-rs/argon2` rentan error.

### Option B — Bun (package manager + runtime) ✅ **CHOSEN**
- **Pro:** Install 5–10x lebih cepat, TypeScript native tanpa transpiler, auto-load `.env`, `Bun.password` built-in (Argon2id tanpa native addon), Vercel mendukung Bun sebagai package manager.
- **Con:** Ekosistem lebih muda, beberapa native addons mungkin bermasalah, `Bun.password` = vendor lock-in ke Bun runtime.

### Option C — Bun hanya sebagai package manager (runtime tetap Node.js)
- **Pro:** Dapat speed benefit install tanpa risiko runtime.
- **Con:** Tidak menyelesaikan masalah `@node-rs/argon2`, tetap butuh transpiler.

## Decision

Migrasi ke **Bun** sebagai package manager DAN runtime lokal/CI/Docker.

**Scope Fase 1+2 (dilakukan sekarang):**
- Bun sebagai package manager (mengganti pnpm)
- `@node-rs/argon2` → `Bun.password` (menghapus native addon)
- Hapus `ts-node`, `tsx`, `dotenv` (redundant)
- CI/CD → `oven-sh/setup-bun@v2`
- Dockerfile → `oven/bun:1-alpine`
- Vercel tetap Node.js runtime (tidak menambahkan `bunVersion`)

**Fase 3 (ditunda — manual nanti):**
- Aktifkan `"bunVersion": "1.x"` di `vercel.json` untuk switch Vercel production runtime ke Bun

## Consequences

**Positif:**
- Eliminasi 3 devDependencies (`ts-node`, `tsx`, `dotenv`)
- Eliminasi 1 production dependency dengan native binary (`@node-rs/argon2`)
- CI install time berkurang signifikan
- TypeScript scripts (seed, backup, restore) berjalan natively tanpa transpiler

**Negatif / Risiko:**
- `Bun.password` hanya berjalan di Bun runtime — jika suatu saat ingin kembali ke Node.js, harus ganti implementasi password hashing
- Bun ecosystem lebih muda dari Node.js — update/breaking changes mungkin lebih sering
- Hash backward compatibility: aman — format PHC string Argon2id (`$argon2id$v=19$m=...`) adalah standar, hash lama tetap valid

## References

- [Bun docs: Password hashing](https://bun.sh/docs/api/hashing)
- [Vercel docs: Bun runtime](https://vercel.com/docs/functions/runtimes/bun)
- [Argon2 PHC string format](https://github.com/P-H-C/phc-string-format/blob/master/phc-sf-spec.md)
