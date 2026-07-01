// app/(user)/faq/metadata.ts
// Separate file needed because page.tsx is 'use client' and cannot export metadata.
// App Router reads this file automatically for the /faq route.
// RAG Source: Next.js App Router docs — co-located metadata files
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'FAQ — Pertanyaan Umum | Pisang Goreng Van Java',
  description:
    'Jawaban atas pertanyaan umum seputar produk, pemesanan, pembayaran, dan pengiriman Pisang Goreng Van Java.',
  openGraph: {
    title: 'FAQ Pisang Goreng Van Java',
    description: 'Pertanyaan yang sering ditanyakan tentang produk dan layanan kami.',
    url: 'https://pisanggorengvanjava.com/faq',
    siteName: 'Pisang Van Java',
    locale: 'id_ID',
    type: 'website',
    images: [
      {
        url: '/api/og?title=FAQ&desc=Pertanyaan+Umum+Pisang+Van+Java',
        width: 1200,
        height: 630,
        alt: 'FAQ Pisang Goreng Van Java'
      }
    ]
  }
}
