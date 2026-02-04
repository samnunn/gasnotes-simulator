export function registerSimInvestigationPostHandler(socket) {
    let postListElement = document.querySelector('#resource-list')
    let cxrCount = 0
    let abgCount = 0

    socket.on('sim-post', (msg) => {
        let data = JSON.parse(msg)

        if (data.type == "CXR") {
            cxrCount += 1

            let html = `
            <sim-post sim-post-target="#resource-marquee">
                <label class="tile">
                    <figure sim-post-content>
                        <img class="thumbnail" src="${data.url}">
                        <figcaption>Case courtesy of ${data.contributor_name}, <a href="https://radiopaedia.org/">Radiopaedia.org</a>, rID: <a href="https://radiopaedia.org/cases/${data.rid}">${data.rid}</a></figcaption>
                    </figure>
                    <span class="label">${data.type} #${cxrCount}</span>
                    <input type="radio" name="sim-post" style="display: none;">
                </label>
            </sim-post>
            `
            postListElement.insertAdjacentHTML("afterbegin", html)

        }

        if (data.type == "ABG") {
            abgCount += 1

            let html = `
            <sim-post sim-post-target="#resource-marquee">
                <label class="tile">
                    <span class="thumbnail">💉</span>
                    <sim-abg sim-post-content readonly="true"></sim-abg>
                    <span class="label">${data.type} #${abgCount}</span>
                    <input type="radio" name="sim-post" style="display: none;">
                </label>
            </sim-post>
            `

            postListElement.insertAdjacentHTML("afterbegin", html)

            let newAbg = postListElement.querySelector('sim-abg')

            newAbg.digestData(data.abg_data)
        }

        postListElement.querySelector('input')?.click()
        document.querySelector('#resources').showModal()
    })
}