'use client'

import { motion } from 'framer-motion'
import { useMemo } from 'react'
import { useLanguage } from '@/context/LanguageContext'

export default function HeroBanner() {
  const { t } = useLanguage()

  const menuTitleParts = useMemo(() => {
    const title = t('menu_title')
    const parts = title.split('Van Java')
    return {
      before: parts[0] || '',
      after: parts[1] || ''
    }
  }, [t])

  return (
    <section className="relative overflow-hidden pt-24 pb-16 sm:pt-28 sm:pb-20 text-white bg-gradient-to-br from-[#3D1C02] via-[#4a2408] to-[#5a2e0a]">
      {/* Decorative warmth — soft amber glow, echoes the radial blob used on the outlet CTA */}
      <div
        className="absolute -top-24 -right-16 w-96 h-96 rounded-full opacity-20 pointer-events-none blur-2xl"
        style={{ background: 'radial-gradient(circle,#D4802A,transparent 70%)' }}
      />
      <div className="absolute inset-0 bg-hero-pattern opacity-[0.06] pointer-events-none" />

      <div className="max-w-[1200px] mx-auto px-6 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="max-w-2xl"
        >
          <span className="inline-block text-xs font-bold tracking-[0.22em] uppercase px-4 py-1.5 rounded-full mb-5 bg-white/10 text-amber-200 border border-white/15 backdrop-blur-sm">
            {t('nav_menu')}
          </span>
          <h1 className="font-serif text-4xl sm:text-5xl md:text-6xl font-bold leading-[1.08] mb-4">
            {menuTitleParts.before}
            <span className="italic font-normal text-amber-300">Van Java</span>
            {menuTitleParts.after}
          </h1>
          <p className="text-base sm:text-lg leading-relaxed text-white/70 max-w-lg">
            {t('menu_desc')}
          </p>
        </motion.div>
      </div>
    </section>
  )
}