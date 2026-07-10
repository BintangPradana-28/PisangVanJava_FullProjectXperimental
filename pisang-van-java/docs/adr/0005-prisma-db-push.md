# 0005. Prisma db push vs migrate dev

* Status: accepted
* Deciders: PVJ Core Team, AI Developer
* Date: 2026-07-10
* Konteks penulisan: Didokumentasikan retroaktif untuk mencatat keputusan sinkronisasi database schema.

Technical Story: Managing database schema updates in an experimental/rapid-development capstone environment.

## Context and Problem Statement

The application is built on top of Prisma ORM connected to a PostgreSQL database on Supabase.
We need to sync schema adjustments rapidly without blocking the development pipeline or dealing with complex migration lock issues on ephemeral developer machines. However, using direct push leaves no schema migration lineage.

## Decision Drivers

* Velocity of prototype development
* Schema migration safety checks
* Tooling overhead and setup complexity

## Considered Options

* **Option A**: Prisma Migrate (`prisma migrate dev`).
* **Option B**: Prisma Push (`prisma db push`).

## Decision Outcome

Chosen option: **Option B** (`prisma db push`), because:
- It allows rapid prototyping where fields are updated, renamed, or added directly in `schema.prisma` without the overhead of creating and applying SQL migration files locally and in production.
- To compensate for the lack of migration files, we run `prisma validate` and `prisma format --check` in the CI/CD pipeline to catch any syntax drift or model mapping errors before changes reach the repository.

### Consequences

* Good: Extreme development agility. Clean single source of truth (`schema.prisma`).
* Bad: No migration history. Renaming columns or deleting fields requires manual coordination (or running scripts like `migrate-delivery-status.ts`) to avoid data loss.

## Referensi

- `GEMINI.md` §3
- `package.json` scripts
- `prisma/schema.prisma`
