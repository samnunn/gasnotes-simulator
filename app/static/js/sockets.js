import {
    registerRemoteNibpCycleReceiver,
    registerNibpAutoCycleStateEmitter,
} from "./nibp";
import { registerSimInvestigationPostHandler } from "./investigations";
import { registerMonitorSyncReceiver } from "./sync";

export function connectSocket() {
    const socket = io({
        auth: {
            sim_room_id: document.body.dataset.simRoomId,
        },
    });

    socket.onAny((event, ...args) => {
        console.log(`Socket: ${event}`);
    });

    return socket;
}

export function connectMonitorSockets(socket) {
    registerMonitorSyncReceiver(socket);
    registerSimInvestigationPostHandler(socket);
    registerRemoteNibpCycleReceiver(socket);
    registerNibpAutoCycleStateEmitter(socket);
}
