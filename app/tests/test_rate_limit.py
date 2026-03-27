from flask import Flask, Response
from flask.testing import FlaskClient


def test_ratelimiting_disabled_in_test_environment(test_app: Flask):
    assert test_app.config.get("RATELIMIT_ENABLED") is False


def test_ratelimiting_fast(
    test_app_ratelimited: Flask, test_client_ratelimited: FlaskClient
):
    assert test_app_ratelimited.config["RATELIMIT_ENABLED"] is True

    for i in range(0, 20):
        test_client_ratelimited.get("/")

    limited_response: Response = test_client_ratelimited.get("/")
    assert limited_response.status_code == 429
