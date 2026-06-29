'use client'

import posthog from 'posthog-js'
import { PostHogProvider as CSPostHogProvider } from 'posthog-js/react'
import { useEffect } from 'react'
import { env } from '@/src/env'

// PERF: posthog.init() moved out of module-evaluation scope (it used to run the
// instant this file was imported, blocking on SDK setup before first paint on
// EVERY page). It now runs inside useEffect, deferred via requestIdleCallback so
// it only starts once the browser has spare main-thread time after mount —
// analytics still initializes within the same session, just no longer competes
// with LCP/FCP for parse+exec time. Falls back to setTimeout for browsers
// without requestIdleCallback (older Safari).
let posthogInitStarted = false

function initPostHog() {
  if (typeof window === 'undefined' || !env.NEXT_PUBLIC_POSTHOG_KEY) return
  if (posthogInitStarted) return
  posthogInitStarted = true

  posthog.init(env.NEXT_PUBLIC_POSTHOG_KEY, {
    api_host: env.NEXT_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com',
    person_profiles: 'identified_only'
  })
}

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const win = window as any
      if (win.requestIdleCallback) {
        const id = win.requestIdleCallback(initPostHog, { timeout: 4000 })
        return () => win.cancelIdleCallback(id)
      }
      const id = window.setTimeout(initPostHog, 1)
      return () => window.clearTimeout(id)
    }
  }, [])

  return <CSPostHogProvider client={posthog}>{children}</CSPostHogProvider>
}
