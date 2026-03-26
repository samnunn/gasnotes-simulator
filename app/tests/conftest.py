import pytest
from flask import Flask
from flask.testing import FlaskClient
from sim import make_app

# FIXTURES


@pytest.fixture(scope="session")
def test_app() -> Flask:
    app: Flask = make_app()
    app.config["RATELIMIT_ENABLED"] = False
    return app


@pytest.fixture(scope="session")
def test_client(test_app: Flask) -> FlaskClient:
    test_client: FlaskClient = test_app.test_client()
    return test_client


@pytest.fixture(scope="session")
def test_app_ratelimited() -> Flask:
    app = test_app()
    return app


@pytest.fixture(scope="session")
def test_client_ratelimited(test_app_ratelimited: Flask) -> FlaskClient:
    return test_app_ratelimited.test_client()
