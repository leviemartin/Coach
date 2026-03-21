# Stage 1: Dependencies
FROM node:20-alpine AS deps
RUN apk add --no-cache make g++ linux-headers
WORKDIR /app

# Node dependencies
COPY dashboard/package.json dashboard/package-lock.json ./
RUN npm ci

# Stage 2: Build
FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY dashboard/ .
RUN npm run build

# Stage 3: Runtime
FROM node:20-alpine AS runner
RUN apk add --no-cache dcron sqlite

WORKDIR /app

# Copy standalone build
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

# Copy scripts
COPY dashboard/scripts/ /app/scripts/
RUN chmod +x /app/scripts/*.sh

# Copy initial data for migration (state, coaches)
# Note: trends.db is gitignored and created fresh by the app on first run.
# To migrate an existing DB, upload it to the volume manually via `railway volume upload`.
COPY state/ /app/init-data/state/
COPY coaches/ /app/init-data/coaches/

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

ENTRYPOINT ["/app/scripts/entrypoint.sh"]
