import { io } from '/static/js/socket.io.esm.min.js';

export class WalkieTalkieConnection {
    constructor(mode, sim_room_id, stream = null) {
        this.mode = mode;
        this.sim_room_id = sim_room_id;
        this.clientID = Math.random().toString(36).substring(2, 12);

        this.socket = null;
        this.peer = null;
        this.stream = stream;

        this.connectionState = "not yet connected";
        this.connectionDescription = null;

        this.onData = () => { };
        this.onAudio = () => { };
        this.onData = (data) => { console.log("data:", data) };
        this.onConnectionStateChanged = (state) => { };
    }

    start() {
        this.initiateWebSocketConnection();
        this.nominateSelf();
    }

    nominateSelf() {
        this.socket.emit("sim-walkietalkie-nominate", JSON.stringify({
            sim_room_id: this.sim_room_id,
            client_id: this.clientID,
            client_type: this.mode,
        }));
    }

    initiateWebSocketConnection() {
        this.socket = io({
            auth: {
                sim_room_id: this.sim_room_id,
            }
        });
        this.socket.on("sim-walkietalkie-connection-description", (json) => {
            let data = JSON.parse(json)
            this.connectionDescription = data;
            if (this.connectionDescription[this.mode] == this.clientID) {
                this.startFreshConnection();
            }
        })
        this.socket.on("sim-walkietalkie-signal", (envelope) => {
            let data = JSON.parse(envelope);
            if (data[this.mode] != this.clientID) return; // ignore messages not addressed to this client in its current mode
            this.peer?.signal(data["signal"]);
        })
    }

    updateConnectionState(txt) {
        this.connectionState = txt
        console.log("connection state changed:", txt)
        this.onConnectionStateChanged(this.connectionState)
    }

    startFreshConnection() {
        this.updateConnectionState("connecting…")

        // sanity checks
        if (!this.connectionDescription) {
            console.error("Unable to start connection until there is a connectionDescription")
            return false
        }

        // init peer
        let config = {
            initiator: this.mode == "transmitter",
            config: { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] },
            trickle: false
        }
        if (this.stream) {
            config.stream = this.stream;
        }
        this.peer = new window.SimplePeer(config)

        // callbacks
        this.peer.on("signal", (signal) => {
            let envelope = JSON.stringify({
                signal: signal,
                ...this.connectionDescription,
            })
            this.socket.emit('sim-walkietalkie-signal', envelope);
            // console.debug("emitted signal envelope", envelope)
        })
        this.peer.on('error', err => console.log('error', err))
        this.peer.on('connect', () => { this.updateConnectionState("connected") })
        this.peer.on('close', () => { this.updateConnectionState("disconnected") })
        this.peer.on('data', data => {
            let string = new TextDecoder().decode(data)
            this.onData(string)
        })
        this.peer.on('track', (track, stream) => { this.onAudio(stream) })

        return true
    }

    attachStream() {

    }

    sendText(txt) {
        this.peer.send(txt)
    }
}