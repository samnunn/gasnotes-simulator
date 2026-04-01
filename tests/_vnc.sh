#!/bin/bash

# DO NOT USE ON HOST
# TO BE STARTED WITHIN THE TEST-RUNNER DOCKER CONTAINER

set -euo pipefail

: "${VNC_PASSWORD:?VNC_PASSWORD must be set}"

# Run the virtual X server on a fixed display so Playwright can open headed browsers.
export DISPLAY=:99

# Clean up stale X lock/socket files from previous container runs.
if [ -f /tmp/.X99-lock ]; then
    rm -f /tmp/.X99-lock
fi

if [ -S /tmp/.X11-unix/X99 ]; then
    rm -f /tmp/.X11-unix/X99
fi

# Start an in-memory X server for headed browser tests.
Xvfb :99 -screen 0 1440x900x24 &

# Wait until the display is accepting connections before starting the window manager.
until xdpyinfo -display "$DISPLAY" >/dev/null 2>&1; do
    sleep 0.2
done

# Openbox provides a minimal window manager; x11vnc exposes the display over VNC.
openbox >/tmp/openbox.log 2>&1 &
mkdir -p /root/.vnc
x11vnc -storepasswd "$VNC_PASSWORD" /root/.vnc/passwd >/tmp/x11vnc-passwd.log 2>&1
x11vnc -display "$DISPLAY" -forever -shared -listen 0.0.0.0 -rfbport 5900 -rfbauth /root/.vnc/passwd >/tmp/x11vnc.log 2>&1 &

# Capture pytest's exit code so the script can continue to any cleanup/reporting that follows.
set +e
PWDEBUG=1 uv run --no-sync python -m pytest -v --headed
test_exit_code=$?
set -e
