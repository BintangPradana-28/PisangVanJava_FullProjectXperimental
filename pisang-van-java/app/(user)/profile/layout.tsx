import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import ProfileSidebar from '@/components/user/profile/ProfileSidebar'
import ProfileWelcome from '@/components/user/profile/ProfileWelcome'
import { auth } from '@/src/auth'

export const metadata: Metadata = {
  title: 'Dashboard Profil | Pisang Goreng Van Java',
  description: 'Kelola data diri, riwayat pesanan, alamat, dan keamanan akun Anda.'
}

export default async function ProfileLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()

  if (!session?.user) {
    redirect('/member-login?callbackUrl=/profile')
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-28 pb-8 md:pt-36 md:pb-12">
      <ProfileWelcome />

      <div className="flex flex-col md:flex-row gap-8">
        {/* Sidebar Navigation */}
        <ProfileSidebar />

        {/* Main Content Area */}
        <div className="flex-1 w-full min-w-0">{children}</div>
      </div>
    </div>
  )
}
