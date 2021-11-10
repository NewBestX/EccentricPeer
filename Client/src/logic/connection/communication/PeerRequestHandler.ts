import {NewPostRequest, PostsRequest, RequestType, ResponseStatus, UserInfoRequest} from '../../model/Network';
import {DataController} from '../../DataController';
import {UserProfile} from '../../model/ProfileContent';
import {Validator} from '../../validator/Validator';

export const PeerRequestHandler = {
  userInfo: (request: UserInfoRequest, channel: RTCDataChannel) => {
    if (!validRequest(request, RequestType.USER_INFO)) {
      return;
    }

    if (request.userId !== DataController.getMyProfile().userId) {
      sendResponse(channel, request.id, ResponseStatus.BAD_REQUEST);
      return;
    }

    if (request.postCount >= DataController.getMyProfile().postCount) {
      sendResponse(channel, request.id, ResponseStatus.UP_TO_DATE);
      return;
    }
    const myProfile: UserProfile = JSON.parse(JSON.stringify(DataController.getMyProfile()));

    if (request.detailsVersion === myProfile.details.versionLock.version) {
      delete myProfile.details;
    }

    if (request.profilePictureVersion === myProfile.profilePicture.versionLock.version) {
      delete myProfile.profilePicture;
    }

    if (request.friendListVersion === myProfile.friends.versionLock.version) {
      delete myProfile.friends;
    }

    if (request.blockedListVersion === myProfile.blocked.versionLock.version) {
      delete myProfile.blocked;
    }

    sendResponse(channel, request.id, ResponseStatus.OK, myProfile);
  },
  posts: (request: PostsRequest, channel: RTCDataChannel) => {
    if (!validRequest(request, RequestType.POSTS)) {
      return;
    }

    if (!request.beginIndex || !request.endIndex) {
      sendResponse(channel, request.id, ResponseStatus.BAD_REQUEST);
      return;
    }

    const myPosts = DataController.getMyPosts();
    const toSend = myPosts.filter(post => post.id >= request.beginIndex && post.id <= request.endIndex);

    sendResponse(channel, request.id, ResponseStatus.OK, toSend);
  },
  newPost: (request: NewPostRequest, senderUserId: string) => {
    if (!validRequest(request, RequestType.PROFILE_UPDATE)) {
      return;
    }

    if (!request.newUserProfile || !request.post) {
      return;
    }

    const profile = request.newUserProfile;
    const post = request.post;

    // Only store updates from friends
    if (!DataController.getMyProfile().friends.elements.map(x => x.id).includes(profile.userId)) {
      return;
    }

    if (!Validator.validateUserProfile(profile) || !Validator.validateSinglePost(post, profile.publicKey, profile.recoveryPublicKey)) {
      return;
    }

    DataController.addNewPostToDb(profile, post);
  }
};

const sendResponse = (channel: RTCDataChannel, requestId: string, status: ResponseStatus, payload: any = undefined) => {
  console.log('Sending response to peer for request ' + requestId + ' with status ' + status + '.');
  if (payload) {
    channel.send(JSON.stringify({requestId, status, payload}));
  } else {
    channel.send(JSON.stringify({requestId, status}));
  }
};

const validRequest = (req, expectedType): boolean => {
  return !(!req || !req.id || req.type !== expectedType);
};
