import {Logger} from "../main.js";
import {v4 as uuid} from 'uuid';
import {ClientRequestHandler} from "./ClientRequestHandler.js";
import {ServerLocalController} from "../ServerLocalController.js";
import {NUMBER_OF_PEERS_TO_RECOMMEND, RequestType} from "../serverManager.js";

// Map userId -> socket
const clients = new Map();

export const connectClient = (socket, userId) => {
    if (!!clients.get(userId)) {
        clients.get(userId).disconnect();
    }
    clients.set(userId, socket);

    socket.on('user-search', (req) => ClientRequestHandler.userSearch(req, socket));
    socket.on('user-info', (req) => ClientRequestHandler.userInfo(req, socket));
    socket.on('posts', (req) => ClientRequestHandler.posts(req, socket));
    socket.on('profile-update', (req) => ClientRequestHandler.profileUpdate(req, socket));
    socket.on('redirect-establish-connection', (req) => ClientRequestHandler.redirectEstablishConnection(req));

    socket.on('disconnect', () => clients.delete(userId));

    recommendPeers(userId, socket);
}

export const getSocket = (userId) => {
    return clients.get(userId);
}

export const disconnectClient = (userId) => {
    clients.get(userId).disconnect();
    clients.delete(userId);
}

export const sendResponseToClient = (socket, requestId, status, payload) => {
    Logger.log('Sent response to client for request ' + requestId + ' with status ' + status + '.');
    if (payload)
        socket.emit('response', {requestId: requestId, status: status, payload: payload});
    else
        socket.emit('response', {requestId: requestId, status: status});
}

// Method that tries to send a configured amount of new peer recommendations to a client, prioritizing friends list
const recommendPeers = (userId, socket) => {
    ServerLocalController.getFriendIds(userId).then((friendIds) => {
        const matches = friendIds.filter(x => clients.has(x));
        matches.forEach(friendId => {
            socket.emit('recommended-peer', {id: uuid(), type: RequestType.RECOMMENDED_PEER, peerId: friendId});
        });

        if (matches.length >= NUMBER_OF_PEERS_TO_RECOMMEND)
            return;

        let sent = matches.length;
        for (let clientId of clients.keys()) {
            if (sent >= NUMBER_OF_PEERS_TO_RECOMMEND)
                break;

            if (clientId === userId)
                continue;
            if (!matches.includes(clientId)) {
                socket.emit('recommended-peer', {id: uuid(), type: RequestType.RECOMMENDED_PEER, peerId: clientId});
                sent++;
            }
        }
    });
}

