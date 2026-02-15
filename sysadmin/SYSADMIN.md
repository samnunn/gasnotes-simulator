# System Administration Notes

> **A hosted version of the Simulation Monitor is available for free at [sim.gasnotes.net][gasnotes-sim]**

## Where to Host

The [free version available at Gas Notes][gasnotes-sim] is a happy little [monolith](https://signalvnoise.com/svn3/the-majestic-monolith/) that runs on the smallest [DigitalOcean Droplet](https://m.do.co/c/5248daea7efd) (referral link) but you can run this on anything machine Git and Docker installed.

## Init

```sh
git clone git@github.com:samnunn/gasnotes-simulator.git
cd gasnotes-simualtor
chmod +x ./sysadmin/run.sh
./sysadmin/run.sh
```

### Secrets

[Flask-SocketIO][flask-socketio] uses Flask's [sessions][flask-session] feature, which mandates the creation of a secret key.

```sh
# Generate a secret token using Python (suggested method from Flask's documentation)
secret_key=$(python -c 'import secrets; print(secrets.token_hex())')
# Save the secret token as SIM_SECRETKEY in the .env file
echo "SIM_SECRETKEY=$secret_key" > .env
```

Variables stored in a `.env` file are automatically piped into the app's environment by Docker Compose.

## Updating

To update Simulation Monitor, simply run:

```sh
cd simulation-monitor
./sysadmin/update.sh
```

## Access

Leaving ports on your server open to the big bad internet is risky business. I highly suggest running [no-ingress server](https://nunn.au/2025/02/07/zero-ingress) using [Cloudflare Tunnels](https://www.cloudflare.com/en-au/products/tunnel/). They provide both `http` access to the app and [`ssh` access to the host](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/use-cases/ssh/).

You might also consider hooking your Docker host up to [Tailscale](https://tailscale.com/).

[flask]: https://flask.palletsprojects.com
[flask-socketio]: https://flask-socketio.readthedocs.io/en/latest/
[flask-session]: https://flask.palletsprojects.com/en/3.0.x/quickstart/#sessions
[gasnotes]: https://gasnotes.net
[gasnotes-sim]: https://sim.gasnotes.net
[socketio]: https://socket.io
[homebrew]: https://brew.sh/
