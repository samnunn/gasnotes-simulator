let socket = null;
export function getSocket() {
    if (socket) return socket;

    socket = io({
        auth: {
            sim_room_id: document.body.dataset.simRoomId,
        },
    });

    socket.onAny((event, ...args) => {
        console.log(`Socket: ${event}`);
    });

    return socket;
}
