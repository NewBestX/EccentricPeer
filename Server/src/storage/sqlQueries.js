// Only fields used to index/search objects have their reserved column, the rest of the object is stored as JSON string

// Statements necessary for creating the profiles table and setting up the needed indexes
export const CREATE_TABLE_PROFILES = 'CREATE TABLE profiles (userId VARCHAR(64) PRIMARY KEY, username VARCHAR(64), publicKey VARCHAR(128), recoveryPublicKey VARCHAR(128), object MEDIUMTEXT)';
export const CREATE_INDEX_PROFILES_USERNAME = 'CREATE UNIQUE INDEX index_username ON profiles (username);'
export const CREATE_INDEX_PROFILES_PUBLIC_KEY = 'CREATE UNIQUE INDEX index_publicKey ON profiles (publicKey);'
export const CREATE_INDEX_PROFILES_RECOVERY_PUBLIC_KEY = 'CREATE UNIQUE INDEX index_recoveryPublicKey ON profiles (recoveryPublicKey);'

export const CREATE_TABLE_POSTS = 'CREATE TABLE posts (userId VARCHAR(64), id INT, object MEDIUMTEXT, CONSTRAINT pk_posts PRIMARY KEY (userId, id))';

export const get_CHECK_TABLE_PROFILES_EXISTS = (dbName) => "SELECT count(*) AS count FROM information_schema.TABLES WHERE (TABLE_SCHEMA = '" + dbName + "') AND (TABLE_NAME = 'profiles')";
export const get_CHECK_TABLE_POSTS_EXISTS = (dbName) => "SELECT count(*) AS count FROM information_schema.TABLES WHERE (TABLE_SCHEMA = '" + dbName + "') AND (TABLE_NAME = 'posts')";

// Queries used in profiles table

export const FIND_PROFILE_BY_ID = 'SELECT * FROM profiles WHERE userId = ?';
export const FIND_PROFILE_BY_USERNAME = 'SELECT * FROM profiles WHERE username = ?';
export const FIND_PROFILE_BY_PUBLIC_KEY = 'SELECT * FROM profiles WHERE publicKey = ?';
export const FIND_PROFILE_BY_RECOVERY_PUBLIC_KEY = 'SELECT * FROM profiles WHERE recoveryPublicKey = ?';
// Params: userId, username, publicKey, recoveryPublicKey, object
export const INSERT_PROFILE = 'INSERT INTO profiles(userId, username, publicKey, recoveryPublicKey, object) VALUES (?, ?, ?, ?, ?)'
// Params: username, publicKey, recoveryPublicKey, object, userId*
export const UPDATE_PROFILE = 'UPDATE profiles SET username = ?, publicKey = ?, recoveryPublicKey = ?, object = ? WHERE userId = ?';
// Params: userId
export const DELETE_PROFILE = 'DELETE FROM profiles WHERE userId = ?';

// Queries used in posts table

// Params: userId, lowerIdBound, upperIdBound
export const FIND_POSTS = 'SELECT * FROM posts WHERE userId = ? AND id >= ? AND id <= ?';
// Params: list of [userId, id, object]
export const INSERT_POSTS = 'INSERT INTO posts(userId, id, object) VALUES ?';
// Params: object, userId*, id*
export const UPDATE_POST = 'UPDATE posts SET object = ? WHERE userId = ? AND id = ?';
// Delete all posts for userId. Params: userId
export const DELETE_POSTS = 'DELETE FROM posts WHERE userId = ?';
