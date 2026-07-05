// app/(admin)/toppings/page.tsx

import { redirect } from 'next/navigation'
import { Toaster } from 'react-hot-toast'
import AdminSidebar from '@/components/admin/AdminSidebar'
import ToppingsClient from '@/components/admin/ToppingsClient'
import { prisma } from '@/lib/prisma'
import { auth } from '@/src/auth'

export default async function ToppingsPage() {
  const session = await auth()
  if (!session) redirect('/member-login')
  const toppings = await prisma.topping.findMany({ orderBy: { name: 'asc' } })
  return (
    <div className="flex min-h-screen">
      <AdminSidebar />
      <main className="flex-1 p-6 sm:p-8 bg-cream-100 overflow-y-auto">
        <Toaster position="top-right" />
        <ToppingsClient initialToppings={toppings} />
      </main>
    </div>
  )
}
