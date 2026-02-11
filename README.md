# Simulation Monitor 😴

<img width="200" src="app/static/img/monitorpanel.svg" alt="" align="right" />

**[Simulation Monitor][gasnotes-sim] is a remote-controlled bedside monitor.**

Simulation is a great way to build strengths and find weaknesses in your self, your team, and your system without putting patients in harm’s way.

This software was created so that simulation tools would be freely available to all.

## Usage

Simulation Monitor is designed to be _reasonably_ self-explanatory to the non-technical user.

<p align="center"><b><a href="https://sim.gasnotes.net">You can check out Simulation Monitor online right now.</a></b></p>

From the homepage, visitors are presented with two options: start a new sim or join an existing one (with a SimCode). Success in either option brings users to an already-running virtual bedside monitor, which prompts users to connect a controller device.

Facilitators can adjust:

- Heart rate
- ECG morphology
- Blood pressure (SBP, DBP and MAP)
- Arterial line morphology
- Respiratory rate
- SpO<sub>2</sub>
- Plethysmograph morphology
- etCO<sub>2</sub>
- Capnograph morphology
- NIBP (including optional auto-cycling)

Pending changes are stored and sent _en bloc_ at the facilitator's request. There are options to gradually transition parameters and enable/disable traces as desired.

Participants can:

- Pause alarms
- Enable/disable sounds
- Review [investigations](#investigations)
- Check an NIBP (including optional auto-cycling)

## Investigations

Facilitators can choose from a curated list of investigations to send to the monitor:

- Arterial and venous gasses (using the Gas Notes ABG Machine)
- BSL and ketones
- Plain chest x-rays (from various contributors on [Radiopedia][radiopedia])
- Echocardiograms (from [Show Me The POCUS][smtp])

## Architecture

Simulation Monitor uses a client-server architecture to avoid all the headaches of P2P connection in potentially-hostile corporate networks. That means that **the [hosted version][gasnotes-sim] requires an internet connection**.

<p align="center">
    <img width="500" src="app/static/img/sim_server_architecture.svg" alt="" />
</p>

The server component is written in Python using the excellent [Flask][flask] framework. Message passing between clients and the server is done with WebSockets via [SocketIO][socketio] (made easy in Flask with [Flask-SocketIO][flask-socketio]).

### Persistence

For the sake of simplicity, each active SimCode is stored as a text file in `./sim_rooms`. The most recent state of each sim room is stored in that file.

## Self-Hosting

The [hosted version][gasnotes-sim] runs happily on the smallest [DigitalOcean Droplet](https://m.do.co/c/5248daea7efd) (affiliate link). If you are looking to host your own, check out the [sysadmin notes](sysadmin/SYSADMIN.md).

## Open Source

Simulation Monitor is released under the [MIT License](LICENSE.txt). This software makes use of these open source projects:

- [Flask][flask] (BSD-3-Clause License)
- [Flask-SocketIO][flask-socketio] (MIT License)
- [SocketIO][socketio] (MIT License)
- [pyenv](https://github.com/pyenv/pyenv) (MIT License)
- [pipenv](https://github.com/pypa/pipenv) (MIT License)
- [Homebrew](https://github.com/Homebrew/brew) (BSD-2-Clause License)
- [cloudflared](https://github.com/cloudflare/cloudflared) (Apache-2.0 License)
- [Tailscale](https://github.com/tailscale/tailscale) (BSD-3-Clause License)
- [Twemoji](https://github.com/twitter/twemoji) for the pager (📟) favicon (CC-BY 4.0 License)
    - Converted to .ico via [favicon.io](https://favicon.io/)

And these closed-source ones:

- [Monodraw](https://monodraw.helftone.com/) for the ASCII art
- [Flat UI Colors 2](https://flatuicolors.com/)

[flask]: https://flask.palletsprojects.com
[flask-socketio]: https://flask-socketio.readthedocs.io/en/latest/
[flask-session]: https://flask.palletsprojects.com/en/3.0.x/quickstart/#sessions
[gasnotes]: https://gasnotes.net
[gasnotes-sim]: https://sim.gasnotes.net
[socketio]: https://socket.io
[homebrew]: https://brew.sh/
[smtp]: https://www.showmethepocus.com/
[radiopedia]: https://radiopaedia.org/?lang=us
