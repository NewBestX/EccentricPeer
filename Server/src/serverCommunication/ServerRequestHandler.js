import {ServerLocalController} from "../ServerLocalController.js";
import {Validator} from "../validator/Validator.js";
import {ServerDispatcher} from "./ServerDispatcher.js";
import {Logger} from "../main.js";
import {PostType, RequestType, ResponseStatus} from "../serverManager.js";
import {removeUpToDateFields, validRequest} from "../utils.js";


export const ServerRequestHandler = {
    userSearchHandler: (request, sourceSocket) => {
        if (!validRequest(request, RequestType.USER_SEARCH))
            return;

        ServerLocalController.userSearch(request.userId, request.username, request.publicKey).then((result) => {
            if (!result) {
                sourceSocket.emit('response', {requestId: request.id, status: ResponseStatus.NOT_FOUND});
            } else {
                sourceSocket.emit('response', {requestId: request.id, status: ResponseStatus.OK, payload: result});
            }
        });
    },
    userInfoHandler: (request, sourceSocket) => {
        if (!validRequest(request, RequestType.USER_INFO))
            return;

        ServerLocalController.userSearch(request.userId).then((result) => {
            if (!result) {
                sourceSocket.emit('response', {requestId: request.id, status: ResponseStatus.NOT_FOUND});
                return;
            }

            if (result.postCount <= request.postCount) {
                sourceSocket.emit('response', {requestId: request.id, status: ResponseStatus.UP_TO_DATE});
                return;
            }

            if (!result.deleted)
                result = removeUpToDateFields(request, result);

            sourceSocket.emit('response', {requestId: request.id, status: ResponseStatus.OK, payload: result});
        });
    },
    postsHandler: (request, sourceSocket) => {
        if (!validRequest(request, RequestType.POSTS))
            return;

        ServerLocalController.getPosts(request.userId, request.beginIndex, request.endIndex).then((posts) => {
            sourceSocket.emit('response', {requestId: request.id, status: ResponseStatus.OK, payload: posts});
        });
    },
    // Received when UserProfile is updated: new post (or even on register)
    profileUpdateHandler: (request) => {
        if (!validRequest(request, RequestType.PROFILE_UPDATE))
            return;

        const profile = request.newUserProfile;
        const post = request.post;

        if (!Validator.validateUserProfile(profile) || !Validator.validateSinglePost(post, profile.publicKey, profile.recoveryPublicKey))
            return;

        if (profile.deleted && post.postType !== PostType.ACCOUNT_DELETION) {
            Logger.log('Received a post from a deleted profile');
            return;
        }
        if (post.postType === PostType.ACCOUNT_DELETION && !profile.deleted) {
            Logger.log('Received profile deletion post, but the profile flag was not set!')
            return;
        }

        ServerLocalController.userSearch(profile.userId).then((result) => {
            if (!result) {
                if (profile.postCount !== 1) {
                    if (profile.deleted) {
                        Logger.log('Received a deleted user account, marking as deleted: ' + profile.username);
                        ServerLocalController.addNewUser(profile);
                        return;
                    }

                    ServerDispatcher.sendPostsReq(profile, 1, profile.postCount).then((posts) => {
                        if (posts.length === 0)
                            return;
                        Logger.log('Saving new profile, username: ' + profile.username + ', postCount: ' + profile.postCount);
                        ServerLocalController.addNewUser(profile, posts);
                    });
                } else {
                    Logger.log('Saving newly registered profile, username: ' + profile.username);
                    ServerLocalController.addNewUser(profile, post);
                }
            } else {
                if (result.deleted) {
                    Logger.log('Received a post from a locally deleted profile');
                    return;
                }

                if (result.recoveryPublicKey !== profile.recoveryPublicKey || result.username !== profile.username) {
                    Logger.log('Received a post with a changed recoveryPublicKey or username');
                    // Currently unable to change username, may change in the future
                    return;
                }

                if (result.postCount >= profile.postCount)
                    return;

                if (profile.deleted) {
                    Logger.log('Received notification for deleted account: ' + profile.username);
                    ServerLocalController.deleteAccount(profile);
                }

                if (result.postCount + 1 === profile.postCount) {
                    if (result.publicKey !== profile.publicKey && post.postType !== PostType.KEY_CHANGE) {
                        Logger.log('Received invalid publicKey with new post!');
                        return;
                    }

                    ServerLocalController.processNewPosts(profile, [post]);
                } else {
                    ServerDispatcher.sendPostsReq(result, result.postCount, profile.postCount, result.publicKey, profile.publicKey).then((posts) => {
                        ServerLocalController.processNewPosts(profile, posts);
                    });
                }
            }
        });
    },
    pingHandler: (request, sourceSocket) => {
        if (!validRequest(request, RequestType.PING))
            return;
        sourceSocket.emit('response', {requestId: request.id, status: ResponseStatus.OK});
    }
}

