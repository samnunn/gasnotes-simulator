let canvas = document.createElement('canvas')
let context = canvas.getContext('2d')
let width = 1500
let height = 1500

canvas.setAttribute('width', width)
canvas.setAttribute('height', height)

context.fillStyle = '#fff'

for (var i = 0; i < 150; i++) {
    context.beginPath();
    context.globalAlpha = Math.random() - 0.6

    context.arc(
        Math.floor(Math.random() * width) + 1,
        Math.floor(Math.random() * height) + 1,
        1 + Math.random(),
        0,
        2 * Math.PI
    )
    context.fill()
    context.closePath()

}

let dataUrl = canvas.toDataURL('image/png', 100)
document
    .querySelector('body')
    .setAttribute('style', `background-image: 
    url("${dataUrl}")
    ;
    background-position-x: center;
    background-attachment: fixed;`)

// document
//     .querySelector('#top-of-page')
//     .setAttribute('style', `background-image: 
//     url("${dataUrl}"),                                                      /* starfield */
//     linear-gradient(0deg, black, 40%, transparent),                         /* fade to black */
//     linear-gradient(-45deg, transparent, 80%, rgba(183, 21, 64, 0.4)),      /* red (top left) */
//     linear-gradient(10deg, transparent, rgb(10 29 79))                      /* blue (top) */
//     ;`)
// document.body.setAttribute('style', `background-image: url("${dataUrl}"`)

// let link = document.createElement('a')
// aDownloadLink.download = 'stars.png'
// aDownloadLink.href = dataUrl
// aDownloadLink.click()