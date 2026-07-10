# 0006. Hashing Password via Argon2id over bcrypt

* Status: accepted
* Deciders: PVJ Core Team, Security Auditor
* Date: 2026-07-10
* Konteks penulisan: Didokumentasikan retroaktif dari `ARCHITECTURE.md` §2.

Technical Story: Ensuring secure user registration and login in compliance with Zero-Trust Security guidelines.

## Context and Problem Statement

Bcrypt is historically the de facto standard for hashing passwords, but it is susceptible to parallelized hardware attacks (GPUs, ASICs).
To satisfy enterprise-grade security and prevent brute force attacks, we need a modern, memory-hard hashing algorithm.

## Decision Drivers

* Resistance to parallel brute force attacks (GPU/ASIC)
* Performance overhead on low-tier serverless environments
* Availability of robust packages for Node.js/Next.js runtimes

## Considered Options

* **Option A**: Bcrypt (`bcryptjs` or native `bcrypt`).
* **Option B**: Argon2id via `@node-rs/argon2`.

## Decision Outcome

Chosen option: **Option B** (Argon2id), because:
- **Argon2id** is the winner of the Password Hashing Competition (PHC) and is designed to resist GPU/ASIC cracking attacks.
- `@node-rs/argon2` compiles to native Rust bindings, ensuring it is extremely fast and performant in production without blocking the Node.js event loop.

### Consequences

* Good: Standard-setting password security. High resistance to offline brute-force attacks.
* Bad: Native bindings require platform-specific binaries during build. Resolved by listing it under `serverExternalPackages` in `next.config.js`.

## Referensi

- `ARCHITECTURE.md` §2
- `package.json` dependencies
- `src/features/auth/`
