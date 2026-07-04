// This file configures the initialization of Sentry on the server.
// The config you add here will be used whenever the server handles a request.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from '@sentry/nextjs'

Sentry.init({
  dsn: process.env.SENTRY_DSN,

  // Define how likely traces are sampled. Lower in production to control Sentry volume/cost.
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1,

  // Disable sending user PII (Personally Identifiable Information) in compliance with UU PDP / UU ITE
  // https://docs.sentry.io/platforms/javascript/guides/nextjs/configuration/options/#sendDefaultPii
  sendDefaultPii: false
})
