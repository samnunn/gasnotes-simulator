import { transitionIfAble } from "../sync.js"

customElements.define('sim-post', class extends HTMLElement {
    constructor() {
        super()
        this.contentTarget = document.querySelector(this.getAttribute('sim-post-target'))
        this.content = this.querySelector('[sim-post-content]')
        this.addEventListener('click', (e) => {
            transitionIfAble(() => {
                this.contentTarget.innerHTML = this.content.cloneNode(true).outerHTML
                // special case for ABG, sigh
                let abg = this.contentTarget.querySelector('sim-abg')
                if (abg) {
                    abg.digestData(this.content.abg_proxy)
                }
            })
        })
    }
})