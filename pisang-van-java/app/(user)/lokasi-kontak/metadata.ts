// app/(user)/lokasi-kontak/metadata.ts
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Lokasi & Kontak | Pisang Goreng Van Java',
  description:
    'Temukan lokasi, jam operasional, dan cara menghubungi Pisang Goreng Van Java di Jakarta Timur.',
  openGraph: {
    title: 'Lokasi & Kontak Pisang Van Java',
    description: 'Lokasi, jam buka, dan semua cara menghubungi kami.',
    url: 'https://pisanggorengvanjava.com/lokasi-kontak',
    siteName: 'Pisang Van Java',
    locale: 'id_ID',
    type: 'website',
    images: [
      {
        url: '/api/og?title=Lokasi+%26+Kontak&desc=Pisang+Goreng+Van+Java',
        width: 1200,
        height: 630,
        alt: 'Lokasi dan Kontak Pisang Goreng Van Java'
      }
    ]
  }
}
