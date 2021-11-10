import {NewPostRequest, RequestType, Response, ResponseStatus, UserInfoRequest} from '../../model/Network';
import {UserProfile} from '../../model/ProfileContent';
import {v4 as uuid} from 'uuid';
import {PEER_REQUEST_TIMEOUT} from '../Utils';
import {Validator} from '../../validator/Validator';
import {Post} from '../../model/Post';

// Map of requestId => callback
const pendingRequests = new Map();

export const PeerDispatcher = {
  registerResponse: (response: Response) => {
    if (!response.requestId || response.status === undefined) {
      console.log('Received invalid response from peer.');
      return;
    }
    if (!pendingRequests.has(response.requestId)) {
      console.log('Received peer response for unregistered/timed-out request ' + response.requestId + ': ' + JSON.stringify(response));
      return;
    }
    pendingRequests.get(response.requestId)(response);
    pendingRequests.delete(response.requestId);
  },
  sendUserInfoReq: (profile: UserProfile, channel: RTCDataChannel) => {
    return new Promise((resolve, reject) => {
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
        reject();
      }, PEER_REQUEST_TIMEOUT);

      const callback = (response: Response) => {
        clearTimeout(timeout);
        if (response.status === ResponseStatus.UP_TO_DATE) {
          console.log('Received UserProfile info from peer (up-to-date)!');
          return resolve({});
        }
        if (response.status !== ResponseStatus.OK) {
          return reject();
        }
        if (!response.payload || !Validator.validateUserProfile(response.payload) || response.payload.userId !== profile.userId) {
          console.log('Received invalid peer response: ' + JSON.stringify(response));
          return reject();
        }

        console.log('Received UserProfile info from peer!');
        resolve(response.payload);
      };

      pendingRequests.set(request.id, callback);
      channel.send(JSON.stringify(request));
    });
  },
  sendPostsReq: (userProfile: UserProfile, beginIndex: number, endIndex: number, beginPublicKey, endPublicKey, channel: RTCDataChannel) => {
    return new Promise((resolve, reject) => {
      const request = {
        id: uuid(),
        type: RequestType.POSTS,
        userId: userProfile.userId,
        beginIndex,
        endIndex
      };

      const timeout = setTimeout(() => {
        pendingRequests.delete(request.id);
        reject();
      }, PEER_REQUEST_TIMEOUT);

      const callback = (response: Response) => {
        clearTimeout(timeout);
        if (response.status !== ResponseStatus.OK) {
          return reject();
        }

        // Validate received posts
        const posts = response.payload.filter((p) => {
          return !!p.id;
        }).sort((a, b) => {
          return a.id - b.id; // ASC sort by id
        });

        const firstKey = !beginPublicKey ? userProfile.publicKey : beginPublicKey;
        const lastKey = !endPublicKey ? userProfile.publicKey : endPublicKey;

        if (!posts[0] || !Validator.validatePostsArray(posts, userProfile.recoveryPublicKey, lastKey, firstKey)) {
          console.log('Received posts from peer failed validation.');
          return reject();
        }

        console.log('Received posts from peer.');
        resolve(posts);
      };

      pendingRequests.set(request.id, callback);
      channel.send(JSON.stringify(request));
    });
  },
  broadcastNewPost: (newProfile: UserProfile, post: Post, channels: Iterable<RTCDataChannel>) => {
    const request: NewPostRequest = {
      id: uuid(),
      type: RequestType.PROFILE_UPDATE,
      newUserProfile: newProfile,
      post
    };
    const jsonReq = JSON.stringify(request);

    for (const dc of channels) {
      dc.send(jsonReq);
    }
  },
};
