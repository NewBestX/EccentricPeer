import {ServerLocalController} from "../ServerLocalController.js";
import {PostType, RequestType, ResponseStatus} from "../serverManager.js";
import {disconnectClient, getSocket, sendResponseToClient} from "./clientsManager.js";
import {lookForProfileUpdates} from "../serverCommunication/serverConnectionUtils.js";
import {ServerDispatcher} from "../serverCommunication/ServerDispatcher.js";
import {removeUpToDateFields, validRequest} from "../utils.js";
import {Validator} from "../validator/Validator.js";
import {Logger} from "../main.js";


export const ClientRequestHandler = {
    userSearch: (request, sourceSocket) => {
        if (!validRequest(request, RequestType.USER_SEARCH))
            return;

        ServerLocalController.userSearch(request.userId, request.username, request.publicKey).then((result1) => {
            if (result1) {
                lookForProfileUpdates(result1).then((result2) => {
                    sendResponseToClient(sourceSocket, request.id, ResponseStatus.OK, result2);
                });
            } else {
                ServerDispatcher.sendUserSearchReq(request.userId, request.username, request.publicKey).then((result2) => {
                    if (!result2) {
                        // Account not found
                        sendResponseToClient(sourceSocket, request.id, ResponseStatus.NOT_FOUND);
                    } else {
                        ServerLocalController.addNewUser(result2);
                        sendResponseToClient(sourceSocket, request.id, ResponseStatus.OK, result2);
                    }
                });
            }
        })
    },
    userInfo: (request, sourceSocket) => {
        if (!validRequest(request, RequestType.USER_INFO))
            return;

        ServerLocalController.userSearch(request.userId).then((localResult) => {
            if (localResult) {
                lookForProfileUpdates(localResult).then((result) => {
                    if (result.postCount <= request.postCount) {
                        sendResponseToClient(sourceSocket, request.id, ResponseStatus.UP_TO_DATE);
                        return;
                    }

                    if (!result.deleted)
                        result = removeUpToDateFields(request, result);

                    sendResponseToClient(sourceSocket, request.id, ResponseStatus.OK, result);
                });
            } else {
                ServerDispatcher.sendUserSearchReq(request.userId).then((result) => {
                    if (!result) {
                        // Account not found
                        sendResponseToClient(sourceSocket, request.id, ResponseStatus.NOT_FOUND);
                    } else {
                        ServerLocalController.addNewUser(result);
                        if (result.postCount <= request.postCount) {
                            sendResponseToClient(sourceSocket, request.id, ResponseStatus.UP_TO_DATE);
                            return;
                        }

                        if (!result.deleted)
                            result = removeUpToDateFields(request, result);

                        sendResponseToClient(sourceSocket, request.id, ResponseStatus.OK, result);
                    }
                });
            }
        })
    },
    posts: (request, sourceSocket) => {
        if (!validRequest(request, RequestType.POSTS))
            return;

        ServerLocalController.getPosts(request.userId, request.beginIndex, request.endIndex).then((posts) => {
            if (posts.length === request.endIndex - request.beginIndex + 1) {
                sendResponseToClient(sourceSocket, request.id, ResponseStatus.OK, posts);
            } else {
                ServerLocalController.userSearch(request.userId).then((profile) => {
                    if (!profile) {
                        sendResponseToClient(sourceSocket, request.id, ResponseStatus.NOT_FOUND);
                        return;
                    }

                    ServerDispatcher.sendPostsReq(profile, request.beginIndex, request.endIndex).then((posts2) => {
                        if (posts2.length === request.endIndex - request.beginIndex + 1) {
                            ServerLocalController.processNewPosts(profile, posts2);
                            sendResponseToClient(sourceSocket, request.id, ResponseStatus.OK, posts2);
                        } else {
                            sendResponseToClient(sourceSocket, request.id, ResponseStatus.NOT_FOUND);
                        }
                    });
                });
            }
        });
    },
    profileUpdate: (request, sourceSocket) => {
        if (!validRequest(request, RequestType.PROFILE_UPDATE))
            return;

        const profile = request.newUserProfile;
        const post = request.post;
        console.log(JSON.stringify(post));

        if (sourceSocket !== getSocket(profile.userId)) {
            sendResponseToClient(sourceSocket, request.id, ResponseStatus.DENIED);
            return;
        }

        console.log(Validator.validateUserProfile(profile) + ' ' + Validator.validateSinglePost(post, profile.publicKey, profile.recoveryPublicKey));
        if (!Validator.validateUserProfile(profile) || !Validator.validateSinglePost(post, profile.publicKey, profile.recoveryPublicKey)) {
            sendResponseToClient(sourceSocket, request.id, ResponseStatus.BAD_REQUEST);
            return;
        }

        if (profile.deleted && post.postType !== PostType.ACCOUNT_DELETION) {
            Logger.log('Received a post from client with newProfile set to deleted');
            sendResponseToClient(sourceSocket, request.id, ResponseStatus.BAD_REQUEST);
            return;
        }
        if (post.postType === PostType.ACCOUNT_DELETION && !profile.deleted) {
            Logger.log('Received profile deletion post from client, but the profile flag was not set!')
            sendResponseToClient(sourceSocket, request.id, ResponseStatus.BAD_REQUEST);
            return;
        }
        if (post.id !== profile.postCount) {
            Logger.log('Received a post with an invalid id');
            console.log(post.id);
            sendResponseToClient(sourceSocket, request.id, ResponseStatus.BAD_REQUEST);
            return;
        }

        ServerLocalController.userSearch(profile.userId).then((result) => {
            if (!result) {
                // This shouldn't happen...
                Logger.log('Received post from client, but his profile is not in storage', Logger.MessageLevel.ERROR);
                sendResponseToClient(sourceSocket, request.id, ResponseStatus.INTERNAL_ERROR);
                return;
            }

            if (result.deleted) {
                Logger.log('Received post from client, but his profile is marked as deleted', Logger.MessageLevel.ERROR);
                sendResponseToClient(sourceSocket, request.id, ResponseStatus.DENIED);
                disconnectClient(profile.userId);
                return;
            }

            if (result.recoveryPublicKey !== profile.recoveryPublicKey || result.username !== profile.username) {
                Logger.log('Client tried to change recoveryPublicKey or username');
                // Currently unable to change username, may change in the future
                sendResponseToClient(sourceSocket, request.id, ResponseStatus.DENIED);
                return;
            }

            if (result.postCount >= profile.postCount) {
                sendResponseToClient(sourceSocket, request.id, ResponseStatus.BAD_REQUEST);
                return;
            }

            if (result.publicKey !== profile.publicKey && post.postType !== PostType.KEY_CHANGE) {
                Logger.log('Received invalid publicKey with new post!');
                return;
            }

            if (profile.deleted) {
                Logger.log('Client deleted his account: ' + profile.username);
                ServerLocalController.deleteAccount(profile);
            } else {
                ServerLocalController.processNewPosts(profile, [post]);
            }
            sendResponseToClient(sourceSocket, request.id, ResponseStatus.OK);
            ServerDispatcher.sendNewPost(profile, post);
        });
    },
    redirectEstablishConnection: (request) => {
        if (!validRequest(request, RequestType.ESTABLISH_CONNECTION) || !request.destinationUserId)
            return;

        const destSocket = getSocket(request.destinationUserId);
        if (!destSocket)
            return;

        destSocket.emit('establish-connection', request);
    }
}

