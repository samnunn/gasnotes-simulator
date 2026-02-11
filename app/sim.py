import json
import os
import re

import segno
from flask import Flask, abort, redirect, render_template, request, url_for
from flask_assets import Environment
from flask_caching import Cache
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from flask_socketio import SocketIO, emit, join_room
from lib import custom_jinja_tools, radiology_tools, room_helpers
from lib.custom_webassets_filters import ESBuildFilter
from webassets.filter import register_filter
from werkzeug.exceptions import HTTPException

#    _____      __
#   / ___/___  / /___  ______
#   \__ \/ _ \/ __/ / / / __ \
#  ___/ /  __/ /_/ /_/ / /_/ /
# /____/\___/\__/\__,_/ .___/
#                    /_/

# constants
DEBUG = os.environ.get("DEBUG", "0") == "1"

# flask
app = Flask(__name__)
app.debug = DEBUG
app.secret_key = os.environ.get("SIM_SECRETKEY")

# socketio
socketio = SocketIO(app)

# flask-assets
assets = Environment(app)
if DEBUG:
    assets.cache = False
    assets.manifest = False
register_filter(ESBuildFilter)

# flask-limiter
limiter = Limiter(
    get_remote_address,
    app=app,
    default_limits=["1000 per day"],
    storage_uri="memory://",
)
default_error_message = "Rate limit exceeded. Please try again later."
limit_fast = limiter.shared_limit(
    "5/second;50/minute;1000/day", scope="simrooms", error_message=default_error_message
)
limit_slow = limiter.shared_limit(
    "1/second;5/minute;100/day", scope="simrooms", error_message=default_error_message
)

# flask-cache
cache_config = {"CACHE_TYPE": "SimpleCache", "CACHE_DEFAULT_TIMEOUT": 300}
if app.debug:
    cache_config["CACHE_TYPE"] = "null"  # disables caching globally
cache = Cache(app, config=cache_config)

#     ____              __
#    / __ \____  __  __/ /____  _____
#   / /_/ / __ \/ / / / __/ _ \/ ___/
#  / _, _/ /_/ / /_/ / /_/  __(__  )
# /_/ |_|\____/\__,_/\__/\___/____/


@app.route("/")
@limit_fast
@cache.cached(timeout=600)
def index():
    data = {}
    data["demo"] = True
    data["title"] = "Simulation Monitor"
    data["last_known_state"] = {}
    data["monitor_html"] = render_template("sim_views/sim_monitor.html", data=data)
    data["controller_html"] = render_template(
        "sim_views/sim_controller.html", data=data
    )
    data["demo"] = False
    return render_template("pages/homepage.html", data=data)


@app.route("/new")
@limit_slow
def sim_new():
    sim_room_id = room_helpers.open_sim_room()
    return redirect(url_for("sim_monitor", sim_room_id=sim_room_id))


@app.route("/connect", methods=["GET", "POST"])
@limit_slow
@cache.cached(timeout=600)
def sim_connect():
    if request.method == "GET":
        # Assemable page data
        data = {}
        data["title"] = "Simulation Monitor - Connect"
        return render_template("sim_views/sim_connect.html", data=data)
    elif request.method == "POST":
        sim_room_id = request.form.get("simcode")
        sim_room_id = room_helpers.normalise_room_id(sim_room_id)

        if room_helpers.sim_room_exists(sim_room_id):
            return redirect(url_for("sim_controller", sim_room_id=sim_room_id))
        else:
            abort(404, "This sim room does not exist.")


@app.route("/sim/<string:sim_room_id>")
@limit_fast
def sim_index(sim_room_id):
    # Normalise SimCode (upper case)
    sim_room_id = room_helpers.normalise_room_id(sim_room_id)

    # Validate SimCode
    if not bool(re.match(r"^[a-zA-Z0-9]{6}$", sim_room_id)):
        abort(400, "Invalid SimCode.")

    # Check that room exists
    if not room_helpers.sim_room_exists(sim_room_id):
        abort(404, "This sim room does not exist.")

    # Assemable page data
    data = {}
    data["title"] = f"Sim Room ({sim_room_id})"
    data["sim_room_id"] = sim_room_id

    return render_template("sim_views/sim_index.html", data=data)


@app.route("/sim/<string:sim_room_id>/monitor")
@limit_fast
@cache.cached(timeout=5)
def sim_monitor(sim_room_id):
    # Normalise SimCode (upper case)
    sim_room_id = room_helpers.normalise_room_id(sim_room_id)

    # Validate SimCode
    if not bool(re.match(r"^[a-zA-Z0-9]{6}$", sim_room_id)):
        abort(400, "Invalid SimCode.")

    data = {}
    data["sim_room_id"] = sim_room_id
    data["title"] = f"Monitor ({sim_room_id.upper()})"

    # get existing data (if available)
    data["last_known_state"] = {}
    try:
        existing_data = room_helpers.get_sim_room_data(sim_room_id)
        data["last_known_state"] = existing_data
    except Exception:
        app.logger.error(f"Unable to pull last-known state for sim room {sim_room_id}")

    return render_template("sim_views/sim_monitor.html", data=data)


@app.route("/sim/<string:sim_room_id>/controller")
@limit_fast
@cache.cached(timeout=5)
def sim_controller(sim_room_id):
    # Normalise SimCode (upper case)
    sim_room_id = room_helpers.normalise_room_id(sim_room_id)

    # Validate SimCode
    if not bool(re.match(r"^[a-zA-Z0-9]{6}$", sim_room_id)):
        abort(400, "Invalid SimCode.")

    data = {}
    data["sim_room_id"] = sim_room_id
    data["title"] = f"Controller ({sim_room_id.upper()})"

    # get existing data (if available)
    data["last_known_state"] = {}
    try:
        existing_data = room_helpers.get_sim_room_data(sim_room_id)
        data["last_known_state"] = existing_data
    except Exception:
        app.logger.error(f"Unable to pull last-known state for sim room {sim_room_id}")

    return render_template(
        "sim_views/sim_controller.html",
        data=data,
    )


if app.debug:

    @app.route("/wavedesign")
    def wave_test_rig():
        return render_template("pages/wavedesign.html")

    @app.route("/wavetiming")
    def new_wavemaker():
        return render_template("pages/wavetiming.html")


@app.errorhandler(HTTPException)
def handle_error(error):
    # override default 404 message
    if error.code == 404:
        error.description = "Not found."

    data = {"error": error, "title": f"Sim Error {error.code}"}

    # return generic error template
    return render_template("pages/error.html", data=data), error.code


#    _____            __        __
#   / ___/____  _____/ /_____  / /______
#   \__ \/ __ \/ ___/ //_/ _ \/ __/ ___/
#  ___/ / /_/ / /__/ ,< /  __/ /_(__  )
# /____/\____/\___/_/|_|\___/\__/____/


@socketio.on("connect")
def handle_connect(auth):
    sim_room_id = auth["sim_room_id"]
    join_room(sim_room_id)

    app.logger.info(
        f"🚨 SocketIO fired the 'connect' event. Client was added to room {sim_room_id}"
    )


# routine parameter updates
@socketio.on("sim-update")
def handle_sim_update(data):
    json_data = json.loads(data)
    sim_room_id = json_data["sim_room_id"]
    sim_room_id = room_helpers.normalise_room_id(sim_room_id)

    # Only send an update if the sim room exists
    if room_helpers.sim_room_exists(sim_room_id):
        room_helpers.update_sim_room(sim_room_id, json_data)
        emit("sim-update", data, to=sim_room_id)
        app.logger.info(f"Relayed sim-update to room {sim_room_id}: {repr(json_data)}")
    else:
        app.logger.info(
            "🚨 SocketIO received a `sim-update` for a non-exitent sim room. Passing."
        )


# sendable investigations (e.g. CXR)
@socketio.on("sim-ix")
def handle_sim_ix(data):
    json_data = json.loads(data)
    sim_room_id = json_data["sim_room_id"]

    # Only send an update if the sim room exists
    if room_helpers.sim_room_exists(sim_room_id):
        emit("sim-ix", data, to=sim_room_id)
        app.logger.info(f"Relayed sim-ix to room {sim_room_id}: {repr(json_data)}")
    else:
        app.logger.info(
            "🚨 SocketIO received a `sim-ix` for a non-exitent sim room. Passing."
        )


@socketio.on("sim-run-nibp")
def handle_sim_run_nibp(data):
    data = json.loads(data)
    sim_room_id = data["sim_room_id"]

    # Only send an update if the sim room exists
    if room_helpers.sim_room_exists(sim_room_id):
        emit("sim-run-nibp", json.dumps(data), to=sim_room_id)


@socketio.on("sim-nibp-state-update")
def handle_sim_nibp_state_update(data):
    json_data = json.loads(data)
    sim_room_id = json_data["sim_room_id"]
    sim_room_id = room_helpers.normalise_room_id(sim_room_id)

    # Only send an update if the sim room exists
    if room_helpers.sim_room_exists(sim_room_id):
        emit("sim-nibp-state-update", data, to=sim_room_id, include_self=False)
        app.logger.info(
            f"Relayed sim-nibp-state-update to room {sim_room_id}: {repr(json_data)}"
        )
    else:
        app.logger.info(
            "🚨 SocketIO received a `sim-nibp-state-update` for a non-exitent sim room. Passing."
        )


#     __  __     __                   __  ___     __  __              __
#    / / / /__  / /___  ___  _____   /  |/  /__  / /_/ /_  ____  ____/ /____
#   / /_/ / _ \/ / __ \/ _ \/ ___/  / /|_/ / _ \/ __/ __ \/ __ \/ __  / ___/
#  / __  /  __/ / /_/ /  __/ /     / /  / /  __/ /_/ / / / /_/ / /_/ (__  )
# /_/ /_/\___/_/ .___/\___/_/     /_/  /_/\___/\__/_/ /_/\____/\__,_/____/
#             /_/


@cache.memoize(timeout=600)
def generate_qrcode(url):
    qrcode = segno.make(url)
    return qrcode.svg_data_uri(scale=10, dark="black", border=0)


@app.context_processor
def add_jinja2_helpers():
    return dict(
        qrcode=generate_qrcode,
        radiology=radiology_tools.get_radiology_images,
        value_autoselect=custom_jinja_tools.value_autoselect,
        enabled=custom_jinja_tools.enabled,
        checked=custom_jinja_tools.checked,
    )
