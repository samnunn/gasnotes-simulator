# base
FROM ghcr.io/astral-sh/uv:python3.14-bookworm-slim AS base
WORKDIR /simulator
EXPOSE 8069
RUN apt-get update \
&& apt-get install -y --no-install-recommends nodejs npm curl \
&& npm install -g esbuild \
&& rm -rf /var/lib/apt/lists/*
COPY uv.lock pyproject.toml .python-version .
RUN uv sync --frozen

# base server
FROM base AS base_server

COPY app /simulator/app
CMD uv run --no-sync gunicorn -b 0.0.0.0:8069 --worker-class gevent -w 1 app.wsgi:app

# dev server
FROM base_server AS dev_server

COPY app /simulator/app
CMD uv run --no-sync flask --app app.wsgi:app --debug run --host=0.0.0.0 --port=8069

# test runner
FROM base AS test_runner
RUN uv tool run playwright install-deps
RUN uv tool run playwright install chromium

COPY app /simulator/app
COPY tests /simulator/tests
CMD uv run --no-sync python -m pytest --verbose --numprocesses 4 --browser chromium

# test runner (headed)
FROM test_runner AS test_runner_headed
RUN apt-get update \
    && apt-get install -y --no-install-recommends xvfb openbox x11vnc x11-utils \
    && rm -rf /var/lib/apt/lists/*
COPY tests/_vnc.sh /usr/local/bin/start-headed-tests.sh
RUN chmod +x /usr/local/bin/start-headed-tests.sh
EXPOSE 5900

COPY app /simulator/app
CMD ["/usr/local/bin/start-headed-tests.sh"]
