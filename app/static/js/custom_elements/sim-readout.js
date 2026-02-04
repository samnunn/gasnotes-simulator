customElements.define(
    "sim-readout",
    class extends HTMLElement {
        prefix;
        suffix;
        limitHigh;
        limitLow;
        wobble_timer;

        constructor() {
            super();
            this.prefix = this.getAttribute("prefix");
            this.suffix = this.getAttribute("suffix");
            this.wobble_factor = parseInt(this.getAttribute("wobble")) || 0;
            this.limitHigh =
                parseInt(this.getAttribute("sim-limit-high")) || null;
            this.limitLow =
                parseInt(this.getAttribute("sim-limit-low")) || null;
            this.limitExceded = false;
            this.innerHTML = `
        <span class="readout-value">${this.prefix}--${this.suffix}</span>
        `;
            this.wobble();
        }

        updateReadout(printedValue = null) {
            if (printedValue == null) {
                printedValue = this.getAttribute("sim-value");
            }

            if (this.getAttribute("sim-disabled")?.toLowerCase() == "true") {
                printedValue = "--";
            }

            this.querySelector("span.readout-value").innerText =
                this.prefix + printedValue + this.suffix;

            this.checkSafety(printedValue);
        }

        checkSafety(proposedValue) {
            if (!this.limitHigh || !this.limitLow) return;
            let proposedInt = parseInt(proposedValue);
            if (proposedInt > this.limitHigh || proposedInt < this.limitLow) {
                this.setAttribute("sim-alarm", "on");
                this.limitExceded = true;
            } else {
                this.setAttribute("sim-alarm", "off");
                this.limitExceded = false;
            }
        }

        wobble() {
            if (this.wobble_factor == 0) return;

            clearTimeout(this.wobble_timer);

            let trueValue = this.getAttribute("sim-value");
            let randomValue =
                parseInt(trueValue) +
                Math.floor(
                    Math.random() * this.wobble_factor * 2 - this.wobble_factor,
                );

            let max = parseInt(this.getAttribute("wobble-max"));
            if (Number.isInteger(max)) {
                randomValue = Math.min(randomValue, max);
            }
            let min = parseInt(this.getAttribute("wobble-min"));
            if (Number.isInteger(min)) {
                randomValue = Math.max(randomValue, min);
            }

            this.updateReadout(randomValue);

            // update more frequently when out of range
            let randomInterval;
            if (this.limitExceded == true) {
                randomInterval = 2000 + Math.random() * 2000;
            } else {
                randomInterval = 8000 + Math.random() * 8000;
            }

            this.wobble_timer = setTimeout(() => {
                this.wobble();
            }, randomInterval);
        }

        attributeChangedCallback(name, oldValue, newValue) {
            if (name == "wobble") {
                this.wobble_factor = parseInt(newValue);
            } else {
                this.updateReadout();
            }
        }

        static get observedAttributes() {
            return ["sim-value", "sim-disabled", "wobble"];
        }
    },
);
