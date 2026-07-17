import pino from 'pino'

// Define structured logging based on environment
const isProduction = process.env.NODE_ENV === 'production'

// NOTE (post-Bun migration, 05-Jul-2026): pino's `transport: { target: 'pino-pretty' }`
// option spawns a worker thread that does a dynamic module resolution Bun cannot handle —
// this throws "unable to determine transport target for pino-pretty" under `bun --bun`.
// Confirmed as a long-standing, still-open Bun compatibility bug (oven-sh/bun#4280, #23062).
// Fix: use pino-pretty as a direct synchronous stream (pino's officially documented
// alternative) instead of the transport/worker-thread option. No new dependency needed —
// pino-pretty is already a devDependency.
const stream = isProduction
  ? undefined
  : require('pino-pretty')({
      colorize: true,
      ignore: 'pid,hostname',
      translateTime: 'SYS:standard'
    })

const options = {
  level: process.env.LOG_LEVEL || 'info',
  formatters: {
    level: (label: string) => {
      return { level: label.toUpperCase() }
    }
  },
  timestamp: pino.stdTimeFunctions.isoTime
}

export const logger = stream ? pino(options, stream) : pino(options)
