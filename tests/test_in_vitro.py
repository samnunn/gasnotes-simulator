import re

from flask import Flask
from flask.testing import FlaskClient

from app.lib import room_helpers


def test_fixtures_working(test_client: FlaskClient, test_app: Flask):
    assert test_app.debug is False


def test_homepage_renders(test_client: FlaskClient):
    response = test_client.get("/")

    assert response.status_code == 200

    html = response.get_data(as_text=True)
    assert "Simulation Monitor" in html


def test_new_redirects_to_new_monitor_room(test_client: FlaskClient, test_app: Flask):
    response = test_client.get("/new", follow_redirects=False)

    assert response.status_code == 302
    location = response.headers["Location"]
    assert re.fullmatch(r"/sim/[A-Z0-9]{6}/monitor", location)

    room_id = location.split("/")[2]
    with test_app.app_context():
        assert room_helpers.sim_room_exists(room_id)


def test_connect_form_rendering(test_client: FlaskClient):
    response = test_client.get("/connect")

    assert response.status_code == 200
    assert "Enter the simulation" in response.get_data(as_text=True)


def test_connect_post_redirects_to_controller_for_existing_room(
    test_client: FlaskClient, test_app: Flask
):
    with test_app.app_context():
        room_id = room_helpers.open_sim_room()

    response = test_client.post(
        "/connect", data={"simcode": room_id.lower()}, follow_redirects=False
    )

    assert response.status_code == 302
    assert response.headers["Location"] == f"/sim/{room_id}/controller"


def test_connect_post_404s_for_missing_room(test_client: FlaskClient):
    response = test_client.post("/connect", data={"simcode": "ABC123"})

    assert response.status_code == 404
    assert "Not found." in response.get_data(as_text=True)


def test_sim_index_rejects_invalid_room_codes(test_client: FlaskClient):
    response = test_client.get("/sim/not-valid")

    assert response.status_code == 400
    assert "Invalid SimCode." in response.get_data(as_text=True)


def test_sim_index_404_for_missing_valid_room(test_client: FlaskClient):
    response = test_client.get("/sim/ABC123")

    assert response.status_code == 404
    assert "Not found." in response.get_data(as_text=True)


def test_monitor_page_404s_without_existing_room(test_client: FlaskClient):
    response = test_client.get("/sim/ABC123/monitor")

    assert response.status_code == 404


def test_controller_page_404s_without_existing_room(test_client: FlaskClient):
    response = test_client.get("/sim/ABC123/controller")

    assert response.status_code == 404
