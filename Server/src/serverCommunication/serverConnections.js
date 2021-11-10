import {ServerDispatcher} from "./ServerDispatcher.js";
import {ServerRequestHandler} from "./ServerRequestHandler.js";
import {io} from "socket.io-client";

const servers = [];

export const getConnectedServers = () => servers;

export const addServer = (socket) => {
    if (servers.map(s => s.conn.remoteAddress).includes(socket.conn.remoteAddress)) {
        socket.disconnect();
        return;
    }

    socket.on('response', (response) => ServerDispatcher.registerResponse(response));
    socket.on('server-user-search', (req) => ServerRequestHandler.userSearchHandler(req, socket));
    socket.on('server-user-info', (req) => ServerRequestHandler.userInfoHandler(req, socket));
    socket.on('server-posts', (req) => ServerRequestHandler.postsHandler(req, socket));
    socket.on('server-profile-update', (req) => ServerRequestHandler.profileUpdateHandler(req));

    socket.on('disconnect', () => {
        servers.splice(servers.indexOf(socket), 1);
    });

    socket.on('server-list', (list) => connectToNewServers(list));

    const addressList = servers.map(s => s.conn.remoteAddress);
    socket.emit('server-list', addressList);

    servers.push(socket);
}

// Connects to a list of server addresses (received from another server)
export const connectToNewServers = (list) => {
    const myAddressList = servers.map(s => s.conn.remoteAddress);
    list.filter(addr => !myAddressList.includes(addr)).forEach(addr => attemptServerConnect(addr));
}

const attemptServerConnect = (address) => {
    const connection = io(address, {
        reconnectionDelayMax: 10000,
        query: {'server': true}
    });
    connection.on('connect', (socket) => {
        addServer(socket);
    })
}
