# EccentricPeer
Bachelor's thesis and implementation

## Summary
EccentricPeer is a decentralized social network that allows clients to share data using peer-to-peer connections.<br/>
The client module is a progressive web application built with Angular.<br/>
The server module is a NodeJS application that uses a MySQL database for data storage.<br/>

The peer-to-peer network must contain at least one server module.<br/>
Client-to-client connections are established using WebRTC. Server-to-client or server-to-server connections use WebSockets (using Socket.IO library).<br/>

Two types of entities are shared inside the network: User Profiles and Posts.<br/>
All entities are secured using digital signatures. All cryptographic operations are performed using the library cryptico-js.<br/>

All the details are explained in-depth in Romanian in my thesis, *Lucrare de licenta.pdf*.
