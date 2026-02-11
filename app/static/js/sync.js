export class TransitionManager {
    targetElement;
    targetValue;
    initialValue;
    currentValue;
    timeout;
    incrementSize;
    incrementDuration = 3000;
    running = true;
    nonTransitionable = false;

    constructor(targetElement, targetValue, targetParameter = "sim-value") {
        this.targetElement = targetElement;
        this.targetValue = parseInt(targetValue);
        this.initialValue = parseInt(
            this.targetElement.getAttribute("sim-value"),
        );
        this.currentValue = this.initialValue;

        // immediately commit changes for non-transitionable elements
        // early return to prevent any further horseplay
        if (this.targetElement.hasAttribute("sim-transitionable") != true) {
            // needs to skip parseInt() because wave morphologies are strings
            setValue(this.targetElement, targetValue);
            this.nonTransitionable = true;
            return;
        }

        // stop the currently-running transition
        if (this.targetElement.activeTransition instanceof TransitionManager) {
            this.targetElement.activeTransition.running = false;
        }

        // substitute this transition
        this.targetElement.activeTransition = this;
    }

    start() {
        if (this.nonTransitionable) return;

        // set duration
        let duration = document.body.getAttribute("sim-transition-time") || 0;

        // duration is an integer number of seconds
        if (duration > 0) {
            this.incrementSize =
                (this.targetValue - this.initialValue) /
                ((duration * 1000) / this.incrementDuration);
        } else {
            this.incrementSize = this.targetValue - this.initialValue;
        }

        // begin
        this.increment();
    }

    increment() {
        // only increment if running == true (gets set to false as an interrupt/end of transition signal)

        // if the total change exceeds the planned change, terminate the transition. otherwise increment/decrement
        let totalChange = Math.abs(this.currentValue - this.initialValue);
        let plannedChange = Math.abs(this.targetValue - this.initialValue);
        if (totalChange >= plannedChange) {
            this.currentValue = this.targetValue;
            this.running = false;
        } else {
            this.currentValue += this.incrementSize;
        }

        // commit changes to the DOM
        // parseInt() to get rid of decimals
        setValue(this.targetElement, parseInt(this.currentValue));

        // AWFUL HACK: special case for etCO2
        if (this.targetElement.getAttribute("sim-parameter") == "etco2") {
            let y_scale = this.currentValue / 36;
            y_scale = Math.max(0.15, Math.min(1, y_scale));
            document.querySelector("#capno").setAttribute("y-scale", y_scale);
        }

        // AWFUL HACK: special case for RR
        if (
            this.targetElement.getAttribute("sim-parameter") ==
            "respiratory-rate"
        ) {
            document
                .querySelector("#capno")
                .setAttribute("rate", this.currentValue);
        }

        // AWFUL HACK: special case for HR
        if (this.targetElement.getAttribute("sim-parameter") == "heart-rate") {
            document
                .querySelector("#ecg")
                .setAttribute("rate", this.currentValue);
        }

        // AWFUL HACK: a special case for spo2
        if (this.targetElement.getAttribute("sim-parameter") == "spo2") {
            // console.log('hack! spo2 is being transitioned')
            // console.log(this.initialValue, this.targetValue, this.currentValue)
        }

        // AWFUL HACK: special case for map (NIBP-dervived)
        if (
            this.targetElement.getAttribute("sim-parameter") ==
            "mean-arterial-pressure-noninvasive"
        ) {
            document
                .querySelector('[sim-parameter="spo2-trace"]')
                .setAttribute("y-scale", y_scale * 0.4 + 0.6);
        }

        // AWFUL HACK: special case for map (artline-derived)
        if (
            this.targetElement.getAttribute("sim-parameter") ==
            "mean-arterial-pressure"
        ) {
            let y_scale = (this.currentValue - 15) / 65;
            y_scale = Math.max(0.05, Math.min(1, y_scale));
            document
                .querySelector('[sim-parameter="artline-trace"]')
                .setAttribute("y-scale", y_scale);
            document
                .querySelector('[sim-parameter="spo2-trace"]')
                .setAttribute("y-scale", y_scale * 0.4 + 0.6);
        }

        if (this.running == true) {
            // set a timeout for next increment
            // will be a no-op if this.running was set to false above
            this.timeout = setTimeout(() => {
                this.increment();
            }, this.incrementDuration); // period is set in this.incrementDuration above
        }
    }

    cancel() {
        this.timeout = null;
    }
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
    if (document.body.dataset.simDemoMode == "true") return;

    function handleSimUpdate(message) {
        let updates = message["updates"];
        console.debug(
            "Sync: got updated state from server, updates were: ",
            updates,
        );
        let enablers = message["enablers"];
        console.debug(
            "Sync: got updated state from server, enablers were: ",
            enablers,
        );

        // special case for cardiac arrest
        let mode = updates["sim-mode"];
        document.body.setAttribute("sim-mode", mode);

        if (mode == "arrested") {
            // disable all parameters by default and selectively re-enable
            let allElements = document.querySelectorAll("[sim-parameter]");
            for (let el of allElements) {
                el.setAttribute("sim-disabled", "true");
            }

            // set user-defined arrest rhythms (or CPR)
            let ecgTrace = document.querySelector(
                '[sim-parameter="ecg-rhythm"]',
            );
            let cprActive = updates["sim-cpr"];

            let arrestedMorphology;
            if (cprActive == "on") {
                arrestedMorphology = "cpr";
            } else {
                arrestedMorphology = updates["arrest-rhythm"];
            }
            ecgTrace.setAttribute("morphology", arrestedMorphology);

            // set heart rate according to morphology
            if (["sinus", "flatline"].includes(arrestedMorphology)) {
                ecgTrace.setAttribute("rate", 60);
            } else if (arrestedMorphology == "cpr") {
                ecgTrace.setAttribute("rate", 100);
            } else {
                ecgTrace.setAttribute("rate", 250);
            }

            // set user-defined etco2
            let capnoTrace = document.querySelector(
                '[sim-parameter="capno-trace"]',
            );
            let etco2 = updates["arrest-etco2"];

            let y_scale = etco2 / 36;
            y_scale = Math.max(0.15, Math.min(1, y_scale));

            capnoTrace.setAttribute("y-scale", y_scale);
            capnoTrace.setAttribute("sim-value", "capno-normal");

            let etco2Readout = document.querySelector(
                '[sim-parameter="etco2"]',
            );
            etco2Readout.setAttribute("sim-value", etco2);

            // user user-defined capno
            let capnoMorphology = updates["arrest-capno"];
            capnoTrace.setAttribute("sim-value", capnoMorphology);
            capnoTrace.removeAttribute("sim-disabled");

            // set wobbly spo2 (simulates under-reading a poor trace during arrest)
            let spo2Readout = document.querySelector('[sim-parameter="spo2"]');
            spo2Readout.setAttribute("sim-value", 64);
            spo2Readout.removeAttribute("sim-disabled");
            spo2Readout.setAttribute("wobble", 15);

            // set arrest-style morphologies for remaining traces
            document
                .querySelector('[sim-parameter="spo2-trace"]')
                .setAttribute("sim-value", "flatline");
            document
                .querySelector('[sim-parameter="artline-trace"]')
                .setAttribute("sim-value", "flatline");

            // prevent further updates by returning early
            return;
        } else {
            // unset wobble on spo2
            let spo2Readout = document.querySelector('[sim-parameter="spo2"]');
            spo2Readout.setAttribute("wobble", 2);
        }

        // update each [sim-parameter]
        for (let u in updates) {
            const targetElements = document.querySelectorAll(
                `[sim-parameter="${u}"]`,
            );

            for (let el of targetElements) {
                // start transition
                // non-transitioning elements will automatically get a transition time of zero
                new TransitionManager(el, updates[u]);
            }

            // transition time
            if (u == "transition-time") {
                document.body.setAttribute("sim-transition-time", updates[u]);
            }
        }

        // enable or disable elements
        for (let e in enablers) {
            let listeningElements = document.querySelectorAll(
                `[data-sim-enabled-by="${e}"]`,
            );
            for (let le of listeningElements) {
                le.setAttribute("sim-disabled", !enablers[e]);
            }

            // special case: HR defined by spo2 trace
            let hr = document.querySelector([`[sim-parameter="heart-rate"]`]);
            if (enablers["ecg"] == false && enablers["spo2"] == true) {
                hr.setAttribute("sim-disabled", false);
                hr.classList.add("blue");
                hr.classList.remove("green");
            } else {
                hr.classList.add("green");
                hr.classList.remove("blue");
            }
        }

        // start all transitions
        // do this after state has been loaded in, so they all start/finish at the same time
        const transitionableElements = document.querySelectorAll(
            "[sim-transitionable]",
        );
        for (let el of transitionableElements) {
            el.activeTransition.start();
        }
    }
    socket.on("sim-update", (msg) => {
        let message = JSON.parse(msg);
        handleSimUpdate(message);
        document.querySelector("dialog[open]")?.close();
    });
    // hack: re-apply existing state on pageload
    // most parameters will be set on the server side
    // but this will run through any arrest special-casing etc

    window.addEventListener("load", (e) => {
        if (document.body.dataset.simDemoMode == "true") return;
        try {
            let state = JSON.parse(window.last_known_state);
            handleSimUpdate(state);
        } catch (e) {
            console.error(
                "Sync: couldn't parse/apply existing state from window.last_known_state (doing this to catch any arrest special-case logic missed by server-side hydration, sigh)",
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
        let message = dumpAllInputState();
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

function dumpAllInputState() {
    let message = {
        sim_room_id: document.body.dataset.simRoomId,
        updates: {},
        enablers: {},
    };

    // sim values
    let inputs = document.querySelectorAll("[data-sim-parameter]");
    for (let i of inputs) {
        let simValue = null;
        if (i.hasAttribute("checked")) {
            // handles checkboxes
            simValue = i.checked;
        } else if (i.hasAttribute("sim-value")) {
            // handles custom inputs
            simValue = i.getAttribute("sim-value");
        } else {
            // handles all other inputs
            simValue = i.value;
        }

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
