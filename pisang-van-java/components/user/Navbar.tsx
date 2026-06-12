'use client'

import { AnimatePresence, motion } from 'framer-motion'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOut, useSession } from 'next-auth/react'
import { useEffect, useRef, useState } from 'react'
import { useLanguage } from '@/context/LanguageContext'
import { useSettings } from '@/context/SettingsContext'
import { useTheme } from '@/context/ThemeContext'
import { selectCartItemCount, selectCartDisplayTotal, useCartStore } from '@/src/stores/cart.store'
import { formatPrice } from '@/lib/utils'
import CartModal from './CartModal'

const ShoppingBagIcon = () => (
  <svg
    className="w-6 h-6"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"></path>
    <line x1="3" y1="6" x2="21" y2="6"></line>
    <path d="M16 10a4 4 0 0 1-8 0"></path>
  </svg>
)

export default function Navbar() {
  const { data: session } = useSession()
  const { theme, toggleTheme, mounted } = useTheme()
  const { locale, setLocale, t } = useLanguage()
  const { getSetting } = useSettings()
  const cartCount = useCartStore(selectCartItemCount)
  const cartTotal = useCartStore(selectCartDisplayTotal)
  const isHydrated = useCartStore((s) => s._hasHydrated)
  const pathname = usePathname()

  const [isOpen, setIsOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const [scrollProgress, setScrollProgress] = useState(0)
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const [isCartOpen, setIsCartOpen] = useState(false)
  // Sprint 3: Cart badge pop animation — track count changes
  const [cartPopKey, setCartPopKey] = useState(0)
  const prevCartCountRef = useRef(cartCount)

  useEffect(() => {
    const handleScroll = () => {
      // Scrolled state
      if (window.scrollY > 50) {
        setScrolled(true)
      } else {
        setScrolled(false)
      }

      // Scroll progress
      const totalScroll = document.documentElement.scrollHeight - window.innerHeight
      if (totalScroll > 0) {
        setScrollProgress((window.scrollY / totalScroll) * 100)
      }
    }
    window.addEventListener('scroll', handleScroll, { passive: true })

    // Sprint 4: Rehydrate zustand store manually to avoid hydration mismatch
    useCartStore.persist.rehydrate()

    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  // Sprint 3: Trigger cart-pop animation when cartCount increases
  useEffect(() => {
    if (cartCount > prevCartCountRef.current) {
      setCartPopKey((k) => k + 1)
      // Haptic feedback on mobile (8ms = tactile, not annoying)
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        try {
          navigator.vibrate(8)
        } catch {}
      }
    }
    prevCartCountRef.current = cartCount
  }, [cartCount])

  // On home page we don't need scroll spy anymore if we link to actual pages
  const isHome = pathname === '/'
  const useSolidHeader = scrolled || !isHome || isOpen

  const links = [
    { id: 'hero', href: '/', label: t('nav_home') },
    { id: 'tentang', href: '/tentang-kami', label: t('nav_about') },
    { id: 'menu', href: '/menu-spesial', label: t('nav_menu') },
    { id: 'lokasi', href: '/lokasi-kontak', label: t('nav_location') }
  ]

  const isLinkActive = (link: (typeof links)[0]) => {
    return pathname === link.href
  }

  const handleLinkClick = (e: React.MouseEvent<HTMLAnchorElement>, targetId: string) => {
    setIsOpen(false)
  }

  const handleSignOut = () => {
    useCartStore.getState().setIsLoggingOut(true)
    useCartStore.getState().clearCart()
    signOut({ callbackUrl: '/' })
  }

  return (
    <>
      {/* Scroll Progress Indicator */}
      <div id="scroll-progress" style={{ width: `${scrollProgress}%` }} />

      {/* Global Store Closed Banner */}
      {getSetting('store_open', 'true') === 'false' && (
        <div className="bg-red-600 text-white text-center py-2 px-4 text-sm font-semibold z-[60] relative">
          Mohon maaf, Pisang Van Java sedang tutup sementara. Pesanan baru tidak dapat diproses saat
          ini.
        </div>
      )}

      {/* Promo Marquee */}
      {getSetting('promo_marquee_active', 'false') === 'true' && (
        <div className="bg-gradient-to-r from-[#D4802A] via-[#E6933D] to-[#D4802A] text-white text-center py-1.5 px-4 text-xs sm:text-sm font-bold z-[60] relative shadow-sm">
          <span className="inline-block animate-pulse">✨</span>{' '}
          {getSetting('promo_marquee_text', 'Promo Spesial!')}{' '}
          <span className="inline-block animate-pulse">✨</span>
        </div>
      )}

      <header
        role="banner"
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
          useSolidHeader
            ? 'bg-white/80 dark:bg-zinc-950/80 backdrop-blur-md border-b border-zinc-200/40 dark:border-zinc-800/40 shadow-sbx-nav py-3'
            : 'bg-transparent py-5'
        }`}
      >
        <nav
          role="navigation"
          aria-label="Navigasi Utama"
          className="max-w-[1200px] mx-auto px-6 flex items-center justify-between"
        >
          {/* Logo */}
          <Link
            href="/"
            className="flex items-center gap-3 group focus:outline-none focus-visible:ring-2 focus-visible:ring-secondary rounded-lg"
            aria-label="Kembali ke halaman utama Pisang Goreng Van Java"
          >
            <div className="w-10 h-10 rounded-[4px] bg-secondary flex items-center justify-center text-xl shadow-sm group-hover:scale-105 transition-transform duration-200">
              🍌
            </div>
            <div className="leading-tight">
              <span
                className={`block font-serif text-lg font-bold transition-colors duration-300 ${
                  useSolidHeader ? 'text-primary dark:text-zinc-100' : 'text-white'
                }`}
              >
                Van Java
              </span>
              <span
                className={`block text-[11px] font-sans tracking-widest uppercase transition-colors duration-300 ${
                  useSolidHeader ? 'text-zinc-500 dark:text-zinc-400' : 'text-cream-200/80'
                }`}
              >
                Premium Heritage
              </span>
            </div>
          </Link>

          {/* Desktop Navigation Links */}
          <ul className="hidden md:flex items-center gap-8">
            {links.map((link) => {
              const isActive = isLinkActive(link)
              return (
                <li key={link.id}>
                  <Link
                    href={link.href}
                    onClick={(e) => handleLinkClick(e, link.id)}
                    className={`font-sans text-sm font-semibold tracking-wide transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-secondary rounded py-1 relative ${
                      useSolidHeader
                        ? isActive
                          ? 'text-secondary'
                          : 'text-zinc-700 dark:text-zinc-200 hover:text-secondary'
                        : isActive
                          ? 'text-secondary-container'
                          : 'text-white/90 hover:text-secondary-container'
                    }`}
                  >
                    {link.label}
                    {isActive && (
                      <span className="absolute -bottom-1 left-0 right-0 h-0.5 rounded-[4px] bg-secondary" />
                    )}
                  </Link>
                </li>
              )
            })}
          </ul>

          {/* Action Controls */}
          <div className="flex items-center gap-4">
            {/* Theme Toggle */}
            <button
              onClick={toggleTheme}
              className={`p-2 rounded-[4px] transition-all focus:outline-none hover:bg-zinc-100 dark:hover:bg-zinc-800 ${
                useSolidHeader ? 'text-zinc-700 dark:text-zinc-200' : 'text-white'
              }`}
              aria-label="Toggle tema gelap/terang"
            >
              {mounted ? (theme === 'dark' ? '☀️' : '🌙') : '🌙'}
            </button>

            {/* Language Switcher */}
            <button
              onClick={() => setLocale(locale === 'id' ? 'en' : 'id')}
              className={`text-xs font-bold px-2.5 py-1.5 rounded-lg border transition-all hover:bg-zinc-100 dark:hover:bg-zinc-800 ${
                useSolidHeader
                  ? 'text-zinc-700 dark:text-zinc-200 border-zinc-300 dark:border-zinc-700'
                  : 'text-white border-white/40'
              }`}
            >
              {locale === 'id' ? 'EN' : 'ID'}
            </button>

            {/* Cart Badge Button */}
            <button
              onClick={() => setIsCartOpen(true)}
              className={`relative p-2 rounded-[4px] transition-all focus:outline-none hover:bg-zinc-100 dark:hover:bg-zinc-800 ${
                useSolidHeader ? 'text-zinc-700 dark:text-zinc-200' : 'text-white'
              }`}
              aria-label="Buka Keranjang Belanja"
            >
              <span className="text-lg">🛒</span>
              {isHydrated && cartCount > 0 && (
                <span
                  key={cartPopKey}
                  className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold w-5 h-5 rounded-[4px] flex items-center justify-center border-2 border-white dark:border-zinc-950 cart-pop"
                >
                  {cartCount}
                </span>
              )}
            </button>

            {/* Auth / Profile Avatar Dropdown */}
            {session ? (
              <div className="relative">
                <button
                  onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                  className="flex items-center focus:outline-none focus-visible:ring-2 focus-visible:ring-secondary rounded-[4px]"
                >
                  <div className="w-9 h-9 rounded-[4px] bg-secondary hover:bg-secondary/95 text-white flex items-center justify-center font-bold text-sm shadow-md transition-all overflow-hidden">
                    {session.user?.image ? (
                      <img
                        src={session.user.image}
                        alt={session.user?.name || 'Profile'}
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                    ) : session.user?.name ? (
                      session.user.name[0].toUpperCase()
                    ) : (
                      'A'
                    )}
                  </div>
                </button>

                <AnimatePresence>
                  {isDropdownOpen && (
                    <>
                      <div
                        className="fixed inset-0 z-10"
                        onClick={() => setIsDropdownOpen(false)}
                      />
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 10 }}
                        className="absolute right-0 mt-2.5 w-48 bg-white dark:bg-zinc-900 border border-zinc-200/50 dark:border-zinc-800 rounded-[4px] shadow-sm py-2 z-20"
                      >
                        <div className="px-4 py-2 border-b border-zinc-100 dark:border-zinc-800">
                          <p className="text-xs text-zinc-400 uppercase tracking-wider font-semibold">
                            User
                          </p>
                          <p className="text-sm font-bold text-zinc-800 dark:text-zinc-200 truncate">
                            {session.user?.name || session.user?.email || 'Admin'}
                          </p>
                        </div>

                        <Link
                          href="/profile"
                          className="flex items-center gap-2 px-4 py-2.5 text-sm text-zinc-700 dark:text-zinc-350 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors"
                          onClick={() => setIsDropdownOpen(false)}
                        >
                          👤 Profil Saya
                        </Link>

                        {session.user.role === 'ADMIN' && (
                          <Link
                            href="/dashboard"
                            className="flex items-center gap-2 px-4 py-2.5 text-sm text-zinc-700 dark:text-zinc-350 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors"
                            onClick={() => setIsDropdownOpen(false)}
                          >
                            ⚙️ {t('nav_admin')}
                          </Link>
                        )}

                        <button
                          onClick={() => {
                            setIsDropdownOpen(false)
                            handleSignOut()
                          }}
                          className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors text-left font-medium"
                        >
                          🚪 {t('nav_logout')}
                        </button>
                      </motion.div>
                    </>
                  )}
                </AnimatePresence>
              </div>
            ) : (
              <Link
                href="/member-login"
                className={`hidden sm:inline-flex text-xs font-bold px-4 py-2.5 rounded-[4px] transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-secondary ${
                  useSolidHeader
                    ? 'bg-secondary text-white hover:bg-secondary/95 shadow-sm'
                    : 'bg-white text-primary hover:bg-white/95 shadow-md'
                }`}
              >
                {t('nav_login')}
              </Link>
            )}

            {/* Mobile Hamburger Drawer Trigger */}
            <button
              onClick={() => setIsOpen(!isOpen)}
              className={`md:hidden p-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-secondary ${
                useSolidHeader ? 'text-zinc-700 dark:text-zinc-200' : 'text-white'
              }`}
              aria-label={isOpen ? 'Tutup navigasi' : 'Buka navigasi'}
              aria-expanded={isOpen}
              aria-controls="mobile-menu"
            >
              <div className="space-y-1.5 w-6">
                <span
                  className={`block h-0.5 w-full bg-current transition-all duration-300 ${
                    isOpen ? 'rotate-45 translate-y-2' : ''
                  }`}
                />
                <span
                  className={`block h-0.5 w-full bg-current transition-all duration-300 ${
                    isOpen ? 'opacity-0' : ''
                  }`}
                />
                <span
                  className={`block h-0.5 w-full bg-current transition-all duration-300 ${
                    isOpen ? '-rotate-45 -translate-y-2' : ''
                  }`}
                />
              </div>
            </button>
          </div>
        </nav>

        {/* Mobile menu dropdown */}
        <AnimatePresence>
          {isOpen && (
            <motion.div
              id="mobile-menu"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.25, ease: 'easeInOut' }}
              className="md:hidden bg-white/95 dark:bg-zinc-950/95 backdrop-blur-md border-b border-zinc-200/40 dark:border-zinc-800/40 overflow-hidden shadow-inner"
            >
              <div className="px-6 py-4 flex flex-col gap-4">
                {links.map((link) => {
                  const isActive = isLinkActive(link)
                  return (
                    <Link
                      key={link.id}
                      href={link.href}
                      onClick={(e) => {
                        handleLinkClick(e, link.id)
                        setIsOpen(false)
                      }}
                      className={`text-base font-semibold py-1 border-b border-zinc-100 dark:border-zinc-800 transition-colors ${
                        isActive
                          ? 'text-secondary'
                          : 'text-zinc-700 dark:text-zinc-200 hover:text-secondary'
                      }`}
                    >
                      {link.label}
                    </Link>
                  )
                })}
                {!session && (
                  <Link
                    href="/member-login"
                    onClick={() => setIsOpen(false)}
                    className="w-full flex items-center justify-center bg-secondary text-white py-3 rounded-[4px] font-bold mt-2"
                  >
                    {t('nav_login')}
                  </Link>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      {/* Floating/Sticky Cart Button */}
      {isHydrated && cartCount > 0 && (
        <button
          onClick={() => setIsCartOpen(true)}
          className="fixed z-[60] bg-amber-brand hover:bg-amber-brand/90 text-white shadow-2xl transition-all duration-200 active:scale-[0.98] focus:outline-none
            /* Mobile Sticky Bar layout */
            bottom-0 left-0 right-0 w-full rounded-t-lg py-4 px-6 flex items-center justify-between sm:hidden
            /* Desktop Floating Button layout */
            sm:bottom-6 sm:right-6 sm:w-14 sm:h-14 sm:rounded-[4px] sm:justify-center"
          aria-label="Buka Keranjang"
        >
          {/* Mobile view content */}
          <div className="flex items-center gap-3 sm:hidden">
            <ShoppingBagIcon />
            <div className="text-left">
              <span className="font-bold text-sm block leading-none text-[#1a0f0a]">Lihat Keranjang</span>
              <span className="text-xs text-[#1a0f0a]/80 mt-0.5 block leading-none">{cartCount} Item</span>
            </div>
          </div>
          <div className="font-bold text-base text-[#1a0f0a] sm:hidden">
            {formatPrice(cartTotal)}
          </div>

          {/* Desktop view content */}
          <div className="hidden sm:flex items-center justify-center relative">
            <ShoppingBagIcon />
            <span
              key={`frap-${cartPopKey}`}
              className="absolute -top-3.5 -right-3.5 bg-red-500 text-white text-[10px] font-bold w-5 h-5 rounded-[4px] flex items-center justify-center border-2 border-amber-brand cart-pop"
            >
              {cartCount}
            </span>
          </div>
        </button>
      )}

      {/* Floating empty cart button (desktop only) */}
      {(!isHydrated || cartCount === 0) && (
        <button
          onClick={() => setIsCartOpen(true)}
          className="fixed bottom-6 right-6 z-[60] w-14 h-14 bg-amber-brand hover:bg-amber-brand/90 text-white rounded-[4px] flex items-center justify-center shadow-sbx-frap transition-all duration-200 active:scale-95 active:shadow-sm focus:outline-none group"
          aria-label="Buka Keranjang"
        >
          <ShoppingBagIcon />
        </button>
      )}

      {/* Cart Drawer component */}
      <CartModal isOpen={isCartOpen} onClose={() => setIsCartOpen(false)} />
    </>
  )
}
