'use client'

import React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { UserCircle, MapPin, Receipt, LogOut } from 'lucide-react'
import { signOut } from 'next-auth/react'

const navItems = [
  { name: 'Data Diri', href: '/profil', icon: UserCircle },
  { name: 'Alamat', href: '/profil/alamat', icon: MapPin },
  { name: 'Pesanan', href: '/profil/pesanan', icon: Receipt },
]

export default function ProfilLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  return (
    <div className="container max-w-5xl mx-auto px-4 py-8">
      <div className="flex flex-col md:flex-row gap-8">
        {/* Sidebar Desktop & Top Tabs Mobile */}
        <aside className="w-full md:w-64 shrink-0">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl overflow-hidden sticky top-24">
            <nav className="flex md:flex-col overflow-x-auto md:overflow-visible no-scrollbar">
              {navItems.map((item) => {
                const isActive = pathname === item.href
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center gap-3 px-5 py-4 font-bold text-sm transition-colors whitespace-nowrap md:whitespace-normal border-b-2 md:border-b-0 md:border-l-4 last:border-r-0 border-zinc-100 dark:border-zinc-800 ${
                      isActive 
                        ? 'bg-[#D4802A]/5 text-[#D4802A] border-b-[#D4802A] md:border-l-[#D4802A]' 
                        : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 border-b-transparent md:border-l-transparent'
                    }`}
                  >
                    <item.icon className="w-5 h-5" />
                    {item.name}
                  </Link>
                )
              })}
              {/* Logout Button */}
              <button
                onClick={() => signOut({ callbackUrl: '/member-login' })}
                className="flex items-center gap-3 px-5 py-4 font-bold text-sm text-red-600 dark:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors whitespace-nowrap md:whitespace-normal md:border-t md:border-l-4 border-l-transparent md:border-zinc-100 dark:md:border-zinc-800"
              >
                <LogOut className="w-5 h-5" />
                Keluar
              </button>
            </nav>
          </div>
        </aside>

        {/* Content Area */}
        <main className="flex-1 min-w-0">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 md:p-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}
