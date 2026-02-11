customElements.define(
    "sim-ix-radiograph",
    class extends HTMLElement {
        constructor() {
            super();
        }
        connectedCallback() {
            this.innerHTML = `<img class="thumbnail">`;
            if (this._pendingData) {
                this.deserialise(this._pendingData);
            }
        }
        serialise() {
            let data = {
                url: this.querySelector("img").getAttribute("src"),
            };
            return data;
        }
        deserialise(data) {
            if (this.isConnected) {
                this.querySelector("img").setAttribute("src", data.url);
            } else {
                this._pendingData = data;
            }
        }
    },
);
