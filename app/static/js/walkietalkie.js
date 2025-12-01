import { io } from '/static/js/socket.io.esm.min.js';

// export class WalkieTalkieConnection {
//     constructor(mode, sim_room_id, stream = null) {
//         this.mode = mode;
//         this.sim_room_id = sim_room_id;
//         this.clientID = Math.random().toString(36).substring(2, 12);

//         this.socket = null;
//         this.peer = null;
//         this.stream = stream;

//         this.connectionState = "not yet connected";
//         this.connectionDescription = null;

//         this.onData = () => { };
//         this.onAudio = () => { };
//         this.onData = (data) => { console.log("data:", data) };
//         this.onConnectionStateChanged = (state) => { };
//     }

//     start() {
//         this.initiateWebSocketConnection();
//         this.nominateSelf();
//     }

//     nominateSelf() {
//         this.socket.emit("sim-walkietalkie-nominate", JSON.stringify({
//             sim_room_id: this.sim_room_id,
//             client_id: this.clientID,
//             client_type: this.mode,
//         }));
//     }

//     initiateWebSocketConnection() {
//         this.socket = io({
//             auth: {
//                 sim_room_id: this.sim_room_id,
//             }
//         });
//         this.socket.on("sim-walkietalkie-connection-description", (json) => {
//             let data = JSON.parse(json)
//             this.connectionDescription = data;
//             if (this.connectionDescription[this.mode] == this.clientID) {
//                 this.startFreshConnection();
//             }
//         })
//         this.socket.on("sim-walkietalkie-signal", (envelope) => {
//             let data = JSON.parse(envelope);
//             if (data[this.mode] != this.clientID) return; // ignore messages not addressed to this client in its current mode
//             this.peer?.signal(data["signal"]);
//         })
//     }

//     updateConnectionState(txt) {
//         this.connectionState = txt
//         console.log("connection state changed:", txt)
//         this.onConnectionStateChanged(this.connectionState)
//     }

//     startFreshConnection() {
//         this.updateConnectionState("connecting…")

//         // sanity checks
//         if (!this.connectionDescription) {
//             console.error("Unable to start connection until there is a connectionDescription")
//             return false
//         }

//         // init peer
//         let config = {
//             initiator: this.mode == "transmitter",
//             config: { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] },
//             trickle: false
//         }
//         if (this.stream) {
//             config.stream = this.stream;
//         }
//         this.peer = new window.SimplePeer(config)

//         // callbacks
//         this.peer.on("signal", (signal) => {
//             let envelope = JSON.stringify({
//                 signal: signal,
//                 ...this.connectionDescription,
//             })
//             this.socket.emit('sim-walkietalkie-signal', envelope);
//             // console.debug("emitted signal envelope", envelope)
//         })
//         this.peer.on('error', err => console.log('error', err))
//         this.peer.on('connect', () => { this.updateConnectionState("connected") })
//         this.peer.on('close', () => { this.updateConnectionState("disconnected") })
//         this.peer.on('data', data => {
//             let string = new TextDecoder().decode(data)
//             this.onData(string)
//         })
//         this.peer.on('track', (track, stream) => { this.onAudio(stream) })

//         return true
//     }

//     attachStream() {

//     }

//     sendText(txt) {
//         this.peer.send(txt)
//     }
// }

export class WebRTC {
    constructor(mode, sim_room_id) {
        this.mode = mode;
        this.sim_room_id = sim_room_id;
        this.client_id = Math.random().toString(36).substring(2, 12);

        this.connectionDescription = null;
        this.socket = null;

        this.state = "not yet connected";

        this.peer = null;

        this.ontrack = () => { };


        this.createPeer()
        this.initiateWebSocketConnection()
        this.nominateSelf()
    }

    start() {

    }

    async createPeer() {
        this.peer = new RTCPeerConnection();

        this.peer.onicecandidate = (event) => {
            console.debug("onicecandidate fired", event)
            if (event.candidate) this.handleLocalIceCandidate(event.candidate)
        };

        this.peer.onconnectionstatechange = (state) => {
            console.debug("onconnectionstatechange fired", state)
        }
        this.peer.onnegotiationneeded = () => {
            console.debug("onnegotiationneeded fired")
            this.negotiateConnection()
        }
        this.peer.ontrack = (e) => {
            console.debug("ontrack fired")
            this.ontrack(e);
        }
        this.peer.ondatachannel = (e) => {
            console.log("got data", e)
            this.setupDataChannel(e.channel)
        }
    }

    async negotiateConnection() {
        // sanity checks
        if (!this.peer) {
            await this.createPeer()
        }

        // make and send offer
        let offer = await this.peer.createOffer()
        await this.peer.setLocalDescription(offer)
        this.sendPacket("offer", offer)
    }

    async attachDataSteam() {
        this.datastream = this.peer.createDataChannel("chat", { ordered: true })
        this.setupDataChannel(this.datastream)
    }

    setupDataChannel(dc) {
        dc.onopen = () => {
            console.debug("data channel open");
        };
        dc.onmessage = (event) => {
            console.debug("data channel received:", event.data);
            // you can parse JSON or handle text directly here
        };
        dc.onclose = () => {
            console.debug("data channel closed");
        };
        dc.onerror = (err) => {
            console.error("data channel error:", err);
        };
    }

    async attachMicrophone() {
        let microphoneStreamHandler = await navigator.mediaDevices.getUserMedia({ audio: true })
        let microphoneAudioTrack = microphoneStreamHandler.getAudioTracks()[0]
        this.peer.addTrack(microphoneAudioTrack, microphoneStreamHandler)
    }

    async handleSignal(data) {
        // sanity checks
        if (data[this.mode] != this.client_id) return
        if (!this.peer) {
            await this.createPeer()
        }

        // router
        if (data.type == "ice") {
            await this.handleRemoteIceCandidate(data.content);
        } else if (data.type == "offer") {
            await this.handleRemoteOffer(data.content);
        } else if (data.type == "answer") {
            await this.handleRemoteAnswer(data.content);
        }
    }
    async handleRemoteIceCandidate(ice_content) {
        console.debug("got remote ice candidate", ice_content)
        await this.peer.addIceCandidate(new RTCIceCandidate(ice_content))
    }
    async handleLocalIceCandidate(candidate) {
        console.debug("got local ice candidate", candidate)
        this.sendPacket("ice", candidate)
    }
    async handleRemoteOffer(offer_content) {
        console.debug("got remote offer", offer_content)
        let offer = new RTCSessionDescription(offer_content)
        await this.peer.setRemoteDescription(offer)

        let answer = await this.peer.createAnswer()
        await this.peer.setLocalDescription(answer)

        this.sendPacket("answer", answer)
    }
    async handleRemoteAnswer(answer_content) {
        console.debug("got remote answer", answer_content)
        let answer = new RTCSessionDescription(answer_content)
        await this.peer.setRemoteDescription(answer)
    }

    sendPacket(type, content) {
        let packet = {
            type: type,
            content: content,
            ...this.connectionDescription
        }
        this.socket.emit("sim-walkietalkie-signal", JSON.stringify(packet))
    }

    // socket stuff
    initiateWebSocketConnection() {
        this.socket = io({
            auth: {
                sim_room_id: this.sim_room_id,
            }
        });
        this.socket.on("sim-walkietalkie-connection-description", (plaintext) => {
            let data = JSON.parse(plaintext)
            console.debug("got sim-walkietalkie-connection-description:", data)

            this.connectionDescription = data;
            if (this.connectionDescription[this.mode] == this.client_id) {
                if (this.mode == "transmitter") {
                    this.peer = null
                    this.negotiateConnection()
                }
                // todo: init connection
            }
        })
        this.socket.on("sim-walkietalkie-signal", (envelope) => {
            let data = JSON.parse(envelope);
            console.debug("got sim-walkietalkie-signal:", data)

            if (data[this.mode] != this.client_id) return; // ignore messages not addressed to this client in its current mode
            this.handleSignal(data);
        })
    }

    nominateSelf() {
        this.socket.emit("sim-walkietalkie-nominate", JSON.stringify({
            sim_room_id: this.sim_room_id,
            client_id: this.client_id,
            client_type: this.mode,
        }));
    }


}

// // globals
// let roomID = "deeznuts"
// window.peerConnectionHandler = false

// window.socket.on("connect", (sk) => {
//     console.log('socket: connected')
//     sk.join(roomID)
//     // initialiseWalkieTalkieTransmitter()
// })

// async function initialiseConnectionHandler() {
//     console.log("initialising peer connection handler...")
//     if (window.peerConnectionHandler) return

//     // init peer connection controller object
//     let rtcConfiguration = {
//         iceServers: [
//             { urls: "stun:stun.l.google.com:19302" },
//         ]
//     }
//     window.peerConnectionHandler = new RTCPeerConnection(rtcConfiguration)

//     // log connection state changes
//     window.peerConnectionHandler.addEventListener("connectionstatechange", (e) => {
//         console.log(`peerConnectionHandler state changed to: ${window.peerConnectionHandler.connectionState}`)
//     })

//     // hook up ice negotiation signals to socketio backhaul
//     window.peerConnectionHandler.addEventListener("icecandidate", (e) => {
//         window.socket.emit("webrtc-ice-candidate", {
//             room: roomID,
//             candidate: e.candidate,
//         })
//     })
//     window.socket.on("webrtc-ice-candidate", async ({ candidate }) => {
//         console.log(`socket: webrtc-ice-candidate: ${candidate}`)
//         if (candidate) await window.peerConnectionHandler.addIceCandidate(new RTCIceCandidate(candidate))
//     })

//     console.log("...done")

// }

// async function initialiseWalkieTalkieTransmitter() {
//     await initialiseConnectionHandler()

//     // capture microphone audio
//     console.log("getting microphone input...")
//     let microphoneStreamHandler = await navigator.mediaDevices.getUserMedia({ audio: true })
//     let microphoneAudioTrack = microphoneStreamHandler.getAudioTracks()[0]
//     window.peerConnectionHandler.addTrack(microphoneAudioTrack, microphoneStreamHandler)
//     console.log("...done")

//     // set receiver's acceptance as remote description (when it arrives)
//     window.socket.on("webrtc-answer", async (msg) => {
//         console.log(`socket: webrtc-answer: ${msg}`)
//         console.log("setting remote description on window.peerConnectionHandler...")
//         let remoteDescription = new RTCSessionDescription(msg.sdp)
//         await window.peerConnectionHandler.setRemoteDescription(remoteDescription)
//         console.log("...done")
//     })

//     // generate and install SDP dump ("offer")
//     let sdpOffer = await window.peerConnectionHandler.createOffer()
//     window.peerConnectionHandler.setLocalDescription(sdpOffer)

//     // share with tx
//     console.log(`sending sdp offer to socket: ${sdpOffer}`)
//     window.socket.emit("webrtc-offer", {
//         room: roomID,
//         sdp: sdpOffer,
//     })
// }

// async function initialiseWalkieTalkieReceiver() {
//     await initialiseConnectionHandler()

//     // hook up audio element
//     console.log("hooking up audio element...")
//     window.peerConnectionHandler.ontrack = (e) => {
//         document.querySelector("audio").srcObject = e.streams[0]
//     }
//     console.log("...done")

//     // set transmitter's offer as remote description (when it arrives)
//     console.log("hooking up audio element...")
//     window.socket.on("webrtc-offer", async (msg) => {
//         let remoteDescription = new RTCSessionDescription(msg.sdp)
//         await window.peerConnectionHandler.setRemoteDescription(remoteDescription)
//     })

//     // accept transmitter's offer
//     window.socket.on("webrtc-offer", async (msg) => {
//         console.log(`socket: webrtc-offer: ${msg}`)
//         console.log("setting remote description on window.peerConnectionHandler...")
//         let remoteDescription = new RTCSessionDescription(msg.sdp)
//         await window.peerConnectionHandler.setRemoteDescription(remoteDescription)
//         console.log("...done")

//         window.socket.emit("webrtc-answer", {
//             room: roomID,
//             sdp: sdpAnswer,
//         })
//     })


// }

// document.querySelector("button#rx")?.addEventListener("click", (e) => {
//     console.log('button press registered')
//     initialiseWalkieTalkieReceiver()
// })

// document.querySelector("button#tx")?.addEventListener("click", (e) => {
//     console.log('button press registered')
//     initialiseWalkieTalkieTransmitter()
// })