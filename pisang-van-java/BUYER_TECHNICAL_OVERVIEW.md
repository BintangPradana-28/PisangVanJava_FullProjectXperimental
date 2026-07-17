# Technical Overview — Pisang Van Java

**Purpose of this document:** a factual technical summary for anyone evaluating
this codebase for acquisition or licensing. Every claim below is something a
reviewer can independently verify by running the referenced command or opening
the referenced file — nothing here is asserted without a way to check it.

This document does not state a price. Valuation depends on deal structure
(source transfer vs. hosted license, exclusivity, ongoing support terms) and
market context neither author nor buyer can determine from code alone — see
`LICENSE` for the terms that need to be settled separately.

---

## 1. What this is

A full-stack commerce and operations platform for a food & beverage business:
customer-facing storefront, point-of-sale register, kitchen ticket display,
delivery dispatch and tracking, and an admin back office (menu, orders,
vouchers, B2B pipeline, complaints, reporting). Built on Next.js 16 (App
Router), TypeScript (strict), PostgreSQL via Prisma ORM, Auth.js v5.

## 2. Live, working third-party integrations

Not mocked, not placeholder — each of these has been exercised end-to-end
during development and verified against real API contracts:

| Integration | What it does | Verify at |
|---|---|---|
| Midtrans | Payment processing, Core API + webhook with HMAC signature verification | `app/api/payment/midtrans/webhook/route.ts` |
| Biteship | Courier rate calculation, order dispatch, delivery-status webhook | `src/services/biteship.service.ts`, `app/api/webhooks/biteship/route.ts` |
| Fonnte | WhatsApp order/status notifications | `lib/notifications.ts` |
| Cloudinary | Image upload with server-side MIME validation (magic-byte check, not just header trust) | `app/api/upload/route.ts` |
| Resend | Transactional email (password reset, order receipts) | `src/lib/resend.ts` |

## 3. Security posture

This is not a claim of "no vulnerabilities" — it's a record of what was
specifically checked and what was found and fixed, so a buyer's own review
starts from a known baseline instead of zero information.

**Classes of issues found and fixed during development-time audits:**
- BOLA (Broken Object Level Authorization) in the review-submission endpoint — fixed by verifying order ownership before granting a "verified buyer" badge
- Price manipulation in the POS order endpoint — client-submitted item prices were trusted directly; fixed by recomputing every price server-side from the database, matching the pattern already used in checkout
- Race condition in POS stock decrement — read-then-write with no re-check at write time could take inventory negative under concurrent orders; fixed with the same optimistic-lock compare-and-swap pattern (`version` + `stock: {gte}` in the update's WHERE clause) already used in the checkout flow
- Timing attack in the Biteship webhook token check — plain string comparison replaced with `crypto.timingSafeEqual`
- Unauthenticated endpoints (`/api/log`, `/api/admin/events`) that allowed unbounded writes / unauthenticated data streaming — both now require an authenticated session

**Currently in place:**
- Argon2id password hashing (`Bun.password` built-in)
- 2FA (TOTP via `otplib`, QR enrollment)
- Session revocation via Redis, fail-closed if Redis is unreachable
- Rate limiting (Upstash) on auth, checkout, reviews, complaints, and contact endpoints
- CSP enforced (not report-only) at the middleware level
- Cloudflare WAF + rate-limiting rules as Terraform IaC (`infra/cloudflare/`)

**Known gaps, stated plainly:**
- Test coverage for security-relevant logic is uneven — see §5
- No penetration test by an independent third party has been performed; the findings above are from structured internal code review, not external red-teaming

## 4. Architecture

- **Layering:** business logic for the highest-stakes domain (checkout: pricing, stock, vouchers) lives in `src/repositories/` + `src/services/`, not inline in route handlers. Most other CRUD domains query Prisma directly from route handlers — a deliberate, documented tradeoff (see `ARCHITECTURE.md`), not an oversight.
- **Automated boundary enforcement:** `.dependency-cruiser.cjs`, run in CI, blocks: client components importing Prisma directly, unsanctioned cross-feature imports, circular dependencies, and new files in two locations known to have accumulated dead/duplicate code in the past. Run it yourself: `bun run depcruise`.
- **Infrastructure as code:** Cloudflare WAF and rate-limiting rules are defined in Terraform (`infra/cloudflare/`), not click-ops. Uncommon at this project's scale — most comparable projects have none.
- **CI:** lint (Biome), typecheck (`tsc --noEmit`), architecture boundaries (dependency-cruiser), unit tests (Vitest), secret scanning (secretlint), and a security scan (semgrep) all run on every push/PR (`.github/workflows/ci.yml`).

## 5. Test coverage — stated honestly, not rounded up

- Unit tests: solid coverage of the checkout domain (pricing, voucher application, Zod schemas). Vitest, `bun run test`.
- E2E: one Playwright spec (`e2e/checkout.spec.ts`) covering the checkout happy path. POS, Kitchen, and admin dispatch flows do not yet have E2E coverage — this is the single largest testing gap in the project.
- No test currently exists that would have caught the POS price-manipulation or stock-race issues in §3 before manual audit found them; both now have server-side guards, but neither has a regression test locking that guard in place yet.

## 6. Feature completeness

| Area | Status |
|---|---|
| B2C storefront, cart, checkout | Complete, tested |
| POS register | Complete; price/stock integrity fixed per §3 |
| Kitchen ticket display | Complete for the core flow (pending → cooking → ready) |
| Delivery dispatch (Biteship) | Complete: admin dispatch UI → courier assignment → live tracking → delivery/tip |
| In-app notifications | Complete (bell icon, mark-as-read, BOLA-safe) |
| Loyalty points ("Koin Pisang") | Complete: earn via referral, redeem at checkout, balance + history visible to the customer |
| B2B pipeline | CRM-style deal tracking exists; does not yet auto-convert a won deal into an Order (manual step required) |
| Promo/voucher | Manual code entry only — no time-based auto-apply (flash sale) engine yet |
| Multi-outlet | **Explicitly out of scope by decision** — this is a single-outlet system. The `StoreBranch` model some earlier snapshots carried was removed rather than left as unused schema surface (see `ARCHITECTURE.md` change log). Extending to multi-outlet later is a real, non-trivial schema/logic change, not a config flag.
- Pre-order / scheduled time slots | Not implemented

## 7. Operational dependencies a buyer should budget for

This project runs on paid third-party services; a buyer inherits these costs
(or needs to re-point to their own accounts): Supabase (Postgres + storage),
Vercel or equivalent Next.js hosting, Midtrans (transaction fees, standard
for any Indonesian payment gateway), Biteship, Fonnte, Cloudinary, Resend,
Upstash Redis, Sentry, Cloudflare (WAF rules require a paid plan tier —
verify against current Cloudflare pricing before assuming cost).

## 8. How to verify any claim in this document

```bash
bun install
bun run env:check      # confirms env schema loads
bun run typecheck       # tsc --noEmit
bun run lint:biome
bun run depcruise       # architecture boundary check — should report 0 errors
bun run test            # unit tests
bun run build           # production build
```

If any of these fail on a clean checkout, that's a real finding worth
raising — this document reflects the state as of the last audit pass, not a
guarantee that no regression has landed since.
