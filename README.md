# Pisang Van Java

![CI](https://github.com/BintangPradana-28/PisangVanJava_FullProjectXperimental/actions/workflows/ci.yml/badge.svg)
![Bun](https://img.shields.io/badge/runtime-Bun-black)
![License](https://img.shields.io/badge/license-Proprietary-red)

> Enterprise-grade F&B Point-of-Sale & E-Commerce platform — built and hardened as a solo-developer portfolio project.

**[Live demo →](https://pisanggorengvanjava.com)**

Pisang Van Java is a production-grade platform for a Javanese banana-fritter street-food brand: customer storefront, point-of-sale register, real-time kitchen display, delivery dispatch, B2B pipeline, and admin back office — one codebase, not a toy demo.

## At a glance

- **Security-audited, not just security-themed.** Real vulnerability classes found and fixed during development (BOLA, price manipulation, stock-decrement race condition, timing attack) — documented with specifics, not just claimed. See [`BUYER_TECHNICAL_OVERVIEW.md`](./pisang-van-java/BUYER_TECHNICAL_OVERVIEW.md).
- **Argon2id + 2FA + fail-closed session revocation** — auth built past "it has a login page."
- **Idempotent, atomic checkout** — Midtrans payment flow with webhook signature verification and optimistic-lock stock decrement, not check-then-update.
- **Bun runtime** across dev, CI, and Docker — including working around a confirmed upstream Bun/Pino compatibility bug rather than ignoring it.
- **CI enforces architecture, not just tests.** `dependency-cruiser` blocks illegal cross-feature imports and client-side Prisma access on every push.

## Repository layout

```
├── pisang-van-java/     ← the actual application. Start here.
├── vercel/               deployment notes
├── .agents/, .bolt/, GEMINI.md, DESIGN.md, debugger.md,
│   fullstack-developer.md
│                         AI coding-assistant configs used during development
└── PVJ_6_AI_Agent_System_Prompts.md
                          the multi-agent prompt framework this was built with
```

| Looking for... | Go to |
|---|---|
| Tech stack & how to run it locally | [`pisang-van-java/README.md`](./pisang-van-java/README.md) |
| Evaluating this for acquisition/licensing | [`pisang-van-java/BUYER_TECHNICAL_OVERVIEW.md`](./pisang-van-java/BUYER_TECHNICAL_OVERVIEW.md) |
| Architectural decisions & documented trade-offs | [`pisang-van-java/ARCHITECTURE.md`](./pisang-van-java/ARCHITECTURE.md) |
| Reporting a security issue | [`SECURITY.md`](./SECURITY.md) |

## License

Proprietary — all rights reserved. This codebase is intended for transfer via a specific commercial sale or licensing agreement; no usage rights are granted by default. See [`pisang-van-java/LICENSE`](./pisang-van-java/LICENSE) for full terms.

