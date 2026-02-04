customElements.define('sim-imagepicker', class extends HTMLElement {
    lastChosenElement

    constructor() {
        super()

        this.dataUrl = this.getAttribute('data-url')

        this.dataName = this.getAttribute('data-name')

        // get target
        this.collectionElement = this.querySelector('[sim-imagepicker-collection]')
    }

    async connectedCallback() {
        // get data
        let imageDataEntries
        try {
            let response = await fetch(this.dataUrl)
            imageDataEntries = await response.json()
        } catch (e) {
            console.error(`Failed to download imaging data from "${dataurl}"`, e)
        }
        if (!imageDataEntries) return

        // pick a random unique number
        let randomNumber = (Math.random() * 1000000).toFixed(0).toString()

        // add entries
        for (let i of imageDataEntries) {
            let html = `
                <label class="tile">
                    <img src="${i['url']}" alt="${i['name_pretty']}" class="thumbnail" data-contributor="${i['contributor_name']}" data-rid="${i['rid']}" title="Case courtesy of ${i.contributor_name}, Radiopaedia.org, rID: ${i.rid}">
                    <span class="label">${i['name_pretty']}</span>
                    <input type="radio" name="${randomNumber}" value="${i['name_ugly']}" style="display: none;">
                </label>
            `

            this.collectionElement.insertAdjacentHTML('beforeend', html)
        }

        // make the button turn red
        this.addEventListener('input', (e) => {
            this.querySelector('button#cxr-send').classList.add('red')
        })
    }

    send() {
        let chosenRadio = this.collectionElement.querySelector('input[type="radio"]:checked')

        // ignore repeats
        if (this.lastChosenElement == chosenRadio) {
            let c = confirm('You have already sent this image. Are you sure you want to send it again?')
            if (!c) return
        }

        let value = chosenRadio?.value
        if (!value) return
        let chosenImg = chosenRadio.closest('.tile').querySelector('img')
        let message = {
            'sim_room_id': document.body.dataset.simRoomId,
            'type': this.dataName,
            'name_ugly': value,
            'url': chosenImg.getAttribute('src'),
            'rid': chosenImg.getAttribute('data-rid'),
            'contributor_name': chosenImg.getAttribute('data-contributor'),
        }
        socket.emit('sim-post', JSON.stringify(message))

        this.lastChosenElement = chosenRadio

        chosenRadio.checked = false

        this.querySelector('button').classList.remove('red')
        this.querySelector('dialog')?.close()
    }
})