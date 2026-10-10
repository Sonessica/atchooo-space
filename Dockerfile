ARG RUNTIME_BASE=runtime
FROM node:22-bookworm-slim AS deps
WORKDIR /app
ARG NPM_REGISTRY=https://registry.npmjs.org
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci --registry=${NPM_REGISTRY}

FROM node:22-bookworm-slim AS bitwarden
WORKDIR /opt/bitwarden
ARG NPM_REGISTRY=https://registry.npmjs.org
RUN --mount=type=cache,target=/root/.npm npm install --omit=dev --no-save --registry=${NPM_REGISTRY} @bitwarden/cli@2026.6.0

# Clean, reusable runtime: never derive this stage from an application image.
FROM node:22-bookworm-slim AS runtime
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg ca-certificates && rm -rf /var/lib/apt/lists/*
COPY --from=bitwarden /opt/bitwarden/node_modules /opt/bitwarden/node_modules
ENV NODE_ENV=production BW_CLI_PATH=/opt/bitwarden/node_modules/@bitwarden/cli/build/bw.js

FROM node:22-bookworm-slim AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ARG NEXT_PUBLIC_SUPABASE_URL=https://example.supabase.co
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY=review-placeholder
ARG NEXT_PUBLIC_APP_URL=https://space.atchooo.com:2096
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY
ENV NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL
RUN npm run lint && npm run test:canvas && npm run test:sections && npm run test:links && npm run test:link-check && npm run test:vaultwarden
RUN --mount=type=cache,target=/app/.next/cache npm run build

FROM ${RUNTIME_BASE} AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0 PORT=3000
ENV BW_CLI_PATH=/opt/bitwarden/node_modules/@bitwarden/cli/build/bw.js
ARG GIT_REVISION=unknown
LABEL org.opencontainers.image.source="https://github.com/Sonessica/atchooo-space" org.opencontainers.image.revision=$GIT_REVISION
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
COPY --from=builder /app/scripts ./scripts
EXPOSE 3000
CMD ["node", "server.js"]
