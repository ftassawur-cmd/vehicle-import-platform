# ── Stage 1: build the web app (engine TS is compiled in-graph by Vite) ──
FROM node:22-alpine AS build
WORKDIR /repo

# Workspace context the web build needs: engine sources + config seeds
COPY packages/calc-engine ./packages/calc-engine
COPY config ./config

# Install with a clean, lockfile-exact tree, then build
COPY apps/web/package.json apps/web/package-lock.json ./apps/web/
RUN npm --prefix apps/web ci --no-audit --no-fund
COPY apps/web ./apps/web
RUN npm --prefix apps/web run typecheck && npm --prefix apps/web run build

# ── Stage 2: serve ──
FROM nginx:1.27-alpine
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /repo/apps/web/dist /usr/share/nginx/html

EXPOSE 80
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://127.0.0.1/healthz || exit 1
