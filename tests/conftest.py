import os
from urllib.parse import urljoin

import pytest
from flask import Flask
from flask.testing import FlaskClient
from playwright.sync_api import BrowserContext, Page

from app.sim import make_app

BASE_URL: str = os.environ.get("SIM_TEST_SERVER_ADDR", "http://127.0.0.1:8609")


@pytest.fixture(scope="session")
def test_app() -> Flask:
    return make_app({"RATELIMIT_ENABLED": False})


@pytest.fixture(scope="session")
def test_client(test_app: Flask) -> FlaskClient:
    test_client: FlaskClient = test_app.test_client()
    return test_client


@pytest.fixture(scope="session")
def test_app_ratelimited() -> Flask:
    return make_app({"RATELIMIT_ENABLED": True})


@pytest.fixture(scope="session")
def test_client_ratelimited(test_app_ratelimited: Flask) -> FlaskClient:
    return test_app_ratelimited.test_client()


@pytest.fixture(scope="function")
def browser_controller(page: Page):
    page.goto(urljoin(BASE_URL, "new"))
    page.get_by_role("link", name="Switch to Controller").click()
    return page


@pytest.fixture(scope="function")
def browser_monitor(page: Page):
    page.goto(urljoin(BASE_URL, "new"))
    page.get_by_role("button", name="Open Simulation").click()
    return page


@pytest.fixture(scope="function")
def browser_monitor_controller_pair(context: BrowserContext) -> tuple[Page, Page]:
    monitor_page = context.new_page()
    monitor_page.goto(urljoin(BASE_URL, "new"))
    monitor_page.get_by_role("button", name="Open Simulation").click()
    controller_page = context.new_page()
    controller_page.goto(monitor_page.url.replace("/monitor", "/controller"))

    return monitor_page, controller_page
