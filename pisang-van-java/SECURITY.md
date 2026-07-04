# Security Policy — Pisang Van Java

We take the security of our hybrid Point-of-Sale (POS) and E-Commerce platform seriously. This document outlines supported versions, vulnerability reporting procedures, and our security compliance architecture.

## Supported Versions

Currently supported versions for security updates:

| Version | Supported |
| ------- | --------- |
| 1.1.x   | :white_check_mark: (Current) |
| 1.0.x   | :x: |

---

## Reporting a Vulnerability

If you discover a security vulnerability in this project, please **do not** open a public issue. Instead, report it privately:

* **Email:** security@pisangvanjava.com
* **Response SLA:** The security team will acknowledge receipt of the vulnerability report within 48 hours and provide updates every 7 days until resolved.

---

## Security & Compliance Architecture

Our platform operates under a Zero-Trust security posture, compliant with standard Indonesian laws and regulatory frameworks:

### 1. Data Protection & Privacy (UU PDP / UU ITE)
* **Personally Identifiable Information (PII)**: All PII in Sentry error tracking is disabled via `sendDefaultPii: false`. Administrative session replays are strictly masked (`maskAllText: true`, `maskAllInputs: true`) and limited exclusively to internal dashboards (`/dashboard`, `/kasir`, `/kitchen`).
* **Session Revocation**: Suspicious/revoked user sessions are immediately invalidated across all clients via Upstash Redis session indexing.

### 2. Financial Records Retention (UU No. 8 Tahun 1997)
* **10-Year Archival**: Transactional and audit log tables are scheduled for archival retention in compliance with Indonesian corporate accounting laws.

### 3. Backup Encryption (AES-256-GCM)
* **Zero-Plaintext Backups**: Production database backups are encrypted on-the-fly using AES-256-GCM. Cleartext SQL files never touch the backup host's disk.
* **Secrets Management**: Encryption keys are rotated annually and securely managed via **Doppler** and **AWS KMS** (strictly injected during CI/CD pipelines).

### 4. API Defense & CSP
* **Unified Strict CSP**: Double-checked, nonce-based dynamic Content Security Policy (CSP) is injected via Middleware for all routes.
* **Fail-Closed Gateways**: API endpoints for Webhooks (Midtrans, Biteship, WhatsApp) and Cron jobs strictly fail-closed on unauthorized payload signatures or invalid authentication keys.
