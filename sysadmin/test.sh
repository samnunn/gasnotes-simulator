#! /bin/bash

cat <<'EOF'

   _____ _              ______          __                              
  / ___/(_)___ ___     /_  __/__  _____/ /____  _____                   
  \__ \/ / __ `__ \     / / / _ \/ ___/ __/ _ \/ ___/                   
 ___/ / / / / / / /    / / /  __(__  ) /_/  __/ /                       
/____/_/_/ /_/ /_/    /_/  \___/____/\__/\___/_/  


================= CONTAINER EDITION =================

EOF

docker compose -f compose.test.yaml up --build --abort-on-container-exit test-server test-runner
