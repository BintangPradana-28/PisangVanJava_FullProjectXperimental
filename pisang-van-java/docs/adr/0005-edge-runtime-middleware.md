# 5. CSP Nonce Generation at Edge Middleware

* Status: accepted
* Deciders: PVJ Core Team, Security Auditor
* Date: 2026-07-10

Technical Story: Implementing a strict Content Security Policy (CSP) with dynamic nonces while maintaining high-performance global delivery.

## Context and Problem Statement

To prevent Cross-Site Scripting (XSS), a strict CSP should use nonces for scripts and styles.
A naive approach is defining static headers in `next.config.js` or injecting nonces via Server-Side Rendering (SSR). However, Next.js page caching would cache the nonces, breaking security. Middleware run on every request is the ideal place to generate unique, cryptographically secure nonces and headers.

## Decision Drivers

* Dynamic nonce generation per request
* Prevention of CSP bypasses
* Low latency routing checks (NFR-1)

## Considered Options

* **Option A**: Static headers in `next.config.js`.
* **Option B**: Dynamic CSP generation in Node.js serverless functions.
* **Option C**: Dynamic CSP generation + Nonces in Edge Runtime Middleware.

## Decision Outcome

Chosen option: **Option C** (Edge Middleware), because:
- The **Edge Runtime** starts instantly (no cold starts) and executes middleware before any route is rendered or served.
- This allows us to generate a fresh cryptographic nonce on every request, inject it into the response headers, and pass it downstream to Server Components, ensuring a strict CSP without impacting TTFB (Time to First Byte).

### Consequences

* Good: Bulletproof XSS defense. Zero impact on serverless cold starts.
* Bad: Limited API surface in Edge runtime. Standard Node.js libraries cannot be imported directly in `middleware.ts`.
