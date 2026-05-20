FROM node:20-bookworm-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    CODEX_HOME=/data/codex \
    HOME=/data/codex

WORKDIR /app

ARG CODEX_CLI_VERSION=latest

RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 python3-pip python3-venv ca-certificates git \
  && rm -rf /var/lib/apt/lists/*

RUN npm install -g "@openai/codex@${CODEX_CLI_VERSION}"

COPY requirements.txt .
RUN python3 -m venv /opt/venv \
  && /opt/venv/bin/pip install --no-cache-dir -r requirements.txt

COPY app.py .

RUN mkdir -p /data/codex /workspace \
  && useradd --system --create-home --home-dir /data/codex --shell /usr/sbin/nologin app \
  && chown -R app:app /app /data/codex /workspace

USER app
ENV PATH="/opt/venv/bin:${PATH}"

CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8020"]
