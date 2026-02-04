customElements.define("sim-slider", class extends HTMLElement {
    constructor() {
        super();
    }
    updateValueDisplay(v) {
        this.outputElement.innerText = v
    }
    connectedCallback() {
        let min = this.querySelector("input")?.min
        let max = this.querySelector("input")?.max

        this.insertAdjacentHTML("beforeend", `
        <div class="input-label">
            <span>${this.dataset.displayName}</span>
            <br>
            <span class="sim-value"></span>
            </div>
            <div class="slider">
                <div class="minmax">
                    <span class="min">${min}</span>
                    <span class="max">${max}</span>
                </div>
            </div>
        `)

        // wire up displays
        this.inputElement = this.querySelector("input")
        this.outputElement = this.querySelector("span.sim-value")
        this.inputElement.addEventListener("input", (e) => {
            this.updateValueDisplay(e.target.value)
        })
        this.updateValueDisplay(this.inputElement.value)

        // move <input> to the correct place
        this.querySelector(".minmax").before(this.inputElement)
    }
})