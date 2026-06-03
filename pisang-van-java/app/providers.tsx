'use client'

import { SessionProvider } from 'next-auth/react'
import { Toaster } from 'react-hot-toast'
import { ThemeProvider } from '@/context/ThemeContext'
import { LanguageProvider } from '@/context/LanguageContext'
import { CartSyncProvider } from '@/src/lib/store/CartSyncProvider'
import { SettingsProvider } from '@/context/SettingsContext'
import { PostHogProvider } from '@/src/providers/PostHogProvider'

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <PostHogProvider>
      <SessionProvider>
        <ThemeProvider>
          <SettingsProvider>
            <LanguageProvider>
              <CartSyncProvider>
                {children}
                <Toaster position="top-center" reverseOrder={false} />
              </CartSyncProvider>
            </LanguageProvider>
          </SettingsProvider>
        </ThemeProvider>
      </SessionProvider>
    </PostHogProvider>
  )
}

