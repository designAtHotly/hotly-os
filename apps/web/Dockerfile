# syntax=docker/dockerfile:1
# Build from the hotly-opensource repository root:
#   docker build -f apps/web/Dockerfile .

FROM oven/bun:1.4 AS deps
WORKDIR /app
COPY package.json bun.lock turbo.json tsconfig.json ./
COPY apps/web/package.json ./apps/web/package.json
COPY apps/server/package.json ./apps/server/package.json
RUN bun install --frozen-lockfile

FROM oven/bun:1.4 AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
# Bun's isolated linker puts package bins in each workspace's node_modules/.bin,
# not only at the repo root. Copy the whole install tree, then overlay source
# (.dockerignore excludes node_modules so those dirs are kept).
COPY --from=deps /app ./
COPY . .
RUN bun x turbo run build --filter=web

FROM oven/bun:1.4-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

COPY --from=builder --chown=bun:bun /app/apps/web/.next/standalone ./
COPY --from=builder --chown=bun:bun /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder --chown=bun:bun /app/apps/web/public ./apps/web/public

USER bun
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD bun -e "fetch('http://127.0.0.1:3000').then((r)=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["bun", "apps/web/server.js"]
