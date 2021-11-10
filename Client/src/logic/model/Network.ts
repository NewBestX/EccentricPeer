import {UserProfile} from './ProfileContent';
import {Post} from './Post';

export interface Request {
  id: string;
  type: RequestType;
}

export enum RequestType {
  PING,
  REGISTER,
  AUTH_TO_SERVER,
  USER_SEARCH,
  USER_INFO,
  RECOMMENDED_PEER,
  ESTABLISH_CONNECTION,
  PROFILE_UPDATE,
  POSTS,
}

// When connecting to the server WebSocket, the user receives a random code that he must sign and send back to the server
// Upon registration, both the public key signature and the recovery key signature are required
export interface RegisterRequest extends Request {
  newProfile: UserProfile;
  publicKeySignature: string;
  recoveryKeySignature: string;
  firstPost: Post; // type: PROFILE_UPDATE
}

// If the login is successful, the server will send back the up-to-date UserProfile
export interface AuthToServerRequest extends Request {
  signature: string; // When connecting to the server WebSocket, the user receives a random code that he must sign
  username: string;
  publicKey: string;
  recoveryPublicKey?: string;
  recoveryKeySignature?: string;
}

// Expects a complete UserProfile as response if successful
// Used when searching for a profile
export interface UserSearchRequest extends Request {
  username?: string;
  userId?: string;
  publicKey?: string;
}

// Expects a UserProfile as response if successful, with the updated info
// Also used for checking if profile is up to date
export interface UserInfoRequest extends Request {
  userId: string;
  postCount: number;
  detailsVersion?: number;
  profilePictureVersion?: number;
  friendListVersion?: number;
  blockedListVersion?: number;
}

// Sent when we want to suggest a peer to another user (if it needs peers, if the suggested peer responded to a UserSearch,
// if they are friends, if the suggested peer is the user searched, etc)
// If the suggestion is accepted, an offer is expected in the response
export interface RecommendedPeerRequest extends Request {
  peerId?: string; // May be a userId or a server IP address
  isServer?: boolean;
}

// The middleman (peer or server) will only pass this to the destination, Or respond with NOT FOUND if they are not connected to dest.
export interface EstablishConnectionRequest extends Request {
  senderUserId: string;
  destinationUserId: string;
  contentType: ConnectionContentType;
  payload: any; // Should be encrypted with destination's public key
}

export enum ConnectionContentType {
  OFFER,
  ANSWER,
  ICE_CANDIDATE,
}

// Sent by a user when he performs a profile update (a new post-list)
export interface NewPostRequest extends Request {
  newUserProfile: UserProfile;
  post: Post;
}

export interface PostsRequest extends Request {
  userId: string;
  beginIndex: number;
  endIndex: number;
}

// A response will only travel to a neighbouring peer
export interface Response {
  status: ResponseStatus;
  requestId: string;
  payload?: any;
}

export enum ResponseStatus {
  OK,
  DENIED,
  BAD_REQUEST,
  UP_TO_DATE,
  UNAUTHORIZED,
  NOT_FOUND,
  INTERNAL_ERROR,
}
