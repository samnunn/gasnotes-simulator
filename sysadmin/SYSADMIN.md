# System Administration Notes

> **A hosted version of the Gas Notes Simulator is available for free at [sim.gasnotes.net][gasnotes-sim]**

## Where to Host
The [free version available at Gas Notes][gasnotes-sim] is a happy little [monolith](https://signalvnoise.com/svn3/the-majestic-monolith/) that runs on the smallest [DigitalOcean Droplet](https://m.do.co/c/5248daea7efd) (referral link) but you can run this software anyplace you like.

## System Setup
Once you've spun up a new Linux box (I'm using Debian), you should create a new `sim` user with sudo privileges.

```sh
adduser sim
usermod -aG sudo sim
```

### SSH
Then you'll need to set up ssh and get your public key onto the server.

```sh
mkdir ~/.ssh
touch ~/.ssh/authorized_keys
echo <YOUR ID_RSA.PUB HERE> >> ~/.ssh/authorized_keys
chmod 700 /home/sim/.ssh
chmod 600 /home/sim/.ssh/authorized_keys
systemctl restart sshd
```

> ⚠️ You should really consider disabling root login via ssh by replacing `PermitRootLogin yes` with `PermitRootLogin no` in `/etc/ssh/sshd_config` (and run `systemctl restart sshd` thereafter).

### Homebrew
Then it's time to get the Simulator's requirements installed. For the sake of familiarity, I stuck with [homebrew][Homebrew] because that’s what I use on my Mac.

```sh
## Get homebrew
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Give it the tools to build software
sudo apt-get install build-essential
brew install gcc
```

## Git

Now it's time to pull this repo onto your server.

```sh
cd ~
git clone git@github.com:samnunn/gasnotes-simulator.git
```

### Python
The Python binary and pip dependencies for this project are managed with `pyenv` and `pipenv`, respectively.

```sh
cd gasnotes-simulator
brew install pyenv
pyenv install
pip install pipenv
pipenv install
```

When using `pipenv`, make sure to have this in your `.profile`.

```bash
# Tell pyenv where to phone home
export PYENV_ROOT="$HOME/.pyenv"
# Tell pyenv where to find its executables
command -v pyenv >/dev/null || export PATH="$PYENV_ROOT/bin:$PATH"
# Install pyenv shims
eval "$(pyenv init -)"
```

### Secrets Management
[Flask-SocketIO][flask-socketio] requires Flask's [sessions][flask-session] feature to be enabled, which mandates the creation of a secret key.

```sh
# Generate a secret token using Python (suggested method from Flask's documentation)
secret_key=$(python -c 'import secrets; print(secrets.token_hex())')
# Save the secret token as SIM_SECRETKEY in the .env file
echo "SIM_SECRETKEY=$secret_key" > .env
```

Variables stored in a `.env` file are automatically turned into environment variables when the server is launched with `pipenv`. If you choose not to use `pipenv`, you'll need to find another way to get `SIM_SECRETKEY` into your environment.

## Running It

```sh
sudo ln -s /home/sim/gasnotes-simulator/sysadmin/gasnotes-simulator.service /etc/systemd/system/
sudo systemctl daemon-reload
systemctl start gasnotes-simulator.service
systemctl enable gasnotes-simulator.service
```

`systemctl stop/start/restart/status gasnotes-simulator.service`

## Access
### Cloudflare
Leaving ports on your server open to the big bad internet is risky business. Instead of running gunicorn behind a reverse proxy (like nginx), I've opted to use Cloudflare's zero-ingress [Tunnels](https://www.cloudflare.com/en-au/products/tunnel/). They provide both `http` access to the app and [`ssh` access to the server](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/use-cases/ssh/).

```sh
brew install cloudflared
````

In order to use SSH via Cloudflare Tunnels, you need to add this little snippet to your local machine’s `~/.ssh/config` (as pere [these instructions](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/use-cases/ssh/#connect-to-ssh-server-with-cloudflared-access)).

```sh
Host ssh.example.com
ProxyCommand /home/linuxbrew/.linuxbrew/bin/cloudflared access ssh --hostname %h
```

Now you can do something like this:

```sh
ssh sim@sim-server.example.com
```

### Tailscale
I've also installed [Tailscale](https://tailscale.com/): a Wireguard-based low/no configuration VPN for the modern era. [Nerds like it](https://www.caseyliss.com/2024/3/27/tailscale) because It Just Works™️.

```sh
brew install tailscale
````

To get it running as a service, I used `brew services` like so. You might also take this chance to enable [Tailscale SSH](https://tailscale.com/tailscale-ssh):

```sh
sudo --preserve-env=HOME /home/linuxbrew/.linuxbrew/bin/brew services start tailscale
tailscale up --ssh
```

> I Specifically needed the `--preserve-env=HOME` because `brew` wasn't finding its cache, so was trying to redownload binaries as root and (rather sensibly) failing to do so. Evidently this is configuration issue with sudo on Debian: it doesn't preserve the $HOME and $PATH variables! That's why I had to manually ask it to preserve $HOME and provide the full path to `brew`.

How you SSH into the machine depends on what hostname you gave it in your Tailnet. Your might be something like this.

```sh
ssh sim@my-sim-server
```

[flask]: https://flask.palletsprojects.com
[flask-socketio]: https://flask-socketio.readthedocs.io/en/latest/
[flask-session]: https://flask.palletsprojects.com/en/3.0.x/quickstart/#sessions
[gasnotes]: https://gasnotes.net
[gasnotes-sim]: https://sim.gasnotes.net
[socketio]: https://socket.io
[homebrew]: https://brew.sh/