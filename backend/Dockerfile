FROM python:3.12.8-slim-bookworm

WORKDIR /app

# Runtime GDAL only; avoid libgdal-dev to keep builds fast on low-end hosts.
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    gdal-bin \
    libgdal32 \
    && rm -rf /var/lib/apt/lists/*

ENV GDAL_CONFIG=/usr/bin/gdal-config \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PIP_NO_CACHE_DIR=1

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY alembic.ini ./
COPY alembic ./alembic
COPY app ./app

EXPOSE 8000

HEALTHCHECK --interval=10s --timeout=5s --start-period=40s --retries=6 \
    CMD curl -f http://127.0.0.1:8000/api/v1/health/live || exit 1

CMD ["sh", "-c", "alembic upgrade head && python -m app.cli seed-demo && python -m app.cli apply-credentials && uvicorn app.main:app --host 0.0.0.0 --port 8000"]
