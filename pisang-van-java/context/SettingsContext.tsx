'use client'

import type React from 'react'
import { createContext, useContext, useEffect, useState } from 'react'

export interface SiteSetting {
  key: string
  value: string
  label: string | null
  group: string
}

interface SettingsContextType {
  settings: Record<string, string>
  loading: boolean
  getSetting: (key: string, defaultValue?: string) => string
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined)

const DEFAULT_SETTINGS: Record<string, string> = {
  site_name: 'Pisang Goreng Van Java',
  site_description: 'Pisang goreng renyah dengan lelehan topping premium terlezat se-Jawa.',
  nomor_wa: '6285773728748',
  kontak_whatsapp: '6285773728748',
  alamat: 'Jl. Raya Cilangkap l Rt.2/Rw.5, Cilangkap, Kec. Cipayung, Kota Jakarta Timur',
  jam_operasional: 'Setiap Hari: 10.00–21.00 WIB',
  instagram: 'https://instagram.com/pisanggorengvanjava',
  tiktok: 'https://tiktok.com/@pisanggorengvanjava',
  store_open: 'true',
  store_delivery_fee: '0'
}

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<Record<string, string>>(DEFAULT_SETTINGS)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/settings')
      .then(async (res) => {
        if (!res.ok) return { success: false, data: [] }
        return res.json().catch(() => ({ success: false, data: [] }))
      })
      .then((res) => {
        if (res.success && Array.isArray(res.data)) {
          const mapped: Record<string, string> = {}
          res.data.forEach((s: SiteSetting) => {
            mapped[s.key] = s.value
          })
          setSettings((prev) => ({ ...prev, ...mapped }))
        }
      })
      .catch((err) => console.error('Failed to load site settings:', err))
      .finally(() => setLoading(false))
  }, [])

  const getSetting = (key: string, defaultValue: string = '') => {
    return settings[key] !== undefined ? settings[key] : defaultValue
  }

  return (
    <SettingsContext.Provider value={{ settings, loading, getSetting }}>
      {children}
    </SettingsContext.Provider>
  )
}

export function useSettings() {
  const context = useContext(SettingsContext)
  if (!context) {
    throw new Error('useSettings must be used within a SettingsProvider')
  }
  return context
}
