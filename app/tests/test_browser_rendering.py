from conftest import BASE_URL
from playwright.sync_api import Page, expect


def test_browser_homepage_renders(page: Page):
    page.goto(BASE_URL)
    expect(page.get_by_text("Simulation Monitor is a")).to_be_visible()


def test_browser_rendering_monitor(browser_monitor: Page):
    expect(browser_monitor.get_by_role("heading", name="Sound")).to_be_visible()


def test_browser_rendering_controller(browser_controller: Page):
    expect(browser_controller.get_by_text("Pulse Oximeter 😮‍💨")).to_be_visible()
