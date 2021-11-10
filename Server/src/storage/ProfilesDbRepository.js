import {getDbConnection} from "./dbConnection.js";
import {
    DELETE_PROFILE,
    FIND_PROFILE_BY_ID,
    FIND_PROFILE_BY_PUBLIC_KEY,
    FIND_PROFILE_BY_RECOVERY_PUBLIC_KEY,
    FIND_PROFILE_BY_USERNAME, INSERT_PROFILE, UPDATE_PROFILE
} from "./sqlQueries.js";

export const ProfilesDbRepository = {
    findById: (userId) => {
        return new Promise((resolve, reject) => {
            getDbConnection().then((connection) => {
                connection.query(FIND_PROFILE_BY_ID, userId, (error, results) => handleProfileFindResult(resolve, reject, error, results));
            }).catch((err) => reject(err));
        });
    },
    findByUsername: (username) => {
        return new Promise((resolve, reject) => {
            getDbConnection().then((connection) => {
                connection.query(FIND_PROFILE_BY_USERNAME, username, (error, results) => handleProfileFindResult(resolve, reject, error, results));
            }).catch((err) => reject(err));
        });
    },
    findByPublicKey: (key) => {
        return new Promise((resolve, reject) => {
            getDbConnection().then((connection) => {
                connection.query(FIND_PROFILE_BY_PUBLIC_KEY, key, (error, results) => handleProfileFindResult(resolve, reject, error, results));
            }).catch((err) => reject(err));
        });
    },
    findByRecoveryPublicKey: (key) => {
        return new Promise((resolve, reject) => {
            getDbConnection().then((connection) => {
                connection.query(FIND_PROFILE_BY_RECOVERY_PUBLIC_KEY, key, (error, results) => handleProfileFindResult(resolve, reject, error, results));
            }).catch((err) => reject(err));
        });
    },
    add: (profile) => {
        return new Promise((resolve, reject) => {
            getDbConnection().then((connection) => {
                const {userId, username, publicKey, recoveryPublicKey, ...object} = profile;
                connection.query(INSERT_PROFILE, [userId, username, publicKey, recoveryPublicKey, JSON.stringify(object)], (error) => {
                    if (error) reject(error);
                    else resolve();
                });
            }).catch((err) => reject(err));
        });
    },
    update: (profile) => {
        return new Promise((resolve, reject) => {
            getDbConnection().then((connection) => {
                const {userId, username, publicKey, recoveryPublicKey, ...object} = profile;
                connection.query(UPDATE_PROFILE, [username, publicKey, recoveryPublicKey, JSON.stringify(object), userId], (error) => {
                    if (error) reject(error);
                    else resolve();
                });
            }).catch((err) => reject(err));
        });
    },
    remove: (userId) => {
        return new Promise((resolve, reject) => {
            getDbConnection().then((connection) => {
                connection.query(DELETE_PROFILE, [userId], (error) => {
                    if (error) reject(error);
                    else resolve();
                });
            }).catch((err) => reject(err));
        });
    }
};

const mergeProfileFields = (p) => {
    return {
        userId: p.userId,
        username: p.username,
        publicKey: p.publicKey,
        recoveryPublicKey: p.recoveryPublicKey,
        ...JSON.parse(p.object)
    };
}

const handleProfileFindResult = (resolve, reject, error, results) => {
    if (error)
        return reject(error);
    if (results.length !== 1)
        return resolve(undefined);
    return resolve(mergeProfileFields(results[0]));
}
