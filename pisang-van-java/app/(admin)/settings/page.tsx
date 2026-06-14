// app/(admin)/settings/page.tsx

import { redirect } from 'next/navigation'
import { Toaster } from 'react-hot-toast'
import AdminSidebar from '@/components/admin/AdminSidebar'
import SettingsClient from '@/components/admin/SettingsClient'
import { prisma } from '@/lib/prisma'
import { auth } from '@/src/auth'

export default async function SettingsPage() {
  const session = await auth()
  if (!session) redirect('/member-login')
  const settings = await prisma.siteSetting.findMany({
    orderBy: [{ group: 'asc' }, { key: 'asc' }]
  })
  return (
    <div className="flex min-h-screen">
      <AdminSidebar />
      <main className="flex-1 p-6 sm:p-8 bg-cream-100 overflow-y-auto">
        <Toaster position="top-right" />
        <SettingsClient settings={settings} adminName={session.user?.name || 'Admin'} />
      </main>
    </div>
  )
}
