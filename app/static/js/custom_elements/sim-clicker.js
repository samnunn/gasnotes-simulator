customElements.define(
    "sim-clicker",
    class extends HTMLElement {
        constructor() {
            super();
        }

        connectedCallback() {
            this.insertAdjacentHTML(
                "afterbegin",
                /*html*/ `<button class="minus">–</button>`,
            );
            this.insertAdjacentHTML(
                "beforeend",
                /*html*/ `<button class="plus">+</button>`,
            );

            this.inputElement = this.querySelector("input");
            this.inputMin =
                parseFloat(this.inputElement.getAttribute("min")) || 0;
            this.inputMax =
                parseFloat(this.inputElement.getAttribute("max")) || 999;
            this.plusButton = this.querySelector("button.plus");
            this.minusButton = this.querySelector("button.minus");

            this.addEventListener("click", (e) => {
                if (e.target == this.plusButton) {
                    this.inputElement.value = Math.min(
                        this.inputMax,
                        parseInt(this.inputElement.value) + 1,
                    );
                } else if (e.target == this.minusButton) {
                    this.inputElement.value = Math.max(
                        this.inputMin,
                        parseInt(this.inputElement.value) - 1,
                    );
                } else {
                    return;
                }
                this.setAttribute("sim-value", this.inputElement.value);
            });

            this.inputElement.addEventListener("focusin", (e) => {
                if (!e.target.matches("input")) return;
                e.target.select();
            });

            this.inputElement.addEventListener("input", (e) => {
                if (e?.detail?.preventAutophagy == true) return;
                e.stopImmediatePropagation();

                this.setAttribute("sim-value", this.inputElement.value);

                this.dispatchEvent(
                    new CustomEvent("input", {
                        bubbles: true,
                        detail: { preventAutophagy: true },
                    }),
                );
            });
        }

        attributeChangedCallback(name, oldValue, newValue) {}

        static get observedAttributes() {
            return [];
        }
    },
);
