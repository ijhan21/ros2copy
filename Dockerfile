# ── 빌드 단계 ─────────────────────────────────────────────
FROM node:22-slim AS builder
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# NEXT_PUBLIC_ 접두사 변수는 빌드 시점에 번들에 포함된다.
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ENV NEXT_PUBLIC_SUPABASE_URL=${NEXT_PUBLIC_SUPABASE_URL}
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=${NEXT_PUBLIC_SUPABASE_ANON_KEY}

RUN test -n "$NEXT_PUBLIC_SUPABASE_URL" \
    || (echo "빌드 인자 NEXT_PUBLIC_SUPABASE_URL 이 비어 있습니다 (.env 확인)" && exit 1)

RUN npm run build

# ── 런타임 단계 ───────────────────────────────────────────
FROM node:22-slim AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3005
ENV HOSTNAME=0.0.0.0
ENV TZ=Asia/Seoul

# standalone 산출물: server.js + 필요한 node_modules
COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static
COPY --from=builder --chown=node:node /app/public ./public

USER node
EXPOSE 3005
CMD ["node", "server.js"]
