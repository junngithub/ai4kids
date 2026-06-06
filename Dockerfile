FROM node:22-alpine AS base
WORKDIR /app

FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund --legacy-peer-deps

FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

FROM base AS runner
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
# Give the `app` user a real, writable HOME. The Claude Agent SDK caches its
# refreshed OAuth access token in ~/.claude/.credentials.json on each turn.
# Without a writable HOME the cache write silently fails and the next turn's
# refresh-token exchange returns 401 — surfacing as "Invalid bearer token"
# 4s into a multi-turn generation.
ENV HOME=/home/app
RUN addgroup -S app \
  && adduser -S app -G app -h /home/app \
  && mkdir -p /home/app/.claude \
  && chown -R app:app /home/app
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
USER app
EXPOSE 3000
CMD ["node", "server.js"]
