import {v4 as uuid} from 'uuid';
import {RequestType, ResponseStatus, REQUEST_TIMEOUT_TIME} from "../serverManager.js";
import {getConnectedServers} from "./serverConnections.js";
import {Logger} from "../main.js";
import {Validator} from "../validator/Validator.js";

// The server can dispatch the following requests (response) to other servers:
// USER_SEARCH (full UserProfile), NEW_POST (), POSTS ([Post]), USER_INFO (partial UserProfile)
// Note: servers only send USER_SEARCH if the user is unknown locally. If a version is known, it is checked for updates
//       using USER_INFO, and only the outdated info is sent back.

// Map of requestId => {responseList, callback, expectedResponseCount}
const pendingRequests = new Map();

export const ServerDispatcher = {
    registerResponse: (response) => {
        if (!response.requestId || !response.status) {
            Logger.log('Received invalid server response.');
            return;
        }
        if (!pendingRequests.has(response.requestId)) {
            Logger.log('Received the following server response for unregistered/timed-out request ' + response.requestId + ': ' + JSON.stringify(response));
            return;
        }
        const it = pendingRequests.get(response.requestId);
        it.responseList.push(response);
        if (it.responseList.length >= it.expectedResponseCount)
            it.callback();
    },
    sendUserSearchReq: (userId, username, publicKey) => {
        return new Promise((resolve) => {
            const servers = getConnectedServers();

            if (servers.length === 0)
                return resolve(undefined);

            const request = {
                id: uuid(),
                type: RequestType.USER_SEARCH,
                userId,
                username,
                publicKey
            }

            const callback = () => {
                clearTimeout(timeout);
                const responses = pendingRequests.get(request.id).responseList;
                pendingRequests.delete(request.id);

                const results = responses.filter((a) => {
                    // Check the received profile to be valid
                    if (a.status === ResponseStatus.NOT_FOUND)
                        return false;
                    if (a.status !== ResponseStatus.OK) {
                        Logger.log('Received server response for request ' + a.requestId + ' with status ' + a.status + ': ' + JSON.stringify(a));
                        return false;
                    }
                    if (!a.payload || !Validator.validateUserProfile(a.payload))
                        return false;
                    if (userId && a.payload.userId !== userId)
                        return false;
                    if (username && a.payload.username !== username)
                        return false;
                    return !(publicKey && a.payload.publicKey !== publicKey);
                }).sort((a, b) => {
                    // Get the most up-to-date response
                    return b.payload.postCount - a.payload.postCount;
                });

                if (results.length === 0 || !results[0])
                    resolve(undefined);
                else {
                    const bestProfile = results[0].payload;
                    resolve(bestProfile);
                }
            }
            const timeout = setTimeout(callback, REQUEST_TIMEOUT_TIME);

            pendingRequests.set(request.id, {
                responseList: [],
                callback: callback,
                expectedResponseCount: servers.length
            });

            servers.forEach((s) => {
                s.emit('server-user-search', request);
            });
        });
    },
    // Returns only the UserProfile fields that need updating
    sendUserInfoReq: (userId, postCount, detailsVersion, profilePictureVersion, friendListVersion, blockedListVersion) => {
        return new Promise((resolve) => {
            const servers = getConnectedServers();

            if (servers.length === 0)
                return resolve({});

            const request = {
                id: uuid(),
                type: RequestType.USER_SEARCH,
                userId,
                postCount,
                detailsVersion,
                profilePictureVersion,
                friendListVersion,
                blockedListVersion
            }

            const callback = () => {
                clearTimeout(timeout);
                const responses = pendingRequests.get(request.id).responseList;
                pendingRequests.delete(request.id);

                const results = responses.filter((a) => {
                    // Check the received profile to be valid
                    if (a.status === ResponseStatus.UP_TO_DATE || a.status === ResponseStatus.NOT_FOUND)
                        return false;
                    if (a.status !== ResponseStatus.OK) {
                        Logger.log('Received server response for request ' + a.requestId + ' with status ' + a.status + ': ' + JSON.stringify(a));
                        return false;
                    }
                    if (!a.payload) {
                        Logger.log('Received server response for request ' + a.requestId + ' with no payload: ' + JSON.stringify(a));
                        return false;
                    }
                    return Validator.validateUserProfile(a.payload);
                }).sort((a, b) => {
                    // Get the most up-to-date response
                    return b.payload.postCount - a.payload.postCount;
                });

                if (results.length === 0)
                    resolve({});
                else
                    resolve(results[0].payload);
            }
            const timeout = setTimeout(callback, REQUEST_TIMEOUT_TIME);

            pendingRequests.set(request.id, {
                responseList: [],
                callback: callback,
                expectedResponseCount: servers.length
            });

            servers.forEach((s) => {
                s.emit('server-user-info', request);
            });
        });
    },
    // Optional: beginPublicKey, endPublicKey - public keys corresponding to beginIndex post and endIndex post
    //           beginPublicKey is only checked if beginIndex > 1. Defaults to userProfile.publicKey
    //           endPublicKey should only be provided if endIndex post's public key differs from userProfile's
    sendPostsReq: (userProfile, beginIndex, endIndex, beginPublicKey, endPublicKey) => {
        return new Promise((resolve) => {
            const servers = getConnectedServers();

            if (servers.length === 0)
                return resolve([]);

            const request = {
                id: uuid(),
                type: RequestType.POSTS,
                userId: userProfile.userId,
                beginIndex,
                endIndex
            }

            const callback = () => {
                const pending = pendingRequests.get(request.id);

                if (pending.responseList.length === 0) {
                    // Means the callback was called because the timeout time is over
                    clearInterval(timeout);
                    return resolve([]);
                }

                // Validate received posts
                const posts = pending.responseList[0].payload.filter((p) => {
                    return !!p.id;
                }).sort((a, b) => {
                    return a.id - b.id; // ASC sort by id
                });
                const firstKey = !beginPublicKey ? userProfile.publicKey : beginPublicKey;
                const lastKey = !endPublicKey ? userProfile.publicKey : endPublicKey;
                if (posts[0].id !== beginIndex ||
                    posts.length !== endIndex - beginIndex + 1 ||
                    !Validator.validatePostsArray(posts, userProfile.recoveryPublicKey, lastKey, firstKey)) {
                    Logger.log('Received posts from server failed validation.');
                    pendingRequests.set(request.id, {
                        responseList: [],
                        callback: pending.callback,
                        expectedResponseCount: 1,
                        nextServerIndex: pending.nextServerIndex
                    });
                    return;
                }

                // Getting here means we got a valid response
                clearInterval(timeout);
                pendingRequests.delete(request.id);
                resolve(posts);
            }
            const nextServerCheck = () => {
                // The interval will be cancelled by the callback on the first valid response received.
                const pending = pendingRequests.get(request.id);

                pendingRequests.set(request.id, {
                    responseList: [], // This should already be empty (either no response received or cleared by callback)
                    callback: pending.callback,
                    expectedResponseCount: 1,
                    nextServerIndex: pending.nextServerIndex + 1
                });

                if (pending.nextServerIndex >= getConnectedServers().length) {
                    // Means the timeout time is over
                    pending.callback();
                    return;
                }

                // Send the request to the next server
                getConnectedServers()[pending.nextServerIndex].emit('posts', request);
            }
            const perServerWait = REQUEST_TIMEOUT_TIME / servers.length;
            const timeout = setInterval(nextServerCheck, perServerWait);

            pendingRequests.set(request.id, {
                responseList: [],
                callback: callback,
                expectedResponseCount: 1,
                nextServerIndex: 1
            });

            getConnectedServers()[0].emit('server-posts', request);
        });
    },
    sendNewPost: (newUserProfile, post) => {
        const servers = getConnectedServers();

        if (servers.length === 0)
            return;

        const request = {
            id: uuid(),
            type: RequestType.PROFILE_UPDATE,
            newUserProfile,
            post
        }
        servers.forEach((s) => {
            s.emit('server-profile-update', request);
        });
    },
}
