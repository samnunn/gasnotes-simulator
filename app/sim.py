from flask import Flask, render_template, session, redirect, request, url_for, abort
from werkzeug.exceptions import HTTPException
from flask_minify import Minify
from flask_socketio import SocketIO, emit, join_room, leave_room, close_room
import segno
import json
import random
import string
import os
import re
import time

#    _____      __
#   / ___/___  / /___  ______
#   \__ \/ _ \/ __/ / / / __ \
#  ___/ /  __/ /_/ /_/ / /_/ /
# /____/\___/\__/\__,_/ .___/
#                    /_/

app = Flask(__name__)
# Minify(app=app, bypass=[re.compile(r'^\/sim\/\w+\/?$')])
socketio = SocketIO(app)
app.secret_key = BASE_URL = os.environ.get('SIM_SECRETKEY')

SIM_ROOM_STORE = 'sim_rooms'

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
    open(sim_path, 'w').write(str(current_time))
    return current_time

def generate_qrcode(url):
    qrcode = segno.make(url)
    return qrcode.svg_data_uri(scale=10, dark='black', border = 0)

def generate_full_url(sim_room_id, request):
    return request.host_url.strip('/') + url_for('sim_room_monitor', sim_room_id=sim_room_id)

def generate_room_id():
    while True:
        propsed_id = ''.join(random.choices('ABCDEFGHIJKLMNPQRSTUVWXYZ123456789', k=6)) # no O or 0 here!
        propsed_id = normalise_room_id(propsed_id)
        if sim_room_exists(propsed_id) == False:
            return propsed_id

def normalise_room_id(sim_room_id):
    return sim_room_id.upper()

def make_sim_room_filepath(sim_room_id):
    sim_room_id = normalise_room_id(sim_room_id)
    return os.path.join(SIM_ROOM_STORE, sim_room_id + '.txt')


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
    data['demo'] = True
    data['title'] = "Gas Notes – Simulation Monitor"
    data['new_sim_url'] = url_for('sim_room_new')
    data['monitor_html'] = render_template('monitor.html', data=data)
    data['controller_html'] = render_template('controller.html', data=data)
    return render_template('homepage.html', data=data)
    # return redirect('https://gasnotes.net/tools')

@app.route("/new")
def sim_room_new():
    sim_room_id = open_sim_room()
    return redirect(url_for('sim_room_monitor', sim_room_id=sim_room_id))

@app.route("/connect")
def sim_room_connect():
    # Assemable page data
    data = {}
    data['title'] = "Gas Notes – Simulation Monitor"

    return render_template('connect.html', data=data)

@app.route("/about")
def sim_about():
    # Assemable page data
    data = {}
    data['title'] = "Gas Notes – About"

    return render_template('about.html', data=data)


@app.route("/code", methods=['POST'], defaults={'simcode': None})
def handle_simcode(simcode):
    sim_room_id = request.form.get('simcode')
    sim_room_id = normalise_room_id(sim_room_id)

    if sim_room_exists(sim_room_id):
        return redirect(url_for('sim_room_monitor', sim_room_id=sim_room_id))
    else:
        abort(404, 'This sim room does not exist.')

@app.route("/sim/<string:sim_room_id>")
def sim_room_monitor(sim_room_id):
    # Normalise SimCode (upper case)
    sim_room_id = normalise_room_id(sim_room_id)

    # Validate SimCode
    if bool(re.match(r'^[a-zA-Z0-9]{6}$', sim_room_id)) == False:
        abort(400, 'Invalid SimCode.')

    # Check that room exists
    if not sim_room_exists(sim_room_id):
        abort(404, 'This sim room does not exist.')

    # Assemable page data
    data = {}
    data['title'] = "Gas Notes – Simulation Monitor"
    data['sim_room_id'] = sim_room_id
    data['demo'] = False
    data['new_sim_url'] = url_for('sim_room_new')
    data['full_url'] = generate_full_url(sim_room_id, request)
    data['index_url'] = url_for('sim_room_monitor', sim_room_id=sim_room_id)
    data['controller_url'] = url_for('sim_room_monitor', sim_room_id=sim_room_id, mode='controller')
    data['monitor_url'] = url_for('sim_room_monitor', sim_room_id=sim_room_id, mode='monitor')
    data['qrcode'] = generate_qrcode(data['full_url'])

    # Return page (contingent on mode= argument)
    mode = request.args.get('mode')
    if mode == "monitor":
        data['title'] = "Sim Monitor"
        return render_template('monitor.html', data=data)
    elif mode == "controller":
        data['title'] = "Sim Controller"
        return render_template('controller.html', data=data)

    # Fallback: if no mode is specified, return the sim index
    return render_template('sim_index.html', data=data)

@app.route("/waves")
def wave_test_rig():
    return render_template('wavetest.html')
@app.route("/livewaves")
def new_wavemaker():
    return render_template('wavegen_tester.html')

# ERRORS
@app.errorhandler(HTTPException)
def handle_error(error):
    if (error.code == 404):
        error.description = 'Not found.'
    return render_template('error.html', data={'error': error}), error.code

#    _____            __        __
#   / ___/____  _____/ /_____  / /______
#   \__ \/ __ \/ ___/ //_/ _ \/ __/ ___/
#  ___/ / /_/ / /__/ ,< /  __/ /_(__  )
# /____/\____/\___/_/|_|\___/\__/____/

@socketio.on('connect')
def handle_connect(auth):
    sim_room_id = auth['sim_room_id']
    join_room(sim_room_id)
    print(f"🚨 SocketIO fired the 'connect' event. Client was added to room {sim_room_id}")

# @socketio.on('disconnect')
# def handle_connect():
#     print("🚨 SocketIO fired the 'disconnect' event.")

@socketio.on('sim-update')
def handle_sim_update(data):
    data = json.loads(data)
    sim_room_id = data['sim_room_id']

    # Only send an update if the sim room exists
    if sim_room_exists(sim_room_id):
        update_sim_room(sim_room_id)
        emit('sim-update', json.dumps(data), to=sim_room_id)
    else:
        print(f'🚨 SocketIO received a `sim-update` for a non-exitent sim room. Passing.')
