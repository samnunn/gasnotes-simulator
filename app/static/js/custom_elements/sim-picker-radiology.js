import { sendInvestigation } from "../investigations";

customElements.define(
    "sim-picker-radiology",
    class extends HTMLElement {
        constructor() {
            super();
        }
        connectedCallback() {
            console.log("Radiology picker: element connected to DOM");
            this.addEventListener("click", (e) => {
                if (!e.target.matches("button[sim-send]")) return;

                let selection = this.querySelector("input:checked");
                if (!selection) {
                    console.warn(
                        "Radiology picker: send button cliked but no image was chosen, skipping…",
                    );
                    return;
                }

                let data = {
                    url: selection.dataset.url,
                    name_ugly: selection.dataset.nameUgly,
                    name_pretty: selection.dataset.namePretty,
                    credit: selection.dataset.credit,
                    url: selection.dataset.url,
                };

                sendInvestigation("radiology", data);
            });
        }
    },
);
