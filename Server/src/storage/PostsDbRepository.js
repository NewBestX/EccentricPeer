import {getDbConnection} from "./dbConnection.js";
import {DELETE_POSTS, FIND_POSTS, INSERT_POSTS, UPDATE_POST} from "./sqlQueries.js";

export const PostsDbRepository = {
    find: (userId, lowerIdBound, upperIdBound) => {
        return new Promise((resolve, reject) => {
            getDbConnection().then((connection) => {
                connection.query(FIND_POSTS, [userId, lowerIdBound, upperIdBound], (error, results) => {
                    if (error) return reject(error);
                    // Rebuilding the posts with all their fields, note: Post does not have a userId
                    const posts = results.map(dbPost => {
                        return {id: dbPost.id, ...JSON.parse(dbPost.object)}
                    });
                    resolve(posts);
                });
            }).catch((err) => reject(err));
        });
    },
    add: (userId, posts) => {
        return new Promise((resolve, reject) => {
            getDbConnection().then((connection) => {
                const dbPosts = posts.map(p => {
                    const {id, ...object} = p;
                    return [userId, id, JSON.stringify(object)];
                });
                connection.query(INSERT_POSTS, [dbPosts], (error) => {
                    if (error) reject(error);
                    else resolve();
                });
            }).catch((err) => reject(err));
        });
    },
    update: (userId, post) => {
        return new Promise((resolve, reject) => {
            getDbConnection().then((connection) => {
                const {id, ...object} = post;
                connection.query(UPDATE_POST, [JSON.stringify(object), userId, id], (error) => {
                    if (error) reject(error);
                    else resolve();
                });
            }).catch((err) => reject(err));
        });
    },
    removeAll: (userId) => {
        return new Promise((resolve, reject) => {
            getDbConnection().then((connection) => {
                connection.query(DELETE_POSTS, userId, (error) => {
                    if (error) reject(error);
                    else resolve();
                });
            }).catch((err) => reject(err));
        });
    }
};
