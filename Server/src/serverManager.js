import http from "http";
import {Server} from "socket.io";
import {Logger} from "./main.js";
import {addServer} from "./serverCommunication/serverConnections.js";
import {authClient} from "./clientCommunication/authentication.js";

let httpServer, io;

export const REQUEST_TIMEOUT_TIME = 1000;
export const NUMBER_OF_PEERS_TO_RECOMMEND = 5;

export const startServer = (port) => {
    httpServer = http.createServer();

    io = new Server(httpServer, getServerOptions());

    io.on('connection', (socket) => {
        if (socket.handshake.query['server'] === true) {
            addServer(socket);
        } else {
            // Client attempting to connect
            authClient(socket);
        }
    });

    httpServer.listen(port);
    Logger.log('Server started.');
}

const getServerOptions = () => {
    return {
        cors: {
            origin: '*',
        }
    }
}

export const RequestType = Object.freeze({
    PING: 0,
    REGISTER: 1,
    AUTH_TO_SERVER: 2,
    USER_SEARCH: 3,
    USER_INFO: 4,
    RECOMMENDED_PEER: 5,
    ESTABLISH_CONNECTION: 6,
    PROFILE_UPDATE: 7,
    POSTS: 8,
});

export const ResponseStatus = Object.freeze({
    OK: 0,
    DENIED: 1,
    BAD_REQUEST: 2,
    UP_TO_DATE: 3,
    UNAUTHORIZED: 4,
    NOT_FOUND: 5,
    INTERNAL_ERROR: 6
});

export const PostType = Object.freeze({
    CONTENT: 0,
    PROFILE_UPDATE: 1,
    POST_DELETION: 2,
    KEY_CHANGE: 3,
    ACCOUNT_DELETION: 4
});
