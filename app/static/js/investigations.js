import { getSocket } from "./sockets";
export function sendInvestigation(type, data) {
    let socket = getSocket();
    let message = {
        sim_room_id: document.body.dataset.simRoomId,
        type: type,
        data: data,
    };
    socket.emit("sim-ix", JSON.stringify(message));
    console.log(`Investigations: send data to server:`, message);
}

export function registerInvestigationReceiver(socket) {
    socket.on("sim-ix", (msg) => {
        let message = JSON.parse(msg);
        console.log(`Investigations: received data from server:`, message);
        receiveInvestigation(message);
    });
}

function receiveInvestigation(message) {
    let type = message.type;
    let data = message.data;

    console.log(
        `Investigations: received an investigation of type "${type}"`,
        data,
    );

    switch (type) {
        case "radiology":
            insertRadiology(data);
            break;
        case "abg":
            insertABG(data);
            break;
        case "temperature":
            insertTemperature(data);
            break;
        case "bsl":
            insertBSL(data);
            break;
        default:
            console.error(
                `Investigations: there is no handler for type "${type}", skipping`,
            );
            return;
    }
}

function insertABG(data) {
    insertInvestigationIntoCarousel();
}

function insertTemperature(data) {
    insertInvestigationIntoCarousel();
}

function countOfType(t) {
    let elements = resourcesModal.querySelectorAll(`[data-type="${t}"]`) || [];
    return elements.length;
}

function insertRadiology(data) {
    let type = "radiology";
    let html = `
            <sim-post sim-post-target="#resource-marquee" data-type="${type}">
                <label class="tile">
                    <figure sim-post-content>
                        <img class="thumbnail" src="${data.url}">
                        <figcaption>${data.credit}</figcaption>
                    </figure>
                    <span class="label">CXR #${countOfType("radiology", type) + 1}</span>
                    <input type="radio" name="sim-post" style="display: none;">
                </label>
            </sim-post>
            `;
    insertInvestigationIntoCarousel(html);
}

function insertBSL(data) {
    insertInvestigationIntoCarousel();
}

let resourcesModal = document.querySelector("#resources");
let postListElement = document.querySelector("#resource-list");
function insertInvestigationIntoCarousel(html) {
    postListElement.insertAdjacentHTML("afterbegin", html);
    postListElement.firstElementChild.click();
    resourcesModal.showModal();
}
