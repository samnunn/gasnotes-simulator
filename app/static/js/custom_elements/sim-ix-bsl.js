let style =
    /*css*/
    `
@scope {
    :scope {
        display: block;

        background-image: url('/static/img/bsl.svg');
        background-size: 100%;
        background-repeat: no-repeat;
            position: relative;

        aspect-ratio: 3/4;

        .bsl-machine__screen {
            container-name: bslscreen;
            container-type: size;

            aspect-ratio: 1;
            width: 60%;
            
            position: absolute;
            top: 15%;
            left: 20%;

            display: grid;
            grid-template-columns: 35% 65%;
            grid-template-rows: 50% 50%;

            align-items: start;

            input {
                appearance: none;
                font-size: 25cqh;
                text-align: right;
                background: none;
                border: none;
                outline: none;
                font-family: "7seg", monospace;
                color: black;
                margin: 0;
                padding: 0;
            }
            
            /* https://stackoverflow.com/questions/3790935/can-i-hide-the-html5-number-input-s-spin-box */
            input::-webkit-outer-spin-button,
            input::-webkit-inner-spin-button {
                -webkit-appearance: none;
                margin: 0;
            }
            
            input::placeholder {
                color: black;
                opacity: 0.2;
            }

            label {
                font-size: 15cqh;
                font-family: monospace;
                color: black;
                font-weight: bold;
            }
        }
    }
    :scope[readonly] * {
        pointer-events: none;
    }
}
`;

let markup =
    //html
    `
<style>
${style}
</style>
<div class="bsl-machine__screen">
    <label for="input-bsl">BSL</label>
    <input
        autofocus
        inputmode="decimal"
        type="number"
        id="input-bsl"
        step="0.1"
        min="0.0"
        max="40.0"
        placeholder="--"
    />
    <label for="input-ket">KET</label>
    <input
        inputmode="decimal"
        type="number"
        id="input-ket"
        step="0.1"
        min="0.0"
        max="10.0"
        placeholder="--"
    />
</div>
`;

customElements.define(
    "sim-ix-bsl",
    class extends HTMLElement {
        constructor() {
            super();
        }
        connectedCallback() {
            this.attachShadow({ mode: "open" });
            this.shadowRoot.innerHTML = markup;

            this.bsl = this.shadowRoot.querySelector("#input-bsl");
            this.ket = this.shadowRoot.querySelector("#input-ket");

            if (this.matches("[readonly]")) {
                this.bsl.disabled = true;
                this.ket.disabled = true;
            }

            if (this._pendingData) {
                this.deserialise(this._pendingData);
            }
        }
        serialise() {
            if (
                !this.shadowRoot.querySelector("input:not(:placeholder-shown)")
            ) {
                console.warn(
                    "BSL: unable to serialise because neither a BSL nor ketones were entered, skipping…",
                );
                return;
            }
            let data = {
                bsl: this.bsl.value,
                ket: this.ket.value,
            };
            return data;
        }
        deserialise(data) {
            if (this.isConnected) {
                this.bsl.value = data.bsl;
                this.ket.value = data.ket;
            } else {
                this._pendingData = data;
            }
        }
    },
);
