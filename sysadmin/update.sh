#! /bin/bash

docker compose -f compose.base.yaml down
git pull git@github.com:samnunn/gasnotes-simulator.git
./build.sh
./run.sh
# sudo systemctl restart gasnotes-simulator.service