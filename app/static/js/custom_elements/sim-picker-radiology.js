customElements.define(
    "sim-picker-radiology",
    class extends HTMLElement {
        constructor() {
            super();
        }
        connectedCallback() {
            console.log("Radiology picker: element connected to DOM");
        }
        serialise() {
            let selection = this.querySelector("input:checked");
            if (!selection) {
                console.warn(
                    "Radiology picker: unable to serialise because nothing is selected, skipping…",
                );
                return;
            }

            let data = {
                url: selection.dataset.url,
                credit: selection.dataset.credit,
            };

            return data;
        }
    },
);
