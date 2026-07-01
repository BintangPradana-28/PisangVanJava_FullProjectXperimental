// app/(user)/checkout/metadata.ts
// robots: noindex prevents Googlebot from indexing transactional/auth pages.
// RAG Source: Next.js App Router — co-located metadata file pattern
import type { Metadata } from 'next'

export const metadata: Metadata = {
  robots: { index: false, follow: false }
}
