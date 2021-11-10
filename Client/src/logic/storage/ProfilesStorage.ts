import {UserProfile} from '../model/ProfileContent';
import {getObjectStore, PROFILES_DB_NAME, PUBLIC_KEY_DB_INDEX, RECOVERY_PUBLIC_KEY_DB_INDEX, USERNAME_DB_INDEX} from './Storage';

export const ProfilesStorage = {
  findById: (userId: string): Promise<UserProfile> => {
    return new Promise((resolve, reject) => {
      const request = getObjectStore(PROFILES_DB_NAME).get(userId);
      request.onsuccess = () => resolve(request.result);
      request.onerror = (ev) => reject(ev);
    });
  },
  findByUsername: (username: string): Promise<UserProfile> => {
    return new Promise((resolve, reject) => {
      const request = getObjectStore(PROFILES_DB_NAME).index(USERNAME_DB_INDEX).get(username);
      request.onsuccess = () => resolve(request.result);
      request.onerror = (ev) => reject(ev);
    });
  },
  findByPublicKey: (key: string): Promise<UserProfile> => {
    return new Promise((resolve, reject) => {
      const request = getObjectStore(PROFILES_DB_NAME).index(PUBLIC_KEY_DB_INDEX).get(key);
      request.onsuccess = () => resolve(request.result);
      request.onerror = (ev) => reject(ev);
    });
  },
  findByRecoveryPublicKey: (key: string): Promise<UserProfile> => {
    return new Promise((resolve, reject) => {
      const request = getObjectStore(PROFILES_DB_NAME).index(RECOVERY_PUBLIC_KEY_DB_INDEX).get(key);
      request.onsuccess = () => resolve(request.result);
      request.onerror = (ev) => reject(ev);
    });
  },
  add: (profile: UserProfile): Promise<void> => {
    return new Promise((resolve, reject) => {
      const request = getObjectStore(PROFILES_DB_NAME, true).add(profile);
      request.onsuccess = () => resolve();
      request.onerror = () => reject();
    });
  },
  update: (profile: UserProfile): Promise<void> => {
    return new Promise((resolve, reject) => {
      const request = getObjectStore(PROFILES_DB_NAME, true).put(profile);
      request.onsuccess = () => resolve();
      request.onerror = () => reject();
    });
  },
  remove: (userId: string): Promise<void> => {
    return new Promise((resolve, reject) => {
      const request = getObjectStore(PROFILES_DB_NAME, true).delete(userId);
      request.onsuccess = () => resolve();
      request.onerror = () => reject();
    });
  },
  getAll: (): Promise<Array<UserProfile>> => { // TODO probably should be removed
    return new Promise((resolve, reject) => {
      const request = getObjectStore(PROFILES_DB_NAME).getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = (ev) => reject(ev);
    });
  },
  getAllUserIds: (): Promise<Array<IDBValidKey>> => {
    return new Promise((resolve, reject) => {
      const request = getObjectStore(PROFILES_DB_NAME).getAllKeys();
      request.onsuccess = () => resolve(request.result);
      request.onerror = (ev) => reject(ev);
    });
  },
};
