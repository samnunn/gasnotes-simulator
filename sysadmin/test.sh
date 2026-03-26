#!/bin/bash

# echo "Downloading test browsers..."
# uv tool run playwright install chromium webkit

# uv run python -m pytest --numprocesses 4 --browser webkit --browser chromium app/tests/ -v

echo "Running tests (containerised)..."
docker compose -f compose.test.yaml up --abort-on-container-exit --build