import { PostHog } from 'posthog-node'
import { env } from '@/src/env'

let posthogClient: PostHog | null = null

export function getPostHogClient() {
  if (!env.NEXT_PUBLIC_POSTHOG_KEY) {
    return null
  }
  
  if (!posthogClient) {
    posthogClient = new PostHog(env.NEXT_PUBLIC_POSTHOG_KEY, {
      host: 'https://us.i.posthog.com', // Update this based on the actual region chosen
      flushAt: 1,
      flushInterval: 0
    })
  }
  return posthogClient
}
