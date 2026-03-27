#! /bin/bash

cat <<'EOF'

   _____ _              ______          __                              
  / ___/(_)___ ___     /_  __/__  _____/ /____  _____                   
  \__ \/ / __ `__ \     / / / _ \/ ___/ __/ _ \/ ___/                   
 ___/ / / / / / / /    / / /  __(__  ) /_/  __/ /                       
/____/_/_/ /_/ /_/    /_/  \___/____/\__/\___/_/  

============= CONTAINER HEADED EDITION =============

VNC server: localhost:5901
VNC password: sim

EOF

docker compose -f compose.test.yaml up --abort-on-container-exit --build test-server test-runner-headed