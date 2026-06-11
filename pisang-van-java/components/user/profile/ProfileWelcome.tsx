'use client'

import { useSession } from 'next-auth/react'
import { useLanguage } from '@/context/LanguageContext'

export default function ProfileWelcome() {
  const { data: session } = useSession()
  const { t } = useLanguage()

  const name = session?.user?.name || t('profile_member')

  return (
    <div className="mb-8">
      <h1 className="text-3xl md:text-4xl font-bold font-serif text-zinc-900 dark:text-zinc-100">
        {t('profile_welcome').replace('{name}', name)}
      </h1>
      <p className="text-zinc-500 dark:text-zinc-400 mt-2">
        {t('profile_welcome_desc')}
      </p>
    </div>
  )
}
