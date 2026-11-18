# Stage 1: Build del frontend (React + Vite)
FROM node:22-alpine AS frontend-builder

WORKDIR /app/frontend

COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci

COPY frontend/ ./

ARG VITE_API_URL=/api
ARG VITE_CONTACT_EMAIL=
ENV VITE_API_URL=${VITE_API_URL}
ENV VITE_CONTACT_EMAIL=${VITE_CONTACT_EMAIL}

RUN npm run build

# Stage 2: Dependencias de produccion del backend
FROM node:22-alpine AS backend-deps

WORKDIR /app/backend

COPY backend/package.json backend/package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Stage 3: Imagen final de produccion
FROM node:22-alpine

RUN addgroup -S credia && adduser -S -G credia credia

WORKDIR /app/backend

COPY backend/package.json backend/package-lock.json ./
COPY --from=backend-deps /app/backend/node_modules ./node_modules
COPY backend/ ./
COPY --from=frontend-builder /app/frontend/dist /app/frontend/dist
COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh

RUN sed -i 's/\r$//' /usr/local/bin/docker-entrypoint.sh \
    && chmod +x /usr/local/bin/docker-entrypoint.sh \
    && chown -R credia:credia /app

ENV NODE_ENV=production
ENV PORT=3000
ENV FRONTEND_DIST_PATH=/app/frontend/dist

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD node -e "fetch('http://127.0.0.1:' + (process.env.PORT || 3000) + '/api/health').then((r) => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

USER credia

ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
