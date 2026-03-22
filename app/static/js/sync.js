import { updateNibpReadoutImmediately } from "./nibp";

// export class TransitionManager {
//     targetElement;
//     targetValue;
//     initialValue;
//     currentValue;
//     timeout;
//     incrementSize;
//     incrementDuration = 3000;
//     running = true;
//     nonTransitionable = false;

//     constructor(targetElement, targetValue, targetParameter = "sim-value") {
//         this.targetElement = targetElement;
//         this.targetValue = parseInt(targetValue);
//         this.initialValue = parseInt(
//             this.targetElement.getAttribute("sim-value"),
//         );
//         this.currentValue = this.initialValue;

//         // immediately commit changes for non-transitionable elements
//         // early return to prevent any further horseplay
//         if (this.targetElement.hasAttribute("sim-transitionable") != true) {
//             // needs to skip parseInt() because wave morphologies are strings
//             setValue(this.targetElement, targetValue);
//             this.nonTransitionable = true;
//             return;
//         }

//         // stop the currently-running transition
//         if (this.targetElement.activeTransition instanceof TransitionManager) {
//             this.targetElement.activeTransition.running = false;
//         }

//         // substitute this transition
//         this.targetElement.activeTransition = this;
//     }

//     start() {
//         if (this.nonTransitionable) return;

//         // set duration
//         let duration = document.body.getAttribute("sim-transition-time") || 0;

//         // duration is an integer number of seconds
//         if (duration > 0) {
//             this.incrementSize =
//                 (this.targetValue - this.initialValue) /
//                 ((duration * 1000) / this.incrementDuration);
//         } else {
//             this.incrementSize = this.targetValue - this.initialValue;
//         }

//         // begin
//         this.increment();
//     }

//     increment() {
//         // only increment if running == true (gets set to false as an interrupt/end of transition signal)

//         // if the total change exceeds the planned change, terminate the transition. otherwise increment/decrement
//         let totalChange = Math.abs(this.currentValue - this.initialValue);
//         let plannedChange = Math.abs(this.targetValue - this.initialValue);
//         if (totalChange >= plannedChange) {
//             this.currentValue = this.targetValue;
//             this.running = false;
//         } else {
//             this.currentValue += this.incrementSize;
//         }

//         // commit changes to the DOM
//         // parseInt() to get rid of decimals
//         setValue(this.targetElement, parseInt(this.currentValue));

//         if (this.running == true) {
//             // set a timeout for next increment
//             // will be a no-op if this.running was set to false above
//             this.timeout = setTimeout(() => {
//                 this.increment();
//             }, this.incrementDuration); // period is set in this.incrementDuration above
//         }
//     }

//     cancel() {
//         this.timeout = null;
//     }
// }

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
        _applyStateToDom(intermediate_state);

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

export function validateStateObject(state) {
    let requiredKeys = Object.keys(window.default_data["updates"]);
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

export function setValue(target, value) {
    if (target.hasAttribute("sim-value")) {
        target.setAttribute("sim-value", value);
    } else if (target.matches(`input[type="checkbox"]`)) {
        target.checked = value.toString() == "true" ? true : false;
    } else if (target.matches(`p, span`)) {
        target.innerText = value;
    } else {
        target.value = value;
    }
}
export function getValue(target) {
    if (target.hasAttribute("sim-value")) {
        return target.getAttribute("sim-value");
    } else if (target.matches(`input[type="checkbox"]`)) {
        return target.checked.toString();
    } else if (target.matches(`p, span`)) {
        return target.innerText;
    } else {
        return target.value;
    }
}

export function transitionIfAble(func) {
    if (document.startViewTransition) {
        document.startViewTransition(() => {
            func();
        });
    } else {
        func();
    }
}

export function registerMonitorSyncReceiver(socket) {
    // if (document.body.dataset.simDemoMode == "true") return;

    DEV: (() => {
        // check for elements with multiple sim-parameters that don't have a valid mapping
        let multiParamElements = document.querySelectorAll(
            `[data-sim-parameter*=" "]`,
        );
        for (let mp of multiParamElements) {
            if (!mp.hasAttribute("data-sim-parameter-mapping")) {
                console.error(
                    `Sync: no "data-sim-parameter-mapping" found when element listens to multiple parameters -> RACE CONDITION`,
                    mp,
                );
                continue;
            }

            let parameters = mp.dataset.simParameter?.split(" ");
            let maps = mp.dataset.simParameterMapping?.split(" ");

            for (let p of parameters) {
                let matchingMaps = 0;
                for (let m of maps) {
                    if (m.split(":")[0] === p) {
                        matchingMaps++;
                    }
                }
                if (matchingMaps === 0) {
                    console.error(
                        `Sync: no valid mapping found for parameter "${p}" on this element (that listens to multiple parameters), meaning nothing will happen when that parameter changes`,
                        mp,
                    );
                }
            }
        }
    })();

    let transitionManager = new SimTransitionSupervisor(
        window.default_data["updates"],
    );

    function handleMonitorStateUpdate(state) {
        // validate state
        if (!validateStateObject(state)) {
            console.error("Sync: received invalid state object", state);
            return;
        }

        // special case for cardiac arrest
        let mode = state["sim-mode"];
        let spo2Readout = document.querySelector(
            '[data-sim-parameter~="spo2"]',
        );

        if (mode == "arrested") {
            // imperatively mutate state to reflect arrest conditions
            state = _mutateStateForCardiacArrest(state);
            // make spo2 wobbly (needs to be actively un-done when alive)
            spo2Readout.setAttribute("data-sim-wobble", 15);
        } else {
            // unset wobble on spo2
            spo2Readout.setAttribute("data-sim-wobble", 2);
        }

        // todo: special cases (imperatively, sigh)
        // - spo2 y-scale defined by map from nibp/art line
        // - art y-scale dervied from map
        // - HR derived from spo2 (should turn blue)

        // _applyStateToDom(state);
        let transitionTime = state["transition-time"] || 0;
        transitionManager.set_target_state(state, transitionTime);
    }

    socket.on("sim-update", (msg) => {
        let message = JSON.parse(msg);
        let state = message["updates"];

        console.debug(
            "Sync: got updated state from server, updates were: ",
            state,
        );

        handleMonitorStateUpdate(state);
        document.querySelector("dialog[open]")?.close();
    });

    // re-apply existing state on pageload
    // this will run through any arrest special-casing etc
    window.addEventListener("load", (e) => {
        // if (document.body.dataset.simDemoMode == "true") return;

        console.debug(
            `Sync: applying initial state on page load: `,
            window.default_data["updates"],
        );

        try {
            let message = window.default_data;
            let state = message["updates"];
            handleMonitorStateUpdate(state);
            updateNibpReadoutImmediately();
        } catch (e) {
            console.error(
                "Sync: couldn't parse/apply state from window.default_data (doing this to catch any arrest special-case logic missed by server-side hydration, sigh)",
                e,
            );
        }
    });
}

export function registerControllerSyncEmitter(socket) {
    if (document.body.dataset.simDemoMode == "true") return;

    let sendButton = document.querySelector("#send");
    let form = document.querySelector("form#sim-input");
    form.addEventListener("submit", (e) => {
        e.preventDefault();
        let message = _dumpAllInputState();
        socket.emit("sim-update", JSON.stringify(message));

        if (sendButton) {
            sendButton.classList.remove("red");
            sendButton.style.width = sendButton.clientWidth + "px"; // preserve initial width
            sendButton.value = "Sent";
        }
    });
    form.addEventListener("input", (e) => {
        sendButton.classList.add("red");
        sendButton.value = "Send";
    });
}

function _dumpAllInputState() {
    let message = {
        sim_room_id: document.body.dataset.simRoomId,
        updates: {},
        enablers: {},
    };

    // sim values
    let inputs = document.querySelectorAll("[data-sim-parameter]");
    for (let i of inputs) {
        let simValue = getValue(i);

        message["updates"][i.dataset.simParameter] = simValue;
    }

    // enabled/disabled components
    let enablers = document.querySelectorAll("[data-sim-enabler-for]");
    for (let e of enablers) {
        let enablerFor = e.dataset.simEnablerFor;
        let isEnabled = e.checked;

        message["enablers"][enablerFor] = isEnabled;
    }

    return message;
}

function _mutateStateForCardiacArrest(updates) {
    // assign ecg-rhythm to cpr OR arrest-rhythm
    if (updates["sim-cpr"] == "on") {
        updates["ecg-rhythm"] = "cpr";
    } else {
        updates["ecg-rhythm"] = updates["arrest-rhythm"];
    }

    // set heart rate according to morphology
    if (["sinus", "flatline"].includes(updates["ecg-rhythm"])) {
        updates["heart-rate"] = 104;
    } else if (updates["ecg-rhythm"] == "cpr") {
        updates["heart-rate"] = 100;
    } else {
        updates["heart-rate"] = 250;
    }

    // transfer arrest capno/etco2 to main
    updates["etco2"] = updates["arrest-etco2"];
    updates["capno-trace"] = updates["arrest-capno"];

    // set spo2 to sod-all
    updates["spo2"] = 64;

    // make nibp uninterpretably low
    let imaginarySbp = (10 + Math.random() * 20).toFixed(0);
    let imaginaryDbp = (5 + Math.random() * 10).toFixed(0);
    let imaginaryMap = (imaginarySbp * 0.6).toFixed(0);
    updates["systolic-blood-pressure-noninvasive"] = imaginarySbp;
    updates["diastolic-blood-pressure-noninvasive"] = "??";
    updates["mean-arterial-pressure-noninvasive"] = imaginaryMap;

    // set arrest-style morphologies for remaining traces
    updates["spo2-trace"] = "spo2-badtrace";
    updates["artline-trace"] = "spo2-badtrace";

    return updates;
}

function _applyStateToDom(state) {
    console.debug(`Sync: applying state to DOM: `, state);

    for (let simParameter in state) {
        let simValue = state[simParameter];

        let interestedElements = document.querySelectorAll(
            `[data-sim-parameter~="${simParameter}"]`,
        );

        for (let ie of interestedElements) {
            // when there are no mappings, just apply to sim-value
            // sharp edge: this can cause a race condition when there aren't mappings to cover all cases
            if (!ie.hasAttribute("data-sim-parameter-mapping")) {
                ie.setAttribute("sim-value", simValue);
                continue;
            }

            // assemble mappings
            let rawMappings = ie.dataset.simParameterMapping?.split(" ") || [];
            let mappings = [];
            for (let rm of rawMappings) {
                let split = rm.split(":");
                if (split.length === 2) {
                    mappings.push(split);
                }
            }

            // iterate over mappings
            // sharp edge: this has potentiate to over-write itself if two mappings are defined for a sim parameter
            let matchedMappings = 0;
            for (let m of mappings) {
                let [mapped_sim_param, mapped_element_attr] = m;
                if (mapped_sim_param === simParameter) {
                    ie.setAttribute(mapped_element_attr, simValue);
                    matchedMappings += 1;
                }
            }
            if (matchedMappings === 0) {
                console.error(
                    `Sync: no matching mapping found for sync parameter "${simParameter}" in element ${ie}, even though *some* mappings exist. Assigning value to sim-value`,
                    ie,
                );
            }
        }
    }
}
