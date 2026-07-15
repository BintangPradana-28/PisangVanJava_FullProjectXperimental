# Data Protection & Retention Policy (PVJ-SEC-01)

## 1. Regulatory Context
This protocol ensures compliance with **UU No. 8 Tahun 1997** (10-year retention for corporate financial records) and **UU PDP / UU ITE** (Protection of Personal Identifiable Information).

## 2. Encryption Standards
* **Algorithm**: AES-256-GCM (Authenticated Encryption).
* **Zero-Trust Guarantee**: Backups are streamed directly from `stdout` to memory-cipher to disk. Plaintext SQL data NEVER touches the host filesystem.
* **Key Management**: The 32-byte encryption key must be rotated annually. Keys are isolated in Doppler/AWS KMS and strictly injected via CI/CD pipelines.

## 3. Disaster Recovery (DR) Execution
To recover the database in the event of catastrophic failure:
1. Provision a clean PostgreSQL instance.
2. Ensure `BACKUP_ENCRYPTION_KEY` and `DATABASE_URL` are set in the environment.
3. Execute: `bun scripts/restore.ts ./backups/pvj-backup-[TIMESTAMP].sql.enc`
4. Verify checksums and run data integrity tests.
