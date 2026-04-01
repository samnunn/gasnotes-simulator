#! /bin/bash

cat <<'EOF'

   _____ _              ______          __                              
  / ___/(_)___ ___     /_  __/__  _____/ /____  _____                   
  \__ \/ / __ `__ \     / / / _ \/ ___/ __/ _ \/ ___/                   
 ___/ / / / / / / /    / / /  __(__  ) /_/  __/ /                       
/____/_/_/ /_/ /_/    /_/  \___/____/\__/\___/_/                                                                                         
EOF

if ! curl -fsS http://127.0.0.1:8069/ >/dev/null 2>&1; then
  echo -e "======================= ERROR ======================\n"
  echo -e "Expected a copy of the app to be running at http://127.0.0.1:8069\n"
  exit 1
fi

(

    export RATELIMIT_ENABLED=0
    export SIM_ROOM_STORE=sim_rooms
    export SECRET_KEY=dummy_secret_key
    export SIM_TEST_SERVER_ADDR=http://127.0.0.1:8069

    uv tool run playwright install chromium
    uv run python -m pytest --verbose --numprocesses 4 --browser chromium
)