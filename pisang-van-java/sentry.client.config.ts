import * as Sentry from "@sentry/nextjs";

Sentry.init({
  // DSN diberikan via Environment Variables (.env)
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Sesuaikan tracesSampleRate di production (misal 0.1 untuk 10%)
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,

  // Setting Sentry Replay
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,

  integrations: [
    Sentry.replayIntegration({
      // 🛡️ CISO Security Masking: Sembunyikan semua teks dan input di layar pengguna dari rekaman Sentry
      maskAllText: true,
      maskAllInputs: true,
    }),
  ],
});
