'use client'

import { motion, useReducedMotion } from 'framer-motion'
import Image from 'next/image'
import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { useLanguage } from '@/context/LanguageContext'

export default function About() {
  const { t } = useLanguage()
  const ref = useRef<HTMLElement>(null)
  const [visible, setVisible] = useState(false)
  const reduceMotion = useReducedMotion()

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true)
        }
      },
      { threshold: 0.1 }
    )
    if (ref.current) observer.observe(ref.current)
    return () => observer.disconnect()
  }, [])

  const pillars = [
    { title: t('about_pillar_1_title'), desc: t('about_pillar_1_desc'), icon: '🌿' },
    { title: t('about_pillar_2_title'), desc: t('about_pillar_2_desc'), icon: '🏆' },
    { title: t('about_pillar_3_title'), desc: t('about_pillar_3_desc'), icon: '✨' }
  ]

  const stats = [
    { num: `${new Date().getFullYear() - 2018}+`, label: t('about_stat_experience') },
    { num: '12+', label: t('about_stat_flavor') },
    { num: '3', label: t('about_stat_types') },
    { num: '100%', label: t('about_stat_local') }
  ]

  const motionProps = (delay = 0) =>
    reduceMotion
      ? {}
      : {
          initial: { opacity: 0, y: 20 },
          animate: visible ? { opacity: 1, y: 0 } : {},
          transition: { duration: 0.4, delay, ease: 'easeOut' as const }
        }

  return (
    <section
      id="tentang"
      ref={ref}
      className="py-24 bg-surface-container-lowest border-y border-outline-variant/20 dark:bg-zinc-950/20"
    >
      <div className="max-w-[1200px] mx-auto px-6">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          {/* Image visual wrapper */}
          <motion.div
            {...(reduceMotion
              ? {}
              : {
                  initial: { opacity: 0, x: -30 },
                  animate: visible ? { opacity: 1, x: 0 } : {},
                  transition: { duration: 0.5, ease: 'easeOut' }
                })}
            className="relative w-full aspect-[4/3] rounded-[4px] overflow-hidden shadow-sm border border-outline-variant/30 bg-surface-container dark:border-zinc-800"
          >
            <Image
              src="/kitchen.png"
              alt="Konsep Kedai Modern Tradisional Pisang Goreng Van Java"
              fill
              sizes="(max-width: 640px) calc(100vw - 3rem), (max-width: 1024px) 50vw, 550px"
              quality={70}
              loading="lazy"
              className="object-cover"
            />
            <div className="absolute bottom-6 right-6 bg-primary dark:bg-zinc-900 text-white rounded-[4px] p-5 shadow-sm border border-white/10 dark:border-zinc-800">
              <div className="font-serif text-lg font-bold text-secondary-container">
                {t('about_since')}
              </div>
              <div className="text-xs text-cream-50/70 mt-0.5">{t('about_quality')}</div>
            </div>
          </motion.div>

          {/* Text Area */}
          <motion.div
            {...(reduceMotion
              ? {}
              : {
                  initial: { opacity: 0, x: 30 },
                  animate: visible ? { opacity: 1, x: 0 } : {},
                  transition: { duration: 0.5, delay: 0.12, ease: 'easeOut' }
                })}
          >
            <div className="inline-block bg-secondary/10 text-secondary text-xs font-bold tracking-[0.2em] uppercase px-4 py-1 rounded-[4px] mb-4">
              {t('about_badge')}
            </div>

            <h2 className="font-serif text-4xl sm:text-5xl font-bold text-primary dark:text-zinc-100 mb-6 leading-[1.15]">
              {t('about_title').split(',')[0].trim()},<br />
              <span className="text-amber-brand italic font-normal">
                {t('about_title').split(',')[1]?.trim()}
              </span>
            </h2>

            <p className="text-on-surface-variant dark:text-zinc-400 text-base leading-relaxed mb-6 font-sans">
              {t('about_desc1')}
            </p>

            <p className="text-on-surface-variant dark:text-zinc-400 text-base leading-relaxed mb-8 font-sans">
              {t('about_desc2')}
            </p>

            {/* Stats strip */}
            <motion.div
              {...motionProps(0.2)}
              className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8"
            >
              {stats.map(({ num, label }) => (
                <div
                  key={label}
                  className="rounded-[4px] border border-outline-variant/20 dark:border-zinc-800 bg-surface-container-low dark:bg-zinc-900 px-4 py-3 text-center"
                >
                  <div className="font-serif text-2xl font-bold text-amber-brand">{num}</div>
                  <div className="text-[10px] sm:text-xs text-on-surface-variant dark:text-zinc-500 uppercase tracking-wider mt-1 font-medium">
                    {label}
                  </div>
                </div>
              ))}
            </motion.div>

            {/* 3 Pillars */}
            <div className="grid sm:grid-cols-3 gap-4 mb-8">
              {pillars.map(({ title, desc, icon }, i) => (
                <motion.div
                  key={title}
                  {...motionProps(0.28 + i * 0.08)}
                  className="bg-surface-container-low dark:bg-zinc-900 border border-outline-variant/20 dark:border-zinc-800 rounded-[4px] p-5 md:p-6 hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 ease-out"
                >
                  <div className="text-2xl mb-2" aria-hidden="true">
                    {icon}
                  </div>
                  <div className="font-serif text-lg font-bold text-primary dark:text-zinc-200 leading-tight mb-1">
                    {title}
                  </div>
                  <div className="text-sm text-on-surface-variant dark:text-zinc-450 leading-relaxed">
                    {desc}
                  </div>
                </motion.div>
              ))}
            </div>

            {/* Read More */}
            <motion.div {...motionProps(0.55)}>
              <Link
                href="/tentang-kami"
                className="inline-flex items-center gap-2 font-bold text-sm px-6 py-3 rounded-[4px] bg-amber-brand hover:bg-amber-brand/90 text-white shadow-sm transition-all duration-200 active:scale-95 hover:-translate-y-0.5 focus:outline-none focus-visible:ring-4 focus-visible:ring-amber-brand/40"
              >
                {t('about_read_more')} →
              </Link>
            </motion.div>
          </motion.div>
        </div>
      </div>
    </section>
  )
}
