import { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { auth } from "@/src/auth";
import ProfileSidebar from '@/components/user/profile/ProfileSidebar'

export const metadata: Metadata = {
  title: 'Dashboard Profil | Pisang Goreng Van Java',
  description: 'Kelola data diri, riwayat pesanan, alamat, dan keamanan akun Anda.',
}

export default async function ProfileLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await auth()

  if (!session?.user) {
    redirect('/login?callbackUrl=/profile')
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-28 pb-8 md:pt-36 md:pb-12">
      <div className="mb-8">
        <h1 className="text-3xl md:text-4xl font-bold font-serif text-zinc-900 dark:text-zinc-100">
          Halo, {session.user.name || 'Pelanggan'}! 👋
        </h1>
        <p className="text-zinc-500 dark:text-zinc-400 mt-2">
          Selamat datang di dashboard profil Anda. Kelola pesanan dan preferensi di sini.
        </p>
      </div>

      <div className="flex flex-col md:flex-row gap-8">
        {/* Sidebar Navigation */}
        <ProfileSidebar />

        {/* Main Content Area */}
        <div className="flex-1 w-full min-w-0">
          {children}
        </div>
      </div>
    </div>
  )
}
