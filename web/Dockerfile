# web/Dockerfile
# ─────────────────────────────────────────────────────────────────
# Stage 1: Build React app
# Stage 2: Serve with nginx (static files only)
# ─────────────────────────────────────────────────────────────────

FROM node:20-slim AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY public/ ./public/
COPY src/ ./src/

# Build args for runtime env vars baked at build time
ARG REACT_APP_API_URL=/api
ARG REACT_APP_INFERENCE_URL=""

ENV REACT_APP_API_URL=$REACT_APP_API_URL \
    REACT_APP_INFERENCE_URL=$REACT_APP_INFERENCE_URL

RUN npm run build


# ── Runner: nginx ─────────────────────────────────────────────────
FROM nginx:1.27-alpine AS runner

# Copy built assets
COPY --from=builder /app/build /usr/share/nginx/html

# nginx config: SPA routing (all routes → index.html)
RUN echo 'server { \
  listen 80; \
  root /usr/share/nginx/html; \
  index index.html; \
  # Cache static assets aggressively \
  location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|tflite|wasm)$ { \
    expires 1y; \
    add_header Cache-Control "public, immutable"; \
  } \
  # Service worker must not be cached \
  location = /sw.js { \
    add_header Cache-Control "no-cache, no-store, must-revalidate"; \
  } \
  # SPA fallback \
  location / { \
    try_files $uri $uri/ /index.html; \
  } \
}' > /etc/nginx/conf.d/default.conf

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
    CMD wget -q --spider http://localhost/ || exit 1
