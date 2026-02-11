import { sendInvestigation } from "../investigations";

customElements.define(
    "sim-ix-sender",
    class extends HTMLElement {
        constructor() {
            super();
        }
        connectedCallback() {
            let type = this.dataset.type;
            let icon = this.dataset.icon || "🧪";
            let name = this.dataset.name || "Investigation";

            if (!type) {
                console.error(
                    "Investigations: failed to connect sim-ix-sender to DOM, no data-type property was set",
                );
                return;
            }

            console.log(
                `Investigations: sim-ix-sender element connected to DOM with type "${type}"`,
            );

            this.addEventListener("click", (e) => {
                if (!e.target.matches("button[sim-send]")) return;
                let data = this.querySelector("[sim-sendable]").serialise();

                console.log(
                    `Investigations: sending data from "${type}"`,
                    data,
                );

                sendInvestigation(type, data, name, icon);

                this.querySelector("dialog").close();
            });
        }
    },
);
