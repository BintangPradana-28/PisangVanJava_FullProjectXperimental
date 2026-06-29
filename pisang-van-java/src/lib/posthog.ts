import { PostHog } from 'posthog-node'
import { env } from '@/src/env'

let posthogClient: PostHog | null = null

export function getPostHogClient() {
  if (!env.NEXT_PUBLIC_POSTHOG_KEY) {
    return null
  }

  if (!posthogClient) {
    posthogClient = new PostHog(env.NEXT_PUBLIC_POSTHOG_KEY, {
      host: env.NEXT_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com',
      flushAt: 1,
      flushInterval: 0
    })
  }
  return posthogClient
}
