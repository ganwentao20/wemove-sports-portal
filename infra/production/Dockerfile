# syntax=docker/dockerfile:1
ARG NODE_IMAGE=node:22-bookworm-slim
FROM ${NODE_IMAGE} AS dependencies
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates openssl && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
RUN --mount=type=cache,target=/root/.npm npm ci --ignore-scripts
COPY apps/api/prisma apps/api/prisma
RUN npm run prisma:generate

FROM dependencies AS api-build
COPY apps/api/tsconfig*.json apps/api/nest-cli.json apps/api/
COPY apps/api/src apps/api/src
RUN npm run build:api

FROM api-build AS migrate
ENV NODE_ENV=production
WORKDIR /app/apps/api
USER node
ENTRYPOINT ["node", "/app/node_modules/prisma/build/index.js", "migrate", "deploy", "--schema", "prisma/schema.prisma"]

FROM dependencies AS production-dependencies
RUN npm prune --omit=dev --ignore-scripts && mkdir -p /app/apps/api/node_modules

FROM ${NODE_IMAGE} AS api
ENV NODE_ENV=production PORT=8080
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates openssl && rm -rf /var/lib/apt/lists/*
COPY --from=production-dependencies /app/node_modules ./node_modules
COPY --from=production-dependencies /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=api-build /app/apps/api/dist ./apps/api/dist
COPY apps/api/assets ./apps/api/assets
COPY package.json ./package.json
COPY apps/api/package.json ./apps/api/package.json
COPY scripts/ops-metrics.mjs scripts/ops-metrics.mjs
RUN mkdir -p /app/apps/api/media_private && chown -R node:node /app/apps/api/media_private
USER node
WORKDIR /app/apps/api
EXPOSE 8080
HEALTHCHECK --interval=20s --timeout=5s --start-period=30s --retries=3 CMD node -e "fetch('http://127.0.0.1:8080/api/v1/health/ready').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "dist/main.js"]

FROM dependencies AS web-build
ARG API_PROXY_TARGET=http://api:8080
ARG NEXT_PUBLIC_SITE_URL
ARG DEPLOYMENT_ENV=production
ENV API_PROXY_TARGET=${API_PROXY_TARGET} NEXT_PUBLIC_SITE_URL=${NEXT_PUBLIC_SITE_URL} DEPLOYMENT_ENV=${DEPLOYMENT_ENV} NEXT_TELEMETRY_DISABLED=1
COPY apps/web apps/web
RUN npm run build:web

FROM ${NODE_IMAGE} AS web
ENV NODE_ENV=production PORT=3000 HOSTNAME=0.0.0.0 NEXT_TELEMETRY_DISABLED=1
WORKDIR /app
COPY --from=web-build --chown=node:node /app/apps/web/.next/standalone ./
COPY --from=web-build --chown=node:node /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=web-build --chown=node:node /app/apps/web/public ./apps/web/public
USER node
EXPOSE 3000
HEALTHCHECK --interval=20s --timeout=5s --start-period=30s --retries=3 CMD node -e "fetch('http://127.0.0.1:3000').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "apps/web/server.js"]

FROM ${NODE_IMAGE} AS scanner
ENV NODE_ENV=production SCANNER_PORT=8081
WORKDIR /app
COPY scripts/ops-scanner.mjs ./ops-scanner.mjs
USER node
EXPOSE 8081
HEALTHCHECK --interval=30s --timeout=5s --start-period=2m --retries=3 CMD node -e "fetch('http://127.0.0.1:8081/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "ops-scanner.mjs"]

FROM postgres:16-bookworm AS postgres
RUN apt-get update && apt-get install -y --no-install-recommends pgbackrest && rm -rf /var/lib/apt/lists/*
COPY infra/production/postgres-entrypoint.sh /usr/local/bin/wemove-postgres-entrypoint
RUN chmod 755 /usr/local/bin/wemove-postgres-entrypoint
ENTRYPOINT ["/usr/local/bin/wemove-postgres-entrypoint"]
CMD ["postgres"]
