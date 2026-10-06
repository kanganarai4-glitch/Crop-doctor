# api/Dockerfile
# ─────────────────────────────────────────────────────────────────
FROM node:20-slim AS runner

WORKDIR /app

# Copy dependency manifests first (layer caching)
COPY package*.json ./

# Production install only
RUN npm ci --omit=dev && npm cache clean --force

# Copy source
COPY src/ ./src/

ENV NODE_ENV=production \
    PORT=3001

# Non-root user
RUN useradd -u 1001 -m appuser && chown -R appuser /app
USER appuser

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3001/health', r => { process.exit(r.statusCode === 200 ? 0 : 1) })"

CMD ["node", "src/index.js"]
