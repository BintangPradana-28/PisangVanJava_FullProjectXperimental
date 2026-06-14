# GEMINI.md — PISANG VAN JAVA
> Important Note: This GEMINI.md content is written in English.
> GOOGLE ANTIGRAVITY IDE processes English instructions more optimally.

---

## 1. Project Overview
- Name : PISANG VAN JAVA
- Description : A mission-critical, scalable F&B enterprise engine and Point of Sale (POS) system.
- Goal : To streamline F&B operations, manage offline-resilient POS transactions, prevent race conditions in inventory, and provide a secure, high-performance web interface.
- Target Users: Cashiers, Store Managers, and Admins.
- Version : 1.0.0
- Status : Active development

---

## 2. Tech Stack
- Language : TypeScript
- Framework : Next.js (App Router, Turbopack)
- Styling : Tailwind CSS
- UI Library : shadcn/ui, next-themes
- Database : Supabase (PostgreSQL, Realtime, pgvector)
- ORM : Prisma
- Auth : NextAuth.js / Supabase Auth
- Form & Validation : React Hook Form, Zod
- URL State : nuqs
- State Management: Zustand
- Data Fetching : Server Actions + next-safe-action
- Package Manager : pnpm
- Deployment : Vercel (with Security Headers)
- Payments : Midtrans
- Communication : Resend & React Email
- Media Storage : Cloudinary
- Analytics/Telemetry: Sentry + PostHog
- Tooling : Biome (Linter/Formatter), Vitest + Playwright (Testing), @t3-oss/env-nextjs (Env Security)

---

## 3. Commands

```bash
# Development
pnpm run dev # Run dev server
pnpm run build # Build for production
pnpm run start # Start production build
pnpm run lint # Run linter (Biome)
pnpm run format # Format code (Biome)

# Package Management
pnpm add [package] # Install new package

# Testing
pnpm run test # Run all tests
pnpm run test:unit # Run unit tests only
pnpm run test:e2e # Run e2e tests only

# Database
pnpm run db:push # Sync database schema
pnpm run db:migrate # Run migrations
pnpm run db:seed # Seed initial data
pnpm run db:studio # Open Prisma Studio
```

> **NEVER** use npm or yarn — **always use pnpm**.

---

## 4. Project Structure
Architecture: Hybrid VSA (Vertical Slice Architecture) + Service Layer & Repository Pattern

```
[root]/
├── app/              # Next.js App Router (routing only)
│   ├── (storefront)/ # menu, cart, checkout, profile pages
│   ├── (admin)/      # admin dashboard pages
│   └── api/          # route handlers and webhooks
├── src/
│   ├── features/     # Vertical Slices per domain (cart, checkout, loyalty, auth, etc.)
│   │   └── [name]/   # contains store, components, hooks, and actions specific to the feature
│   ├── services/     # Cross-feature business logic
│   ├── repositories/ # Prisma data access layer
│   └── shared/       # UI primitives, utils, types (lucide, shadcn wrappers, global config)
├── public/           # Static assets accessible to the public
└── [config files]    # next.config.js, tailwind.config.js, package.json, etc.
```

File placement rules:
- **Routing Layer (`app/`)**: Only place Next.js routing files (`page.tsx`, `layout.tsx`, `route.ts`). Business logic must be delegated.
- **Features (`src/features/`)**: Place all domain-specific code here (components, stores, hooks, actions). This ensures high cohesion and low coupling.
- **Services (`src/services/`)**: Place business logic that orchestrates multiple repositories or crosses feature boundaries.
- **Repositories (`src/repositories/`)**: Place all Prisma database access operations here. Prevent raw DB queries inside components or features.
- **Shared (`src/shared/` or `src/components/`, `src/lib/`)**: Place agnostic UI components (e.g., generic buttons), global utilities, and types.
- **Do not create new root folders without prior confirmation.**

---

## 5. Naming Conventions
```
# Files and Folders
- Components : PascalCase (e.g., UserCard.tsx)
- Non-components : camelCase (e.g., useAuth.ts, getUserById.ts)
- Folders : kebab-case (e.g., user-profile/, pos-system/)
- Pages : page.tsx
- Layouts : layout.tsx
- Test files : [name].test.ts or [name].spec.ts

# Inside Code
- Variables : camelCase (e.g., userData, isLoading)
- Constants : UPPER_SNAKE (e.g., MAX_RETRY, BASE_URL)
- Functions : camelCase (e.g., getUserById, formatDate)
- Types/Interfaces: PascalCase (e.g., UserType, ApiResponse)
- Enums : PascalCase (e.g., UserRole, OrderStatus)
- CSS Classes : kebab-case (e.g., user-card, nav-item)

# Git Branches
- New feature : feat/[feature-name]
- Bug fix : fix/[bug-name]
- Hotfix : hotfix/[name]
- Refactor : refactor/[name]
```

---

## 6. Code Conventions

```
# Coding Approach
- Apply SOLID principles, DRY, and Clean Code.
- Avoid code duplication; extract logic into functions if used more than once.
- Write readable code over the shortest possible code.
- Zero-Trust Architecture: Always validate inputs and prevent Race Conditions.

# TypeScript
- Use strict mode.
- **NEVER** use the 'any' type.
- Always explicitly define function return types.
- Use interfaces for objects, and types for unions or intersections.

# Import Order
1. External libraries (React, Next.js, etc.)
2. Absolute internal imports (@/components, @/lib, etc.)
3. Relative internal imports (./Component, ../utils)
4. Types and Interfaces
5. Assets and styles

# Export Pattern
- Use named exports for components and functions.
- Use default exports ONLY for Next.js page.tsx and layout.tsx.

# Error Handling
- Always use try-catch for async functions.
- Never swallow errors silently without logging (use Sentry).
- Return specific and opaque error messages to the client (Do not leak PII or DB Schema).
```

---

## 7. Component Rules
```
# Writing Order within a Component
1. Imports
2. Types or Interfaces for props
3. Component definition
4. Hooks (useState, useEffect, Zustand, etc.)
5. Local handlers and functions
6. JSX Return
7. Export

# Props Rules
- Always explicitly type props.
- Use default values for optional props.
- Keep the number of props reasonable (extract to complex objects if > 5).

# Server vs Client Components (Next.js)
- Default: Use Server Components for maximum performance and SEO.
- Use 'use client' ONLY when requiring:
  - useState / useEffect / custom hooks
  - Event listeners (onClick, onChange, etc.)
  - Browser APIs (localStorage, window, etc.)
  - Third-party libraries that do not support SSR.

# Component Granularity
- Separate into standalone files if used in more than one place.
- May be combined in one file if used exclusively by the parent component.
```

---

## 8. Styling Rules
```
# Styling Approach
- Use Tailwind CSS exclusively.
- Do not use inline styles unless the value is strictly dynamic.
- Do not use !important.

# Tailwind CSS
- Use utility classes directly in JSX.
- Use `cn()` (clsx + tailwind-merge) for conditional class names.
- Extract into a shared component if the exact class string is repeated often.
- Class order: layout > spacing > sizing > color > typography > state.

# Responsive Design
- Mobile-first approach.
- Breakpoints: sm (640px) / md (768px) / lg (1024px) / xl (1280px).

# Dark Mode
- Use `dark:` prefix from Tailwind CSS + next-themes.
- Always test UI components in dark mode after creation.

# Design Tokens
- Use CSS variables for colors, spacing, and typography (shadcn style).
- Do not hardcode hex colors directly in components if possible.
```

---

## 9. API & Data Fetching Rules
```
# Server vs Client Fetching
- Server Fetch : For data that doesn't require user interaction (initial page load). Use Prisma directly in Server Components or Server Actions.
- Client Fetch : For data that changes after user interaction.
- Use Server Actions (`next-safe-action`) for mutations.
- Do NOT use useEffect for data fetching.

# API Response Format
- Always return a consistent format across all endpoints/actions:
  { success: boolean, data: T | null, error?: string, details?: any }

# API Error Handling
- Always handle errors with try-catch.
- Return appropriate HTTP status codes (200, 400, 401, 404, 500) if using Route Handlers.
- Do NOT expose detailed backend errors to the client in production.

# Fetch Function Location
- Store all database queries and external fetch functions in `src/lib/services` or inside Server Actions in the respective `src/features/[name]`.
- Do not write raw database queries directly inside UI components.

# Environment
- Use `@t3-oss/env-nextjs` for strict environment variable validation.
- Never hardcode URLs or secrets in the codebase.
```

---

## 10. State Management Rules
```
# State Hierarchy
1. Local state (useState) : Used by 1 component.
2. URL state (nuqs) : For search, filters, pagination that should be shareable.
3. Lifted state : Used by 2-3 adjacent components.
4. Global state (Zustand) : Used across multiple complex components.

# When to Use Global State
- Complex client-side operations like the POS Cart.
- Global UI states (theme, language).

# Zustand Rules
- Create a store per domain or feature (e.g., `usePosStore`), do not create one massive monolithic store.
- Do not store derived data that can be computed on the fly.
- Use selectors to fetch specific data from the store to prevent unnecessary re-renders.

# When to Use Context
- Rarely. Prefer Zustand for state. Use Context only for deeply integrated Next.js providers (like next-themes).
```

---

## 11. Performance Rules
```
# Code Splitting
- Use `next/dynamic` for large components that are not immediately visible.
- Lazy load rare UI modals.

# Image Optimization
- Always use `next/image` (`<Image />`).
- Specify width and height for every image to prevent layout shifts.
- Rely on Cloudinary / Image CDN for heavy assets.

# Re-render Optimization
- Use `useMemo` for heavy calculations.
- Use `useCallback` for functions passed as props to memoized components.
- Profile before optimizing; do not overuse memoization prematurely.

# Bundle Size
- Import only what is needed, not the entire library.
  Correct : `import { debounce } from 'lodash'`
  Incorrect : `import _ from 'lodash'`

# SSR and SSG (Next.js)
- Default to Server Components to reduce client JavaScript bundle.
- Use caching effectively (`unstable_cache`, `revalidate`) for static-heavy data.
```

---

## 12. Git Rules
Every time Claude Code (or Antigravity) finishes making code changes,
it must be committed to GitHub before moving to the next task.
This is crucial for diffing and safe rollbacks.
```
# Commit Message Format
feat : [new feature description]
fix : [bug fix description]
refactor : [refactoring description]
style : [styling or formatting changes]
docs : [documentation changes]
test : [adding or modifying tests]
chore : [configuration or tooling changes]

# Examples
feat: add Manager PIN override for POS discounts
fix: resolve extreme responsiveness issue on POS mobile view
refactor: extract PosReceiptModal into isolated component

# Additional Rules
- Never commit .env files or secrets.
- One commit per specific logical change.
- Do not mix unrelated changes into a single monolithic commit.
```

---

## 13. Features
```
# Completed and Running
- [x] Basic POS Interface
- [x] POS Cart & Modifiers (Base & Toppings)
- [x] Offline Sync Armor & Idempotency
- [x] Atomic Stock Decrement & Transaction Safety
- [x] POS Receipt Printing (Thermal 58mm styling)
- [x] Core Web Vitals Optimization (LCP/FCP)

# Work in Progress
- [ ] DevOps & CI/CD Pipeline Configuration
- [ ] Next-Safe-Action Integration
- [ ] Cloudinary Image Pipeline

# Planned
- [ ] Midtrans Payment Webhooks
- [ ] Advanced PostHog Analytics Dashboard
```

---

## 14. Testing
```
# Testing Approach
- Types : Unit, Integration, E2E
- Frameworks : Vitest (Unit/Integration), Playwright (E2E)

# What to Test
- Complex business logic (e.g., cart total calculation, idempotency rules).
- API endpoints (Happy path and Edge cases like Race Conditions).
- Critical UI components used across many pages.

# What Not to Test
- Extremely simple presentational components.
- Third-party libraries (already tested by maintainers).

# Test Writing Rules
- One test file per source file tested.
- Descriptive test names: 'should [expected behavior] when [condition]'
- Follow the AAA pattern: Arrange, Act, Assert.

# Coverage Target
- Minimum coverage : 80%
- Priority : Business Logic > API > UI Components
```

---

## 15. Do Not
If instructions or prompts are ambiguous, ASK FIRST before writing code.
Do not assume or execute without confirmation.
```
# Structure and Files
- Do not create new root folders without confirmation.
- Do not delete or move files without confirmation.
- Do not alter the existing architectural folder structure.

# Code
- Do not use the 'any' type in TypeScript.
- Do not hardcode values that should come from environment variables.
- Do not commit .env files or any secrets.
- Do not install new packages without CISO verification (Anti-Slopsquatting).
- Do not remove or alter working features without explicit instructions.

# Forbidden Patterns
- Do not mix raw Prisma queries inside Client Components.
- Do not use useEffect for data fetching (Use Server Actions / Prisma directly).
- Do not use inline styles when Tailwind utility classes suffice.

# Database
- Do not run commands that alter or drop production data.
- Do not create database migrations without confirmation.
- Do not expose database credentials or Prisma errors to the client-side.

# Security (Zero-Trust)
- Do not expose API keys or secrets to the client.
- Do not bypass Zod input validation under any circumstances.
- Do not skip error handling in API Routes or Server Actions (BOLA/IDOR prevention).
```

---

## 16. Environment Variables
```
# Setup
- Copy .env.example to .env.local for local development.
- Never commit .env or .env.local to the repository.
- Validation is enforced via @t3-oss/env-nextjs.

# Public Variables (Safe for Client)
NEXT_PUBLIC_APP_URL # Base URL of the application
NEXT_PUBLIC_POSTHOG_KEY # Analytics tracking key
NEXT_PUBLIC_MIDTRANS_CLIENT_KEY # Midtrans public key

# Server-only Variables (NEVER expose to Client)
DATABASE_URL # Supabase PostgreSQL connection string
DIRECT_URL # Direct DB connection for Prisma migrations
RESEND_API_KEY # Resend email service key
CLOUDINARY_API_SECRET # Cloudinary secure secret
MIDTRANS_SERVER_KEY # Midtrans server secret key

# Auth Variables
NEXTAUTH_SECRET # Secret for JWT signing
NEXTAUTH_URL # Base URL for NextAuth (if required)
```
