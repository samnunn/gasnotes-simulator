#! /bin/bash
(
    cd ./app || exit 1

    export RATELIMIT_ENABLED=0
    export SIM_ROOM_STORE=sim_rooms
    export SECRET_KEY=dummy_secret_key

    uv run flask --app app.wsgi:app --debug run --host=0.0.0.0 --port=8069
)