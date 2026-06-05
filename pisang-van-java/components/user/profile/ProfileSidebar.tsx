'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { User, MapPin, ShoppingBag, Ticket, Shield, LogOut, ChevronRight } from 'lucide-react'
import { signOut, useSession } from 'next-auth/react'
import Image from 'next/image'

const menuItems = [
  { name: 'Data Diri', href: '/profile', icon: User },
  { name: 'Alamat Pengiriman', href: '/profile/alamat', icon: MapPin },
  { name: 'Riwayat Pesanan', href: '/profile/pesanan', icon: ShoppingBag },
  { name: 'Voucher & Poin', href: '/profile/voucher', icon: Ticket },
  { name: 'Keamanan', href: '/profile/keamanan', icon: Shield },
]

export default function ProfileSidebar() {
  const pathname = usePathname()
  const { data: session } = useSession()

  return (
    <div className="w-full md:w-72 flex-shrink-0">
      <div className="bg-white dark:bg-zinc-900 rounded-3xl p-4 md:p-6 shadow-sm border border-zinc-200/50 dark:border-zinc-800/80 sticky top-24">
        
        {/* Profile Info (Desktop) */}
        <div className="hidden md:flex flex-col items-center pb-6 mb-6 border-b border-zinc-100 dark:border-zinc-800">
          <div className="w-24 h-24 rounded-full overflow-hidden bg-zinc-100 dark:bg-zinc-800 mb-4 shadow-sm relative border-4 border-white dark:border-zinc-900">
            {session?.user?.image ? (
              <Image src={session.user.image} alt="Avatar" fill className="object-cover" />
            ) : (
              <User className="w-10 h-10 text-zinc-400 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
            )}
          </div>
          <h3 className="font-bold text-lg text-zinc-900 dark:text-zinc-100 text-center">{session?.user?.name || 'Pelanggan'}</h3>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 text-center truncate w-full px-2">{session?.user?.email}</p>
        </div>

        {/* Navigation */}
        <nav className="flex md:flex-col overflow-x-auto md:overflow-visible gap-2 pb-2 md:pb-0 scrollbar-hide">
          {menuItems.map((item) => {
            const isActive = pathname === item.href || (item.href !== '/profile' && pathname.startsWith(item.href))
            const Icon = item.icon
            return (
              <Link
                key={item.name}
                href={item.href}
                className={`flex items-center gap-3 px-4 py-3.5 md:py-3 rounded-2xl whitespace-nowrap transition-all font-medium text-sm ${
                  isActive
                    ? 'bg-[#D4802A] text-white shadow-md'
                    : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800/50'
                }`}
              >
                <Icon className={`w-5 h-5 ${isActive ? 'text-white' : 'text-zinc-400 dark:text-zinc-500'}`} />
                <span className="flex-1">{item.name}</span>
                {isActive && <ChevronRight className="w-4 h-4 hidden md:block opacity-70" />}
              </Link>
            )
          })}

          <div className="hidden md:block w-full h-px bg-zinc-100 dark:bg-zinc-800 my-4" />

          <button
            onClick={() => signOut({ callbackUrl: '/' })}
            className="flex items-center gap-3 px-4 py-3.5 md:py-3 rounded-2xl whitespace-nowrap transition-all font-medium text-sm text-red-600 dark:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30"
          >
            <LogOut className="w-5 h-5 text-red-500 dark:text-red-400" />
            <span>Keluar</span>
          </button>
        </nav>
      </div>
    </div>
  )
}
