export const STUNList = [
  {urls: 'stun:stun.l.google.com:19302'},
  {urls: 'stun:stun1.l.google.com:19302'},
  {urls: 'stun:stun2.l.google.com:19302'},
  {urls: 'stun:stun3.l.google.com:19302'},
  {urls: 'stun:stun4.l.google.com:19302'},
];

export const ServerList = ['http://localhost:25015'];

export const SERVER_CONNECTION_OPTIONS = {
  reconnectionDelayMax: 10000,
  reconnection: false // it is handled manually
  // query: {
  //  'my-key': 'my-valueSalut'
  // }
};

// The amount of time the application will wait for a response from the server
export const SERVER_REQUEST_TIMEOUT = 5000;
// The amount of time the application will wait for a response from a peer
export const PEER_REQUEST_TIMEOUT = 1000;
// The number of random peers wanted (not friends)
export const MIN_WANTED_PEERS = 10;
