# Changelog — Pisang Van Java

All notable changes to this project will be documented in this file.

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

## [1.0.0] - 2026-06-15

### Added
- **POS Cashier Interface**: Built internal cashier POS interface with layout caching and responsive design.
- **Offline Sync Queue**: Zustand-based offline action queue that synchronizes local orders to the DB upon connection restore.
- **E-Commerce Storefront**: Product catalogs, active variants, modifiers, and cart state.
- **Payment Gateway**: Midtrans Snap integration for QRIS, Virtual Accounts, and Bank Transfer with HMAC webhook reconciliation.
- **Receipt & Invoice Generator**: Client-side thermal receipt styling (jsPDF) and server-side detailed invoice compilation (@react-pdf/renderer) saved to Supabase Storage.
- **Logging**: Initial Pino logger setup for selected critical pathways.
