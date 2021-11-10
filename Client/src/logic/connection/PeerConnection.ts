import {STUNList} from './Utils';
import {ConnectionManager} from './ConnectionManager';
import {decryptMessage, encryptMessage} from '../encryption/Encryption';
import {DataController} from '../DataController';
import {ConnectionContentType, EstablishConnectionRequest, RequestType} from '../model/Network';
import {v4 as uuid} from 'uuid';


export class PeerConnection {
  private peerConnection: RTCPeerConnection;
  private data: RTCDataChannel;
  readonly peerId: string;
  readonly encryptionPublicKey: string;

  constructor(peerId: string, publicKey: string, configuration: any = {iceServers: STUNList}) {
    this.peerConnection = new RTCPeerConnection(configuration);
    this.encryptionPublicKey = publicKey;
    this.peerId = peerId;

    // setInterval(() => {
    //   console.log('>> Connection: ' + this.peerConnection.connectionState + ' -> Data: ' + this.data.readyState);
    // }, 3000);
  }

  async createOffer(): Promise<any> {
    this.data = this.peerConnection.createDataChannel('data');

    this.data.onopen = () => ConnectionManager.addNewPeer(this.peerId, this.data);
    this.data.onclose = () => {
      ConnectionManager.removePeer(this.peerId);
      this.peerConnection.close();
    };

    const offer = await this.peerConnection.createOffer();
    await this.peerConnection.setLocalDescription(offer);
    return encryptMessage(JSON.stringify(offer), this.encryptionPublicKey);
  }

  async acceptOffer(offer: any, sendIceCallback): Promise<any> {
    const decryptedOffer = JSON.parse(decryptMessage(offer, DataController.getMyPrivateKey().keyObj));
    await this.peerConnection.setRemoteDescription(new RTCSessionDescription(decryptedOffer));
    const answer = await this.peerConnection.createAnswer();
    await this.peerConnection.setLocalDescription(answer);

    this.peerConnection.onicecandidate = (ev) => {
      if (ev && ev.candidate) {
        sendIceCallback(createCandidateRequest(ev.candidate, this.peerId));
      }
    };
    this.peerConnection.ondatachannel = (ev) => {
      this.data = ev.channel;

      this.data.onopen = () => ConnectionManager.addNewPeer(this.peerId, this.data);
      this.data.onclose = () => {
        ConnectionManager.removePeer(this.peerId);
        this.peerConnection.close();
      };
    };

    return encryptMessage(JSON.stringify(answer), this.encryptionPublicKey);
  }

  async receiveAnswer(answer: any, sendIceCallback): Promise<void> {
    const decryptedAnswer = JSON.parse(decryptMessage(answer, DataController.getMyPrivateKey().keyObj));
    await this.peerConnection.setRemoteDescription(decryptedAnswer);

    this.peerConnection.onicecandidate = (ev) => {
      if (ev && ev.candidate) {
        sendIceCallback(createCandidateRequest(ev.candidate, this.peerId));
      }
    };
  }

  async addIce(candidate): Promise<void> {
    await this.peerConnection.addIceCandidate(candidate);
  }
}

const createCandidateRequest = (candidate, destinationId): EstablishConnectionRequest => {
  return {
    id: uuid(),
    type: RequestType.ESTABLISH_CONNECTION,
    senderUserId: DataController.getMyProfile().userId,
    destinationUserId: destinationId,
    contentType: ConnectionContentType.ICE_CANDIDATE,
    payload: candidate
  };
};
