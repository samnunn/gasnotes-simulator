// sim-clicker {
//     display: flex;
//     background-color: var(--dark-grey);
//     border: 2px solid #222;
//     border-radius: 0.5rem;
//     overflow: hidden;

//     input[type="number"] {
//         flex-grow: 1;
//         font-size: 1.2rem;
//         appearance: none;
//         border-radius: 0;
//         background: none;
//         border: none;
//         outline: none;
//         padding: 0.2rem;
//         text-align: center;
//         margin: 0;
//         -moz-appearance: textfield;
//     }
//     input::-webkit-outer-spin-button,
//     input::-webkit-inner-spin-button {
//         -webkit-appearance: none;
//     }

//     button {
//         appearance: none;
//         aspect-ratio: 1;
//         border-radius: 0;
//         background: #222;
//         border: none;
//         outline: none;
//         padding: 0;
//         margin: 0;
//         color: white;
//         font-size: 1rem;
//         font-weight: bold;
//     }
//     button:hover {
//         background-color: oklch(from var(--dark-grey) 0.3 c h);
//     }

//     button:active {
//         background-color: oklch(from var(--dark-grey) 0.4 c h);
//     }

//     &:has(input:invalid) {
//         border-color: color-mix(in srgb, var(--color-red) 70%, black);
//         input:invalid {
//             color: var(--color-red);
//         }
//     }
// }

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
