import json
import logging
import os
import random
import re
import string
import time
from enum import Enum

import segno
from flask import Flask, abort, redirect, render_template, request, session, url_for
from flask_minify import Minify
from flask_socketio import SocketIO, close_room, emit, join_room, leave_room
from werkzeug.exceptions import HTTPException

#    _____      __
#   / ___/___  / /___  ______
#   \__ \/ _ \/ __/ / / / __ \
#  ___/ /  __/ /_/ /_/ / /_/ /
# /____/\___/\__/\__,_/ .___/
#                    /_/

app = Flask(__name__)
# Minify(app=app, bypass=[re.compile(r'^\/sim\/\w+\/?$')])
socketio = SocketIO(app)
app.secret_key = os.environ.get("SIM_SECRETKEY")

SIM_ROOM_STORE = "sim_rooms"

logger = logging.getLogger(__name__)


#     __  __     __                   __  ___     __  __              __
#    / / / /__  / /___  ___  _____   /  |/  /__  / /_/ /_  ____  ____/ /____
#   / /_/ / _ \/ / __ \/ _ \/ ___/  / /|_/ / _ \/ __/ __ \/ __ \/ __  / ___/
#  / __  /  __/ / /_/ /  __/ /     / /  / /  __/ /_/ / / / /_/ / /_/ (__  )
# /_/ /_/\___/_/ .___/\___/_/     /_/  /_/\___/\__/_/ /_/\____/\__,_/____/
#             /_/
def sim_room_exists(sim_room_id):
    sim_room_id = normalise_room_id(sim_room_id)
    sim_path = make_sim_room_filepath(sim_room_id)
    return os.path.exists(sim_path)


def open_sim_room():
    sim_room_id = generate_room_id()
    update_sim_room(sim_room_id)
    return sim_room_id


def update_sim_room(sim_room_id):
    current_time = time.time()
    sim_path = make_sim_room_filepath(sim_room_id)
    open(sim_path, "w").write(str(current_time))
    return current_time


def generate_qrcode(url):
    qrcode = segno.make(url)
    return qrcode.svg_data_uri(scale=10, dark="black", border=0)


def generate_full_url(sim_room_id, request):
    return request.host_url.strip("/") + url_for(
        "sim_room_monitor", sim_room_id=sim_room_id
    )


def generate_room_id():
    while True:
        propsed_id = "".join(
            random.choices("ABCDEFGHIJKLMNPQRSTUVWXYZ123456789", k=6)
        )  # no O or 0 here!
        propsed_id = normalise_room_id(propsed_id)
        if sim_room_exists(propsed_id) == False:
            return propsed_id


def normalise_room_id(sim_room_id):
    return sim_room_id.upper()


def make_sim_room_filepath(sim_room_id):
    sim_room_id = normalise_room_id(sim_room_id)
    return os.path.join(SIM_ROOM_STORE, sim_room_id + ".txt")


#     ____       ____                            ___    ______
#    / __ )___  / __/___  ________       __     /   |  / __/ /____  _____
#   / __  / _ \/ /_/ __ \/ ___/ _ \   __/ /_   / /| | / /_/ __/ _ \/ ___/
#  / /_/ /  __/ __/ /_/ / /  /  __/  /_  __/  / ___ |/ __/ /_/  __/ /
# /_____/\___/_/  \____/_/   \___/    /_/    /_/  |_/_/  \__/\___/_/


# @app.before_request
# @app.after_request

#     ____              __
#    / __ \____  __  __/ /____  _____
#   / /_/ / __ \/ / / / __/ _ \/ ___/
#  / _, _/ /_/ / /_/ / /_/  __(__  )
# /_/ |_|\____/\__,_/\__/\___/____/


@app.route("/")
def index():
    data = {}
    data["demo"] = True
    data["title"] = "Gas Notes – Simulation Monitor"
    data["new_sim_url"] = url_for("sim_room_new")
    data["monitor_html"] = render_template("monitor.html", data=data)
    data["controller_html"] = render_template("controller.html", data=data)
    return render_template("homepage.html", data=data)
    # return redirect('https://gasnotes.net/tools')


@app.route("/new")
def sim_room_new():
    sim_room_id = open_sim_room()
    return redirect(url_for("sim_room_monitor", sim_room_id=sim_room_id))


@app.route("/connect")
def sim_room_connect():
    # Assemable page data
    data = {}
    data["title"] = "Gas Notes – Simulation Monitor"

    return render_template("connect.html", data=data)


@app.route("/about")
def sim_about():
    # Assemable page data
    data = {}
    data["title"] = "Gas Notes – About"

    return render_template("about.html", data=data)


@app.route("/code", methods=["POST"], defaults={"simcode": None})
def handle_simcode(simcode):
    sim_room_id = request.form.get("simcode")
    sim_room_id = normalise_room_id(sim_room_id)

    if sim_room_exists(sim_room_id):
        return redirect(url_for("sim_room_monitor", sim_room_id=sim_room_id))
    else:
        abort(404, "This sim room does not exist.")


@app.route("/sim/<string:sim_room_id>")
def sim_room_monitor(sim_room_id):
    # Normalise SimCode (upper case)
    sim_room_id = normalise_room_id(sim_room_id)

    # Validate SimCode
    if bool(re.match(r"^[a-zA-Z0-9]{6}$", sim_room_id)) == False:
        abort(400, "Invalid SimCode.")

    # Check that room exists
    if not sim_room_exists(sim_room_id):
        abort(404, "This sim room does not exist.")

    # Assemable page data
    data = {}
    data["title"] = "Gas Notes – Simulation Monitor"
    data["sim_room_id"] = sim_room_id
    data["demo"] = False
    data["new_sim_url"] = url_for("sim_room_new")
    data["full_url"] = generate_full_url(sim_room_id, request)
    data["index_url"] = url_for("sim_room_monitor", sim_room_id=sim_room_id)
    data["controller_url"] = url_for(
        "sim_room_monitor", sim_room_id=sim_room_id, mode="controller"
    )
    data["monitor_url"] = url_for(
        "sim_room_monitor", sim_room_id=sim_room_id, mode="monitor"
    )
    data["qrcode"] = generate_qrcode(data["full_url"])

    # Return page (contingent on mode= argument)
    mode = request.args.get("mode")
    if mode == "monitor":
        data["title"] = "Sim Monitor"
        return render_template("monitor.html", data=data)
    elif mode == "controller":
        data["title"] = "Sim Controller"
        return render_template("controller.html", data=data)

    # Fallback: if no mode is specified, return the sim index
    return render_template("sim_index.html", data=data)


@app.route("/wavedesign")
def wave_test_rig():
    return render_template("wavedesign.html")


@app.route("/wavetiming")
def new_wavemaker():
    return render_template("wavetiming.html")


@app.route("/tx")
def tx():
    data = {
        "sim_room_id": "demo",
        "txrx_mode": "transmitter",
    }
    return render_template("tx.html", data=data)


@app.route("/rx")
def rx():
    data = {
        "sim_room_id": "demo",
        "txrx_mode": "receiver",
    }
    return render_template("rx.html", data=data)


# ERRORS
@app.errorhandler(HTTPException)
def handle_error(error):
    if error.code == 404:
        error.description = "Not found."
    return render_template("error.html", data={"error": error}), error.code


#    _____            __        __
#   / ___/____  _____/ /_____  / /______
#   \__ \/ __ \/ ___/ //_/ _ \/ __/ ___/
#  ___/ / /_/ / /__/ ,< /  __/ /_(__  )
# /____/\____/\___/_/|_|\___/\__/____/

WT_ROOMS = {}


@socketio.on("connect")
def handle_connect(auth):
    sim_room_id = auth["sim_room_id"]
    if sim_room_id not in WT_ROOMS:
        WT_ROOMS[sim_room_id] = {}
    join_room(sim_room_id)
    print(
        f"🚨 SocketIO fired the 'connect' event. Client was added to room {sim_room_id}"
    )


@socketio.on("sim-walkietalkie-nominate")
def handle_walkietalkie_nomination(data):
    data = json.loads(data)

    sim_room_id = data["sim_room_id"]
    client_type = data["client_type"]
    client_id = data["client_id"]

    WT_ROOMS[sim_room_id][client_type] = client_id

    if "transmitter" and "receiver" in WT_ROOMS[sim_room_id]:
        payload = json.dumps(
            {
                "sim_room_id": sim_room_id,
                "transmitter": WT_ROOMS[sim_room_id]["transmitter"],
                "receiver": WT_ROOMS[sim_room_id]["receiver"],
            }
        )
        emit("sim-walkietalkie-connection-description", payload, to=sim_room_id)


@socketio.on("sim-update")
def handle_sim_update(data):
    data = json.loads(data)
    sim_room_id = data["sim_room_id"]

    # Only send an update if the sim room exists
    if sim_room_exists(sim_room_id):
        update_sim_room(sim_room_id)
        emit("sim-update", json.dumps(data), to=sim_room_id)
    else:
        print(
            "🚨 SocketIO received a `sim-update` for a non-exitent sim room. Passing."
        )


@socketio.on("sim-post")
def handle_sim_post(data):
    data = json.loads(data)
    sim_room_id = data["sim_room_id"]

    # Only send an update if the sim room exists
    if sim_room_exists(sim_room_id):
        update_sim_room(sim_room_id)
        emit("sim-post", json.dumps(data), to=sim_room_id)
    else:
        print("🚨 SocketIO received a `sim-post` for a non-exitent sim room. Passing.")


@socketio.on("sim-walkietalkie-signal")
def forward_webrtc_signal_to_room(envelope):
    # {
    #     "sim_room_id": str,
    #     "transmitter": str,
    #     "receiver": str,
    #     "signal": sdp junk,
    # }
    data = json.loads(envelope)
    emit(
        "sim-walkietalkie-signal",
        envelope,
        to=data["sim_room_id"],
        include_self=False,
    )
