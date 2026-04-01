import { updateNibpReadoutImmediately } from "./nibp";

class SimTransitionSupervisor {
    // assumes state object has exactly the right keys (should be validated before handing over)
    // functions assume their inputs and strings, so often parseFloat() etc
    // they return strings too

    constructor(initial_state) {
        this.INCREMENT_DURATION = 3_000;
        this.TRANSITIONABLE_ELEMENTS = [
            "heart-rate",
            "spo2",
            "etco2",
            "respiratory-rate",
            "systolic-blood-pressure-noninvasive",
            "diastolic-blood-pressure-noninvasive",
            "mean-arterial-pressure-noninvasive",
            "systolic-blood-pressure",
            "diastolic-blood-pressure",
            "mean-arterial-pressure",
        ];

        this.timeout = null;

        this.current_state = initial_state;
        this.target_state = initial_state;
        this.deltas = {};
    }

    set_target_state(new_target_state, transition_duration) {
        this.deltas = this._calculateDeltas(
            this.deltas,
            this.current_state,
            this.target_state,
            new_target_state,
            transition_duration,
        );
        this.target_state = new_target_state;

        // increment immediately
        clearTimeout(this.timeout);
        this.increment();
    }

    increment() {
        console.log(
            `SimTransitionSupervisor: incrementing state towards target state`,
        );

        let intermediate_state = this.current_state;

        for (let key in intermediate_state) {
            if (key in this.deltas) {
                intermediate_state[key] =
                    parseFloat(intermediate_state[key]) +
                    parseFloat(this.deltas[key]);

                // overshoot/completion detector
                // elegant? no
                // understandable? yes
                let target = parseFloat(this.target_state[key]); // stored as strings elsewhere, sigh
                let is_increasing = this.deltas[key] > 0;
                let is_decreasing = !is_increasing;
                let increase_complete = intermediate_state[key] >= target;
                let decrease_complete = intermediate_state[key] <= target;
                if (
                    (is_increasing && increase_complete) ||
                    (is_decreasing && decrease_complete)
                ) {
                    intermediate_state[key] = target;
                    delete this.deltas[key];
                }

                // re-stringify
                intermediate_state[key] = intermediate_state[key]
                    .toFixed(0)
                    .toString();
            } else {
                // guarantees that any keys without a matching delta will be set to their target value
                // _calculateDeltas relies on this behaviour!
                // it assumes that NOT making/replacing a delta for a changed parameter will cause it to jump immediately
                intermediate_state[key] = this.target_state[key];
            }
        }

        console.debug(
            `Sync: transitioning to intermediate state: `,
            intermediate_state,
        );

        // apply current_state to DOM
        // _applyStateToDom(intermediate_state);
        try {
            _applyStateToDomFragment(
                "#sim-monitor",
                "data-sim-parameters",
                intermediate_state,
            );
        } catch (e) {
            console.error(
                `Sync: encountered an error while updating state in the DOM`,
                e,
            );
        }

        // save state
        this.current_state = intermediate_state;

        // eat own tail
        let deltas_remaining = Object.keys(this.deltas).length;
        if (deltas_remaining > 0) {
            console.debug(
                `SimTransitionSupervisor: ${deltas_remaining} delta remaining, scheduling next increment`,
                this.deltas,
            );
            this.timeout = setTimeout(() => {
                this.increment();
            }, this.INCREMENT_DURATION);
        } else {
            console.debug(
                `SimTransitionSupervisor: reached target state, stopping transition`,
            );
        }
    }

    _calculateDeltas(
        stale_deltas,
        current_state,
        stale_target_state,
        new_target_state,
        transition_duration,
    ) {
        // adds a delta (float) to this.deltas for any transitionable parameter that needs transitioning (i.e. time != 0 and difference != 0)
        // any parameter that doesn't get a delta will transition immediately, including non-transitionable parameters

        let deltas = stale_deltas;
        for (let key in new_target_state) {
            // skip when transition_duration is zero
            // - intended effect: jump immediately to target_state AND stop any ongoing transition
            // - assumes that any parameter without a delta will jump immediately
            // - also assumes that `delete` a non-existent key is a no-op
            if (transition_duration == 0) {
                delete deltas[key];
                continue;
            }

            // skip if non-transitionable
            if (!this.TRANSITIONABLE_ELEMENTS.includes(key)) continue;

            // skip when target is unchanged (string comparison is fine here), which will either:
            // - not make a delta (causing an immediate jump to the new target), or
            // - keep using an old delta, effectively "continuing" the old transition
            let target_unchanged =
                new_target_state[key] == stale_target_state[key];
            let duration_unchanged =
                stale_target_state["transition-time"] ==
                new_target_state["transition-time"];
            if (target_unchanged && duration_unchanged) continue;

            // skip when planned change is NaN (e.g. when new target is "??")
            // - e.g. diastolic-blood-pressure-noninvasive gets changed to "??" in cardiac arrest
            // - consider removing and ditching "??" in cardiac arrest altogether #todo
            let planned_change =
                parseFloat(new_target_state[key]) -
                parseFloat(current_state[key]);
            if (isNaN(planned_change)) continue; // skip if new target isn't a number (e.g. "??")

            // otherise, perform a transition
            // recalculate delta based on new target, picking up from current state (wherever we are in the old transition)
            deltas[key] =
                planned_change *
                (this.INCREMENT_DURATION / transition_duration);
        }
        return deltas;
    }
}

export function registerMonitorSyncReceiver(socket) {
    let transitionManager = new SimTransitionSupervisor(window.initial_states);

    function handleMonitorStateUpdate(states) {
        // validate state
        if (!_validateStateObject(states)) {
            console.error("Sync: received invalid state object", states);
            return;
        }

        // special case for cardiac arrest
        let mode = states["sim-mode"];
        let spo2Readout = document.querySelector("#readout-spo2");

        if (mode == "arrested") {
            // imperatively mutate state to reflect arrest conditions
            states = _mutateStateForCardiacArrest(states);
            // make spo2 wobbly (needs to be actively un-done when alive)
            spo2Readout.setAttribute("data-sim-wobble", 15);
        } else {
            // unset wobble on spo2
            spo2Readout.setAttribute("data-sim-wobble", 2);
        }

        // special cases and side effects
        _monitorStateUpdateSideEffects(states);

        // apply state via transition manager
        let transitionTime = states["transition-time"] || 0;
        transitionManager.set_target_state(states, transitionTime);
    }

    socket.on("sim-update", (msg) => {
        let message = JSON.parse(msg);
        let states = message["updates"];

        console.debug(
            "Sync: got updated state from server, updates were: ",
            states,
        );

        handleMonitorStateUpdate(states);
        document.querySelector("dialog[open]")?.close();
    });

    // re-apply existing state on pageload
    _applySavedStateOnPageload((state) => {
        handleMonitorStateUpdate(state);
        updateNibpReadoutImmediately();
    });
}

export function registerControllerSyncEmitter(socket) {
    window.dumpstate = _serialiseStateFromDomFragment;

    if (document.body.dataset.simDemoMode == "true") return;

    let sendButton = document.querySelector("#send");
    sendButton.addEventListener("click", (e) => {
        e.preventDefault();
        let message = {
            sim_room_id: document.body.dataset.simRoomId,
            updates: _serialiseStateFromDomFragment(
                "#controller",
                "data-sim-input",
            ),
        };
        socket.emit("sim-update", JSON.stringify(message));

        if (sendButton) {
            sendButton.classList.remove("red");
            sendButton.style.width = sendButton.clientWidth + "px"; // preserve initial width
            sendButton.value = "Sent";
        }
    });
    document.addEventListener("input", (e) => {
        sendButton.classList.add("red");
        sendButton.value = "Send";
    });

    // re-apply existing state on pageload
    _applySavedStateOnPageload((state) => {
        _applyStateToDomFragment("#controller", "data-sim-input", state);
    });
}

export function setSimValue(el, attributeName, attributeValue) {
    // special case for "checked"
    if (attributeName == "checked") {
        if (attributeValue == "false" || Boolean(attributeValue) == false) {
            el.checked = false;
        } else {
            el.checked = true;
        }
        return;
    }

    // special case for "value"
    if (attributeName == "value") {
        el.value = attributeValue;
        el.dispatchEvent(
            new CustomEvent("input", {
                bubbles: true,
                detail: { preventAutophagy: true },
            }),
        );
        return;
    }

    // general case
    el.setAttribute(attributeName, attributeValue);
}

export function getSimValue(el, attributeName) {
    let attributeValue;

    if (attributeName == "checked") {
        attributeValue = el.checked;
    } else if (attributeName == "value") {
        attributeValue = el.value;
    } else {
        attributeValue = el.getAttribute("sim-value") || "";
    }

    return attributeValue;
}

function _applySavedStateOnPageload(initFunction) {
    window.addEventListener("load", (e) => {
        console.debug(
            `Sync: applying initial state on page load: `,
            window.initial_states,
        );

        try {
            let state = window.initial_states;
            initFunction(state);
        } catch (e) {
            console.error(
                "Sync: couldn't parse/apply state from window.initial_states (doing this to catch any arrest special-case logic missed by server-side hydration, sigh)",
                e,
            );
        }
        // needs to be on next frame to enable all animations to be suppressed on pageload
        requestAnimationFrame(() => {
            document.body.classList.remove("sim-fouc-suppressed");
        });
    });
}

function _mutateStateForCardiacArrest(state) {
    // assign ecg-rhythm to cpr OR arrest-rhythm
    if (state["sim-cpr"] == "on") {
        state["ecg-rhythm"] = "cpr";
    } else {
        state["ecg-rhythm"] = state["arrest-rhythm"];
    }

    // set heart rate according to morphology
    if (["sinus", "flatline"].includes(state["ecg-rhythm"])) {
        state["heart-rate"] = 104;
    } else if (state["ecg-rhythm"] == "cpr") {
        state["heart-rate"] = 100;
    } else {
        state["heart-rate"] = 250;
    }

    // transfer arrest capno/etco2 to main
    state["etco2"] = state["arrest-etco2"];
    state["capno-trace"] = state["arrest-capno"];

    // set spo2 to sod-all
    state["spo2"] = 64;

    // make nibp uninterpretably low
    let imaginarySbp = (10 + Math.random() * 20).toFixed(0);
    let imaginaryDbp = (5 + Math.random() * 10).toFixed(0);
    let imaginaryMap = (imaginarySbp * 0.6).toFixed(0);
    state["systolic-blood-pressure-noninvasive"] = imaginarySbp;
    state["diastolic-blood-pressure-noninvasive"] = "??";
    state["mean-arterial-pressure-noninvasive"] = imaginaryMap;

    // set arrest-style morphologies for remaining traces
    state["spo2-trace"] = "spo2-badtrace";
    state["artline-trace"] = "spo2-badtrace";

    return state;
}

export function _serialiseStateFromDomFragment(selector, mapAttribute) {
    let containerElement = document.querySelector(selector);
    if (!containerElement) {
        throw new Error(
            "Sync: _serialiseStateFromDomFragment selector did not match anything",
        );
    }

    let inputElements = containerElement.querySelectorAll(`[${mapAttribute}]`);
    if (inputElements.length == 0) {
        throw new Error(
            `_serialiseStateFromDomFragment could not find any elements with [data-sim-parameters] in <${selector}>`,
        );
    }

    let states = {};

    for (let ie of inputElements) {
        let parametersString = ie.getAttribute(mapAttribute);

        if (parametersString.split(" ").length > 1) {
            console.error(
                `Sync: _serialiseStateFromDomFragment found an input with multiple mappings (${parametersString}), which is not allowed. Skipping.`,
            );
            continue;
        }

        let [parameterName, attributeName] = parametersString.split(":");

        if (states[parameterName] != undefined) {
            console.error(
                `Sync: _serialiseStateFromDomFragment found multiple inputs with [${mapAttribute}]*="${parameterName}", skipping (all but the first one)`,
            );
            continue;
        }

        let value = getSimValue(ie, attributeName);

        states[parameterName] = value;
    }

    // validate
    if (!_validateStateObject(states)) {
        throw new Error(
            "_serialiseStateFromDomFragment produced an invalid/incomplete state object",
        );
    }

    return states;
}

export function _applyStateToDomFragment(selector, mapAttribute, states) {
    let containerElement = document.querySelector(selector);
    if (!containerElement) {
        throw new Error(
            "Sync: _applyStateToDomFragment selector did not match anything",
        );
    }

    let interestedElements = containerElement.querySelectorAll(
        `[${mapAttribute}]`,
    );
    if (interestedElements.length == 0) {
        throw new Error(
            `_applyStateToDomFragment could not find any elements with [${mapAttribute}] in <${selector}>`,
        );
    }

    for (let ie of interestedElements) {
        let parametersString = ie.getAttribute(mapAttribute);
        let parameterMappings = parametersString.split(" ");

        let anonymousParameters = [];
        for (let pm of parameterMappings) {
            let [parameterName, attributeName] = pm.split(":");

            // anonymous parameters
            if (attributeName == undefined) {
                attributeName = "sim-value";
                anonymousParameters.push(parameterName);
                if (anonymousParameters.length > 1) {
                    console.warn(
                        `Sync: element has multiple "anonymous" parameters (${anonymousParameters.join()}) implicitly mapped to [sim-value]. "${anonymousParameters[0]}" was permitted, now skipping "${parameterName}" to avoid a race condition.`,
                        ie,
                    );
                    continue;
                }
            }

            // get value
            let attributeValue = states[parameterName];
            if (attributeValue == undefined) {
                console.error(
                    `Sync: _applyStateToDomFragment could not find a value for "${parameterName}" in state object. Validation must have failed to catch this!`,
                );
                continue;
            }

            // set attr
            setSimValue(ie, attributeName, attributeValue);
        }
    }
}

function _validateStateObject(state) {
    let requiredKeys = Object.keys(window.initial_states);
    let observedKeys = Object.keys(state);

    if (requiredKeys.length != observedKeys.length) {
        console.error(
            "Sync: proposed state object is missing required keys",
            state,
        );
    }

    for (let key of requiredKeys) {
        if (!(key in state)) {
            console.error(
                `Sync: state object is missing required key: ${key}`,
                state,
            );
            return false;
        }
    }

    for (let key of observedKeys) {
        if (!requiredKeys.includes(key)) {
            console.error(
                `Sync: state object has unexpected key: ${key}`,
                state,
            );
            return false;
        }
    }

    return true;
}

function _monitorStateUpdateSideEffects(states) {
    // - HR coloured by derivation
    let heartRateReadout = document.querySelector("#heart-rate");
    let heartRateColour = undefined;
    let heartRateEnabled = true;
    if (states["enabler-for-art"] == true) heartRateColour = "red";
    if (states["enabler-for-spo2"] == true) heartRateColour = "blue";
    if (states["enabler-for-ecg"] == true) heartRateColour = "green";
    if (heartRateColour == undefined) {
        heartRateEnabled = false;
        heartRateColour = "green";
    } else {
    }
    heartRateReadout.dataset.simEnabled = heartRateEnabled;
    heartRateReadout.classList = heartRateColour;
}
