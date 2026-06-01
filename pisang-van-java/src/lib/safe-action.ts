import { createSafeActionClient, DEFAULT_SERVER_ERROR_MESSAGE } from 'next-safe-action'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/src/features/auth/authOptions'
import * as Sentry from '@sentry/nextjs'

class ActionError extends Error {}

export const actionClient = createSafeActionClient({
  handleReturnedServerError(e) {
    if (e instanceof ActionError) {
      return e.message
    }
    // Track unhandled errors to Sentry
    Sentry.captureException(e)
    return DEFAULT_SERVER_ERROR_MESSAGE
  },
})

// Client requiring authentication
export const authActionClient = actionClient.use(async ({ next }) => {
  const session = await getServerSession(authOptions)

  if (!session?.user) {
    throw new ActionError('Sesi tidak valid atau telah berakhir. Silakan login kembali.')
  }

  // Inject user into the action context
  return next({
    ctx: {
      userId: session.user.id,
      userRole: session.user.role,
    }
  })
})

// Note: For Role-Based Access Control (RBAC), you can create another client like `adminActionClient`
// that further checks if ctx.userRole === 'ADMIN'.
