'use client'

import type React from 'react'
import { createContext, useContext, useEffect, useState } from 'react'
import { useSettings } from '@/context/SettingsContext'
import { dictionaries, type Locale } from '@/lib/i18n/dictionaries'

interface LanguageContextType {
  locale: Locale
  setLocale: (locale: Locale) => void
  t: (key: string) => string
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined)

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>('id')
  const { settings } = useSettings()

  // 1. Ambil preferensi bahasa dari localStorage saat komponen di-mount
  useEffect(() => {
    const savedLocale = localStorage.getItem('locale') as Locale | null
    if (savedLocale) {
      setLocaleState(savedLocale)
    }
  }, [])

  const setLocale = (newLocale: Locale) => {
    setLocaleState(newLocale)
    localStorage.setItem('locale', newLocale)
  }

  const t = (key: string): string => {
    // Hierarki: Database Settings -> Dictionary -> Raw Key
    // Penggunaan objek dictionary secara statis memastikan proses Server-Side Rendering (SSR)
    // tidak menghasilkan raw key (blablabla_blablabla) saat First-Load.
    return settings[key] || dictionaries[locale][key] || key
  }

  return (
    <LanguageContext.Provider value={{ locale, setLocale, t }}>{children}</LanguageContext.Provider>
  )
}

export function useLanguage() {
  const context = useContext(LanguageContext)
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider')
  }
  return context
}
