import json
import os
import random
from pathlib import Path

from flask import current_app


def sim_room_exists(sim_room_id):
    sim_room_id = normalise_room_id(sim_room_id)
    sim_path = get_sim_room_path_from_id(sim_room_id)
    return os.path.exists(sim_path)


def open_sim_room():
    sim_room_id = generate_room_id()
    sim_room_path = get_sim_room_path_from_id(sim_room_id)
    Path(sim_room_path).touch()
    return sim_room_id


def update_sim_room_data_by_id(sim_room_id, data=[]):
    sim_path = get_sim_room_path_from_id(sim_room_id)
    json.dump(data, open(sim_path, "w"))
    return True


def get_sim_room_data(sim_room_id):
    sim_path = get_sim_room_path_from_id(sim_room_id)
    data = json.load(open(sim_path, "r"))
    return data


def generate_room_id():
    while True:
        propsed_id = "".join(
            random.choices("ABCDEFGHJKLMNPQRSTUVWXYZ23456789", k=6)
        )  # skips 1, I, 0, O
        propsed_id = normalise_room_id(propsed_id)
        if not sim_room_exists(propsed_id):
            return propsed_id


def normalise_room_id(sim_room_id):
    return sim_room_id.upper()


def get_sim_room_path_from_id(sim_room_id):
    sim_room_id = normalise_room_id(sim_room_id)
    path_relative = os.path.join(
        current_app.config.get("SIM_ROOM_STORE"), sim_room_id + ".txt"
    )
    path_absolute = Path(path_relative).absolute()
    return path_absolute
