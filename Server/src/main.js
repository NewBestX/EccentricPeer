import {startServer} from "./serverManager.js";
import {readFileSync} from "fs";
import {getDbConnection} from "./storage/dbConnection.js";

export const serverConfig = JSON.parse(readFileSync('./serverConfig.json').toString());

export const Logger = {
    log: (message, level) => {
        let prefix = '';
        if (level) {
            if (level === 1)
                prefix = ' [WARNING] ';
            else if (level === 2)
                prefix = ' [ERROR] ';
            else if (level === 3)
                prefix = ' [CRITICAL] ';
        }
        console.log(new Date().toTimeString().split(' ')[0] + ' - ' + prefix + ' ' + message);
    },
    MessageLevel: Object.freeze({
        WARNING: 1,
        ERROR: 2,
        CRITICAL: 3
    })
}

getDbConnection().then(() => {
    startServer(serverConfig.port);
}).catch(() => {
    console.log('Error getting database connection, stopping server.')
});




// const httpServer = http.createServer();
// const io = new Server(httpServer, {
//     cors: {
//         origin: '*',
//     }
// });
//
// console.log("Done");
//

// const clients = [];
//
// io.on('connection', (socket) => {
//     console.log("User connected: " + socket.handshake.query['my-key'] + ' ' + socket.id);
//     clients.push(socket);
//     if (clients.length === 1) {
//         setTimeout(() => {
//             console.log("in timeout");
//             clients[0].emit('buna-ziua', 'asd');
//         }, 5000);
//     }
//     socket.on('offer', (oferta) => {
//         clients[1].emit('oferta', oferta);
//     })
//     socket.on('answer', (rasp) => {
//         clients[0].emit('raspuns-la-oferta', rasp);
//     })
//     socket.on('ice', (msg) => {
//         if (socket === clients[0])
//             clients[1].emit('iaICE', msg);
//         else
//             clients[0].emit('iaICE', msg);
//     })
// });
//
// httpServer.listen(25015);
//
// console.log("Starting db tests");
//
// const dummyPost = {
//     id: 1,
//     signature: 'testSignature',
//     postType: 0,
//     content: 'testContent'
// }
//
// const dummyProfile = {
//     userId: '1',
//     username: 'asd',
//     publicKey: 'testPK',
//     recoveryPublicKey: 'testRPK',
//     postCount: 1,
//     postCountSignature: 'testPCS',
//     sharePermission: 0,
//     details: {
//         registrationTimestamp: 0,
//         birthday: {
//             year: 1999,
//             month: 4,
//             day: 4
//         },
//         description: 'testDESC',
//         location: 'testLoc',
//         education: 'testEd',
//         versionLock: {
//             version: 1,
//             signature: 'testVLSD'
//         }
//     },
//     profilePicture: {
//         picture: 'testPICTURE',
//         versionLock: {
//             version: 1,
//             signature: 'testVLSP'
//         }
//     },
//     friends: {
//         elements: ['testFLid1', 'testFLid2'],
//         versionLock: {
//             version: 1,
//             signature: 'testVLSFL'
//         }
//     },
//     blocked: {
//         elements: ['testBLid1', 'testBLid2'],
//         versionLock: {
//             version: 1,
//             signature: 'testVLSBL'
//         }
//     }
// }
//
// ProfilesDbRepository.add(dummyProfile).then(() => {
//     return ProfilesDbRepository.findById(1);
// }).then((result) => {
//     console.log("Rezultat PROFILES: " + (JSON.stringify(dummyProfile) === JSON.stringify(result)));
// }).catch((err) => {
//     console.log("EROARE: " + JSON.stringify(err));
// });
//
// PostsDbRepository.add('1', [dummyPost]).then(() => {
//     return PostsDbRepository.find('1', 1, 1)
// }).then((result) => {
//     console.log("len: " + result.length);
//     console.log("Rezultat POSTS: " + (JSON.stringify(dummyPost) === JSON.stringify(result[0])));
// }).catch((err) => {
//     console.log("EROARE: " + JSON.stringify(err));
// });
