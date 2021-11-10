import {io, Socket} from 'socket.io-client';
import {SERVER_CONNECTION_OPTIONS, ServerList} from './Utils';
import {ServerDispatcher} from './communication/ServerDispatcher';
import {PeerConnectionEstablisher, peerSignalingCallback, serverSignalingCallback} from './PeerConnectionEstablisher';
import {PeerDispatcher} from './communication/PeerDispatcher';
import {RequestType} from '../model/Network';
import {PeerRequestHandler} from './communication/PeerRequestHandler';
import {UserProfile} from '../model/ProfileContent';
import {Post} from '../model/Post';


let serverSocket: Socket;
const connectedPeers = new Map<string, RTCDataChannel>(); // userId => dataChannel
let lastAuthKey: string;

export const ConnectionManager = {
  // Makes sure a server connection is established and returns the auth key received
  getServerAuthKey: (onReconnectCallback): Promise<string> => {
    return new Promise<string>((resolve, reject) => {
      if (!!serverSocket && serverSocket.connected && !!lastAuthKey) {
        resolve(lastAuthKey);
      } else {
        retryServerConnection(resolve, onReconnectCallback, 10, reject);
      }
    });
  },
  broadcastNewPost: (newProfile: UserProfile, post: Post) => {
    if (connectedPeers.size > 0) {
      PeerDispatcher.broadcastNewPost(newProfile, post, connectedPeers.values());
    }
  },
  searchProfileUpdates: (profile: UserProfile) => {
    const channel = connectedPeers.get(profile.userId);
    if (channel) {
      console.log('Trying to find updates directly from peer!');
      return PeerDispatcher.sendUserInfoReq(profile, channel).catch(() => {
        console.log('Looking on the server instead.');
        return ServerDispatcher.sendUserInfoReq(profile);
      });
    } else {
      console.log('User not directly connected, looking on the server.');
      return ServerDispatcher.sendUserInfoReq(profile);
    }
  },
  searchPosts: (profile: UserProfile, beginIndex: number, beginPublicKey: string) => {
    const channel = connectedPeers.get(profile.userId);
    if (channel) {
      return PeerDispatcher.sendPostsReq(profile, beginIndex, profile.postCount, beginPublicKey, profile.publicKey, channel).catch(() => {
        return ServerDispatcher.sendPostsReq(profile, beginIndex, profile.postCount, beginPublicKey, profile.publicKey);
      });
    } else {
      return ServerDispatcher.sendPostsReq(profile, beginIndex, profile.postCount, beginPublicKey, profile.publicKey);
    }
  },
  getServerSocket: () => {
    return serverSocket;
  },
  getConnectedPeersMap: () => {
    return connectedPeers;
  },
  getConnectedPeersIds: () => {
    return connectedPeers.keys();
  },
  addNewPeer: (userId, dataChannel) => {
    PeerConnectionEstablisher.finishedConnecting(userId);
    addDataChannelMessageHandlers(dataChannel, userId);
    connectedPeers.set(userId, dataChannel);
    console.log('Added new peer, connected: ' + connectedPeers.size);
    setTimeout(() => dataChannel.send('"test"'), 1000);
  },
  removePeer: (userId) => {
    const channel = connectedPeers.get(userId);
    if (channel && channel.readyState === 'open') {
      channel.close();
    }
    connectedPeers.delete(userId);
    console.log('Peer disconnected, still online: ' + connectedPeers.size);
  },
  disconnectAll: () => {
    for (const channel of connectedPeers.values()) {
      channel.close();
    }
    connectedPeers.clear();
    serverSocket.disconnect();
    console.log('Disconnected from the server and all peers.');
  }
};

const retryServerConnection = (authKeyCallback, onReconnectCallback, maxRetryAttempts, failCallback): void => {
  if (maxRetryAttempts <= 0) {
    console.log('Failed to connect to server!');
    failCallback();
    return;
  }
  console.log('Establishing server connection...');

  const pick = Math.floor(Math.random() * ServerList.length);
  serverSocket = io(ServerList[pick], SERVER_CONNECTION_OPTIONS);

  addServerHandlers();

  // Adding the auth handler
  serverSocket.once('auth-key', (key) => {
    lastAuthKey = key;
    authKeyCallback(key);
  });
  serverSocket.on('disconnect', () => {
    lastAuthKey = undefined;
    onReconnectCallback();
  });
  serverSocket.on('connect_error', () => retryServerConnection(authKeyCallback, onReconnectCallback, maxRetryAttempts - 1, failCallback));
  serverSocket.on('connect_failed', () => retryServerConnection(authKeyCallback, onReconnectCallback, maxRetryAttempts - 1, failCallback));
};

const addServerHandlers = (): void => {
  serverSocket.on('response', (response) => ServerDispatcher.receiveResponse(response));
  serverSocket.on('recommended-peer', (request) => PeerConnectionEstablisher.receivePeerRecommendation(request, serverSignalingCallback));
  serverSocket.on('establish-connection', (request) => PeerConnectionEstablisher.receiveEstablishRequest(request, serverSignalingCallback));
};

const addDataChannelMessageHandlers = (dataChannel: RTCDataChannel, userId: string) => {
  dataChannel.onmessage = event => {
    console.log('> WebRTC: ' + event.data.substr(0, 200) + (event.data.length > 200 ? ' ...' : ''));
    const message = JSON.parse(event.data);
    if (!!message.requestId && message.status !== undefined) { // Response
      PeerDispatcher.registerResponse(message);
    } else if (!!message.id && message.type !== undefined) { // Request
      if (message.type === RequestType.RECOMMENDED_PEER) {
        PeerConnectionEstablisher.receivePeerRecommendation(message, peerSignalingCallback(dataChannel));
      } else if (message.type === RequestType.ESTABLISH_CONNECTION) {
        PeerConnectionEstablisher.receiveEstablishRequest(message, peerSignalingCallback(dataChannel));
      } else if (message.type === RequestType.USER_INFO) {
        PeerRequestHandler.userInfo(message, dataChannel);
      } else if (message.type === RequestType.POSTS) {
        PeerRequestHandler.posts(message, dataChannel);
      } else if (message.type === RequestType.PROFILE_UPDATE) {
        PeerRequestHandler.newPost(message, userId);
      }
    }
  };
};
