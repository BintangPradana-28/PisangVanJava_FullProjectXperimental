# ── Build context is the REPO ROOT, not pisang-van-java/ ────────────────────
# Run as: docker build -f pisang-van-java/Dockerfile .   (from repo root)
# This matches how the workspace is actually laid out (bun.lock lives at root,
# next.config.js already sets turbopack.root one level up) — no more manual
# `cp ../bun.lock .` staging hack required in CI.

FROM oven/bun:1-alpine AS base
RUN apk add --no-cache libc6-compat
WORKDIR /app

# ── deps: install via Bun (fast) ─────────────────────────────────────────────
FROM base AS deps
COPY package.json bun.lock ./
COPY pisang-van-java/package.json ./pisang-van-java/package.json
RUN bun install --frozen-lockfile

# ── builder: build via Bun (fast) ────────────────────────────────────────────
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/pisang-van-java/node_modules ./pisang-van-java/node_modules
COPY . .
WORKDIR /app/pisang-van-java
RUN bunx prisma generate
RUN bun run build

# ── runner: REAL Node.js, not Bun ────────────────────────────────────────────
# Verified via oven-sh/bun's own Dockerfile (dockerhub/alpine/Dockerfile):
#   ln -s /usr/local/bin/bun /usr/local/bun-node-fallback-bin/node
# "node" inside an oven/bun image is Bun wearing a name tag — same runtime,
# same RSC-module-resolution risk documented against Next.js standalone output.
# node:22-alpine is a genuine, separate Node.js binary for the one thing that
# needs to be maximally boring and correct: actually serving production traffic.
FROM node:22-alpine AS runner
ENV NODE_ENV=production
ENV PORT=3000
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs
COPY --from=builder /app/pisang-van-java/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/pisang-van-java/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/pisang-van-java/.next/static ./pisang-van-java/.next/static
COPY --from=builder /app/pisang-van-java/prisma ./pisang-van-java/prisma
USER nextjs
EXPOSE 3000
# server.js path matches turbopack.root in next.config.js (monorepo root is
# one level above pisang-van-java/) — standalone output preserves that nesting.
CMD ["node", "pisang-van-java/server.js"]
