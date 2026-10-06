# inference-service/Dockerfile
# ─────────────────────────────────────────────────────────────────
# Multi-stage: builder installs deps, runner is a slim image.
# Uses tensorflow-cpu (no GPU required in the container).
# ─────────────────────────────────────────────────────────────────

FROM python:3.11-slim AS builder

WORKDIR /build

# System deps for Pillow / numpy compilation
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc libglib2.0-0 libsm6 libxext6 libxrender-dev \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --upgrade pip && \
    pip install --no-cache-dir --prefix=/install -r requirements.txt


# ── Runner ────────────────────────────────────────────────────────
FROM python:3.11-slim AS runner

WORKDIR /app

# Copy installed packages from builder
COPY --from=builder /install /usr/local

# Copy application code
COPY app/ ./app/

# Labels and models are mounted at runtime via ECS volume or env override.
# During local dev (docker-compose) they are bind-mounted from ml/models/.
COPY --chown=1000:1000 app/ ./app/

ENV MODEL_DIR=/app/models \
    LABELS_PATH=/app/labels.json \
    MODEL_VERSION=0.0.1-dummy \
    MAX_IMAGE_SIZE_MB=10 \
    LOW_CONFIDENCE_THRESHOLD=0.60 \
    PYTHONUNBUFFERED=1

# Non-root user for security
RUN useradd -u 1000 -m appuser && chown -R appuser /app
USER appuser

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/health')"

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1"]
