import {v4 as uuid} from 'uuid';
import {connectClient, sendResponseToClient} from "./clientsManager.js";
import {Validator} from "../validator/Validator.js";
import {PostType, RequestType, ResponseStatus} from "../serverManager.js";
import {Logger} from "../main.js";
import {ServerLocalController} from "../ServerLocalController.js";
import {checkSignature} from "../validator/signatureValidator.js";
import {ServerDispatcher} from "../serverCommunication/ServerDispatcher.js";
import {lookForProfileUpdates} from "../serverCommunication/serverConnectionUtils.js";

// Map of socket: authKey
const authenticating = new Map();

export const authClient = (socket) => {
    const key = createAuthKey();
    authenticating.set(socket, key);
    socket.on('auth', (req) => handleAuthRequest(socket, req));
    socket.emit('auth-key', key);
}

const handleAuthRequest = (socket, request) => {
    const id = request.id;
    const type = request.type;

    if (!id) {
        sendResponseToClient(socket, 0, ResponseStatus.BAD_REQUEST);
        return;
    }
    if (!type) {
        sendResponseToClient(socket, id, ResponseStatus.BAD_REQUEST);
        return;
    }

    if (!authenticating.has(socket)) {
        Logger.log('Could not find socket in authenticating list!', Logger.MessageLevel.ERROR);
        sendResponseToClient(socket, id, ResponseStatus.INTERNAL_ERROR);
        socket.disconnect();
        return;
    }
    const authKey = authenticating.get(socket);

    if (type === RequestType.REGISTER) {
        const profile = request.newProfile;
        const post = request.firstPost;

        if (!Validator.validateNewUserProfile(profile) ||
            !request.publicKeySignature ||
            !request.recoveryKeySignature ||
            !Validator.validateSinglePost(post, profile.publicKey, profile.recoveryPublicKey) ||
            post.id !== 1 || post.postType !== PostType.PROFILE_UPDATE) {
            sendResponseToClient(socket, id, ResponseStatus.BAD_REQUEST);
            return;
        }
        Logger.log('Register request for username: ' + profile.username);

        const publicKey = profile.publicKey;
        const recoveryPublicKey = profile.recoveryPublicKey;

        if (!checkSignature(authKey, request.publicKeySignature, publicKey) ||
            !checkSignature(authKey, request.recoveryKeySignature, recoveryPublicKey)) {
            Logger.log('Registration rejected for bad signatures.');
            sendResponseToClient(socket, id, ResponseStatus.BAD_REQUEST);
            return;
        }

        handleRegistration(id, socket, profile, post);
    } else if (type === RequestType.AUTH_TO_SERVER) {
        const {signature, username, publicKey, recoveryPublicKey, recoveryKeySignature} = request;
        if (!signature || !username || !publicKey || !checkSignature(authKey, signature, publicKey)) {
            sendResponseToClient(socket, id, ResponseStatus.BAD_REQUEST);
            return;
        }
        Logger.log('Auth request for username: ' + username);

        ServerLocalController.userSearch(undefined, username, undefined).then((result1) => {
            if (result1) {
                lookForProfileUpdates(result1).then((result2) => {
                    if (recoveryPublicKey && recoveryKeySignature) {
                        if (checkSignature(authKey, recoveryKeySignature, recoveryPublicKey)) {
                            finishAuth(socket, id, result2, username, publicKey, recoveryPublicKey);
                        } else {
                            sendResponseToClient(socket, id, ResponseStatus.BAD_REQUEST);
                        }
                    } else {
                        finishAuth(socket, id, result2, username, publicKey);
                    }
                    if (result2.postCount > result1.postCount) {
                        ServerDispatcher.sendPostsReq(result2, result1.postCount, result2.postCount, result1.publicKey, result2.publicKey).then((posts) => {
                            if (posts.length !== 0)
                                ServerLocalController.processNewPosts(result2, posts);
                        });
                    }
                });
            } else {
                ServerDispatcher.sendUserSearchReq(undefined, username, publicKey).then((result2) => {
                    if (!result2) {
                        // Account not found
                        sendResponseToClient(socket, id, ResponseStatus.DENIED);
                    } else {
                        ServerDispatcher.sendPostsReq(result2, 1, result2.postCount).then((posts) => {
                            ServerLocalController.addNewUser(result2, posts);
                            finishAuth(socket, id, result2, username, publicKey);
                        });
                    }
                });
            }
        })
    }
}

const finishAuth = (socket, id, profile, username, publicKey, recoveryKey) => {
    if (recoveryKey) {
        if (!profile || profile.deleted === true || profile.username !== username || profile.recoveryPublicKey !== recoveryKey) {
            sendResponseToClient(socket, id, ResponseStatus.DENIED);
        } else {
            sendResponseToClient(socket, id, ResponseStatus.OK, profile);
            authCompleted(socket, profile.userId);
        }
    }

    if (!profile || profile.deleted === true || profile.username !== username || profile.publicKey !== publicKey) {
        sendResponseToClient(socket, id, ResponseStatus.DENIED);
    } else {
        sendResponseToClient(socket, id, ResponseStatus.OK, profile);
        authCompleted(socket, profile.userId);
    }
}

const handleRegistration = (requestId, socket, profile, post) => {
    ServerLocalController.userSearch(profile.userId, profile.username, profile.publicKey).then((result) => {
        if (result)
            throw undefined;
        return ServerDispatcher.sendUserSearchReq(profile.userId, profile.username, profile.publicKey);
    }).then((result) => {
        if (result) {
            ServerLocalController.addNewUser(result);
            throw undefined;
        }
        // At this stage, the new profile passed all validations and will be registered.
        ServerLocalController.addNewUser(profile, [post]);
        ServerDispatcher.sendNewPost(profile, post);

        // Sending success message to the client
        authCompleted(socket, profile.userId);
        sendResponseToClient(socket, requestId, ResponseStatus.OK);
    }).catch((error) => {
        if (error) { // If not undefined, it came from the repository...
            Logger.log('Error occurred while saving a new user: ' + error.toString(), Logger.MessageLevel.ERROR);
            sendResponseToClient(socket, requestId, ResponseStatus.INTERNAL_ERROR);
        } else { // Username already in use
            sendResponseToClient(socket, requestId, ResponseStatus.DENIED);
        }
    });
}

const authCompleted = (socket, userId) => {
    socket.removeAllListeners('auth');
    authenticating.delete(socket);
    connectClient(socket, userId);
}

const createAuthKey = () => {
    return Date.now() + '.' + uuid();
}
