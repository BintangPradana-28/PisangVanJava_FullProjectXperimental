import { getPostHogClient } from './posthog'

/**
 * Evaluates a PostHog feature flag on the server-side.
 * Used in server components, API routes, or server actions.
 */
export async function isFeatureEnabled(distinctId: string, flagKey: string): Promise<boolean> {
  const client = getPostHogClient()
  if (!client) return false

  try {
    const isEnabled = await client.isFeatureEnabled(flagKey, distinctId)
    return !!isEnabled
  } catch (error) {
    console.error(
      '[POSTHOG] Failed to check feature flag',
      flagKey,
      'for',
      distinctId,
      'error:',
      error
    )
    return false
  }
}
