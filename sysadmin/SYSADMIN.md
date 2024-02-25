# System Administration Notes

> **A hosted version of the Gas Notes Simulator is available for free at [sim.gasnotes.net][gasnotes-sim]**

## Where to Host
The [free version available at Gas Notes][gasnotes-sim] is a happy little [monolith](https://signalvnoise.com/svn3/the-majestic-monolith/) that runs on the smallest [DigitalOcean Droplet](https://m.do.co/c/5248daea7efd) (referral link) but you can run this software anyplace you like.

## System Setup
Once you've spun up a new Linux box (of any flavour), you should create a new `sim` user with sudo privileges.

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

To stop.
`systemctl stop gasnotes-simulator.service`

- Script
- Service installation

## Egress
### Cloudflare Tunnels


## Remote Access
Accessing a server via `ssh` is all well and good, but leaving port 22 open to the big bad world had ought to give any sysadmin chills.

To remedy those chills, I have installed two separate remote access services.

### Tailscale
[Tailscale](https://tailscale.com/) (and more recently [Tailscale SSH](https://tailscale.com/tailscale-ssh)) is a Wireguard-based low/no configuration VPN for the modern era. [Nerds like it](https://www.caseyliss.com/2024/3/27/tailscale) because It Just Works™️.

```sh
brew install tailscale
````

To get it running as a service, I used `brew services` like so.

```sh
sudo --preserve-env=HOME /home/linuxbrew/.linuxbrew/bin/brew services start tailscale
tailscale up --ssh
```

> I Specifically needed the `--preserve-env=HOME` because `brew` wasn't finding its cache, so was trying to redownload binaries as root and (rather sensibly) failing to do so. Evidently this is configuration issue with sudo on Debian: it doesn't preserve the $HOME and $PATH variables! That's why I had to manually ask it to preserve $HOME and provide the full path to `brew`.

How you SSH into the machine depends on what hostname you gave it in your Tailnet. Your might be something like this.

```sh
ssh sim@my-sim-server
```

### Cloudflare Tunnels
Cloudflare tunnels pull double duty on this server. In addition to providing a zero-ingress web server, you can also SSH into your machines. I used [these instructions](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/use-cases/ssh/#connect-to-ssh-server-with-cloudflared-access) to get it set up.

Don’t forget to add this to your local machine’s `~/.ssh/config`.

```sh
Host ssh.example.com
ProxyCommand /home/linuxbrew/.linuxbrew/bin/cloudflared access ssh --hostname %h
```

Now you can SSH in just like this.

```sh
ssh sim@sim-server.example.com
```

---–--------------------------
  
## Convenience Scripts
### Updating
./sysadmin/update.sh

### Reverse Proxy
```sh
ssh -f -L 127.0.0.1:8090:127.0.0.1:8090 sim@ssh.gasnotes.net
```


[flask]: https://flask.palletsprojects.com
[flask-socketio]: https://flask-socketio.readthedocs.io/en/latest/
[flask-session]: https://flask.palletsprojects.com/en/3.0.x/quickstart/#sessions
[gasnotes]: https://gasnotes.net
[gasnotes-sim]: https://sim.gasnotes.net
[socketio]: https://socket.io
[homebrew]: https://brew.sh/