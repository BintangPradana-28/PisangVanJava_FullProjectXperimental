## Ringkasan Perubahan

<!-- Jelaskan singkat apa yang diubah dan kenapa -->

## Jenis Perubahan

- [ ] Bug fix
- [ ] Fitur baru
- [ ] Breaking change
- [ ] Refactor / cleanup
- [ ] Dokumentasi

## Checklist

- [ ] Sudah dites lokal (`bun run dev`)
- [ ] `bun run test` lolos
- [ ] `npx tsc --noEmit` tidak ada error
- [ ] Kalau ada perubahan `schema.prisma` — migration sudah dibuat (`prisma migrate dev`) dan di-commit
- [ ] Kalau ada perubahan di route/API — sudah dicek ownership check (BOLA/IDOR) dan rate limiting
- [ ] Kalau ada query baru ke DB — sudah dicek potensi N+1 (loop yang isinya `await prisma.*`)
- [ ] Tidak ada secret/API key ter-hardcode

## Screenshot (kalau ada perubahan UI)

<!-- Tempel screenshot di sini -->
