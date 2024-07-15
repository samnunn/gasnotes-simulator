//    _____      __             
//   / ___/___  / /___  ______  
//   \__ \/ _ \/ __/ / / / __ \ 
//  ___/ /  __/ /_/ /_/ / /_/ / 
// /____/\___/\__/\__,_/ .___/  
//                    /_/         
                    
// GLOBALS / CONFIG
const xPixelsPerSecond = 100 // Hz
const globalMaximumSVGCount = 5
let rsaAccumulator = 0  // like xCursor but doesn't re-zero when a new line starts

// PREAMBLE
console.info('Gas Notes Wave Synthesiser is starting up…')

//                             __  ___                                  
//  _      ______ __   _____  /  |/  /___ _____  ____ _____ ____  _____ 
// | | /| / / __ `/ | / / _ \/ /|_/ / __ `/ __ \/ __ `/ __ `/ _ \/ ___/ 
// | |/ |/ / /_/ /| |/ /  __/ /  / / /_/ / / / / /_/ / /_/ /  __/ /     
// |__/|__/\__,_/ |___/\___/_/  /_/\__,_/_/ /_/\__,_/\__, /\___/_/      
//                                                  /____/              

export class waveManager {
    // man = 100 // Hz
    globalAnimationDelay = 100
    globalMaximumSVGCount = 3
    wavesetContainerID
    wavesetContainer
    wavesetContainerHeight = 300 // px
    frontSVGContainer
    traceColour
    lastComplexWidth

    // PROGRAM STATE
    globalBeatCount = 0 // forever-increasing count
    xCursor = 0 // x offset within the SVG elements
    xOvershoot = 0 // how far past the vibile boundary the most recently drawn ECG complex went
    rsaAccumulator = 0  // like this.xCursor but doesn't re-zero when a new line starts
                        // used to generate the respiratory sinus arrythmia
                        // when omitted, y value of the RSA resets every line (therefore doesn't line up with the last one)
    yCursor = this.wavesetContainerHeight / 2 // again, used to line up the end of the previous line and the start of the new one
    previousKeyframes = null


    globalHeartRhythm // to be set in constructor()
    globalHeartRate // to be set in constructor()

    constructor(wavesetContainerID, initialRate, intialRhythmName, traceColour) {
        this.wavesetContainerID = wavesetContainerID
        this.globalHeartRate = initialRate
        this.globalHeartRhythm = intialRhythmName
        this.wavesetContainer = document.querySelector(`div.wave-container#${this.wavesetContainerID}`)
        this.wavesetContainer.style.minHeight = `${this.wavesetContainerHeight}px`
        this.traceColour = traceColour
        this.frontSVGContainer = this.newLine(0, 0)
        console.info(`New waveManager for <div#${this.wavesetContainerID}> instantiated`)
    }

    async paintNextComplex(pacemaker, suppressNewLines=false) {
        // SET RATE/COMPLEX WIDTH PARAMETERS
        let mandatoryWidth = 0
        if (pacemaker instanceof waveManager) {
            mandatoryWidth = pacemaker.lastComplexWidth
            this.globalHeartRate = pacemaker.globalHeartRate
        }

        // DRAW COMPLEX (x in ms, y in 0-1)
        let mandatoryDuration = pixelsToMilliseconds(mandatoryWidth)
        let newComplexKeyframes = await waveGenerators[this.globalHeartRhythm](this.globalHeartRate, mandatoryDuration, this.globalBeatCount)
    
        // SQUEEZE TO SIZE IF MANDATORYWIDTH != 0
        // if (mandatoryWidth != 0) {
        //     newComplexKeyframes = await squeezeKeyframesToDuration(mandatoryDuration, newComplexKeyframes)
        // }

        // CONVERT COORDINATES TO KEYFRAMES IN PX
        newComplexKeyframes = await convertKeyframesFromMillisecondsToPixels(newComplexKeyframes, this.xCursor, this.wavesetContainerHeight)


        // CONVERT KEYFRAMES TO SVG PATH COMMANDS
        let newComplexCommands = await makePathCommandsFromKeyframes(newComplexKeyframes)

        // ADD COMMANDS TO FRONT SVG
        let frontPath = this.frontSVGContainer.querySelector('path')
        let oldCommands = frontPath.getAttribute('d')
        frontPath.setAttribute('d', oldCommands + newComplexCommands)
        
        // CALCULATE THE NEW COMPLEX's WIDTH (used to decide animation duration, newline behaviour, and move x cursor)
        let frontSVGWidth = this.frontSVGContainer.querySelector('path').getBBox().width
        let newComplexWidth = frontSVGWidth - this.xCursor

        // ANIMATE WAVE PLOTTER
        const wavePlotterAnimation = this.frontSVGContainer.animate([
        { width: `${this.xCursor + this.xOvershoot}px` },
        { width: `${frontSVGWidth + this.xOvershoot}px` }
        ], {
            duration: pixelsToMilliseconds(newComplexWidth),
            fill: 'forwards',
            iterations: 1,
            easing: 'linear',
            delay: this.globalAnimationDelay,
        })
        wavePlotterAnimation.play()
        
        // NEWLINE LOGIC (PRN)
        let newLineRequired = frontSVGWidth + this.xOvershoot > this.wavesetContainer.clientWidth
        
        if (newLineRequired == true && suppressNewLines == false) {
            // recalculate overshoot
            this.xOvershoot = this.xOvershoot + frontSVGWidth - this.wavesetContainer.clientWidth
            // delay the start of animation on the new line so there's no gap while this one finishes animating
            let nextLineDelay = pixelsToMilliseconds(newComplexWidth - this.xOvershoot)
            // make a new line (left offset = this.xOvershoot)
            let newSVGContainer = this.newLine(this.xOvershoot, nextLineDelay, this.wavesetContainerHeight, this.yCursor, this.xOvershoot)
            // (deep) copy the completed line to the next line (to fill in the gap on the left)
            let completeSVG = this.frontSVGContainer.querySelector('svg').cloneNode(true)
            // move it all to the left by (overflow) px
            completeSVG.style.position = 'absolute'
            completeSVG.style.top = '0px'
            completeSVG.style.left = `-${frontSVGWidth - this.xOvershoot}px`
            // prepend tail of last SVG to new line
            newSVGContainer.appendChild(completeSVG)

            // UPDATE FRONT WAVE STATE
            this.frontSVGContainer = newSVGContainer
        }
        
        // UPDATE X CURSOR
        // So the next-drawn SVG knows where to start
        if (newLineRequired == true && suppressNewLines == false) {
            this.xCursor = 0 // always zero when there's a newline since the SVG starts blank
        } else {
            this.xCursor = frontSVGWidth
        }

        // UPDATE Y CURSOR
        // So the next-drawn SVG knows where to start
        let lastKeyframe = newComplexKeyframes[newComplexKeyframes.length - 1]
        this.yCursor = lastKeyframe[1]
        
        // INCREMENT BEAT COUNTER
        this.globalBeatCount += 1

        // STORE LASTCOMPLEXWIDTH
        // May be needed by child wave managers to pre-set their complex widths
        this.lastComplexWidth = newComplexWidth

        return newComplexWidth
    }

    newLine(leftMargin, delayTime) {
        // CONSTRUCT NEWLINE
        let newDiv = document.createElement('div')
        newDiv.classList.add('wave')
        newDiv.innerHTML = `<svg width="10000" height="${this.wavesetContainerHeight}" style="left: ${leftMargin}px;"><path d="M 0,${this.yCursor} " stroke="${this.traceColour}" stroke-width="2" fill="none"></path></svg>`
        // newDiv.style.width = `0px`
        
        // APPEND TO DOM (recycling the variable)
        newDiv = this.wavesetContainer.appendChild(newDiv)
        
        // ANIMATE
        delayTime += this.globalAnimationDelay

        // ANIMATE THE CARRYOVER SEGMENT
        const overshootAnimation = newDiv.animate([
            { width: '0px' },
            { width: `${this.xOvershoot}px` }
            ], {
                duration: pixelsToMilliseconds(this.xOvershoot),
                fill: 'forwards',
                iterations: 1,
                easing: 'linear',
                delay: delayTime,
        })
        overshootAnimation.play()

        // ANIMATE THE BORDER/GAP
        let borderWidth = 20
        let borderAnimationDuration = pixelsToMilliseconds(borderWidth)
        const borderAnimation = newDiv.animate([
            { borderWidth: '0px' },
            { borderWidth: `${borderWidth}px` }
            ], {
                duration: borderAnimationDuration,
                fill: 'forwards',
                iterations: 1,
                easing: 'linear',
                delay: delayTime,
        })
        // borderAnimation.play()
        
        // CLEAN UP OLD LINES
        let allWaves = this.wavesetContainer.querySelectorAll('div.wave')
        if (allWaves.length > globalMaximumSVGCount) {
            for (let i = 0; i < allWaves.length - globalMaximumSVGCount; i++) {
                this.wavesetContainer.removeChild(allWaves[i])
            }
        }

        this.xCursor = 0
        
        return newDiv
    }


}

//  _       __                    ______                           __                 
// | |     / /___ __   _____     / ____/__  ____  ___  _________ _/ /_____  __________
// | | /| / / __ `/ | / / _ \   / / __/ _ \/ __ \/ _ \/ ___/ __ `/ __/ __ \/ ___/ ___/
// | |/ |/ / /_/ /| |/ /  __/  / /_/ /  __/ / / /  __/ /  / /_/ / /_/ /_/ / /  (__  ) 
// |__/|__/\__,_/ |___/\___/   \____/\___/_/ /_/\___/_/   \__,_/\__/\____/_/  /____/  

export const waveGenerators = {
    "artline": async (rate, targetDuration) => {
        // DURATION WRNAGLING
        if (targetDuration == 0) {
            targetDuration = 60000 / rate
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
        let measuredDuration = getDurationOfKeyframes(keyframes)
        keyframes[keyframes.length] = [targetDuration-measuredDuration, 0, -0.01 * targetDuration]
        
        return keyframes
    },
    "artline-underdamped": async (rate, targetDuration) => {
        // DURATION WRNAGLING
        if (targetDuration == 0) {
            targetDuration = 60000 / rate
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
        let measuredDuration = getDurationOfKeyframes(keyframes)
        keyframes[keyframes.length] = [targetDuration-measuredDuration, 0, -0.1 * (targetDuration-measuredDuration)]
        
        return keyframes
    },
    "artline-overdamped": async (rate, targetDuration) => {
        // DURATION WRNAGLING
        if (targetDuration == 0) {
            targetDuration = 60000 / rate
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
        let measuredDuration = getDurationOfKeyframes(keyframes)
        keyframes[keyframes.length] = [targetDuration-measuredDuration, 0, -0.03 * targetDuration]
        
        return keyframes
    },
    "flatline": async (rate, targetDuration) => {
        // DURATION WRNAGLING
        if (targetDuration == 0) {
            targetDuration = 60000 / rate
        }

        let keyframes = [
            [0,0],
            [targetDuration, 0]
        ]

        return keyframes
    },
    "spo2": async (rate, targetDuration) => {
        // DURATION WRNAGLING
        if (targetDuration == 0) {
            targetDuration = 60000 / rate
        }

        let wobble = interpolateDuration(-25, -5, rate)

        // MAKE QRS
        let keyframes = [
            [0, 0, -wobble],
            [0.4 * (60000/rate), interpolateDuration(0.7, 0.4, rate) + 0.1 * Math.random(), wobble, 0], // faster hr, shorter waves
        ]

        // SQUEEZE OR EXTRUDE
        let draftDuration = getDurationOfKeyframes(keyframes)
        let tailLength = draftDuration < targetDuration ? targetDuration - draftDuration : 100
        keyframes[keyframes.length] = [tailLength, 0, wobble]
        
        return keyframes
    },
    "spo2-badtrace": async (rate, targetDuration) => {
        // DURATION WRNAGLING
        if (targetDuration == 0) {
            targetDuration = 60000 / rate
        }

        let wobble = interpolateDuration(-25, -5, rate)

        // MAKE QRS
        let keyframes = [
            [0, 0, -wobble],
            [0.4 * (60000/rate), 0.1 * interpolateDuration(0.7, 0.2, rate) + 0.1 * Math.random(), wobble, 0],
        ]

        // SQUEEZE OR EXTRUDE
        let draftDuration = getDurationOfKeyframes(keyframes)
        let tailLength = draftDuration < targetDuration ? targetDuration - draftDuration : 100
        keyframes[keyframes.length] = [tailLength, 0, wobble]
        
        return keyframes
    },
    "afib": async (rate, targetDuration) => {
        // DURATION WRNAGLING
        if (targetDuration == 0) {
            let idealDuration = 60000 / rate
            targetDuration = randomNumberBetween(1.5 * idealDuration, 0.5 * idealDuration)
        }

        // MAKE QRS
        let keyframes = [
            [30, 0 - Math.random() * 0.05],    // q wave (trough)
            [30, 0.9 + Math.random() * 0.1, -0.05],       // r wave (peak)
            [30, -0.05 - Math.random() * 0.05],    // s wave (trough)
            // [50, 0.9 + Math.random() * 0.1, 0],
        ]

        // SQUEEZE OR EXTRUDE
        let draftDuration = getDurationOfKeyframes(keyframes)
        if (draftDuration < targetDuration) {
            // MAKE FIBRILLATION WAVES
            let baseFibrillationWaveWidth = 80 // ms

            // let fibCount = ((60 * 1000 / rate) - 130) / averageFibrillationWaveWidth
            let fibCount = targetDuration / baseFibrillationWaveWidth

            for (let i = 0; i < fibCount; i++) {
                let newFrame = [
                    randomNumberBetween(1.5 * baseFibrillationWaveWidth, 0.5 * baseFibrillationWaveWidth),
                    randomNumberBetween(0.0, 0.08),
                    -3,
                ]
                keyframes.push(newFrame)
            }
        }
        
        return keyframes
    },
    "vfib": async (rate, targetDuration) => {
        // DURATION WRNAGLING
        if (targetDuration == 0) {
            let idealDuration = 60000 / rate
            targetDuration = randomNumberBetween(2 * idealDuration, 0.7 * idealDuration)
        }

        let isoelectricLine = 0

        // MAKE QRS
        let keyframes = [
            [0, isoelectricLine, 0.02 * targetDuration],
            [targetDuration * 0.35, 0.2 + 0.8 * Math.random(), -0.02 * targetDuration],
            [targetDuration * 0.65, isoelectricLine, -0.02 * targetDuration]
        ]
        return keyframes
    },
    "vtach-monomorphic": async (rate, targetDuration) => {
        // DURATION WRNAGLING
        if (targetDuration == 0) {
            let idealDuration = 60000 / rate
            targetDuration = randomNumberBetween(1.1 * idealDuration, 0.9 * idealDuration)
        }

        let isoelectricLine = 0

        let peakHeight = 0.8 + 0.05 * Math.random()

        // MAKE QRS
        let keyframes = [
            [0, isoelectricLine, 0.01 * targetDuration],
            [targetDuration * 0.35, peakHeight, -6 * Math.random() - 4, -5 * Math.random() + 2 ],
            [targetDuration * 0.25, isoelectricLine, -0.01 * targetDuration]
        ]
        return keyframes
    },
    "vtach-torsades": async (rate, targetDuration, beatCount) => {
        // DURATION WRNAGLING
        if (targetDuration == 0) {
            let idealDuration = 60000 / rate
            targetDuration = randomNumberBetween(1.1 * idealDuration, 0.9 * idealDuration)
        }

        let randomCompoent = Math.random() * 0.2
        let wanderingBaseline =  0.2 * Math.sin(beatCount * 0.3) / Math.PI

        let isoelectricLine = 0 - 0.5 * Math.sin(beatCount * 0.2) / Math.PI - randomCompoent + wanderingBaseline

        let peakHeight = 0.5 + 0.5 * Math.sin(beatCount * 0.2) / Math.PI + randomCompoent + wanderingBaseline

        // MAKE QRS
        let keyframes = [
            [0, isoelectricLine, 0.01 * targetDuration],
            [targetDuration * 0.35, peakHeight, -9 * Math.random() - 1, -5 * Math.random() + 2 ],
            [targetDuration * 0.25, isoelectricLine, -0.01 * targetDuration]
        ]
        return keyframes
    },
    "sinus": async (rate, targetDuration) => {
        // DURATION WRNAGLING
        if (targetDuration == 0) {
            let idealDuration = 60000 / rate
            targetDuration = randomNumberBetween(1.1 * idealDuration, 0.9 * idealDuration)
        }

        let isoelectricLine = rate > 120 ? rate * 0.0006 : 0

        // DRAFT KEYFRAMES
        let keyframes = [
            // dx (ms), y (0-1), squishX, squishY 
            [0, isoelectricLine, 5, 0],                                   // start (isoelectric)
            [interpolateDuration(100, 80, rate), 0.1, interpolateDuration(-4, -2, rate)],                                                 // p wave (peak)
            [interpolateDuration(100, 80, rate), 0, interpolateDuration(-4, 0, rate), 0],                                                // pr segment start (isoelectric)
            [interpolateDuration(80, 0, rate), 0, interpolateDuration(-2, 0, rate), 0],                                                  // end of pr segment (isoelectric)
            [interpolateDuration(40, 25, rate), -0.1, -0.05],                                                                            // q wave (trough)
            [interpolateDuration(50, 25, rate), randomNumberBetween(1, 0.9), -0.05],                                                     // r wave (peak)
            [interpolateDuration(50, 25, rate), -0.1, -0.05],                                                                               // s wave (trough)
            [interpolateDuration(70, 30, rate), 0, interpolateDuration(-5, 0, rate), 5],                                                // st segment
            [interpolateDuration(180, 60, rate), 0.175, interpolateDuration(-6, -2, rate)],                                                // t wave (peak)
            [interpolateDuration(180, 60, rate), isoelectricLine, interpolateDuration(-8, 0, rate)],  // qt (isoelectric)
        ]

        // ADD FILLER OR SQUEEZE TO SIZE
        let keyframeDuration = getDurationOfKeyframes(keyframes)
        if (keyframeDuration < targetDuration) {
            keyframes = appendIsoelectricFillerToMeetDuration(targetDuration, keyframeDuration, keyframes, isoelectricLine)
        }

        return keyframes
    },
    "stemi": async (rate, targetDuration) => {
        // DURATION WRNAGLING
        if (targetDuration == 0) {
            let idealDuration = 60000 / rate
            targetDuration = randomNumberBetween(1.1 * idealDuration, 0.9 * idealDuration)
        }

        let isoelectricLine = rate > 120 ? rate * 0.0006 : 0

        // DRAFT KEYFRAMES
        let keyframes = [
            // dx (ms), y (0-1), squishX, squishY 
            [0, isoelectricLine, 5, 0],                                   // start (isoelectric)
            [interpolateDuration(100, 80, rate), 0.1, interpolateDuration(-4, -2, rate)],                                                 // p wave (peak)
            [interpolateDuration(100, 80, rate), 0, interpolateDuration(-4, 0, rate), 0],                                                // pr segment start (isoelectric)
            [interpolateDuration(80, 0, rate), 0, interpolateDuration(-2, 0, rate), 0],                                                  // end of pr segment (isoelectric)
            [interpolateDuration(40, 25, rate), -0.1, -0.05],                                                                            // q wave (trough)
            [interpolateDuration(50, 25, rate), randomNumberBetween(1, 0.9), -0.05],                                                     // r wave (peak)
            [interpolateDuration(50, 25, rate), -0.1, -0.05],                                                                               // s wave (trough)
            [interpolateDuration(70, 30, rate), 0.22, interpolateDuration(-5, 0, rate), -5],                                                // st segment
            [interpolateDuration(180, 60, rate), 0.295, interpolateDuration(-6, -2, rate)],                                                // t wave (peak)
            [interpolateDuration(180, 60, rate), isoelectricLine, interpolateDuration(-8, 0, rate)],  // qt (isoelectric)
        ]

        // ADD FILLER OR SQUEEZE TO SIZE
        let keyframeDuration = getDurationOfKeyframes(keyframes)
        if (keyframeDuration < targetDuration) {
            keyframes = appendIsoelectricFillerToMeetDuration(targetDuration, keyframeDuration, keyframes, isoelectricLine)
        }

        return keyframes
    },
    "hb2m1": async (rate, targetDuration, beatCount) => {
        let skippedBeat = beatCount % 4 == 3 ? 0 : 1

        // DURATION WRNAGLING
        if (targetDuration == 0) {
            let idealDuration = 60000 / rate
            targetDuration = randomNumberBetween(1.1 * idealDuration, 0.9 * idealDuration)
        }

        let isoelectricLine = 0

        // DRAFT KEYFRAMES
        let keyframes = [
            // dx (ms), y (0-1), squishX, squishY 
            [0, isoelectricLine, interpolateDuration(5, 0.1, rate), interpolateDuration(0, 2, rate)],                                   // start (isoelectric)
            [interpolateDuration(100, 80, rate), 0.1, interpolateDuration(-4, -2, rate)],                                                 // p wave (peak)
            [interpolateDuration(100, 80, rate), 0, interpolateDuration(-4, 0, rate), 0],                                                // pr segment start (isoelectric)
            [interpolateDuration((beatCount % 4) * 50 + 80, 0, rate), 0, skippedBeat * interpolateDuration(-2, 0, rate), skippedBeat * 1],                                                  // end of pr segment (isoelectric)
            [interpolateDuration(40, 25, rate), skippedBeat * -0.1, skippedBeat * -0.05],                                                                            // q wave (trough)
            [interpolateDuration(50, 25, rate), skippedBeat * randomNumberBetween(1, 0.9), -0.05],                                                        // r wave (peak)
            [interpolateDuration(50, 25, rate), skippedBeat * -0.1, 0],                                                                               // s wave (trough)
            [interpolateDuration(70, 30, rate), 0, interpolateDuration(-5, 0, rate), skippedBeat * -5],                                                // st segment
            [interpolateDuration(180, 60, rate), skippedBeat * 0.175, skippedBeat * interpolateDuration(-6, -2, rate)],                                                // t wave (peak)
            [interpolateDuration(180, 60, rate), isoelectricLine, skippedBeat * interpolateDuration(-5, -0.1, rate), skippedBeat * interpolateDuration(0, -2, rate)],  // qt (isoelectric)
        ]

        // ADD FILLER OR SQUEEZE TO SIZE
        let keyframeDuration = getDurationOfKeyframes(keyframes)
        if (keyframeDuration < targetDuration) {
            keyframes = appendIsoelectricFillerToMeetDuration(targetDuration, keyframeDuration, keyframes)
        }

        return keyframes
    },
    "hb2m2": async (rate, targetDuration, beatCount) => {
        let skippedBeat = beatCount % 4 == 3 ? 0 : 1


        // DURATION WRNAGLING
        if (targetDuration == 0) {
            let idealDuration = 60000 / rate
            targetDuration = randomNumberBetween(1.1 * idealDuration, 0.9 * idealDuration)
        }

        let keyframes = [
            // dx (ms), y (0-1), squishX, squishY 
            [0, 0, interpolateDuration(5, 0.1, rate), interpolateDuration(0, 2, rate)],                                   // start (isoelectric)
            [interpolateDuration(100, 80, rate), 0.1, interpolateDuration(-4, -2, rate)],                                                 // p wave (peak)
            [interpolateDuration(100, 80, rate), 0, interpolateDuration(-4, 0, rate), 0],                                                // pr segment start (isoelectric)
            [interpolateDuration(100, 80, rate), 0, interpolateDuration(-4, 0, rate), 0],                                                  // end of pr segment (isoelectric)
            [interpolateDuration(40, 25, rate), skippedBeat * -0.1, skippedBeat * -0.05],                                                                            // q wave (trough)
            [interpolateDuration(50, 25, rate), skippedBeat * randomNumberBetween(1, 0.9), -0.05],                                                        // r wave (peak)
            [interpolateDuration(50, 25, rate), skippedBeat * -0.1, 0],                                                                               // s wave (trough)
            [interpolateDuration(70, 30, rate), 0, interpolateDuration(-5, 0, rate), skippedBeat * -5],                                                // st segment
            [interpolateDuration(180, 60, rate), skippedBeat * 0.175, skippedBeat * interpolateDuration(-6, -2, rate)],                                                // t wave (peak)
            [interpolateDuration(180, 60, rate), 0, skippedBeat * interpolateDuration(-5, -0.1, rate), skippedBeat * interpolateDuration(0, -2, rate)],  // qt (isoelectric)
        ]

        // ADD FILLER OR SQUEEZE TO SIZE
        let keyframeDuration = getDurationOfKeyframes(keyframes)
        if (keyframeDuration < targetDuration) {
            keyframes = appendIsoelectricFillerToMeetDuration(targetDuration, keyframeDuration, keyframes)
        }

        return keyframes
    },
}

//    __  ____  _ ___ __           ______                 __  _                       
//   / / / / /_(_) (_) /___  __   / ____/_  ______  _____/ /_(_)___  ____  _____      
//  / / / / __/ / / / __/ / / /  / /_  / / / / __ \/ ___/ __/ / __ \/ __ \/ ___/      
// / /_/ / /_/ / / / /_/ /_/ /  / __/ / /_/ / / / / /__/ /_/ / /_/ / / / (__  )       
// \____/\__/_/_/_/\__/\__, /  /_/    \__,_/_/ /_/\___/\__/_/\____/_/ /_/____/        
//                    /____/                                                          

function interpolateDuration(at20bpm, at220bpm, rate) {
    // returns longest at 200 bpm (a reasonable maximum HR for our purposes)
    // returns shortest at 20bpm (a reasonable minimum HR)
    // linear interpolation between
    return at20bpm - ((at20bpm - at220bpm) / 180) * (rate - 20)
}

function randomNumberBetween(longest, shortest) {
    return shortest + Math.random() * (longest - shortest)
}

function getDurationOfKeyframes(keyframes) {
    let totalDuration = 0
    for (let i = 0; i < keyframes.length; i++) {
        totalDuration += keyframes[i][0]
    }
    return totalDuration
}

async function squeezeKeyframesToDuration(targetDuration, keyframes) {
    let initialDuration = getDurationOfKeyframes(keyframes)
    let scaleFactor = targetDuration / initialDuration
    for (let i = 0; i < keyframes.length; i++) {
        keyframes[i][0] = keyframes[i][0] * scaleFactor
    }
    return keyframes
}

async function appendIsoelectricFillerToMeetDuration(targetDuration, initialDuration, keyframes, isoelectricLine=0) {
    let shortFall = targetDuration - initialDuration
    keyframes[keyframes.length] = [shortFall, isoelectricLine, 0]
    return keyframes
}

async function makePathCommandsFromKeyframes(currentKeyframes) {
    // INITIATE VARIABLES
    let pathCommands = ""

    // SPECIAL CASE: FRAME[0]
    let firstFrame = currentKeyframes[0]
    let firstCubicBezierX = firstFrame[0] + (firstFrame[2] || 0)
    let firstCubicBezierY = firstFrame[1] - (firstFrame[3] || 0)

    pathCommands += ' l 0 0'

    // SPECIAL CASE: FRAME[1]
    let secondFrame = currentKeyframes[1]
    pathCommands += ` C ${firstCubicBezierX} ${firstCubicBezierY}, ${secondFrame[0] + (secondFrame[2] || 0)} ${secondFrame[1] - (secondFrame[3] || 0)}, ${secondFrame[0]} ${secondFrame[1]}`


    // WRITE COMMANDS [1] to [-2]
    for (let i = 2; i < currentKeyframes.length; i++) {
        // Coordinates for the destination (x y)
        let x = currentKeyframes[i][0]
        let y = currentKeyframes[i][1]

        let cubicBezierDX = currentKeyframes[i][2] || 0
        let cubicBezierDY = currentKeyframes[i][3] || 0

        pathCommands += ` S ${x + cubicBezierDX},${y - cubicBezierDY} ${x},${y}`
    }

    // SPECIAL CASE: FRAME[-1]
    // let lastFrame = currentKeyframes[currentKeyframes.length - 1]

    // pathCommands += 'l 50 0' // for testing purposes

    // RETURN COMMANDS
    return pathCommands
}

async function convertKeyframesFromMillisecondsToPixels(keyframes, xOffset, yMax) {
    // takes keyframes that have…
        // X values specified in ms (more understandable to the author)
        // Y values expressed as ±1
    // and converts them to pixels

    // offset x (this is useful when drawing subsequent complexes in a single line)
    let x = xOffset

    // FOR EACH KEYFRAME...
    for (let i = 0; i < keyframes.length; i++) {
        // CONVERT DX UNITS FROM MS TO PX
        let dx = millisecondsToPixels(keyframes[i][0])
        x = x + dx

        // CONVERT Y UNITS FROM FRACTION (0.0-1.0) TO PX
        let y = (yMax / 2) * (1 - keyframes[i][1])

        // INTRODUCE RESPIRATORY SINUS ARRYTHMIA
        // rsaAccumulator += dx
        // let rsa = 2 * Math.sin(rsaAccumulator/500)
        // y = y + rsa

        // SAVE TO MODEL
        keyframes[i][0] = x
        keyframes[i][1] = y
    }

    return keyframes
}

export function pixelsToMilliseconds(pixels) {
    return 1000 * pixels / xPixelsPerSecond
}
export function millisecondsToPixels(ms) {
    return xPixelsPerSecond * ms / 1000
}