'use client'

import {
  ChevronRight,
  Gift,
  HelpCircle,
  LogOut,
  MapPin,
  Shield,
  ShoppingBag,
  Ticket,
  User,
  Wallet
} from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOut, useSession } from 'next-auth/react'
import { useLanguage } from '@/context/LanguageContext'
import { useCartStore } from '@/src/features/cart/stores/cart.store'

const menuItems = [
  { key: 'profile_menu_info', href: '/profile', icon: User },
  { key: 'profile_menu_address', href: '/profile/alamat', icon: MapPin },
  { key: 'profile_menu_orders', href: '/profile/pesanan', icon: ShoppingBag },
  { key: 'profile_menu_budget_history', href: '/profile/anggaran', icon: Wallet },
  { key: 'profile_menu_vouchers', href: '/profile/voucher', icon: Ticket },
  { key: 'profile_menu_security', href: '/profile/keamanan', icon: Shield }
]

const actionItems = [
  { key: 'profile_menu_referral', href: '/profile/referral', icon: Gift },
  { key: 'profile_menu_help', href: '/faq', icon: HelpCircle }
]

export default function ProfileSidebar() {
  const pathname = usePathname()
  const { data: session } = useSession()
  const { t } = useLanguage()

  return (
    <div className="w-full md:w-72 flex-shrink-0">
      <div className="bg-white dark:bg-zinc-900 rounded-[4px] p-4 md:p-6 shadow-sm border border-zinc-200/50 dark:border-zinc-800/80 sticky top-24">
        {/* Profile Info (Desktop) */}
        <div className="hidden md:flex flex-col items-center pb-6 mb-6 border-b border-zinc-100 dark:border-zinc-800">
          <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-full overflow-hidden border-4 border-white dark:border-zinc-900 shadow-md relative bg-zinc-100 dark:bg-zinc-800">
            {session?.user?.image ? (
              <Image
                src={session.user.image}
                alt="Avatar"
                fill
                sizes="112px"
                className="object-cover"
              />
            ) : (
              <User className="w-12 h-12 text-zinc-400 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
            )}
          </div>
          <h3 className="font-bold text-lg text-zinc-900 dark:text-zinc-100 text-center">
            {session?.user?.name || t('profile_member')}
          </h3>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 text-center truncate w-full px-2">
            {session?.user?.email}
          </p>
        </div>

        {/* Navigation */}
        <nav className="flex md:flex-col overflow-x-auto md:overflow-visible gap-2 pb-2 md:pb-0 scrollbar-hide">
          {menuItems.map((item) => {
            const isActive =
              pathname === item.href || (item.href !== '/profile' && pathname.startsWith(item.href))
            const Icon = item.icon
            return (
              <Link
                key={item.key}
                href={item.href}
                className={`flex items-center gap-3 px-4 py-3.5 md:py-3 rounded-[4px] whitespace-nowrap transition-all font-medium text-sm ${
                  isActive
                    ? 'bg-[#D4802A] text-white shadow-md'
                    : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800/50'
                }`}
              >
                <Icon
                  className={`w-5 h-5 ${isActive ? 'text-white' : 'text-zinc-400 dark:text-zinc-500'}`}
                />
                <span className="flex-1">{t(item.key)}</span>
                {isActive && <ChevronRight className="w-4 h-4 hidden md:block opacity-70" />}
              </Link>
            )
          })}

          <div className="hidden md:block w-full h-px bg-zinc-100 dark:bg-zinc-800 my-4" />

          {/* Aksi Akun */}
          <div className="hidden md:block px-4 pb-2">
            <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
              {t('profile_menu_actions')}
            </p>
          </div>

          {actionItems.map((item) => {
            const isActive =
              pathname === item.href || (item.href !== '/profile' && pathname.startsWith(item.href))
            const Icon = item.icon
            return (
              <Link
                key={item.key}
                href={item.href}
                className={`flex items-center gap-3 px-4 py-3.5 md:py-3 rounded-[4px] whitespace-nowrap transition-all font-medium text-sm ${
                  isActive
                    ? 'bg-orange-50 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400'
                    : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800/50'
                }`}
              >
                <Icon
                  className={`w-5 h-5 ${isActive ? 'text-orange-600 dark:text-orange-400' : 'text-zinc-400 dark:text-zinc-500'}`}
                />
                <span className="flex-1">{t(item.key)}</span>
                {isActive && <ChevronRight className="w-4 h-4 hidden md:block opacity-70" />}
              </Link>
            )
          })}

          <button
            onClick={() => {
              useCartStore.getState().setIsLoggingOut(true)
              useCartStore.getState().clearCart()
              signOut({ callbackUrl: '/' })
            }}
            className="flex items-center gap-3 px-4 py-3.5 md:py-3 rounded-[4px] whitespace-nowrap transition-all font-medium text-sm text-red-600 dark:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30"
          >
            <LogOut className="w-5 h-5 text-red-500 dark:text-red-400" />
            <span>{t('profile_menu_logout')}</span>
          </button>
        </nav>
      </div>
    </div>
  )
}
