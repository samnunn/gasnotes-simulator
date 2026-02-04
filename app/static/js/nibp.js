import { audioIsRunning } from "./audio.js";
import { getValue, setValue } from "./sync.js";

let delayedAudioOutputs = document.querySelectorAll(
    "#nibp [data-sim-delayed-datasource]",
);
export function updateNibpReadoutImmediately() {
    for (let d of delayedAudioOutputs) {
        let dataSource = document.querySelector(
            `#nibp [sim-parameter="${d.dataset.simDelayedDatasource}"]`,
        );
        let dataValue = dataSource.getAttribute("sim-value");
        d.removeAttribute("hidden");
        d.setAttribute("sim-value", dataValue);
    }
}

function updateNibpReadoutWithAnimation(max) {
    // reset timer
    resetNibpTimer();

    // get peak value
    let targetSbp = document
        .querySelector(`[sim-parameter="systolic-blood-pressure-noninvasive"]`)
        .getAttribute("sim-value");
    let peakPressure = (targetSbp * 1.25).toFixed(0);

    // wipe off old values
    for (let d of delayedAudioOutputs) {
        d.setAttribute("hidden", true);
    }

    // start Sound
    if (audioIsRunning() == true) {
        startNibpSound();
    }

    // animate BP
    animateCuffPressure(
        delayedAudioOutputs[0],
        updateNibpReadoutImmediately,
        peakPressure,
    );
}

function startNibpSound() {
    let nibpAudio = document.getElementById("nibp-audio");
    if (audioIsRunning() == false) return;
    nibpAudio.play();
    nibpAudio.currentTime = 0; // restart from beginning
}

let activeAnimationFrameId = null;
function animateCuffPressure(
    mapDisplay,
    onEnd = null,
    peak = 223,
    tUp = 16000,
    tHold = 1000,
    tDown = 13000,
    tStep = 900,
) {
    // cancel existing animations
    if (activeAnimationFrameId != null) {
        cancelAnimationFrame(activeAnimationFrameId);
        activeAnimationFrameId = null;
    }

    // pre-calculate key times
    // t0 = start
    // t1 = start of pressure peak
    // t2 = end of pressure peak
    // t3 = end of cycle
    let t0 = performance.now();
    let t1 = tUp;
    let t2 = tUp + tHold;
    let t3 = tUp + tHold + tDown;

    // set lastUpdateTime to -infinity so first frame() call renders something out
    let lastUpdateTime = -Infinity;

    // make sure it's visible
    mapDisplay.removeAttribute("hidden");
    mapDisplay.setAttribute("sim-disabled", "false");

    function frame(now) {
        // clock math
        let elapsedTime = now - t0;

        // only render every few seconds (set by tStep)
        if (now - lastUpdateTime >= tStep) {
            lastUpdateTime = now;

            let value;
            if (elapsedTime <= t1) {
                value = peak * (elapsedTime / tUp);
            } else if (elapsedTime <= t2) {
                value = peak;
            } else if (elapsedTime <= t3) {
                value = peak * (1 - (0.8 * (elapsedTime - t2)) / tDown);
            } else {
                value = 0;
            }

            value = Math.max(0, Math.round(value));
            mapDisplay.setAttribute("sim-value", value);
        }

        if (elapsedTime < t3) {
            activeAnimationFrameId = requestAnimationFrame(frame);
        } else {
            activeAnimationFrameId = null;
            if (typeof onEnd === "function") {
                onEnd();
            }
        }
    }

    // init
    activeAnimationFrameId = requestAnimationFrame(frame);
}

// TIMER WIDGET
let nibpTimerWidget = document.getElementById("nibp-timer-widget");
let nibpTimerIntervalMs = 1000 * 60 * 2;

export function initialiseNibpTimer() {
    let loopFrequency = 1000;
    console.debug(`Initialising NIBP timer, looping every ${loopFrequency} ms`);
    resetNibpTimer();
    function tick() {
        renderNibpTimerWidget();
        setTimeout(() => {
            tick();
        }, loopFrequency);
    }
    tick();
}
export function resetNibpTimer() {
    nibpTimerWidget.dataset.nextTrigger = Date.now() + nibpTimerIntervalMs;
}

import { renderSecondsAsMMSS } from "./utils.js";
function renderNibpTimerWidget() {
    let now = Date.now();
    let nextTriggerTimeMs = Number(nibpTimerWidget.dataset.nextTrigger);

    if (nextTriggerTimeMs) {
        if (!Number.isFinite(nextTriggerTimeMs)) {
            nextTriggerTimeMs = now + nibpTimerIntervalMs;
            nibpTimerWidget.dataset.nextTrigger = nextTriggerTimeMs;
        }

        // render time remaining as text MM:SS
        let secondsRemaining = Math.max(
            0,
            Math.round((nextTriggerTimeMs - now) / 1000),
        );
        let time = renderSecondsAsMMSS(secondsRemaining);
        nibpTimerWidget.innerText = `Auto ${time}`;
    }

    if (
        nextTriggerTimeMs &&
        nibpTimerWidget.getAttribute("sim-disabled") != "true" &&
        now >= nextTriggerTimeMs
    ) {
        // run nibp
        updateNibpReadoutWithAnimation();
    }
}

// REMOTE EMITTERS/RECEIVERS
export function registerNibpAutoCycleStateReceiver(socket) {
    console.debug(
        "Registered: NIBP auto-cycle receiver (listens over the wire, updates toggle)",
    );
    let nibpSwitch = document.querySelector("[sim-nibp-cycle-switch]");
    socket.on("sim-nibp-state-update", (msg) => {
        let message = JSON.parse(msg);
        let state = message["nibp_auto_cycling"] == "true";

        setValue(nibpSwitch, state);
        console.debug(
            `Recevied: NIBP auto-cycle state (${state}) received from server and applied locally`,
        );

        // TODO: fix this special case
        if (document.getElementById("nibp-timer-widget")) {
            nibpSwitch.dispatchEvent(new CustomEvent("sim:nibp-cycling-set"));
        }
    });
}

export function registerNibpAutoCycleStateEmitter(socket) {
    console.debug(
        "Registered: NIBP auto-cycle emitter (watches for toggles, sends over the wire)",
    );
    let nibpSwitch = document.querySelector("[sim-nibp-cycle-switch]");
    nibpSwitch.addEventListener("input", (e) => {
        let state = getValue(nibpSwitch);

        let message = {
            sim_room_id: document.body.dataset.simRoomId,
            nibp_auto_cycling: state,
        };
        socket.emit("sim-nibp-state-update", JSON.stringify(message));
        console.debug(
            `Emitted: NIBP auto-cycle state set to ${state}, sending to server`,
        );

        // TODO: fix this special case
        if (document.getElementById("nibp-timer-widget")) {
            nibpSwitch.dispatchEvent(new CustomEvent("sim:nibp-cycling-set"));
        }
    });
}

export function registerRemoteNibpCycleReceiver(socket) {
    console.debug(
        "Registered: NIBP manual run receiver (listens for commands over the wire)",
    );
    socket.on("sim-run-nibp", (e) => {
        updateNibpReadoutWithAnimation();
        console.debug(`Received: NIBP manual run`);
    });
}

export function registerRemoteNibpCycleEmitter(socket) {
    console.debug(
        "Registered: NIBP manual run emitter (sends commands over the wire)",
    );
    let nibpButton = document.querySelector("[sim-nibp-cycle-button]");
    nibpButton.addEventListener("click", (e) => {
        e.preventDefault();
        let message = {
            sim_room_id: document.body.dataset.simRoomId,
        };
        socket.emit("sim-run-nibp", JSON.stringify(message));
        console.debug(`Emitted: NIBP manual run`);
    });
}

// LOCAL EVENT LISTENERS
export function attachLocalNibpCycleButton() {
    document.addEventListener("click", (e) => {
        if (
            e.target.matches(
                "[sim-nibp-trigger-manual], [sim-nibp-trigger-manual] *",
            )
        ) {
            updateNibpReadoutWithAnimation();
        }
    });
}

export function attachMonitorNibpCycleSwitchHandler() {
    let nibpSwitch = document.querySelector("[sim-nibp-cycle-switch]");
    nibpSwitch.addEventListener("sim:nibp-cycling-set", (e) => {
        let state = nibpSwitch.checked;
        if (state == true) {
            resetNibpTimer();
            renderNibpTimerWidget();
            nibpTimerWidget.setAttribute("sim-disabled", "false");
        } else {
            nibpTimerWidget.setAttribute("sim-disabled", "true");
        }
        console.debug(`NIBP switch changed to: ${state ? "on" : "off"}`);
    });
}

// let nibpAudio = document.getElementById("nibp-audio");
// nibp button hookup
// auto-send nibp updates
// emitter
// let nibpAutoToggle = document.getElementById(`nibp-cycling-switch`);
// nibpAutoToggle.addEventListener("input", (e) => {
//     let state = nibpAutoToggle.querySelector("input[data-sim-parameter]").value;
//     let message = {
//         sim_room_id: document.body.dataset.simRoomId,
//         nibp_auto_cycling: state,
//     };
//     socket.emit("sim-nibp-state-update", JSON.stringify(message));
// });
// receiver
// nibpAutoToggle.addEventListener("input", (e) => {
//     let autoCyclingEnabled = nibpAutoToggle.checked;
//     let message = {
//         sim_room_id: document.body.dataset.simRoomId,
//         nibp_auto_cycling: autoCyclingEnabled,
//     };
//     // TODO: fix
//     // socket.emit("sim-nibp-state-update", JSON.stringify(message))
//     if (autoCyclingEnabled) {
//         startNibpTimerWidget();
//     } else {
//         stopNibpTimerWidget();
//     }
// });
// if (nibpAutoToggle.checked) {
//     startNibpTimerWidget();
// }
