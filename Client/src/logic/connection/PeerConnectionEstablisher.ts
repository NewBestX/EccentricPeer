import {ConnectionContentType, EstablishConnectionRequest, RecommendedPeerRequest, RequestType} from '../model/Network';
import {ConnectionManager} from './ConnectionManager';
import {DataController} from '../DataController';
import {MIN_WANTED_PEERS} from './Utils';
import {PeerConnection} from './PeerConnection';
import {v4 as uuid} from 'uuid';
import {ServerDispatcher} from './communication/ServerDispatcher';
import {UserProfile} from '../model/ProfileContent';


const connecting = new Map<string, PeerConnection>();

export const PeerConnectionEstablisher = {
  receivePeerRecommendation: (req: RecommendedPeerRequest, communicationCallback) => {
    if (!req.peerId) {
      return;
    }
    if (ConnectionManager.getConnectedPeersMap().has(req.peerId)) {
      return;
    }
    const myProfile = DataController.getMyProfile();
    if (myProfile.userId === req.peerId) {
      return;
    }
    if (myProfile.blocked.elements.map(x => x.id).includes(req.peerId)) {
      return;
    }
    if (ConnectionManager.getConnectedPeersMap().size > MIN_WANTED_PEERS
      && !myProfile.friends.elements.map(x => x.id).includes(req.peerId)) {
      return;
    }

    sendOffer(req.peerId, myProfile.userId, communicationCallback);
  },
  receiveEstablishRequest: (request: EstablishConnectionRequest, communicationCallback) => {
    if (request.type !== RequestType.ESTABLISH_CONNECTION || request.destinationUserId !== DataController.getMyProfile().userId) {
      return;
    }

    if (request.contentType === ConnectionContentType.OFFER) {
      analyzeOffer(request.payload, request.senderUserId, communicationCallback);
    } else if (request.contentType === ConnectionContentType.ANSWER) {
      registerAnswer(request.payload, request.senderUserId, communicationCallback);
    } else if (request.contentType === ConnectionContentType.ICE_CANDIDATE) {
      if (connecting.get(request.senderUserId)) {
        connecting.get(request.senderUserId).addIce(request.payload);
      }
    }
  },
  finishedConnecting: (peerId) => {
    connecting.delete(peerId);
  }
};

const sendOffer = (peerId, myId, communicationCallback) => {
  ServerDispatcher.sendUserSearchReq(peerId, undefined, undefined).then((result: UserProfile) => {
    if (!result) {
      return;
    }
    DataController.addNewProfile(result);
    const newConnection = new PeerConnection(peerId, result.publicKey);
    newConnection.createOffer().then((offer) => {
      const request: EstablishConnectionRequest = {
        id: uuid(),
        type: RequestType.ESTABLISH_CONNECTION,
        senderUserId: myId,
        destinationUserId: result.userId,
        contentType: ConnectionContentType.OFFER,
        payload: offer
      };
      communicationCallback(request);
      connecting.set(result.userId, newConnection);
    });
  });
};

const analyzeOffer = (offer, sourceId, communicationCallback) => {
  if (ConnectionManager.getConnectedPeersMap().has(sourceId)) {
    return;
  }
  const myProfile = DataController.getMyProfile();
  if (myProfile.blocked.elements.map(x => x.id).includes(sourceId) || sourceId === myProfile.userId) {
    return;
  }
  if (ConnectionManager.getConnectedPeersMap().size > MIN_WANTED_PEERS && !myProfile.friends.elements.map(x => x.id).includes(sourceId)) {
    return;
  }

  ServerDispatcher.sendUserSearchReq(sourceId, undefined, undefined).then((result: UserProfile) => {
    if (!result) {
      return;
    }
    DataController.addNewProfile(result);
    const newConnection = new PeerConnection(sourceId, result.publicKey);
    newConnection.acceptOffer(offer, communicationCallback).then((answer) => {
      const request: EstablishConnectionRequest = {
        id: uuid(),
        type: RequestType.ESTABLISH_CONNECTION,
        senderUserId: DataController.getMyProfile().userId,
        destinationUserId: sourceId,
        contentType: ConnectionContentType.ANSWER,
        payload: answer
      };
      communicationCallback(request);
      connecting.set(result.userId, newConnection);
    });
  });
};

const registerAnswer = (answer, sourceId, communicationCallback) => {
  if (!connecting.has(sourceId)) {
    return;
  }
  connecting.get(sourceId).receiveAnswer(answer, communicationCallback);
};

export const serverSignalingCallback = (request) => {
  ConnectionManager.getServerSocket().emit('redirect-establish-connection', request);
};

export const peerSignalingCallback = (channel: RTCDataChannel) => {
  return (request) => {
    channel.send(JSON.stringify(request));
  };
};
