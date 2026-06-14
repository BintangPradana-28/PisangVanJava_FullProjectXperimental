import { redirect } from 'next/navigation'
import AdminSidebar from '@/components/admin/AdminSidebar'
import { auth } from '@/src/auth'
import ManageUsersClient from './ManageUsersClient'

export default async function ManageUsersPage() {
  const session = await auth()
  if (!session || !['ADMIN', 'SUPER_ADMIN'].includes(session.user.role)) {
    redirect('/member-login')
  }

  return (
    <div className="flex min-h-screen">
      <AdminSidebar />
      <main className="flex-1 p-6 sm:p-8 overflow-y-auto bg-cream-100">
        <h1 className="font-serif text-3xl font-bold text-brown-800 mb-6">PENGGUNA & RESELLER</h1>
        <ManageUsersClient />
      </main>
    </div>
  )
}
