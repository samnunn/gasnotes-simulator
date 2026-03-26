import os

from sim import app, socketio

app.config["RATELIMIT_ENABLED"] = False

try:
    from sim import limiter

    limiter.enabled = False
except Exception:
    pass


if __name__ == "__main__":
    socketio.run(
        app,
        host="127.0.0.1",
        port=int(os.environ["PORT"]),
        use_reloader=False,
        allow_unsafe_werkzeug=True,
    )
