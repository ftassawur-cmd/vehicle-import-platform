# ── JSL Imports API (NestJS · Prisma 7 rust-free · @jsl/calc-engine) ──
#
# Build from the REPO ROOT:  docker build -f docker/api.Dockerfile -t jsl-imports/api .
#
# The image keeps the monorepo layout (/app/apps/api, /app/packages/calc-engine,
# /app/prisma, /app/config) so the `file:../../packages/calc-engine` dependency
# symlink and the seed's ../../../config path both resolve unchanged.

# ── deps + build ──────────────────────────────────────────────────────
FROM node:22-alpine AS build
WORKDIR /app

# Engine first (dependency of the api)
COPY packages/calc-engine/package*.json packages/calc-engine/
RUN npm --prefix packages/calc-engine ci --no-audit --no-fund
COPY packages/calc-engine/tsconfig*.json packages/calc-engine/
COPY packages/calc-engine/src packages/calc-engine/src
RUN npm --prefix packages/calc-engine run build

# API deps (postinstall may fetch the Prisma schema-engine used by `migrate`;
# needs network — standard in any real build environment)
COPY apps/api/package*.json apps/api/
RUN npm --prefix apps/api ci --no-audit --no-fund

# Prisma client generation needs the schema + config
COPY prisma prisma
COPY prisma.config.ts .
RUN npm --prefix apps/api run prisma:generate

# Compile the API (generated client compiles in-tree → dist/generated)
COPY apps/api/tsconfig*.json apps/api/
COPY apps/api/src apps/api/src
COPY apps/api/prisma apps/api/prisma
COPY config config
RUN npm --prefix apps/api run build

# ── runtime ───────────────────────────────────────────────────────────
FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production

# Full node_modules is copied (not --omit=dev) because `prisma migrate deploy`
# runs at container start; the CLI lives in devDependencies. Trading ~80 MB of
# image for a self-migrating container is the right call at this stage.
COPY --from=build /app/packages/calc-engine packages/calc-engine
COPY --from=build /app/apps/api/node_modules apps/api/node_modules
COPY --from=build /app/apps/api/dist apps/api/dist
COPY --from=build /app/apps/api/package.json apps/api/
COPY --from=build /app/apps/api/prisma apps/api/prisma
COPY --from=build /app/prisma prisma
COPY --from=build /app/prisma.config.ts .
COPY --from=build /app/config config

EXPOSE 3000
HEALTHCHECK --interval=15s --timeout=4s --start-period=25s --retries=5 \
  CMD wget -qO- http://127.0.0.1:3000/v1/health | grep -q '"db":"ok"' || exit 1

WORKDIR /app/apps/api
# Apply committed migrations, then serve. Seed is a separate one-off:
#   docker compose exec api npm run db:seed
CMD ["sh", "-c", "npx prisma migrate deploy --config ../../prisma.config.ts && node dist/main.js"]
