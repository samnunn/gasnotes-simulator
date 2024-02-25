#! /bin/sh
cd "$(dirname "$0")"
cd ..
# rm Pipfile.lock
# ~/.pyenv/shims/pipenv --rm
# ~/.pyenv/shims/pipenv --clear
mkdir sim_rooms
~/.pyenv/shims/pipenv install
~/.pyenv/shims/pipenv run gunicorn --worker-class eventlet -w 1 -p 127.0.0.1:8000 sim:app