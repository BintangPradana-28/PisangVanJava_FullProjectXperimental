# Contributing to Pisang Van Java

Thank you for your interest in contributing. This document outlines the development workflow and code standards.

---

- Bun >= 1.2.0 (strictly enforced)

---

## Development Setup

1. Fork and clone the repository
2. Run `bun install`
3. Copy `.env.example` to `.env` and fill in all required variables
4. Run `bun run db:push` to sync the database schema
5. Run `bun run db:seed` to populate demo data
6. Run `bun run dev` to start the development server

---

## Branch Naming

| Pattern | Example |
|---|---|
| Feature | `feat/pos-offline-sync` |
| Bug fix | `fix/kds-audio-notification` |
| Refactor | `refactor/checkout-service` |
| Docs | `docs/api-reference` |

---

## Commit Conventions

Use conventional commit prefixes:

- `feat:` -- New feature
- `fix:` -- Bug fix
- `refactor:` -- Code restructuring without behavior change
- `docs:` -- Documentation changes
- `test:` -- Adding or updating tests
- `chore:` -- Build, tooling, or dependency changes

---

## Code Standards

### Formatting & Linting

This project uses **Biome** (not ESLint/Prettier). Before committing:

```bash
bun run check          # Format + lint (write mode)
bun run lint:biome     # Lint only
bun run format         # Format only
```

Pre-commit hooks (Husky + lint-staged) will run Biome and secretlint automatically.

### TypeScript

- Strict mode is enabled. No `any` types without explicit justification
- All environment variables must be declared in `src/env.ts` using `@t3-oss/env-nextjs`
- Use `server-only` for modules that must never reach the client bundle

### Architecture

- **Feature-Sliced Design:** New code belongs in `src/features/<domain>/`. Do not import internal logic across features
- **Service Layer:** Business logic lives in `src/services/`. Server Actions call services, they do not contain business logic
- **Repository Pattern:** Database queries are encapsulated in `src/repositories/`
- **Dumb Components:** UI components should be stateless and receive data via props. Stateful logic belongs in stores or providers

### Security

- All inputs must be validated with Zod schemas before processing
- All mutations must verify resource ownership (BOLA/IDOR prevention)
- Error messages returned to the client must be opaque -- no stack traces or internal details
- Financial calculations must use the `src/lib/financial/money.ts` engine (Decimal.js, never floating-point arithmetic)
- Never commit secrets -- `secretlint` runs on every commit

- Unit tests: `bun run test` (Vitest)
- E2E tests: `bun run test:e2e` (Playwright)
- New features should include corresponding test coverage
- Critical paths (checkout, payment, money calculations) must have tests

---

## Pull Request Process

1. Ensure all checks pass: `bun run check`, `bun run test`, `bun run build`
2. Write a clear PR description explaining the change and its rationale
3. Link any related issues
4. Keep PRs focused -- one logical change per PR
5. Request review from a maintainer

---

## Reporting Issues

When filing a bug report, include:

- Steps to reproduce
- Expected vs. actual behavior
- Browser and OS information
- Relevant console/server logs (redact any sensitive data)
