// CUSTOM ELEMENTS
import "./custom_elements/sim-readout.js";
import "./custom_elements/sim-post.js";

// SOCKETS
import { connectSocket, connectMonitorSockets } from "./sockets.js";

let socket = connectSocket();
// connectMonitorSockets(socket);

// NIBP
import {
    registerNibpAutoCycleStateEmitter,
    registerNibpAutoCycleStateReceiver,
    resetNibpTimer,
    attachMonitorNibpCycleSwitchHandler,
    registerRemoteNibpCycleReceiver,
    attachLocalNibpCycleButton,
    initialiseNibpTimer,
} from "./nibp.js";

registerNibpAutoCycleStateEmitter(socket);
registerNibpAutoCycleStateReceiver(socket);
registerRemoteNibpCycleReceiver(socket);
initialiseNibpTimer();
attachLocalNibpCycleButton();
attachMonitorNibpCycleSwitchHandler();

// SYNC
import { registerMonitorSyncReceiver } from "./sync.js";
registerMonitorSyncReceiver(socket);

// INVESTIGATIONS
import { registerSimInvestigationPostHandler } from "./investigations.js";
registerSimInvestigationPostHandler(socket);

// BEEPS AND BOOPS
import {
    createSimAudioContext,
    autoPlayHeartBeeps,
    enableAudioAutoPlayOnFirstUserInteraction,
    autoPlayAlarmBoops,
    connectAlarmAcknowledgementTimerLogic,
} from "./audio.js";

// audio shared infrastructure
window.simAudioControlObjects = createSimAudioContext();
enableAudioAutoPlayOnFirstUserInteraction(window.simAudioControlObjects);

// heart beeps
autoPlayHeartBeeps(window.simAudioControlObjects);

// alarm boops + silencing
autoPlayAlarmBoops(window.simAudioControlObjects);
connectAlarmAcknowledgementTimerLogic();

document.addEventListener(
    "pointerdown",
    () => {
        // enable sound switch (audiocontext autoplay enabled elsewhere) on first interaction
        document.getElementById("sound-switch").checked = true;
    },
    { once: true },
);

// WAVES
import "./wavemaker2.js";

// pacemakers need to be started manually
window.addEventListener("load", (e) => {
    setTimeout(() => {
        document.querySelector("#ecg").beat(0, true);
        document.querySelector("#capno").beat(0, true);
    }, 300);
});
