'use client'

import { SessionProvider } from 'next-auth/react'
import { Toaster } from 'react-hot-toast'
import { LanguageProvider } from '@/context/LanguageContext'
import { SettingsProvider } from '@/context/SettingsContext'
import { ThemeProvider } from '@/context/ThemeContext'
import { CartSyncProvider } from '@/src/features/cart/providers/CartSyncProvider'
import { PostHogProvider } from '@/src/providers/PostHogProvider'

import { NuqsAdapter } from 'nuqs/adapters/next/app'
import { QueryProvider } from '@/src/providers/query-provider'

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <NuqsAdapter>
      <QueryProvider>
        <PostHogProvider>
          <SessionProvider>
            <CartSyncProvider>
              <ThemeProvider>
                <SettingsProvider>
                  <LanguageProvider>
                    {children}
                    <Toaster
                      position="top-center"
                      reverseOrder={false}
                      toastOptions={{
                        className:
                          '!bg-white dark:!bg-zinc-900 !text-zinc-900 dark:!text-zinc-100 !border !border-zinc-200 dark:!border-zinc-800 !shadow-sm'
                      }}
                    />
                  </LanguageProvider>
                </SettingsProvider>
              </ThemeProvider>
            </CartSyncProvider>
          </SessionProvider>
        </PostHogProvider>
      </QueryProvider>
    </NuqsAdapter>
  )
}
