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
            this.prefix = this.dataset.simPrefix || "";
            this.suffix = this.dataset.simSuffix || "";
            this.wobble_factor = parseInt(this.dataset.simWobble) || 0;
            this.wobble_min = parseInt(this.dataset.simWobbleMin);
            this.wobble_max = parseInt(this.dataset.simWobbleMax);

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

            if (
                this.getAttribute("data-sim-enabled")?.toLowerCase() == "false"
            ) {
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

            // apply limits
            if (this.wobble_max) {
                randomValue = Math.min(randomValue, this.wobble_max);
            }

            if (this.wobble_min) {
                randomValue = Math.max(randomValue, this.wobble_min);
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
            if (name == "data-sim-wobble") {
                this.wobble_factor = parseInt(newValue) || 0;
            } else {
                this.updateReadout();
            }
        }

        static get observedAttributes() {
            return ["sim-value", "data-sim-enabled", "data-simwobble"];
        }
    },
);
