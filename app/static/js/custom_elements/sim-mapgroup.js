//     ____  ____     _____ ___     __                                     
//    / __ )/ __ \   / ___// (_)___/ /__  __________                       
//   / __  / /_/ /   \__ \/ / / __  / _ \/ ___/ ___/                       
//  / /_/ / ____/   ___/ / / / /_/ /  __/ /  (__  )                        
// /_____/_/       /____/_/_/\__,_/\___/_/  /____/                         

customElements.define('sim-mapgroup', class extends HTMLElement {
    constructor() {
        super()
    }

    connectedCallback() {
        this.sbp = this.querySelector('[data-sim-sbp]')
        this.dbp = this.querySelector('[data-sim-dbp]')
        this.map = this.querySelector('[data-sim-map]')
        this.pulseWidth = 0
        this.updatePulseWidth()
        this.sbp.addEventListener('input', (e) => {
            if (e?.detail?.preventAutophagy == true) return
            // prevent SBP from dipping below DBP
            let sbp_val = parseInt(this.sbp.value)
            let dbp_val = parseInt(this.dbp.value)
            this.setSBP(Math.max(dbp_val, sbp_val))

            // and update MAP
            this.updateMAP()
            this.updatePulseWidth()
        })
        this.dbp.addEventListener('input', (e) => {
            if (e?.detail?.preventAutophagy == true) return
            // prevent DBP from exceeding SBP
            let sbp_val = parseInt(this.sbp.value)
            let dbp_val = parseInt(this.dbp.value)
            this.setDBP(Math.min(dbp_val, sbp_val))

            // and update MAP
            this.updateMAP(e)
            this.updatePulseWidth()
        })
        this.map.addEventListener('input', (e) => {
            if (e?.detail?.preventAutophagy == true) return
            // map = (2*dbp + sbp)/3
            // dbp = (3*map - sbp)/2
            // sbp = (3*map - 2*dbp)

            let sbp_val = parseInt(this.sbp.value)
            let dbp_val = parseInt(this.dbp.value)
            let map_val = parseInt(this.map.value)

            // adjust SBP and DBP
            let new_sbp = null
            let new_dbp = null

            if (dbp_val <= this.dbp.min && sbp_val >= this.sbp.max) {
                // if both are at their limits, just make sure MAP is calculated correctly
                this.updateMAP()
            } else if (dbp_val <= this.dbp.min && sbp_val - dbp_val < this.pulseWidth) {
                // if dbp is minimal AND the difference is less than the last-recorded this.pulseWidth, derive SBP
                new_sbp = 3 * map_val - 2 * dbp_val
            } else if (sbp_val >= this.sbp.max && sbp_val - dbp_val < this.pulseWidth) {
                // if sbp is maximal AND the difference is less than the last-recorded this.pulseWidth, defive DBP
                new_dbp = (3 * map_val - sbp_val) / 2
            } else {
                // if neither are at their limits, move them up and down while preserving pulse width
                new_sbp = map_val + (2 / 3) * this.pulseWidth
                // new_dbp = map_val - (1/3) * this.pulseWidth
                new_dbp = new_sbp - this.pulseWidth // minimise rounding errors
            }

            // deploy SBP/DBP updates, if they are needed
            if (new_sbp) {
                new_sbp = parseInt(new_sbp) // remove decimals
                new_sbp = Math.min(this.sbp.max, new_sbp) // do not violate user-specified minima
                this.setSBP(new_sbp)
            }
            if (new_dbp) {
                new_dbp = parseInt(new_dbp) // remove decimals
                new_dbp = Math.max(this.dbp.min, new_dbp) // do not violate user-specified maxima
                this.setDBP(new_dbp)
            }

            // does NOT update this.pulseWidth
        })
    }

    updateMAP() {
        let sbp_val = parseInt(this.sbp.value)
        let dbp_val = parseInt(this.dbp.value)
        let new_map = ((sbp_val + 2 * dbp_val) / 3).toFixed(0)
        this.setMAP(new_map)
        return new_map
    }

    updatePulseWidth() {
        let sbp_val = this.sbp.value
        let dbp_val = this.dbp.value
        this.pulseWidth = sbp_val - dbp_val
        return this.pulseWidth
    }

    setMAP(v) {
        this.setValueGeneric(this.map, v)
    }

    setSBP(v) {
        this.setValueGeneric(this.sbp, v)
    }

    setDBP(v) {
        this.setValueGeneric(this.dbp, v)
    }

    setValueGeneric(target, v) {
        target.value = v
        target.dispatchEvent(new CustomEvent("input", { bubbles: true, detail: { preventAutophagy: true } }))
    }

})