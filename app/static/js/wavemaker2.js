//  _       __                 __  ___      __                ___
// | |     / /___ __   _____  /  |/  /___ _/ /_____  _____   |__ \
// | | /| / / __ `/ | / / _ \/ /|_/ / __ `/ //_/ _ \/ ___/   __/ /
// | |/ |/ / /_/ /| |/ /  __/ /  / / /_/ / ,< /  __/ /      / __/
// |__/|__/\__,_/ |___/\___/_/  /_/\__,_/_/|_|\___/_/      /____/
//

// ┌────────────────────────────────────────────────────────────────────────┐
// │            ┌─────────────────────────────────────────────────────────┐ │
// │            │                          Wave                           │ │
// │            │ ┌─────────┐┌─────────┐┌─────────┐┌─────────┐┌─────────┐ │ │
// │            │ │ Complex ││ Complex ││ Complex ││ Complex ││ Complex │ │ │
// │            │ └─────────┘└─────────┘└─────────┘└─────────┘└─────────┘ │ │
// │            └─────────────────────────────────────────────────────────┘ │
// │            ┌─────────────────────────────────────────────────────────┐ │
// │            │                          Wave                           │ │
// │            │ ┌─────────┐┌─────────┐┌─────────┐┌─────────┐┌─────────┐ │ │
// │  waveSet   │ │ Complex ││ Complex ││ Complex ││ Complex ││ Complex │ │ │
// │            │ └─────────┘└─────────┘└─────────┘└─────────┘└─────────┘ │ │
// │            └─────────────────────────────────────────────────────────┘ │
// │            ┌─────────────────────────────────────────────────────────┐ │
// │            │                          Wave                           │ │
// │            │ ┌─────────┐┌─────────┐┌─────────┐┌─────────┐┌─────────┐ │ │
// │            │ │ Complex ││ Complex ││ Complex ││ Complex ││ Complex │ │ │
// │            │ └─────────┘└─────────┘└─────────┘└─────────┘└─────────┘ │ │
// │            └─────────────────────────────────────────────────────────┘ │
// └────────────────────────────────────────────────────────────────────────┘

customElements.define('sim-trace', class extends HTMLElement {
    // accumulators
    complexCount = 0
    baselineWanderAccumulator = Math.random() * 150

    constructor() {
        // boilerplate
        super()

        // setup and defaults
        this.pacemaker_id       = this.getAttribute('pacemaker')                    || null
        this.mode               = this.getAttribute('mode')                         || 'pacemaker'
        this.morphology         = this.getAttribute('morphology')                   || 'sinus'
        this.last_morphology    = this.morphology
        this.strokeColour       = this.getAttribute('stroke-colour')                || 'green'
        this.fillColour         = this.getAttribute('fill-colour')                  || 'none'
        this.fillOpacity        = parseFloat(this.getAttribute('fill-opacity'))     || 1.0
        this.y_scale            = parseFloat(this.getAttribute('y-scale'))          || 1
        this.pixelsPerSecond    = parseInt(this.getAttribute('x-rate'))             || 100
        this.rate               = parseInt(this.getAttribute('rate'))               || 60
        this.strokeWidth        = parseInt(this.getAttribute('stroke-width'))       || 2
        this.height             = parseInt(this.getAttribute('height'))             || 250
        this.maxLayers          = parseInt(this.getAttribute('max-layers'))         || 10
        this.last_y             = this.height/2                                     // initial baseline = 50% of this.height
        this.wobble_enabled     = this.getAttribute('baseline-wobble') == "true"

        // INIT
        // make a waveSet element
        this.waveSet = document.createElement('div')
        this.waveSet.classList.add('waveset')

        // style the waveSet
        this.waveSet.style.height = `${this.height}px`
        this.waveSet.innerHTML = `<style>
sim-wave {
    display: block;
    width: 100%;
}
.waveset {
    color: white;
    /* using grid to stack waves in the z axis*/
    /* absolute positioning breaks the width animation */
    display: grid;
    grid-template-rows: 1fr;
    grid-template-columns: 1fr;
    grid-template-areas: "wave";
    overflow: hidden;
}
.wave {
    box-sizing: content-box;
    grid-area: wave;
    overflow: hidden;
    border-right: 0px solid black;
    width: 0%;
    height: 100%;
    position: relative;
    background-color: black;
}
</style>`

        // add waveSet to DOM
        this.appendChild(this.waveSet)

        // make the first wave
        let firstWave = this.constructWave(0)
        this.insertWave(firstWave)

        // copycat mode
        // subscribes to 'beat' events from its controlling sim-trace
        // disables built-in pacemaker
        if (this.mode == 'copycat') {
            // add event listener to pacemaker that beats every time it's called
            this.pacemaker = document.getElementById(this.pacemaker_id)
            this.pacemaker.addEventListener('beat', (e) => {
                this.rate = this.pacemaker.rate
                this.beat(e.detail, false)
            })
        }
    }

	attributeChangedCallback (name, oldValue, newValue) {
        if (name == 'rate') {
            this.rate = newValue
        }
        if (name == 'y-scale') {
            this.y_scale = newValue
        }
        if (name == 'morphology' || name == 'sim-value') {
            this.morphology = newValue
        }
        
        let event = new Event("sim-value-changed")
        this.dispatchEvent(event)
	}

	static get observedAttributes () {
		return ['rate', 'morphology', 'sim-value', 'y-scale']
	}

    //     __  ___      _          __
    //    /  |/  /___ _(_)___     / /   ____  ____  ____
    //   / /|_/ / __ `/ / __ \   / /   / __ \/ __ \/ __ \
    //  / /  / / /_/ / / / / /  / /___/ /_/ / /_/ / /_/ /
    // /_/  /_/\__,_/_/_/ /_/  /_____/\____/\____/ .___/
    //                                          /_/

    // beat() is either called by listening for 'beat' events on the pacemaker trace or self-calling via an animation-based timeout (not setTimeout, bleh)
    // these are its tasks:
    // - Save a reference to the front-most wave (the frontmost wave will change in the case of a newline)
    // - Insert a new correctly-offset <path> IF there has been a morphology change
    //      - Done so the "sim-disconnect" morphology could be a dashed line without making all surrounding complexes dashed too
    // - Makes a new complex in the current morphology
    // - Inserts the new complex
    // - Calculates initial and final width of the front wave
    // - Calculates the x overshoot
    // - Initiates newline procedure of overshoot is >= 0 px:
    //      - Creates a new <div.wave>
    //      - Usual case: copies the SVG from the last line into the new one and moves it leftwards
    //      - Special case for a disconnection: creates a new flat line (equal to the overshoot length) instead of copying the last SVG
    //      - Does this because discontinuous lines make the dashes appear uneven
    // - 
    // - 
    // - 
    beat(mandatoryWidth=0, repeating=false, animating=true) {
        // save reference to this.frontWave as targetWave
        // avoids collision in newline handler, where animate() should apply to whatever is the front wave at the start of this function call
        let targetWave = this.frontWave
        
        // disconnected handler
        if (this.morphology != this.last_morphology) {
            let newPath = document.createElementNS("http://www.w3.org/2000/svg", "path")
            newPath.setAttribute('fill', this.fillColour)
            newPath.setAttribute('fill-opacity', this.fillOpacity)
            newPath.setAttribute('stroke', this.strokeColour)
            newPath.setAttribute('stroke-width', this.strokeWidth)
            newPath.setAttribute('fill', 'none')
            newPath.setAttribute('d', `M ${targetWave.x_cursor},${this.last_y} `)
            
            this.frontWave.querySelector('svg')?.appendChild(newPath)
        }
        // save for next time
        this.last_morphology = this.morphology
        
        if (this.morphology == 'sim-disconnect' || this.morphology == 'nibp-only') {
            this.frontWave.querySelector('path:last-child').setAttribute('stroke-dasharray', '20,20')
        }
        
        // make new complex
        let newComplex = this.constructComplex(targetWave, mandatoryWidth)

        // insert new complex
        this.insertComplex(targetWave, newComplex)

        // calculate initialWidth, finalWidth, overshoot
        let initialWidth = targetWave.clientWidth
        let overshoot = initialWidth + newComplex.width - this.waveSet.clientWidth

        let finalWidth
        if (targetWave.clientWidth == 0) { // first complex in a wave
            // console.log(`finalWidth calculated for FIRST complex in a wave: targetWave.x_offset (${targetWave.x_offset}) + newComplex.width (${newComplex.width})`)
            finalWidth = targetWave.x_offset + newComplex.width
            // ┌─div.waveset────────────────────────────────────────────────────────────────────────────────────┐
            // ├┐                                                                                               │
            // │├ svg > path─ ─ ─ ┐                                                                             │
            // ││                                                                                               │
            // ││                 │                                                                             │
            // │◀────────────────▶                                                                              │
            // ││   finalWidth    │                                                                             │
            // ││                                                                                               │
            // ││                 │                                                                             │
            // │◀────────────────▶                                                                              │
            // ││newComplex.width │                                                                             │
            // ││                                                                                               │
            // │├ ─ ─ ─ ─ ─ ─ ─ ─ ┘                                                                             │
            // ├┘◀──── div.wave, initialWidth = 0                                                               │
            // └────────────────────────────────────────────────────────────────────────────────────────────────┘
        } else if (overshoot >= 0) { // last complex in a wave
            // console.log('finalWidth calculated for LAST complex in a wave: this.waveSet.clientWidth')
            finalWidth = this.waveSet.clientWidth
            // ┌─div.waveset────────────────────────────────────────────────────────────────────────────────────┐
            // ├─div.wave─────────────────────────────────────────────────────────────────────────────┐         │
            // │        ┌ svg > path─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┼ ─ ─ ─ ─ ┼ ─ ─ ─ ─ ┐
            // │◀────────────────────────────────────────────────────────────────────────────────────▶│         │
            // │        │                                initialWidth                                 │         │         │
            // │◀─────────────────────────────────────────────────────────────────────────────────────┼────────▶│
            // │        │                                finalWidth                                   │         │         │
            // │◀──────▶                                                                              │◀────────┼────────▶
            // │x_offset│                                                                             │  newComplex.width │
            // │                                                                                      │         │
            // │        │                                                                             │         │◀───────▶│
            // │                                                                                      │         │overshoot
            // │        └ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┼ ─ ─ ─ ─ ┼ ─ ─ ─ ─ ┘
            // ├──────────────────────────────────────────────────────────────────────────────────────┘         │
            // └────────────────────────────────────────────────────────────────────────────────────────────────┘
        } else { // all intermediate complexes
            finalWidth = targetWave.clientWidth + newComplex.width
            // console.log('finalWidth calculated for MIDDLE complex in a wave: targetWave.clientWidth + newComplex.width')
            // ┌─div.waveset────────────────────────────────────────────────────────────────────────────────────┐
            // ├─div.wave─────────────────────────────────────────────────┐                                     │
            // │        ┌ svg > path─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┼ ─ ─ ─ ─ ─ ─ ─ ─ ─                   │
            // │◀────────────────────────────────────────────────────────▶│                  │                  │
            // │        │                                initialWidth     │                                     │
            // │◀─────────────────────────────────────────────────────────┼─────────────────▶│                  │
            // │        │                                finalWidth       │                                     │
            // │◀──────▶                                                  │                  │                  │
            // │x_offset│                                                 │                                     │
            // │                                                          │◀────────────────▶│                  │
            // │        │                                                 │ newComplex.width                    │
            // │                                                          │                  │                  │
            // │        └ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┼ ─ ─ ─ ─ ─ ─ ─ ─ ─                   │
            // ├──────────────────────────────────────────────────────────┘                                     │
            // └────────────────────────────────────────────────────────────────────────────────────────────────┘
        }

        // newline handler
        if (overshoot >= 0) {
            //     ┌────────────────────────────────────────────────────────────────────────────────────────────────┐
            //     │┌──────────────────────────────────────────────────────────────────────────────────────────────┐│
            //     ││┌ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┼│─ ─ ─ ─ ─ ─ ─
            //     ││                                                                                              ││             │
            //     │││                                                                                             ││
            //     ││                                                                                              ││             │
            //     │││                         SVG gets copied and left-shifted such that the                      ││
            //   ┌─┼┼───────────────────────── currently-hidden portion (overshoot) becomes                        ││◀───────────▶│
            //   │ │││                         visible in the x_offset of the next line                            ││  overshoot
            //   │ ││                                                                                              ││             │
            //   │ │││                                                                                             ││
            //   │ ││                                                                                              ││             │
            //   │ ││└ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┼│─ ─ ─ ─ ─ ─ ─
            //   │ │└──────────────────────────────────────────────────────────────────────────────────────────────┘│
            //   │ └────────────────────────────────────────────────────────────────────────────────────────────────┘
            //   │
            //   │ ┌────────────────────────────────────────────────────────────────────────────────────────────────┐
            //   │ │┌──────────────────────────────────────────────────────────────────────────────────────────────┐│
            //  ─│─│┼ ─ ─ ─ ─ ─ ─ ─ ┌ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─││
            //   ▼ ││              │                                                                               ││
            //     ││               │                                                                              ││
            //     ││              │                                                                               ││
            //     ││◀────────────▶ │                                                                              ││
            //     ││  x_offset    │                                                                               ││
            //     ││     ==        │                                                                              ││
            //     ││  overshoot   │                                                                               ││
            //     ││               │                                                                              ││
            //     ││              │                                                                               ││
            //  ─ ─│┼ ─ ─ ─ ─ ─ ─ ─ └ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─││
            //     │└──────────────────────────────────────────────────────────────────────────────────────────────┘│
            //     └────────────────────────────────────────────────────────────────────────────────────────────────┘

            // construct new wave
            let newWave = this.constructWave(overshoot)

            // copy-pasta current SVG to new wave
            let outgoingSVG = targetWave.svg.cloneNode(true) // clone to avoid borking the original
            outgoingSVG.style.position = 'absolute'
            outgoingSVG.style.left = `-${initialWidth + newComplex.width - targetWave.x_offset - overshoot - 0.5}px`
            // shortening the leftward displacement by 0.5px prevents the little black gap between waves from appearing
            outgoingSVG.style.top = '0px'
            newWave.appendChild(outgoingSVG)
            
            // insert new wave
            this.insertWave(newWave)

            // animate new wave's border in (to avoid it just appearing suddenly)
            this.frontWave.animate(
                [
                    { borderWidth: '0px' },
                    { borderWidth: '20px' },
                ], {
                    duration: 100,
                    iterations: 1,
                    easing: 'linear',
                    fill: 'forwards',
                    delay: this.pixelsToMilliseconds(newComplex.width - overshoot),
                }
            )


            // clean up old waves
            let allWaves = this.waveSet.querySelectorAll('.wave')
            if (allWaves.length > this.maxLayers) {
                for (let i = 0; i < allWaves.length - this.maxLayers; i++) {
                    this.waveSet.removeChild(allWaves[i])
                }
            }
        }
        
        // animate this complex
        // console.log('finalWidth', finalWidth)
        // console.log('initialWidth', initialWidth)
        // console.log('duration', finalWidth - initialWidth)
        let animation
        if (animating == true) {
            animation = targetWave.animate(
                [
                    { width: `${initialWidth}px` },
                    { width: `${finalWidth}px` }
                ],
                {
                    duration: Math.max(this.pixelsToMilliseconds(finalWidth - initialWidth), 0),
                    iterations: 1,
                    easing: 'linear',
                    fill: 'forwards'
                }
            )
        } else {
            targetWave.style.width = `${finalWidth}px`
        }

        // set a timeout (if repeating)
        if (repeating == true) {
            animation.onfinish = (a) => {
                this.beat(mandatoryWidth, repeating)
            }
        }

        // emit pace event
        const event = new CustomEvent("beat", { detail: newComplex.width})
        this.dispatchEvent(event)
    }

    //    __  ____  _ ___ __           ______                 __  _
    //   / / / / /_(_) (_) /___  __   / ____/_  ______  _____/ /_(_)___  ____  _____
    //  / / / / __/ / / / __/ / / /  / /_  / / / / __ \/ ___/ __/ / __ \/ __ \/ ___/
    // / /_/ / /_/ / / / /_/ /_/ /  / __/ / /_/ / / / / /__/ /_/ / /_/ / / / (__  )
    // \____/\__/_/_/_/\__/\__, /  /_/    \__,_/_/ /_/\___/\__/_/\____/_/ /_/____/
    //                    /____/

    pixelsToMilliseconds(pixels) {
        return 1000 * pixels / this.pixelsPerSecond
    }
    millisecondsToPixels(ms) {
        return this.pixelsPerSecond * ms / 1000
    }

    // WAVE MAKING/PLACING
    constructWave(x_offset=0) {
        // create .wave element (and its SVG)
        let newWave = document.createElement('div')
        newWave.x_offset = x_offset
        newWave.x_cursor = 0
        newWave.classList.add('wave')
        newWave.innerHTML = `<svg width="10000" height="${this.height}" style="position:relative; left: ${x_offset}px;"><path fill="${this.fillColour}" fill-opacity="${this.fillOpacity}" d="M 0,${this.last_y} " stroke="${this.strokeColour}" stroke-width="${this.strokeWidth}" fill="none"></path></svg>`
        newWave.svg = newWave.querySelector('svg')
        return newWave
    }

    insertWave(wave) {
        // insert and update this.frontWave
        this.frontWave = this.waveSet.appendChild(wave)
    }

    // COMPLEX MAKING/PLACING
    // needs targetWave so it can work out how to absolute-ify the x values
    constructComplex(targetWave=this.frontWave, mandatoryWidth=0) {
        // init complex object
        let complex = {}

        // get time-based keyframes
        let mandatoryDuration = this.pixelsToMilliseconds(mandatoryWidth)
        let draftKeyframes
        try {
            draftKeyframes = this.waveGenerators[this.morphology](mandatoryDuration)
        } catch (error) {
            console.error(`An invalid wave morphology (${this.morphology}) was provided to wavemaker!`)
            console.error(error)
            draftKeyframes = this.waveGenerators['flatline'](mandatoryDuration)
        }

        // squash to mandatoryWidth
        if (mandatoryWidth != 0) {
            let initialDuration = this.getDurationOfKeyframes(draftKeyframes)
            let scaleFactor = mandatoryDuration / initialDuration
            for (let i = 0; i < draftKeyframes.length; i++) {
                draftKeyframes[i][0] = draftKeyframes[i][0] * scaleFactor
            }
        }

        // convert time-based keyframes to px-based
        // AND convert dx values to absolute x
        // AND calculate x width of this complex
        let width = 0
        let x = targetWave.x_cursor
        for (let i = 0; i < draftKeyframes.length; i++) {
            // CONVERT DX UNITS FROM MS TO PX
            // always paints complexes a 100px per second, no matter the xPixelsPerSecond (which is the reveal rate, no the paint rate)
            let dx = this.millisecondsToPixels(draftKeyframes[i][0])

            // Accumulate width
            width += dx

            // CHANGE X FROM RELATIVE TO ABSOLUTE
            x = x + dx

            let y = draftKeyframes[i][1]

            // Apply Y scaling
            y = y * this.y_scale

            // Add baseline wander
            // if (this.wobble_enabled == true) {
            //     this.baselineWanderAccumulator += dx
            //     let wander = 0.05 * Math.sin(this.baselineWanderAccumulator/250)
            //     y = y + wander
            // }

            // CONVERT Y UNITS FROM FRACTION (0.0-1.0) TO PX
            y = (this.height / 2) * (1 - y)

            // Save Y value
            this.last_y = y

            // SAVE TO MODEL
            draftKeyframes[i][0] = x
            draftKeyframes[i][1] = y
        }
        targetWave.x_cursor = x

        // MAKE COMMANDS
        let commands = " "

        // special case: frame[0]
        let firstFrame = draftKeyframes[0]
        let firstCubicBezierX = firstFrame[0] + (firstFrame[2] || 0)
        let firstCubicBezierY = firstFrame[1] - (firstFrame[3] || 0)

        // special case: frame[1]
        let secondFrame = draftKeyframes[1]

        commands += ` C ${firstCubicBezierX} ${firstCubicBezierY}, ${secondFrame[0] + (secondFrame[2] || 0)} ${secondFrame[1] - (secondFrame[3] || 0)}, ${secondFrame[0]} ${secondFrame[1]}`

        // general case: frame[2] to frame[-1]
        for (let i = 2; i < draftKeyframes.length; i++) {
            let x = draftKeyframes[i][0]
            let y = draftKeyframes[i][1]
            let cubicBezierDX = draftKeyframes[i][2] || 0
            let cubicBezierDY = draftKeyframes[i][3] || 0
            commands += ` S ${x + cubicBezierDX},${y - cubicBezierDY} ${x},${y}`
        }

        // finish
        complex.commands = commands
        complex.width = width
        return complex
    }

    insertComplex(wave, complex) {
        // INSERT
        let frontPath = wave.querySelector('path:last-child')
        frontPath.setAttribute('d', frontPath.getAttribute('d') + complex.commands)

        // INCREMENT GLOBAL COUNTER
        this.complexCount += 1
    }

    interpolateDuration(at20bpm, at220bpm, rate) {
        // returns longest at 200 bpm (a reasonable maximum HR for our purposes)
        // returns shortest at 20bpm (a reasonable minimum HR)
        // linear interpolation between
        return at20bpm - ((at20bpm - at220bpm) / 180) * (rate - 20)
    }

    randomNumberBetween(longest, shortest) {
        return shortest + Math.random() * (longest - shortest)
    }

    getDurationOfKeyframes(keyframes) {
        let totalDuration = 0
        for (let i = 0; i < keyframes.length; i++) {
            totalDuration += keyframes[i][0]
        }
        return totalDuration
    }

    makePathCommandsFromKeyframes(currentKeyframes) {
        // INITIATE VARIABLES
        let pathCommands = " l 0 0"

        // SPECIAL CASE: FRAME[0]
        let firstFrame = currentKeyframes[0]
        let firstCubicBezierX = firstFrame[0] + (firstFrame[2] || 0)
        let firstCubicBezierY = firstFrame[1] - (firstFrame[3] || 0)

        // SPECIAL CASE: FRAME[1]
        let secondFrame = currentKeyframes[1]
        pathCommands += ` C ${firstCubicBezierX} ${firstCubicBezierY}, ${secondFrame[0] + (secondFrame[2] || 0)} ${secondFrame[1] - (secondFrame[3] || 0)}, ${secondFrame[0]} ${secondFrame[1]}`


        // WRITE COMMANDS [1] to [-1]
        for (let i = 2; i < currentKeyframes.length; i++) {
            // Coordinates for the destination (x y)
            let x = currentKeyframes[i][0]
            let y = currentKeyframes[i][1]

            let cubicBezierDX = currentKeyframes[i][2] || 0
            let cubicBezierDY = currentKeyframes[i][3] || 0

            pathCommands += ` S ${x + cubicBezierDX},${y - cubicBezierDY} ${x},${y}`
        }

        // RETURN COMMANDS
        return pathCommands
    }

    //  _       __                    ______                           __
    // | |     / /___ __   _____     / ____/__  ____  ___  _________ _/ /_____  __________
    // | | /| / / __ `/ | / / _ \   / / __/ _ \/ __ \/ _ \/ ___/ __ `/ __/ __ \/ ___/ ___/
    // | |/ |/ / /_/ /| |/ /  __/  / /_/ /  __/ / / /  __/ /  / /_/ / /_/ /_/ / /  (__  )
    // |__/|__/\__,_/ |___/\___/   \____/\___/_/ /_/\___/_/   \__,_/\__/\____/_/  /____/

    waveGenerators = {
        "artline": (targetDuration) => {
            // DURATION WRNAGLING
            if (targetDuration == 0) {
                targetDuration = 60000 / this.rate
            }

            let notchWidth = Math.min(0.15 * targetDuration, 100)
            let pulseWidth = Math.min(0.30 * targetDuration, 300)

            // MAKE QRS
            let keyframes = [
                [0, 0, 5], // start
                [pulseWidth, 0.7, notchWidth * -0.10], // peak
                [0.7 * pulseWidth, 0.28, -0.04 * notchWidth], // noch trough
                [notchWidth, 0.32, -0.05 * notchWidth, 8], // noch peak
                // [notchWidth, 0.28, -0.1, 0.2], // noch end
            ]
            // ADD FINAL DESCENT
            let measuredDuration = this.getDurationOfKeyframes(keyframes)
            keyframes[keyframes.length] = [targetDuration-measuredDuration, 0, -0.01 * targetDuration]

            return keyframes
        },
        "artline-underdamped": (targetDuration) => {
            // DURATION WRNAGLING
            if (targetDuration == 0) {
                targetDuration = 60000 / this.rate
            }

            let notchWidth = Math.min(0.15 * targetDuration, 100)
            let pulseWidth = Math.min(0.30 * targetDuration, 200)

            // MAKE QRS
            let keyframes = [
                [0, 0, 5], // start
                [pulseWidth, 0.95 + 0.1 * Math.random(), notchWidth * -0.05], // peak
                [0.7 * pulseWidth, 0.28, -0.04 * notchWidth], // noch trough
                [notchWidth, 0.48, -0.05 * notchWidth, 8], // noch peak
                // [notchWidth, 0.28, -0.1, 0.2], // noch end
            ]
            // ADD FINAL DESCENT
            let measuredDuration = this.getDurationOfKeyframes(keyframes)
            keyframes[keyframes.length] = [targetDuration-measuredDuration, 0, -0.1 * (targetDuration-measuredDuration)]

            return keyframes
        },
        "artline-overdamped": (targetDuration) => {
            // DURATION WRNAGLING
            if (targetDuration == 0) {
                targetDuration = 60000 / this.rate
            }

            let notchWidth = Math.min(0.15 * targetDuration, 100)
            let pulseWidth = Math.min(0.30 * targetDuration, 300)

            // MAKE QRS
            let keyframes = [
                [0, 0, 5], // start
                [pulseWidth, 0.5, notchWidth * -0.15], // peak
                // [0.7 * pulseWidth, 0.28, -0.04 * notchWidth], // noch trough
                // [notchWidth, 0.32, -0.05 * notchWidth, 8], // noch peak
                // [notchWidth, 0.28, -0.1, 0.2], // noch end
            ]
            // ADD FINAL DESCENT
            let measuredDuration = this.getDurationOfKeyframes(keyframes)
            keyframes[keyframes.length] = [targetDuration-measuredDuration, 0, -0.03 * targetDuration]

            return keyframes
        },
        "flatline": (targetDuration) => {
            // DURATION WRNAGLING
            if (targetDuration == 0) {
                targetDuration = 60000 / this.rate
            }
        
            let keyframes = [
                [0,0],
                [targetDuration, 0]
            ]
        
            return keyframes
        },
        "sim-disconnect": (targetDuration) => {
            // alias of sim-disconnect
            return this.waveGenerators["flatline"](targetDuration)
        },
        "nibp-only": (targetDuration) => {
            // alias of sim-disconnect
            return this.waveGenerators["flatline"](targetDuration)
        },
        "capno-normal": (targetDuration) => {
            // DURATION WRNAGLING
            if (targetDuration == 0) {
                targetDuration = 60000 / this.rate
            }

            // MAKE QRS
            let keyframes = [
                [0, 0.03, 10, 4],
                [300, 0.66, -10, -10],
                [0.30 * targetDuration, 0.7, -5, 10],
                [150, 0.02, -10, 4],
            ]

            // AS BASELINE
            let draftDuration = this.getDurationOfKeyframes(keyframes)
            let tailLength = draftDuration < targetDuration ? targetDuration - draftDuration : 100
            keyframes[keyframes.length] = [tailLength, 0.03, 0]

            return keyframes
        },
        "capno-obstructed-moderate": (targetDuration) => {
            // DURATION WRNAGLING
            if (targetDuration == 0) {
                targetDuration = 60000 / this.rate
            }

            // MAKE QRS
            let keyframes = [
                [0, 0.03, 10, 4],
                [300, 0.4, -7, -10],
                [0.30 * targetDuration, 0.7, -5, 10],
                [150, 0.02, -10, 4],
            ]

            // AS BASELINE
            let draftDuration = this.getDurationOfKeyframes(keyframes)
            let tailLength = draftDuration < targetDuration ? targetDuration - draftDuration : 100
            keyframes[keyframes.length] = [tailLength, 0.03, 0]

            return keyframes
        },
        "capno-obstructed-severe": (targetDuration) => {
            // DURATION WRNAGLING
            if (targetDuration == 0) {
                targetDuration = 60000 / this.rate
            }

            // MAKE QRS
            let keyframes = [
                [0, 0.03, 10, 4],
                [300, 0.2, -7, -10],
                [0.30 * targetDuration, 0.7, -5, 10],
                [150, 0.02, -10, 4],
            ]

            // AS BASELINE
            let draftDuration = this.getDurationOfKeyframes(keyframes)
            let tailLength = draftDuration < targetDuration ? targetDuration - draftDuration : 100
            keyframes[keyframes.length] = [tailLength, 0.03, 0]

            return keyframes
        },
        "spo2": (targetDuration) => {
            // DURATION WRNAGLING
            if (targetDuration == 0) {
                targetDuration = 60000 / this.rate
            }

            let wobble = this.interpolateDuration(-25, -5, this.rate)
            let sidetoside = Math.random() * 0.1

            // MAKE QRS
            let keyframes = [
                [0, 0, -wobble],
                [(0.5 + sidetoside) * targetDuration, this.interpolateDuration(0.5, 0.35, this.rate) + 0.1 * Math.random(), wobble, 0], // faster hr, shorter waves
                [(0.5 - sidetoside) * targetDuration, 0, wobble]
            ]

            return keyframes
        },
        "spo2-badtrace": (targetDuration) => {
            // DURATION WRNAGLING
            if (targetDuration == 0) {
                targetDuration = 60000 / this.rate
            }

            let wobble = this.interpolateDuration(-25, -5, this.rate)

            // MAKE QRS
            let keyframes = [
                [0, 0, -wobble],
                [0.45 * (60000/this.rate), 0.1 * this.interpolateDuration(0.7, 0.2, this.rate) + 0.1 * Math.random(), wobble, 0],
            ]

            // SQUEEZE OR EXTRUDE
            let draftDuration = this.getDurationOfKeyframes(keyframes)
            let tailLength = draftDuration < targetDuration ? targetDuration - draftDuration : 100
            keyframes[keyframes.length] = [tailLength, 0, wobble]

            return keyframes
        },
        "afib": (targetDuration) => {
            // DURATION WRNAGLING
            if (targetDuration == 0) {
                let idealDuration = 60000 / this.rate
                targetDuration = this.randomNumberBetween(1.5 * idealDuration, 0.5 * idealDuration)
            }

            // MAKE QRS
            let keyframes = [
                [30, 0 - Math.random() * 0.05],    // q wave (trough)
                [30, 0.9 + Math.random() * 0.1, -0.05],       // r wave (peak)
                [30, -0.05 - Math.random() * 0.05],    // s wave (trough)
                // [50, 0.9 + Math.random() * 0.1, 0],
            ]

            // SQUEEZE OR EXTRUDE
            let draftDuration = this.getDurationOfKeyframes(keyframes)
            if (draftDuration < targetDuration) {
                // MAKE FIBRILLATION WAVES
                let baseFibrillationWaveWidth = 80 // ms

                // let fibCount = ((60 * 1000 / this.rate) - 130) / averageFibrillationWaveWidth
                let fibCount = targetDuration / baseFibrillationWaveWidth

                for (let i = 0; i < fibCount; i++) {
                    let newFrame = [
                        this.randomNumberBetween(1.5 * baseFibrillationWaveWidth, 0.5 * baseFibrillationWaveWidth),
                        this.randomNumberBetween(0.0, 0.08),
                        -3,
                    ]
                    keyframes.push(newFrame)
                }
            }

            return keyframes
        },
        "vfib": (targetDuration) => {
            // DURATION WRNAGLING
            if (targetDuration == 0) {
                let idealDuration = 60000 / this.rate
                targetDuration = this.randomNumberBetween(1.3 * idealDuration, 0.7 * idealDuration)
            }

            let randomCompoent = Math.random() * 0.5

            let wanderingBaseline =  0.3 * Math.sin(this.complexCount * 0.05) / Math.PI

            let isoelectricLine = 0 - randomCompoent + wanderingBaseline

            let peakHeight = 0.1 + randomCompoent + wanderingBaseline

            // MAKE QRS
            let keyframes = [
                [0, isoelectricLine, 0.01 * targetDuration],
                [targetDuration * 0.52, peakHeight, -5 * Math.random() - 1, -5 * Math.random() + 2 ],
                [targetDuration * 0.47, isoelectricLine, -0.01 * targetDuration]
            ]
            return keyframes
        },
        "vtach-monomorphic": (targetDuration) => {
            // DURATION WRNAGLING
            if (targetDuration == 0) {
                let idealDuration = 60000 / this.rate
                targetDuration = this.randomNumberBetween(1.1 * idealDuration, 0.9 * idealDuration)
            }

            let isoelectricLine = 0

            let peakHeight = 0.8 + 0.05 * Math.random()

            // MAKE QRS
            let keyframes = [
                [0, isoelectricLine, 0.01 * targetDuration],
                [targetDuration * 0.53, peakHeight, -6 * Math.random() - 4, -5 * Math.random() + 2 ],
                [targetDuration * 0.47, isoelectricLine, -0.01 * targetDuration]
            ]
            return keyframes
        },
        "vtach-torsades": (targetDuration) => {
            // DURATION WRNAGLING
            if (targetDuration == 0) {
                let idealDuration = 60000 / this.rate
                targetDuration = this.randomNumberBetween(1.1 * idealDuration, 0.9 * idealDuration)
            }

            let randomCompoent = Math.random() * 0.2
            let wanderingBaseline =  0.2 * Math.sin(this.complexCount * 0.3) / Math.PI

            let isoelectricLine = 0 - 0.5 * Math.sin(this.complexCount * 0.2) / Math.PI - randomCompoent + wanderingBaseline

            let peakHeight = 0.5 + 0.5 * Math.sin(this.complexCount * 0.2) / Math.PI + randomCompoent + wanderingBaseline

            // MAKE QRS
            let keyframes = [
                [0, isoelectricLine, 0.01 * targetDuration],
                [targetDuration * 0.52, peakHeight, -9 * Math.random() - 1, -5 * Math.random() + 2 ],
                [targetDuration * 0.47, isoelectricLine, -0.01 * targetDuration]
            ]
            return keyframes
        },
        "sinus": (targetDuration) => {
            // DURATION WRNAGLING
            if (targetDuration == 0) {
                let idealDuration = 60000 / this.rate
                targetDuration = this.randomNumberBetween(1.1 * idealDuration, 0.9 * idealDuration)
            }

            let isoelectricLine = this.rate > 120 ? this.rate * 0.0006 : 0

            // DRAFT KEYFRAMES
            let keyframes = [
                // dx (ms), y (0-1), squishX, squishY
                [0, isoelectricLine, 5, 0],                                   // start (isoelectric)
                [this.interpolateDuration(100, 80, this.rate), 0.1, this.interpolateDuration(-4, -2, this.rate)],                                                 // p wave (peak)
                [this.interpolateDuration(100, 80, this.rate), 0, this.interpolateDuration(-4, 0, this.rate), 0],                                                // pr segment start (isoelectric)
                [this.interpolateDuration(80, 0, this.rate), 0, this.interpolateDuration(-2, 0, this.rate), 0],                                                  // end of pr segment (isoelectric)
                [this.interpolateDuration(40, 25, this.rate), this.randomNumberBetween(-0.07, -0.04), -0.05],                                                                            // q wave (trough)
                [this.interpolateDuration(50, 25, this.rate), this.randomNumberBetween(1, 0.9), -0.05],                                                     // r wave (peak)
                [this.interpolateDuration(50, 25, this.rate), this.randomNumberBetween(-0.1, -0.05), -0.05],                                                                               // s wave (trough)
                [this.interpolateDuration(70, 30, this.rate), 0, this.interpolateDuration(-5, 0, this.rate), 5],                                                // st segment
                [this.interpolateDuration(180, 60, this.rate), 0.175, this.interpolateDuration(-6, -2, this.rate)],                                                // t wave (peak)
                [this.interpolateDuration(180, 60, this.rate), isoelectricLine, this.interpolateDuration(-8, 0, this.rate)],  // qt (isoelectric)
            ]

            // ADD FILLER OR SQUEEZE TO SIZE
            let keyframeDuration = this.getDurationOfKeyframes(keyframes)
            if (keyframeDuration < targetDuration) {
                let shortFall = targetDuration - keyframeDuration
                keyframes[keyframes.length] = [shortFall, isoelectricLine, 0]
            }

            return keyframes
        },
        "stemi": (targetDuration) => {
            // DURATION WRNAGLING
            if (targetDuration == 0) {
                let idealDuration = 60000 / this.rate
                targetDuration = this.randomNumberBetween(1.1 * idealDuration, 0.9 * idealDuration)
            }

            let isoelectricLine = this.rate > 120 ? this.rate * 0.0006 : 0

            // DRAFT KEYFRAMES
            let keyframes = [
                // dx (ms), y (0-1), squishX, squishY
                [0, isoelectricLine, 5, 0],                                   // start (isoelectric)
                [this.interpolateDuration(100, 80, this.rate), 0.1, this.interpolateDuration(-4, -2, this.rate)],                                                 // p wave (peak)
                [this.interpolateDuration(100, 80, this.rate), 0, this.interpolateDuration(-4, 0, this.rate), 0],                                                // pr segment start (isoelectric)
                [this.interpolateDuration(80, 0, this.rate), 0, this.interpolateDuration(-2, 0, this.rate), 0],                                                  // end of pr segment (isoelectric)
                [this.interpolateDuration(45, 30, this.rate), -0.25, -0.05],                                                                            // q wave (trough)
                [this.interpolateDuration(50, 25, this.rate), this.randomNumberBetween(1, 0.9), -0.05],                                                     // r wave (peak)
                [this.interpolateDuration(50, 25, this.rate), -0.1, -0.05],                                                                               // s wave (trough)
                [this.interpolateDuration(70, 30, this.rate), 0.22, this.interpolateDuration(-5, 0, this.rate), -5],                                                // st segment
                [this.interpolateDuration(180, 60, this.rate), 0.295, this.interpolateDuration(-6, -4, this.rate)],                                                // t wave (peak)
                [this.interpolateDuration(180, 60, this.rate), isoelectricLine, this.interpolateDuration(-8, 0, this.rate)],  // qt (isoelectric)
            ]

            // ADD FILLER OR SQUEEZE TO SIZE
            let keyframeDuration = this.getDurationOfKeyframes(keyframes)
            if (keyframeDuration < targetDuration) {
                let shortFall = targetDuration - keyframeDuration
                keyframes[keyframes.length] = [shortFall, isoelectricLine, 0]
            }

            return keyframes
        },
        "hb2m1": (targetDuration) => {
            let skippedBeat = this.complexCount % 4 == 3 ? 0 : 1

            // DURATION WRNAGLING
            if (targetDuration == 0) {
                let idealDuration = 60000 / this.rate
                targetDuration = this.randomNumberBetween(1.1 * idealDuration, 0.9 * idealDuration)
            }

            let isoelectricLine = 0

            // DRAFT KEYFRAMES
            let keyframes = [
                // dx (ms), y (0-1), squishX, squishY
                [0, isoelectricLine, this.interpolateDuration(5, 0.1, this.rate), this.interpolateDuration(0, 2, this.rate)],                                   // start (isoelectric)
                [this.interpolateDuration(100, 80, this.rate), 0.1, this.interpolateDuration(-4, -2, this.rate)],                                                 // p wave (peak)
                [this.interpolateDuration(100, 80, this.rate), 0, this.interpolateDuration(-4, 0, this.rate), 0],                                                // pr segment start (isoelectric)
                [this.interpolateDuration((this.complexCount % 4) * 80 + 80, 0, this.rate), 0, skippedBeat * this.interpolateDuration(-2, 0, this.rate), skippedBeat * 1],                                                  // end of pr segment (isoelectric)
                [this.interpolateDuration(40, 25, this.rate), skippedBeat * -0.1, skippedBeat * -0.05],                                                                            // q wave (trough)
                [this.interpolateDuration(50, 25, this.rate), skippedBeat * this.randomNumberBetween(1, 0.9), -0.05],                                                        // r wave (peak)
                [this.interpolateDuration(50, 25, this.rate), skippedBeat * -0.1, 0],                                                                               // s wave (trough)
                [this.interpolateDuration(70, 30, this.rate), 0, this.interpolateDuration(-5, 0, this.rate), skippedBeat * -5],                                                // st segment
                [this.interpolateDuration(180, 60, this.rate), skippedBeat * 0.175, skippedBeat * this.interpolateDuration(-6, -2, this.rate)],                                                // t wave (peak)
                [this.interpolateDuration(180, 60, this.rate), isoelectricLine, skippedBeat * this.interpolateDuration(-5, -0.1, this.rate), skippedBeat * this.interpolateDuration(0, -2, this.rate)],  // qt (isoelectric)
            ]

            // ADD FILLER OR SQUEEZE TO SIZE
            let keyframeDuration = this.getDurationOfKeyframes(keyframes)
            if (keyframeDuration < targetDuration) {
                let shortFall = targetDuration - keyframeDuration
                keyframes[keyframes.length] = [shortFall, isoelectricLine, 0]
            }

            return keyframes
        },
        "hb2m2": (targetDuration) => {
            let skippedBeat = this.complexCount % 4 == 3 ? 0 : 1


            // DURATION WRNAGLING
            if (targetDuration == 0) {
                let idealDuration = 60000 / this.rate
                targetDuration = this.randomNumberBetween(1.1 * idealDuration, 0.9 * idealDuration)
            }

            let keyframes = [
                // dx (ms), y (0-1), squishX, squishY
                [0, 0, this.interpolateDuration(5, 0.1, this.rate), this.interpolateDuration(0, 2, this.rate)],                                   // start (isoelectric)
                [this.interpolateDuration(100, 80, this.rate), 0.1, this.interpolateDuration(-4, -2, this.rate)],                                                 // p wave (peak)
                [this.interpolateDuration(100, 80, this.rate), 0, this.interpolateDuration(-4, 0, this.rate), 0],                                                // pr segment start (isoelectric)
                [this.interpolateDuration(100, 80, this.rate), 0, this.interpolateDuration(-4, 0, this.rate), 0],                                                  // end of pr segment (isoelectric)
                [this.interpolateDuration(40, 25, this.rate), skippedBeat * -0.1, skippedBeat * -0.05],                                                                            // q wave (trough)
                [this.interpolateDuration(50, 25, this.rate), skippedBeat * this.randomNumberBetween(1, 0.9), -0.05],                                                        // r wave (peak)
                [this.interpolateDuration(50, 25, this.rate), skippedBeat * -0.1, 0],                                                                               // s wave (trough)
                [this.interpolateDuration(70, 30, this.rate), 0, this.interpolateDuration(-5, 0, this.rate), skippedBeat * -5],                                                // st segment
                [this.interpolateDuration(180, 60, this.rate), skippedBeat * 0.175, skippedBeat * this.interpolateDuration(-6, -2, this.rate)],                                                // t wave (peak)
                [this.interpolateDuration(180, 60, this.rate), 0, skippedBeat * this.interpolateDuration(-5, -0.1, this.rate), skippedBeat * this.interpolateDuration(0, -2, this.rate)],  // qt (isoelectric)
            ]

            // ADD FILLER OR SQUEEZE TO SIZE
            let keyframeDuration = this.getDurationOfKeyframes(keyframes)
            if (keyframeDuration < targetDuration) {
                let shortFall = targetDuration - keyframeDuration
                keyframes[keyframes.length] = [shortFall, 0, 0]
            }

            return keyframes
        },
    }
})