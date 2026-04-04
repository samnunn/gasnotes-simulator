import re

import bs4
from flask import Flask, url_for
from flask.testing import FlaskClient

from app.lib import room_helpers
from app.lib.state import DEFAULT_DATA


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


def test_all_input_parameters_are_present_in_default_data(
    test_client: FlaskClient, test_app: Flask
):
    with test_app.app_context():
        room_id = room_helpers.open_sim_room()

    with test_app.test_request_context("/"):
        url = url_for("sim_controller", sim_room_id=room_id)

    response = test_client.get(url)
    soup = bs4.BeautifulSoup(response.text, "html.parser")

    found_keys: set[str] = set()
    known_keys: set[str] = set(DEFAULT_DATA.keys())

    tags_with_inputs = soup.find_all(lambda tag: tag.has_attr("data-sim-input"))

    for tag in tags_with_inputs:
        inputs_string: str = str(tag["data-sim-input"])
        inputs_list: list[str] = inputs_string.split(" ")

        for i in inputs_list:
            parameter, *methods = i.split(":")
            found_keys.add(parameter)
            if len(methods) > 0:
                assert methods[0] in ["checked", "value"], (
                    f"Controller input for parameter '{parameter}' referenced method '{methods[0]}', which does not exist"
                )

    assert found_keys.issubset(known_keys), (
        f"Controller has referenced the following parameters that do not exist in the default data: {found_keys.difference(known_keys)}"
    )


def test_all_output_parameters_are_present_in_default_data(
    test_client: FlaskClient, test_app: Flask
):
    with test_app.app_context():
        room_id = room_helpers.open_sim_room()

    with test_app.test_request_context("/"):
        url = url_for("sim_monitor", sim_room_id=room_id)

    response = test_client.get(url)
    soup = bs4.BeautifulSoup(response.text, "html.parser")

    found_keys: set[str] = set()
    known_keys: set[str] = set(DEFAULT_DATA.keys())

    tags_with_outputs = soup.find_all(lambda tag: tag.has_attr("data-sim-parameters"))

    for tag in tags_with_outputs:
        outputs_string: str = str(tag["data-sim-parameters"])
        outputs_list: list[str] = outputs_string.split(" ")

        for o in outputs_list:
            parameter: str = o.split(":")[0]
            found_keys.add(parameter)

    assert found_keys.issubset(known_keys), (
        f"Monitor has referenced the following parameters that do not exist in the default data: {found_keys.difference(known_keys)}"
    )
