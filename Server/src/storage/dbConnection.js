import {
    CREATE_INDEX_PROFILES_PUBLIC_KEY,
    CREATE_INDEX_PROFILES_RECOVERY_PUBLIC_KEY,
    CREATE_INDEX_PROFILES_USERNAME,
    CREATE_TABLE_POSTS,
    CREATE_TABLE_PROFILES,
    get_CHECK_TABLE_POSTS_EXISTS,
    get_CHECK_TABLE_PROFILES_EXISTS
} from "./sqlQueries.js";
import mysql from 'mysql';
import {serverConfig} from "../main.js";

let dbConnection = undefined;
let runningPromise = undefined;
let dbName = undefined;

/*
 Returns:
  On resolve: a valid database connection,
  On reject: object containing the failed step (string) and an error object: {step, error}
 If a new connection is needed, the database connection configuration is loaded from config file.
*/
export const getDbConnection = () => {
    // Make sure two connections are not being established simultaneously
    if (runningPromise) {
        return runningPromise;
    }

    return runningPromise = new Promise((promiseResolve, promiseReject) => {
        const resolve = (con) => {
            runningPromise = undefined;
            dbConnection = con;
            promiseResolve(dbConnection);
        }
        const reject = (err) => {
            runningPromise = undefined;
            dbConnection = undefined;
            promiseReject(err);
        }

        if (dbConnection)
            return resolve(dbConnection);

        const connection = mysql.createConnection(getDbConfig());

        connection.connect((err) => {
            if (err) {
                return reject({step: 'Database connection error', error: err});
            }

            const funCreateProfilesTable = () => {
                connection.query(CREATE_TABLE_PROFILES, (error) => {
                    if (error)
                        return reject({step: 'Database error creating profiles table', error: error});
                    connection.query(CREATE_INDEX_PROFILES_USERNAME, (e) => {
                        if (e) return reject({
                            step: 'Database error creating profiles table username index',
                            error: e
                        });
                        connection.query(CREATE_INDEX_PROFILES_PUBLIC_KEY, (e) => {
                            if (e) return reject({
                                step: 'Database error creating profiles table public key index',
                                error: e
                            });
                            connection.query(CREATE_INDEX_PROFILES_RECOVERY_PUBLIC_KEY, (e) => {
                                if (e) return reject({
                                    step: 'Database error creating profiles table recovery public key index',
                                    error: e
                                });
                                resolve(connection);
                            });
                        });
                    });
                });
            }

            // Checking if profiles and posts tables exist, creating if necessary
            connection.query(get_CHECK_TABLE_PROFILES_EXISTS(dbName), (error, results1) => {
                if (error)
                    return reject({step: 'Database error checking profiles table', error: error});
                connection.query(get_CHECK_TABLE_POSTS_EXISTS(dbName), (error, results2) => {
                    if (error)
                        return reject({step: 'Database error checking posts table', error: error});

                    if (results2[0]['count'] === 0) {
                        connection.query(CREATE_TABLE_POSTS, (error) => {
                            if (error)
                                return reject({step: 'Database error creating posts table', error: error});
                            if (results1[0]['count'] === 0) {
                                funCreateProfilesTable();
                            } else {
                                resolve(connection);
                            }
                        });
                    } else {
                        if (results1[0]['count'] === 0) {
                            funCreateProfilesTable();
                        } else {
                            resolve(connection);
                        }
                    }
                });
            });
        });
        connection.on('error', (err) => {
            console.log('Database error: ' + err.code + ' ' + err.message);
            if (err.code === 'PROTOCOL_CONNECTION_LOST') {
                dbConnection = undefined;
            }
        });
    });
}

export const closeDbConnection = () => {
    if (dbConnection) {
        dbConnection.end((err) => {
            if (err)
                console.log("Error shutting down the database connection: " + err.code + " " + err.message);
        });
    }
}

const getDbConfig = () => {
    dbName = serverConfig.db_config.database;
    return serverConfig.db_config;
}
