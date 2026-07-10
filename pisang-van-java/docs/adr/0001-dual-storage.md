# 1. Dual Storage Providers (Decoupled Architecture)

* Status: accepted
* Deciders: PVJ Core Team, AI Architect
* Date: 2026-07-10

Technical Story: Designing a high-performance storefront with strict access control requirements for transaction documents.

## Context and Problem Statement

For the F&B enterprise dashboard and storefront, we handle two distinct types of assets:
1. Public menu images and variant photos: These need to be loaded instantly by clients, formatted to modern high-performance formats (avif/webp), and cropped/optimized dynamically.
2. Private transactional documents (Invoice PDFs, proof of delivery photos, staff avatars): These documents require strict access control, row-level security (RLS), and secure persistence.

Using a single storage provider (like raw S3 or public Supabase buckets) results in either a lack of optimization for user-facing images, or insecure access controls for sensitive invoice/transaction files.

## Decision Drivers

* Page performance (NFR-1: FCP < 1.5s)
* Zero-Trust Security (NFR-2: prevent unauthorized access to customer invoices)
* API simplicity and integration with PostgreSQL database

## Considered Options

* **Option A**: Use Supabase Storage for all assets.
* **Option B**: Use Cloudinary for all assets.
* **Option C**: Dual Storage — Cloudinary for menu/variant images, Supabase Storage for transaksional/private assets (avatars, PDF invoices).

## Decision Outcome

Chosen option: **Option C** (Dual Storage), because:
- **Cloudinary** provides automatic modern format transformation (`f_auto`, `q_auto`, AVIF/WebP) and CDN edge optimization out of the box, which is vital for storefront speed.
- **Supabase Storage** integrates natively with PostgreSQL database RLS rules, enabling military-grade access control for sensitive customer documents.

### Consequences

* Good: Optimal image performance for storefront (lowering LCP/FCP) while keeping sensitive files secure.
* Bad: Requires managing credentials for two separate storage services (Supabase & Cloudinary).
