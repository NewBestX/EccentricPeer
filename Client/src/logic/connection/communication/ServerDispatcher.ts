import {v4 as uuid} from 'uuid';
import {ConnectionManager} from '../ConnectionManager';
import {
  AuthToServerRequest,
  NewPostRequest, RegisterRequest,
  RequestType,
  Response,
  ResponseStatus,
  UserInfoRequest,
  UserSearchRequest
} from '../../model/Network';
import {Validator} from '../../validator/Validator';
import {SERVER_REQUEST_TIMEOUT} from '../Utils';
import {UserProfile} from '../../model/ProfileContent';
import {Post} from '../../model/Post';

// Map of requestId => callback
const pendingRequests = new Map();

export const ServerDispatcher = {
  receiveResponse: (response: Response) => {
    if (!response.requestId || response.status === undefined) {
      console.log('Received invalid server response: ' + JSON.stringify(response));
      return;
    }
    if (!pendingRequests.has(response.requestId)) {
      console.log('Received server response for unregistered/timed-out request ' + response.requestId + ': ' + JSON.stringify(response));
      return;
    }
    pendingRequests.get(response.requestId)(response);
    pendingRequests.delete(response.requestId);
  },
  sendUserSearchReq: (userId, username, publicKey): Promise<UserProfile> => {
    return new Promise((resolve) => {
      const serverSocket = ConnectionManager.getServerSocket();

      if (serverSocket.disconnected) {
        return resolve(undefined);
      }

      const request: UserSearchRequest = {
        id: uuid(),
        type: RequestType.USER_SEARCH,
        userId,
        username,
        publicKey
      };

      const timeout = setTimeout(() => {
        pendingRequests.delete(request.id);
        resolve(undefined);
      }, SERVER_REQUEST_TIMEOUT);

      const callback = (response: Response) => {
        clearTimeout(timeout);
        if (response.status === ResponseStatus.NOT_FOUND) {
          return resolve(undefined);
        }
        if (response.status !== ResponseStatus.OK) {
          console.log('Received server response with status ' + response.status + ': ' + JSON.stringify(response));
          return resolve(undefined);
        }
        if (!response.payload || !Validator.validateUserProfile(response.payload) || (userId && response.payload.userId !== userId) ||
          (username && response.payload.username !== username) || (publicKey && response.payload.publicKey !== publicKey)) {
          console.log('Received invalid server response: ' + JSON.stringify(response));
          return resolve(undefined);
        }

        resolve(response.payload);
      };
      pendingRequests.set(request.id, callback);
      serverSocket.emit('user-search', request);
    });
  },
  sendUserInfoReq: (profile: UserProfile) => {
    return new Promise((resolve) => {
      const serverSocket = ConnectionManager.getServerSocket();

      if (serverSocket.disconnected) {
        return resolve({});
      }

      const request: UserInfoRequest = {
        id: uuid(),
        type: RequestType.USER_INFO,
        userId: profile.userId,
        postCount: profile.postCount,
        detailsVersion: profile.details.versionLock.version,
        profilePictureVersion: profile.profilePicture.versionLock.version,
        friendListVersion: profile.friends.versionLock.version,
        blockedListVersion: profile.blocked.versionLock.version
      };

      const timeout = setTimeout(() => {
        pendingRequests.delete(request.id);
        resolve({});
      }, SERVER_REQUEST_TIMEOUT);

      const callback = (response: Response) => {
        clearTimeout(timeout);
        if (response.status !== ResponseStatus.OK) {
          return resolve({});
        }

        if (!response.payload || !Validator.validateUserProfile(response.payload) || response.payload.userId !== profile.userId) {
          console.log('Received invalid server response: ' + JSON.stringify(response));
          return resolve({});
        }

        resolve(response.payload);
      };

      pendingRequests.set(request.id, callback);
      serverSocket.emit('user-info', request);
    });
  },
  sendPostsReq: (userProfile, beginIndex, endIndex, beginPublicKey = undefined, endPublicKey = undefined) => {
    return new Promise((resolve) => {
      const serverSocket = ConnectionManager.getServerSocket();

      if (serverSocket.disconnected) {
        return resolve([]);
      }

      const request = {
        id: uuid(),
        type: RequestType.POSTS,
        userId: userProfile.userId,
        beginIndex,
        endIndex
      };

      const timeout = setTimeout(() => {
        pendingRequests.delete(request.id);
        resolve([]);
      }, SERVER_REQUEST_TIMEOUT);

      const callback = (response: Response) => {
        clearTimeout(timeout);
        if (response.status !== ResponseStatus.OK) {
          return resolve([]);
        }

        // Validate received posts
        const posts = response.payload.filter((p) => {
          return !!p.id;
        }).sort((a, b) => {
          return a.id - b.id; // ASC sort by id
        });

        const firstKey = !beginPublicKey ? userProfile.publicKey : beginPublicKey;
        const lastKey = !endPublicKey ? userProfile.publicKey : endPublicKey;

        if (!posts || !Validator.validatePostsArray(posts, userProfile.recoveryPublicKey, lastKey, firstKey)) {
          console.log('Received posts from server failed validation.');
          return resolve([]);
        }
        console.log('Received posts from server.');
        resolve(posts);
      };

      pendingRequests.set(request.id, callback);
      serverSocket.emit('posts', request);
    });
  },
  sendNewPost: (newProfile: UserProfile, post: Post) => {
    return new Promise<void>((resolve, reject) => {
      const serverSocket = ConnectionManager.getServerSocket();

      if (serverSocket.disconnected) {
        return reject();
      }

      const request: NewPostRequest = {
        id: uuid(),
        type: RequestType.PROFILE_UPDATE,
        newUserProfile: newProfile,
        post
      };

      const timeout = setTimeout(() => {
        pendingRequests.delete(request.id);
        reject();
      }, SERVER_REQUEST_TIMEOUT);

      const callback = (response: Response) => {
        clearTimeout(timeout);
        if (response.status !== ResponseStatus.OK) {
          reject();
        } else {
          resolve();
        }
      };

      pendingRequests.set(request.id, callback);
      serverSocket.emit('profile-update', request);
    });
  },
  sendAuthRequest: (username: string, publicKey: string, signature: string,
                    recoveryPublicKey: string = undefined, recoveryKeySignature: string = undefined): Promise<UserProfile> => {
    const request: AuthToServerRequest = {
      id: uuid(),
      type: RequestType.AUTH_TO_SERVER,
      username,
      publicKey,
      signature,
      recoveryPublicKey,
      recoveryKeySignature
    };

    return authRegisterHelper(request);
  },
  sendRegisterRequest: (newProfile: UserProfile, firstPost: Post, pkSignature: string, rpkSignature: string): Promise<any> => {
    const request: RegisterRequest = {
      id: uuid(),
      type: RequestType.REGISTER,
      newProfile,
      firstPost,
      publicKeySignature: pkSignature,
      recoveryKeySignature: rpkSignature
    };

    return authRegisterHelper(request);
  }
};

// A handler for both authentication and registration
const authRegisterHelper = (request) => {
  return new Promise<UserProfile>((resolve, reject) => {
    const serverSocket = ConnectionManager.getServerSocket();

    if (serverSocket.disconnected) {
      return reject();
    }

    const timeout = setTimeout(() => {
      pendingRequests.delete(request.id);
      reject();
    }, SERVER_REQUEST_TIMEOUT);

    const callback = (response: Response) => {
      clearTimeout(timeout);
      if (response.status !== ResponseStatus.OK) {
        reject();
      } else {
        if (!!response.payload) {  // Received at login
          if (!Validator.validateUserProfile(response.payload)) {
            console.log('Received invalid profile from server');
            console.log(JSON.stringify(response.payload));
            reject();
          } else {
            resolve(response.payload);
          }
        } else {
          resolve(undefined); // Received at register
        }
      }
    };

    pendingRequests.set(request.id, callback);
    serverSocket.emit('auth', request);
  });
};
