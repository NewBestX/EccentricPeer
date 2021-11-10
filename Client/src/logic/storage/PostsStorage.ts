import {getObjectStore, POSTS_DB_NAME} from './Storage';
import {Post} from '../model/Post';

export const PostsStorage = {
  findOne: (userId: string, id: number): Promise<Post> => {
    return new Promise((resolve, reject) => {
      const request = getObjectStore(POSTS_DB_NAME).get([userId, id]);
      request.onsuccess = () => {
        if (request.result) {
          delete request.result.userId;
        }
        resolve(request.result);
      };
      request.onerror = (ev) => reject(ev);
    });
  },
  findForUser: (userId: string): Promise<Array<Post>> => {
    return new Promise((resolve, reject) => {
      const request = getObjectStore(POSTS_DB_NAME).getAll(IDBKeyRange.bound([userId, 0], [userId, Infinity], false, true));
      request.onsuccess = () => {
        request.result.forEach(x => delete x.userId);
        resolve(request.result);
      };
      request.onerror = (ev) => reject(ev);
    });
  },
  findInRange: (userId: string, lower: number, upper: number): Promise<Array<Post>> => {
    return new Promise((resolve, reject) => {
      const request = getObjectStore(POSTS_DB_NAME).getAll(IDBKeyRange.bound([userId, lower], [userId, upper], false, false));
      request.onsuccess = () => {
        request.result.forEach(x => delete x.userId);
        resolve(request.result);
      };
      request.onerror = (ev) => reject(ev);
    });
  },
  addOne: (userId: string, post: Post): Promise<void> => {
    return new Promise((resolve, reject) => {
      const request = getObjectStore(POSTS_DB_NAME, true).add({userId, ...post});
      request.onsuccess = () => resolve();
      request.onerror = () => reject();
    });
  },
  addAll: (userId: string, posts: Array<Post>): Promise<void> => {
    return new Promise((resolve, reject) => {
      const objStore = getObjectStore(POSTS_DB_NAME, true);
      posts.forEach(x => objStore.add({userId, ...x}));
      objStore.transaction.oncomplete = () => resolve();
      objStore.transaction.onerror = () => reject();
    });
  },
  update: (userId: string, post: Post): Promise<void> => {
    return new Promise((resolve, reject) => {
      const request = getObjectStore(POSTS_DB_NAME, true).put({userId, ...post});
      request.onsuccess = () => resolve();
      request.onerror = () => reject();
    });
  },
  removeOne: (userId: string, id: number): Promise<void> => {
    return new Promise((resolve, reject) => {
      const request = getObjectStore(POSTS_DB_NAME, true).delete([userId, id]);
      request.onsuccess = () => resolve();
      request.onerror = () => reject();
    });
  },
  removeAll: (userId: string): Promise<void> => {
    return new Promise((resolve, reject) => {
      const objStore = getObjectStore(POSTS_DB_NAME, true).delete(IDBKeyRange.bound([userId, 0], [userId, Infinity], false, true));
      objStore.transaction.oncomplete = () => resolve();
      objStore.transaction.onerror = () => reject();
    });
  },
};
