# Changelog — Pisang Van Java

All notable changes to this project will be documented in this file.

---

## [1.2.0] - 2026-07-15

### Added
- **ADR 0008 (Bun Migration)**: Created `docs/adr/0008-bun-migration.md` to document the decision to migrate from pnpm + Node.js to Bun package manager and runtime.

### Changed
- **Package Manager Migration**: Migrated the entire workspace from `pnpm` to `Bun`. Deleted `pnpm-workspace.yaml`, `pnpm-lock.yaml`, `.npmrc`, and generated `bun.lock` at the root workspace level.
- **Argon2 Hashing Migration**: Replaced the `@node-rs/argon2` Rust native addon (which has binary compatibility issues in Bun) with Bun's native high-performance `Bun.password` Argon2id API. Existing password hashes in the database remain fully valid and backward-compatible.
- **Docker Setup**: Updated the `Dockerfile` to use `oven/bun:1-alpine` as the base image for both building and running Next.js.
- **CI/CD Workflows**: Migrated `.github/workflows/ci.yml` and `backup.yml` to use `oven-sh/setup-bun@v2` and execute all scripts via `bun` instead of `pnpm` / `npx`.
- **System and Dev Tools**: Removed redundant transpilers `ts-node`, `tsx`, and `dotenv` from development dependencies, relying on Bun's native TypeScript execution and automatic `.env` loading.
- **Documentation**: Updated package runner examples and configuration specs in `GEMINI.md`, `README.md`, `ARCHITECTURE.md`, `SECURITY.md`, `CONTRIBUTING.md`, `BUYER_TECHNICAL_OVERVIEW.md`, and `compliance_backup_policy.md`.

---

## [1.1.0] - 2026-07-03

### Added
- **Server-Side Store Hours Enforcement**: Added validation checks in `POST /api/orders` to verify the store's current operational hours and overrides in the database before processing checkout transactions.
- **Doppler & AWS KMS Tech Stack**: Added Doppler configuration mappings and AWS KMS references for DB backup encryption keys.
- **Security Policy**: Added [SECURITY.md](SECURITY.md) to define vulnerability disclosure flows and compliance scopes.

### Changed
- **CSP Global Matcher Middleware**: Replaced static CSP in `next.config.js` with a single, unified dynamic nonce-based CSP matched globally across all pages (including login/register portals) via Middleware.
- **NextAuth Security Gating**: Enforced `env.AUTH_SECRET` required validator and disabled `allowDangerousEmailAccountLinking` in Google OAuth providers.
- **Sentry Data Privacy & Trace Calibration**:
  - Disabled PII transmission (`sendDefaultPii: false`) on both server and edge configurations in compliance with UU PDP.
  - Removed hardcoded Edge DSN key and mapped it to environment variables.
  - Calibrated `tracesSampleRate` in production environments (0.1) to control cloud costs.
- **Coin Manual Adjustments**: Restrained manual coin adjustments to the `SUPER_ADMIN` role only and added a strict Zod boundary cap (`-1,000,000` to `1,000,000`) for adjustments.
- **Safe Profile rendering**: Replaced the use of `dangerouslySetInnerHTML` on the user profile with standard JSX template split rendering.

### Removed
- **Orphaned Auth Registration Route**: Deleted `app/api/auth/register/route.ts` which bypassed rate limits and leaked database users.
- **Sentry Wizard Boilerplate**: Deleted Sentry example API test route and Page component.

---

## [1.0.1] - 2026-07-02

### Added
- **Observability Playbook**: Created `docs/observability-playbook.md` detailing alert routing, failure mode runbooks, production log access, and PostHog event recommendations.
- **Security Policy**: Initial placeholder `SECURITY.md` added.
- **ARCHITECTURE.md Updates**: Added Sentry and PostHog observability sections.

### Fixed
- **Password Hashing Docs**: Corrected password hashing description in `ARCHITECTURE.md` from `Bcrypt` to `@node-rs/argon2` to align with the source code.
- **Sentry Server Config**: Calibrated `tracesSampleRate` to be environment-aware (0.1 in production) to control cloud costs.

---

## [1.0.0] - 2026-06-15

### Added
- **POS Cashier Interface**: Built internal cashier POS interface with layout caching and responsive design.
- **Offline Sync Queue**: Zustand-based offline action queue that synchronizes local orders to the DB upon connection restore.
- **E-Commerce Storefront**: Product catalogs, active variants, modifiers, and cart state.
- **Payment Gateway**: Midtrans Snap integration for QRIS, Virtual Accounts, and Bank Transfer with HMAC webhook reconciliation.
- **Receipt & Invoice Generator**: Client-side thermal receipt styling (jsPDF) and server-side detailed invoice compilation (@react-pdf/renderer) saved to Supabase Storage.
- **Logging**: Initial Pino logger setup for selected critical pathways.
