# 2. Dual PDF Generation Engines

* Status: accepted
* Deciders: PVJ Core Team, AI Architect
* Date: 2026-07-10

Technical Story: Enabling rapid receipt printing at the POS station while ensuring automated, scheduled invoicing on the server.

## Context and Problem Statement

The POS Cashier interface needs to print physical receipts instantly upon checkout completion. Conversely, automated processes (such as email invoicing or monthly reporting) require generating invoice PDFs in the background without user interaction.
Using server-side rendering for POS receipts causes delay and adds heavy load to the server during peak hours. On the other hand, client-side libraries cannot run inside scheduled Serverless functions.

## Decision Drivers

* High availability & server resource usage during peak hours
* Checkout experience latency (NFR-3)
* Portability of styling (HTML/React to PDF)

## Considered Options

* **Option A**: Server-side only generation for all PDFs using `@react-pdf/renderer` or Puppeteer.
* **Option B**: Client-side only generation using `jsPDF`.
* **Option C**: Dual PDF Generation — `jsPDF + jspdf-autotable` on the client (POS) and `@react-pdf/renderer` on the server.

## Decision Outcome

Chosen option: **Option C** (Dual PDF Generation), because:
- **jsPDF + jspdf-autotable (Client-Side)** allows instant receipt rendering directly in the cashier's browser, reducing server overhead to 0. It works with local printer capabilities (e.g. 58mm thermal receipts).
- **@react-pdf/renderer (Server-Side)** generates pixel-perfect invoice PDFs within background jobs/Server Actions to be sent via Resend or uploaded to Supabase Storage.

### Consequences

* Good: Extreme scalability for POS receipt generation. Background tasks are completely independent of UI interactions.
* Bad: Duplication of styling definitions (POS receipt styles in jsPDF, Invoices in React-PDF).
