customElements.define(
    "sim-radiogroup",
    class extends HTMLElement {
        // I made this so I could query a single element's sim-value and have it return which radio button was selected
        // The conventional way in JS is to use querySelector('input[type="radio"]:checked')
        // The way I'm serialising all data-sim-parameters from the DOM requires every element with a data-sim-parameter defined to also return a .value or a .getAttribute('sim-value')
        constructor() {
            super();
        }

        connectedCallback() {
            this.addEventListener("input", (e) => {
                if (e?.detail?.preventAutophagy == true) return;
                e.stopImmediatePropagation();

                this.updateSimValue();

                this.dispatchEvent(
                    new CustomEvent("input", {
                        bubbles: true,
                        detail: { preventAutophagy: true },
                    }),
                );
            });

            this.updateSimValue();
        }

        updateSimValue() {
            let selectedElement = this.querySelector(
                'input[type="radio"]:checked',
            );
            this.setAttribute("sim-value", selectedElement.value);
        }

        attributeChangedCallback(name, oldValue, newValue) {
            if (name == "sim-value") {
                let target = this.querySelector(
                    `input[type="radio"][value="${newValue}"]`,
                );
                target.checked = true;
            }
        }

        static get observedAttributes() {
            return ["sim-value"];
        }
    },
);
