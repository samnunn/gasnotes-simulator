# base
FROM ghcr.io/astral-sh/uv:python3.14-bookworm-slim AS base
EXPOSE 8069
WORKDIR /app
RUN apt-get update \
    && apt-get install -y --no-install-recommends nodejs npm curl \
    && npm install -g esbuild \
    && rm -rf /var/lib/apt/lists/*
COPY pyproject.toml uv.lock .python-version ./
RUN uv sync --frozen

# base server
FROM base AS base_server
COPY . .
CMD uv run --no-sync gunicorn -b 0.0.0.0:8069 --worker-class eventlet -w 1 wsgi:app

# dev server
FROM base_server AS dev_server
CMD uv run --no-sync flask --app wsgi:app --debug run --host=0.0.0.0 --port=8069

# test runner
FROM base AS test_runner
RUN uv tool run playwright install-deps
RUN uv tool run playwright install chromium webkit
COPY . .
CMD uv run --no-sync python -m pytest --verbose --numprocesses 4 --browser webkit --browser chromium

# test runner (headed)
FROM test_runner AS test_runner_headed
RUN apt-get update \
    && apt-get install -y --no-install-recommends xvfb openbox x11vnc x11-utils \
    && rm -rf /var/lib/apt/lists/*
COPY start-headed-tests.sh /usr/local/bin/start-headed-tests.sh
RUN chmod +x /usr/local/bin/start-headed-tests.sh
EXPOSE 5900
CMD ["/usr/local/bin/start-headed-tests.sh"]
