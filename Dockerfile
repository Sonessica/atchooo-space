ARG RUNTIME_BASE=docker.1ms.run/library/node:22-bookworm-slim
FROM docker.1ms.run/library/node:22-bookworm-slim AS deps
WORKDIR /app
ARG NPM_REGISTRY=https://registry.npmjs.org
COPY package.json package-lock.json ./
RUN npm ci --registry=${NPM_REGISTRY}

FROM docker.1ms.run/library/node:22-bookworm-slim AS bitwarden
WORKDIR /opt/bitwarden
ARG NPM_REGISTRY=https://registry.npmjs.org
RUN npm install --omit=dev --no-save --registry=${NPM_REGISTRY} @bitwarden/cli@2026.6.0

FROM docker.1ms.run/library/node:22-bookworm-slim AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ARG NEXT_PUBLIC_SUPABASE_URL=https://example.supabase.co
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY=review-placeholder
ARG NEXT_PUBLIC_APP_URL=https://space.atchooo.com:2096
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY
ENV NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL
RUN npm run build

FROM ${RUNTIME_BASE} AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV BW_CLI_PATH=/opt/bitwarden/node_modules/@bitwarden/cli/build/bw.js
RUN if ! command -v ffmpeg >/dev/null 2>&1; then \
      apt-get update \
      && apt-get install -y --no-install-recommends ffmpeg \
      && rm -rf /var/lib/apt/lists/*; \
    fi
RUN rm -rf /app/.next /app/node_modules /app/public /app/scripts
COPY --from=bitwarden /opt/bitwarden/node_modules /opt/bitwarden/node_modules
COPY --from=builder /app/package.json /app/package-lock.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/scripts ./scripts
EXPOSE 3000
CMD ["npm", "run", "start"]
