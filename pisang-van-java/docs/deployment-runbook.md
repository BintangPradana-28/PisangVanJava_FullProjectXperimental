# Vercel Deployment & Rollback Runbook

This document defines the deployment verification checklist and instant rollback procedures for Pisang Van Java storefront and POS.

---

## 1. Deployment Validation Checklist

Before promoting any pull request or preview deployment to production, verify the following steps locally or in the Preview environment:

- [ ] **Typecheck passes**: `bun run typecheck` completes with 0 errors.
- [ ] **Lint and format checks pass**: `bun run lint:biome` and `bun run format` complete with 0 errors.
- [ ] **Tests pass**: `bun run test` (Vitest unit tests) and `bun run test:e2e` (Playwright E2E tests) pass.
- [ ] **Bundle Budget complies**: `bun run build` completed under bundle budget limits (`scripts/check-bundle-budget.js` exits with 0).
- [ ] **Migration Check**: Prisma schema is valid and formatted (`bunx prisma validate` and `bunx prisma format --check`).

---

## 2. Canary Deployment Strategy (via Vercel Previews)

1. Every pull request automatically generates a **Vercel Preview Deployment**.
2. **Verify changes** on the preview URL.
3. Test payment webhooks using Midtrans sandbox by configuring the webhook URL to point to the preview branch URL.
4. Once verified, merge the PR to `main` to trigger the production deployment.

---

## 3. Instant Rollback Procedure

If a critical bug, security vulnerability, or payment issue is detected in production, execute the rollback immediately:

### A. Via Vercel Web Dashboard (Recommended)
1. Go to the [Vercel Dashboard](https://vercel.com/) and select the `pisang-van-java` project.
2. Click on the **Deployments** tab.
3. Find the last known stable deployment (labeled as **Active** prior to the broken deployment).
4. Click the three dots `...` next to the stable deployment.
5. Select **Rollback**.
6. Confirm the rollback. Production traffic will instantly route to the stable deployment (zero downtime).

### B. Via Vercel CLI
If you have Vercel CLI configured locally:
```bash
# Rollback to the previous deployment
vercel rollback
```

---

## 4. Disaster Recovery & Emergency Rotation

If credentials or API secrets are compromised, rotate them immediately in **Doppler** or **Vercel Project Settings**:

1. **AUTH_SECRET**: Rotates the session signing key. Invalidates all active sessions (fail-closed security).
2. **MIDTRANS_SERVER_KEY**: Prevents unauthorized midtrans charges/refunds.
3. **RESEND_API_KEY**: Rotates email delivery secret.
4. After rotating keys, trigger a redeploy of the active production deployment to inject the new env variables:
   ```bash
   vercel --prod --force
   ```
5. Check the `api/health` check endpoint (`https://pisang-van-java-full-project-vg1z.vercel.app/api/health`) to confirm database and cache connections remain healthy.
