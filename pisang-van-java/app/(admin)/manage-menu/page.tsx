// app/(admin)/manage-menu/page.tsx

import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import AdminSidebar from '@/components/admin/AdminSidebar'
import { prisma } from '@/lib/prisma'
import { auth } from '@/src/auth'
import AdminMenuDashboard from '@/src/features/menu/components/AdminMenuDashboard'

export const metadata: Metadata = { title: 'Kelola Menu | Admin' }

export default async function ManageMenuPage() {
  // Zero Trust: Pastikan pengguna benar-benar memiliki sesi dari NextAuth
  const session = await auth()
  if (!session) {
    redirect('/member-login')
  }

  // Mengambil data produk aktif
  const dbProducts = await prisma.menuVariant.findMany({
    where: { isDeleted: false },
    orderBy: { createdAt: 'desc' }
  })

  // Data yang dikirim ke Client Component
  const products = dbProducts.map((p: any) => ({
    id: p.id,
    flavorName: p.flavorName,
    priceKembung: p.priceKembung,
    priceLumpia: p.priceLumpia,
    priceKrispy: p.priceKrispy,
    wholesaleKembung: p.wholesaleKembung,
    wholesaleLumpia: p.wholesaleLumpia,
    wholesaleKrispy: p.wholesaleKrispy,
    imageUrl: p.imageUrl,
    deskripsi_topping: p.deskripsi_topping,
    isAvailable: p.isAvailable,
    stock: p.stock,
    tags: p.tags || [],
    isActive: p.isActive
  }))

  return (
    <div className="flex min-h-screen">
      <AdminSidebar />
      <main className="flex-1 p-6 sm:p-8 overflow-y-auto bg-cream-100">
        <h1 className="font-serif text-3xl font-bold text-brown-800 mb-6">ADMIN DASHBOARD</h1>
        <AdminMenuDashboard initialProducts={products} />
      </main>
    </div>
  )
}
