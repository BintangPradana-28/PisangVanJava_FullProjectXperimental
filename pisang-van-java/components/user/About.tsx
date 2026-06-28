'use client'

import { motion, useReducedMotion } from 'framer-motion'
import Image from 'next/image'
import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { useLanguage } from '@/context/LanguageContext'

export default function About({
  averageRating = 0,
  totalReviews = 0,
  activeFlavorsCount = 12
}: {
  averageRating?: number
  totalReviews?: number
  activeFlavorsCount?: number
}) {
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
    {
      num: activeFlavorsCount > 0 ? `${activeFlavorsCount}+` : '12+',
      label: t('about_stat_flavor')
    },
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
            <div className="flex flex-wrap items-center gap-3 mb-5">
              <div className="inline-block bg-secondary/10 text-secondary text-[11px] font-semibold tracking-wider font-sans uppercase px-3 py-1 rounded-[6px]">
                {t('about_badge')}
              </div>
              {totalReviews >= 5 && (
                <Link
                  href="/ulasan"
                  className="inline-flex items-center gap-1 bg-amber-brand/10 border border-amber-brand/20 px-2.5 py-1 rounded-[6px] transition-all hover:bg-amber-brand/20 active:scale-95 focus:outline-none"
                >
                  <span className="text-amber-brand text-xs font-bold">
                    ★ {averageRating.toFixed(1)}
                  </span>
                  <span className="text-[10px] font-semibold text-amber-855 dark:text-amber-400">
                    ({totalReviews} {t('about_review_social')})
                  </span>
                </Link>
              )}
            </div>

            <h2 className="font-sans text-3xl sm:text-4xl font-extrabold text-primary dark:text-zinc-100 mb-6 leading-[1.12] tracking-[-0.03em] sm:tracking-[-0.04em]">
              {t('about_title').split(',')[0].trim()},<br />
              <span className="text-amber-brand font-medium">
                {t('about_title').split(',')[1]?.trim()}.
              </span>
            </h2>

            <p className="text-zinc-650 dark:text-zinc-400 text-sm sm:text-base leading-relaxed mb-6 font-sans">
              {t('about_desc1')}
            </p>

            <p className="text-zinc-650 dark:text-zinc-400 text-sm sm:text-base leading-relaxed mb-8 font-sans">
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
                  className="rounded-[6px] border border-outline-variant/35 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 px-4 py-3 text-center shadow-sm"
                >
                  <div className="font-sans text-2xl font-bold text-amber-brand">{num}</div>
                  <div className="text-[10px] text-zinc-450 dark:text-zinc-500 font-sans tracking-wider uppercase mt-1 font-semibold">
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
                  className="bg-white dark:bg-zinc-900/80 border border-outline-variant/35 dark:border-zinc-800/80 rounded-[6px] p-5 md:p-6 shadow-sm hover:shadow-md transition-all duration-200 ease-out"
                >
                  <div className="text-2xl mb-2.5" aria-hidden="true">
                    {icon}
                  </div>
                  <div className="font-sans text-base font-bold text-primary dark:text-zinc-200 leading-tight mb-1">
                    {title}
                  </div>
                  <div className="text-xs text-zinc-550 dark:text-zinc-400 leading-relaxed">
                    {desc}
                  </div>
                </motion.div>
              ))}
            </div>

            {/* Read More */}
            <motion.div {...motionProps(0.55)}>
              <Link
                href="/tentang-kami"
                className="inline-flex items-center gap-2 font-bold text-sm px-6 py-3 rounded-full bg-amber-brand hover:bg-amber-brand/95 text-white shadow-sm transition-all duration-205 active:scale-95 focus:outline-none focus-visible:ring-4 focus-visible:ring-amber-brand/40"
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
