# 🍌 Pisang Van Java

> **Mission-Critical F&B Enterprise Engine & Point of Sale (POS) System**  
> Built with *Zero-Trust Architecture* and Modern Web Standards.

Pisang Van Java is a highly scalable, offline-resilient hybrid web application designed to handle B2C customer interactions and B2B enterprise POS operations for a Javanese banana fritter street-food brand.

---

## 📋 Tech Stack Overview

| Domain | Technology |
|---|---|
| **Framework** | Next.js 14 (App Router) + Turbopack |
| **Language** | Strict TypeScript |
| **Database** | Supabase (PostgreSQL, Realtime, pgvector) |
| **ORM** | Prisma |
| **Authentication** | NextAuth.js / Supabase Auth |
| **Validation & Security**| Zod, `@t3-oss/env-nextjs` |
| **Styling** | Tailwind CSS, `shadcn/ui`, `next-themes` |
| **State Management** | Zustand (Global), `nuqs` (URL State) |
| **Data Flow** | Server Actions (`next-safe-action`) |
| **Payments** | Midtrans |
| **Communication** | Resend, React Email |
| **Media Storage** | Cloudinary |
| **Observability** | Sentry (APM), PostHog (Analytics) |
| **DevOps & Testing** | Biome (Linter/Formatter), Vitest, Playwright |
| **Package Manager** | `pnpm` (Strictly enforced) |

---

## 🚀 Quick Start (Local Development)

### Prerequisites

- **Node.js** ≥ 18.17
- **pnpm** (Do not use `npm` or `yarn`)
- **Supabase** Account (for PostgreSQL database)
- **Upstash** Account (for Redis / Rate Limiting)

### 1 — Clone & Install

```bash
git clone <your-repo-url>
cd pisang-van-java
pnpm install
```

### 2 — Setup Environment Variables

```bash
cp .env.example .env
```
Ensure you fill in all required secrets in `.env`. The build and runtime will fail automatically (Fail-Safe) if critical environment variables are missing, thanks to `t3-env` zero-trust validation.

### 3 — Setup Database

```bash
# Push Prisma schema to your Supabase PostgreSQL instance
pnpm run db:push

# Seed the database with initial data
pnpm run db:seed
```

### 4 — Run Development Server

```bash
pnpm run dev
```

Open [http://localhost:3000](http://localhost:3000) 🎉

---

## 🛠️ Essential Commands

```bash
# Development
pnpm run dev          # Start dev server with Turbopack
pnpm run build        # Production build
pnpm run start        # Start production server

# Database (Prisma)
pnpm run db:push      # Sync schema to database
pnpm run db:studio    # Open Prisma Studio GUI
pnpm run db:seed      # Seed demo data

# Testing & Code Quality (Biome + Vitest + Playwright)
pnpm run format       # Format code via Biome
pnpm run lint:biome   # Run Biome linter
pnpm run check        # Run Biome formatter and linter together
pnpm run test         # Run unit tests (Vitest)
pnpm run test:watch   # Run unit tests in watch mode
pnpm run test:e2e     # Run End-to-End tests (Playwright)
```

---

## 🛡️ Architecture & Zero-Trust Governance

This project adheres to a strict **Zero-Trust Engineering & Anti-Slop Governance** model:

1. **Anti-Slopsquatting:** All dependencies are verified, actively maintained, and enterprise-standard.
2. **Absolute Security:** Error messages are opaque to the client. BOLA/IDOR prevention is strictly enforced via `next-safe-action` middleware verifying resource ownership before executing queries.
3. **Business Logic Armor:** Financial and inventory mutations utilize Prisma `$transaction` and optimistic locking to prevent double-spending and Race Conditions. API routes are idempotent.
4. **Environment Security:** `t3-env` strictly validates both client and server environment variables at build and runtime. No secrets are ever exposed to the client.

---

## 🗂️ Project Structure

```
[root]/
├── src/
│   ├── app/          # Next.js App Router (pages, layouts, API routes)
│   ├── components/   # Shared UI components (shadcn/ui)
│   ├── features/     # Feature-based modular business logic (pos, auth, menu)
│   ├── lib/          # Core utilities (prisma, midtrans, resend, cloudinary, safe-action)
│   ├── providers/    # Context and SDK Providers (PostHog, NextAuth)
│   ├── emails/       # React Email templates
│   └── types/        # Global TypeScript types and Zod schemas
├── prisma/           # Database schema and seeders
├── public/           # Static assets
└── [configs]         # biome.json, vitest.config.ts, playwright.config.ts, etc.
```

---

## 🔑 Admin Access (Default Seed)

| Field    | Value      |
|----------|------------|
| URL      | `/login`   |
| Username | `admin`    |
| Password | `admin123` |

*(Ensure you change these credentials immediately in production).*

---

## 📝 License

Academic / Enterprise Prototype — Informatics Student SDLC Project 2024-2026.
Brand: **Pisang Van Java** 🍌
