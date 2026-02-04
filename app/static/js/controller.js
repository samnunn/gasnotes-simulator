// CUSTOM ELEMENTS
import "./custom_elements/sim-mapgroup";
import "./custom_elements/sim-slider";
import "./custom_elements/sim-radiogroup";
import "./custom_elements/sim-imagepicker";

// SOCKETS
import { connectSocket } from "./sockets";
let socket = connectSocket();

// SYNC SETUP
import { registerControllerSyncEmitter } from "./sync";
registerControllerSyncEmitter(socket);

// SYNC VALUES (within page)
document.addEventListener("input", (e) => {
    if (!e.target.matches("[sim-sync]")) return;
    if (e?.detail?.preventAutophagy == true) return;

    let parameter = e.target.dataset.simParameter;
    if (parameter) {
        let interestedElements = document.querySelectorAll(
            `[data-sim-parameter="${parameter}"]`,
        );
        for (let ie of interestedElements) {
            ie.value = e.target.value;
            ie.dispatchEvent(
                new CustomEvent("input", {
                    bubbles: true,
                    detail: {
                        preventAutophagy: true,
                    },
                }),
            );
        }
    }
});

// NON-PERFUSING RHYTHM CHECKER
let normalEcg = document.querySelector('[data-sim-parameter="ecg-rhythm"]');
let arrestEcg = document.querySelector('[data-sim-parameter="arrest-rhythm"]');
let arrestButton = document.querySelector("#arrest-button");

let lastEcgValue = normalEcg.value; // keep track of last non-arrested rhythm choice

normalEcg.addEventListener("change", (e) => {
    if (e.target.options[e.target.selectedIndex].hasAttribute("sim-arrest")) {
        // confirm with user
        let a = confirm(`Initiate cardiac arrest?`);
        if (!a) {
            document
                .querySelector('[data-sim-parameter="heart-rate"]')
                .setAttribute("sim-value", 220);
            return true;
        }

        // set arrest rhythm parameter (it's a separate <select> element)
        arrestEcg.value = e.target.value;

        // initiate cardiac arrest
        arrestButton.click();

        // restore last non-arrested rhythm choice
        e.target.value = lastEcgValue;
    } else {
        // keep track of last non-arrested rhythm choice
        lastEcgValue = e.target.value;
    }
});

// CPR
let cprButton = document.querySelector("#cpr-button");
let cprInput = document.querySelector('[data-sim-parameter="sim-cpr"]');

cprButton.addEventListener("click", (e) => {
    cprButton.classList.toggle("red");

    if (cprButton.classList.contains("red")) {
        // non-arrested
        cprInput.value = "off";
    } else {
        // arrested
        cprInput.value = "on";
    }
});

// ARREST SPECIAL CASE
let normalCapno = document.querySelector('[data-sim-parameter="capno-trace"]');
let arrestCapno = document.querySelector('[data-sim-parameter="arrest-capno"]');
let simModeSwitch = document.querySelector('[data-sim-parameter="sim-mode"]');
simModeSwitch.addEventListener("input", (e) => {
    // set mode parameter on body
    // will be picked up by CSS to hide physiologically irrelevant parameters
    document.body.setAttribute(
        "sim-mode",
        simModeSwitch.getAttribute("sim-value"),
    );

    if (e.target.value == "arrested") {
        // carry over non-arrested capno morphology (IF it exists)
        // arrest capno doesn't have all the modes of non-arrest capno
        // will default to "disconnected" if a nonexistent mode is set
        arrestCapno.value = normalCapno.value;
        // trigger input event on arrest capno
        // this allows it to disable the etco2 slider according to its own sim-disconnect rules
        arrestCapno.dispatchEvent(new CustomEvent("input", { bubbles: true }));
    } else {
        cprInput.value = "off";
        cprButton.classList.add("red");
    }
});
// TODO: render this server-side to avoid FOUC-like appearance of "alive" mode
document.body.setAttribute("sim-mode", simModeSwitch.getAttribute("sim-value"));

// ABG
let sendableAbg = document.querySelector("#sendable-abg");
let abgButton = document.querySelector("#abg-send");
abgButton.addEventListener("click", (e) => {
    let message = {
        sim_room_id: document.body.dataset.simRoomId,
        type: "ABG",
        abg_data: sendableAbg.abg_proxy,
    };
    socket.emit("sim-post", JSON.stringify(message));
    document.querySelector("#abg-picker")?.close();
});
let presetPicker = document.querySelector("#abg-presets");
let presets = {
    "Acute Respiratory Acidosis": {
        ph: 7.27,
        pco2: 77,
    },
    "Chronic Respiratory Acidosis": {
        ph: 7.31,
        pco2: 61,
    },
    HAGMA: {
        ph: 7.11,
        pco2: 42,
    },
    NAGMA: {
        ph: 7.11,
        pco2: 48,
        cl: 115,
    },
    DKA: {
        ph: 7.05,
        pco2: 31,
        bsl: 37,
        lactate: 1.9,
        na: 128,
        k: 3.1,
        cl: 96,
        ca: 1.21,
    },
    HHS: {
        ph: 7.36,
        pco2: 35,
        bsl: 43,
        lactate: 0.8,
        na: 124,
        k: 3.7,
        cl: 114,
        cr: 119,
    },
};
document.addEventListener("DOMContentLoaded", (e) => {
    for (let p in presets) {
        let option = document.createElement("option");
        option.innerText = p;
        option.value = p;
        option.parameters = presets[p];
        presetPicker.insertAdjacentElement("beforeend", option);
    }
});
presetPicker.addEventListener("change", (e) => {
    let option = e.target.options[e.target.selectedIndex];
    let parameters = option.parameters;
    for (let p in parameters) {
        sendableAbg.abg_proxy[p] = parameters[p];
    }
});
sendableAbg.addEventListener("input", (e) => {
    presetPicker.selectedIndex = 0;
});

// NIBP
import {
    registerNibpAutoCycleStateEmitter,
    registerNibpAutoCycleStateReceiver,
    registerRemoteNibpCycleEmitter,
} from "./nibp";
// remote cycle
registerRemoteNibpCycleEmitter(socket);
// on/off switch sync
registerNibpAutoCycleStateEmitter(socket);
registerNibpAutoCycleStateReceiver(socket);
