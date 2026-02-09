import { sendInvestigation } from "../investigations";

customElements.define(
    "sim-picker-abg",
    class extends HTMLElement {
        constructor() {
            super();
        }
        connectedCallback() {
            console.log("ABG picker: element connected to DOM");
            this.addEventListener("click", (e) => {
                if (!e.target.matches("button[sim-send]")) return;
                let data = this.querySelector("sim-abg").abg_proxy;

                console.log(`ABG picker: sending data:`, data);

                sendInvestigation("abg", data);
            });
        }
    },
);
