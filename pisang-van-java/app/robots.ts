import type { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: [
        // Staff-only pages — semua ini adalah URL nyata di root, BUKAN di
        // bawah /admin/, karena app/(admin)/ adalah route group (tanda kurung
        // = tidak muncul di URL). Terverifikasi via folder app/(admin)/*/page.tsx
        '/dashboard',
        '/kasir',
        '/kitchen',
        '/manage-menu',
        '/manage-users',
        '/manage-vouchers',
        '/orders', // admin order list — beda dari /profile/orders milik customer
        '/reviews', // admin review moderation, beda dari halaman /ulasan publik
        '/banners',
        '/settings',
        '/reports',
        '/complaints', // admin complaint inbox, beda dari /profile/bantuan milik customer
        '/kontak-leads', // data leads B2B — jangan sampai bocor ke hasil pencarian
        '/b2b-pipeline',
        '/login', // staff login

        // API — ini beneran di bawah /api/admin/
        '/api/admin/',
        '/api/pos/' // endpoint POS internal
      ]
    },
    sitemap: 'https://pisanggorengvanjava.com/sitemap.xml'
  }
}
