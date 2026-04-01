import re

from conftest import BASE_URL
from playwright.sync_api import Page, expect


def test_browser_homepage_renders(page: Page):
    page.goto(BASE_URL)
    expect(page.get_by_text("Simulation Monitor is a")).to_be_visible()


def test_browser_renders_monitor(browser_monitor: Page):
    expect(browser_monitor.get_by_role("heading", name="Sound")).to_be_visible()


def test_browser_renders_controller(browser_controller: Page):
    expect(browser_controller.get_by_text("Pulse Oximeter 😮‍💨")).to_be_visible()


def test_browser_renders_sliders(browser_controller: Page):
    browser_controller.get_by_test_id("controller-heart-rate").fill("160")
    expect(browser_controller.locator("#cardiac")).to_contain_text("HR 160")


def test_browser_renders_monitor_controller_pair(
    browser_monitor_controller_pair: tuple[Page, Page],
):
    monitor, controller = browser_monitor_controller_pair
    expect(controller.get_by_text("Pulse Oximeter 😮‍💨")).to_be_visible()
    expect(monitor.get_by_role("heading", name="Sound")).to_be_visible()


def test_sending_heart_rate(browser_monitor_controller_pair: tuple[Page, Page]):
    monitor, controller = browser_monitor_controller_pair
    controller.get_by_test_id("controller-heart-rate").fill("140")
    controller.get_by_role("button", name="Send").click()
    expect(monitor.get_by_test_id("monitor-readout-heart-rate")).to_contain_text(
        "1"
    )  # wobbles, so it won't always be exactly 140


def test_gradual_transition(browser_monitor_controller_pair: tuple[Page, Page]):
    monitor, controller = browser_monitor_controller_pair
    controller.locator("#cardiac").get_by_role("slider").fill("200")
    controller.get_by_text("30s").click()
    controller.get_by_role("button", name="Send").click()

    monitor.wait_for_timeout(2000)

    hr_str: str = (
        monitor.get_by_test_id("monitor-readout-heart-rate").text_content() or "0"
    )
    hr_int = int(hr_str)

    # assuming starts at 67, should be 75 by the time two seconds pass
    assert hr_int > 70
    assert hr_int < 100


def test_nibp_toggle_push_state(
    browser_monitor_controller_pair: tuple[Page, Page],
):
    monitor, controller = browser_monitor_controller_pair

    nibp_timer_widget = monitor.get_by_test_id("readout-nibp-timer")

    expect(nibp_timer_widget).not_to_be_visible()

    controller.get_by_test_id("controller-nibp-auto").click()

    expect(nibp_timer_widget).to_be_visible()


def test_nibp_button_push_state(
    browser_monitor_controller_pair: tuple[Page, Page],
):
    monitor, controller = browser_monitor_controller_pair

    sbp_readout = monitor.get_by_test_id("readout-nibp-sbp-delayed")
    dbp_readout = monitor.get_by_test_id("readout-nibp-dbp-delayed")
    nibp_button = controller.get_by_test_id("controller-nibp-run-now")

    expect(sbp_readout).to_be_visible()
    expect(dbp_readout).to_be_visible()

    nibp_button.click()

    expect(sbp_readout).to_be_visible()
    expect(dbp_readout).not_to_be_visible()


def test_enabling_and_disabling_monitors(
    browser_monitor_controller_pair: tuple[Page, Page],
):
    monitor, controller = browser_monitor_controller_pair

    input = controller.get_by_test_id("controller-enabler-spo2-primary")
    output = monitor.get_by_test_id("monitor-readout-spo2")

    input.set_checked(True)
    controller.get_by_role("button", name="Send").click()
    expect(output).to_have_text(re.compile(r"\d+"))

    input.set_checked(False)
    controller.get_by_role("button", name="Send").click()
    expect(output).to_have_text("--")


def test_controller_checkbox_sync(
    browser_controller: Page,
):

    primary = browser_controller.get_by_test_id("controller-enabler-spo2-primary")
    mirror = browser_controller.get_by_test_id("controller-enabler-spo2-mirror")

    browser_controller.get_by_text("Alive").click()
    primary.set_checked(True)
    browser_controller.get_by_text("Arrested").click()
    expect(mirror).to_be_checked()

    browser_controller.get_by_text("Alive").click()
    primary.set_checked(False)
    browser_controller.get_by_text("Arrested").click()
    expect(mirror).not_to_be_checked()

    browser_controller.get_by_text("Arrested").click()
    mirror.set_checked(True)
    browser_controller.get_by_text("Alive").click()
    expect(primary).to_be_checked()

    browser_controller.get_by_text("Arrested").click()
    mirror.set_checked(False)
    browser_controller.get_by_text("Alive").click()
    expect(primary).not_to_be_checked()


def test_controller_slider_sync(
    browser_controller: Page,
):

    primary = browser_controller.get_by_test_id("controller-heart-rate")
    mirror = browser_controller.get_by_test_id("controller-heart-rate-mirror")

    primary.fill("200")
    expect(mirror).to_have_value("200")

    mirror.fill("100")
    expect(primary).to_have_value("100")


# investigation sending
# investigation drawer
# abg machine renders
# testing js is removed
# sim-value targeting
# nibp animation
# nibp update on controller -> not before cycle -> appears after cycle
