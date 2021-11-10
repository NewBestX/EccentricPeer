export const PROFILES_DB_NAME = 'profiles';
export const USERNAME_DB_INDEX = 'username';
export const PUBLIC_KEY_DB_INDEX = 'publicKey';
export const RECOVERY_PUBLIC_KEY_DB_INDEX = 'recoveryPublicKey';
export const POSTS_DB_NAME = 'posts';

export let db: IDBDatabase;


// Initializes the local database
// Returns: 0, if successful; 1, if the browser does not support indexedDB; 2, if the user denied usage of indexedDB
export const storageInit = (): Promise<number> => {
  return new Promise<number>((resolve, reject) => {
    if (!window.indexedDB) {
      reject(1);
    }

    const request = indexedDB.open('eccentricpeerdb', 1);
    request.onerror = (event) => {
      reject(2);
    };
    request.onsuccess = (event) => {
      db = request.result;
      db.onerror = (ev) => {
        // Generic error handler for all errors targeted at this database's requests
        console.error('Database error: ' + JSON.stringify(ev));
      };

      resolve(0);
    };

    request.onupgradeneeded = (event) => {
      const tempDB = request.result;

      const profilesObjectStore = tempDB.createObjectStore(PROFILES_DB_NAME, {keyPath: 'userId'});
      profilesObjectStore.createIndex(USERNAME_DB_INDEX, 'username', {unique: true});
      profilesObjectStore.createIndex(PUBLIC_KEY_DB_INDEX, 'publicKey', {unique: true});
      profilesObjectStore.createIndex(RECOVERY_PUBLIC_KEY_DB_INDEX, 'recoveryPublicKey', {unique: true});

      const postsObjectStore = tempDB.createObjectStore(POSTS_DB_NAME, {keyPath: ['userId', 'id']});
    };
  });
};

// Starts a new database transaction and returns the object store
export const getObjectStore = (dbName: string, readWrite?: boolean): IDBObjectStore => {
  const trans = readWrite ? db.transaction(dbName, 'readwrite') : db.transaction(dbName, 'readonly');
  trans.onerror = (event) => console.log('Database transaction error' + (event ? ': ' + JSON.stringify(event.target) : ''));
  return trans.objectStore(dbName);
};
