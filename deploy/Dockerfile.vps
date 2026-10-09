# Tilo on any VPS (e.g. InterServer): app + Postgres side by side.
# Build + run: docker build -t tilo . && docker run -p 3000:3000 --env-file .env.prod tilo
# .env.prod must set DATABASE_URL (pooler URL with ?connection_limit=5),
# BETTER_AUTH_SECRET, BETTER_AUTH_URL, NEXT_PUBLIC_APP_URL and your provider keys.
FROM node:20-bookworm-slim AS base
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

FROM base AS deps
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci && npx prisma generate

FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate && npm run build

FROM base AS run
ENV NODE_ENV=production
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/.next ./.next
COPY --from=build /app/public ./public
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/next.config.ts ./next.config.ts
COPY --from=build /app/next.user-config.ts ./next.user-config.ts
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=10s --retries=3 CMD node -e "fetch('http://localhost:3000/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"
# Migrate on boot so the container recovers its own schema, then serve.
CMD ["sh", "-c", "npx prisma migrate deploy && npm run start -- --port ${PORT:-3000}"]
