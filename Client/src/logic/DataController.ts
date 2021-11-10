import {UserProfile} from './model/ProfileContent';
import {Post, PostType} from './model/Post';
import {ProfilesStorage} from './storage/ProfilesStorage';
import {PostsStorage} from './storage/PostsStorage';
import {ServerDispatcher} from './connection/communication/ServerDispatcher';
import {generateKeyFromPassword, generateKeyFromSeed, generateRandomRecoveryKey, KeyWrapper, signString} from './encryption/Encryption';
import {ConnectionManager} from './connection/ConnectionManager';
import {ContentFactory} from './contentFactory/ContentFactory';
import {storageInit} from './storage/Storage';
import {Validator} from './validator/Validator';
import {getBasicProfileFields} from './contentFactory/Utils';

let myProfile: UserProfile;  // Only set after successful auth
let myPosts: Post[] = [];    // Only set after successful auth
let myPrivateKey: KeyWrapper;
let myUsername: string;

export const DataController = {
  init: () => {
    storageInit().then((result) => {
      if (result === 0) {
        console.log('Storage successfully initiated.');
      }
    });
  },
  authenticate: (username: string, password: string): Promise<void> => {
    myUsername = username;
    myPrivateKey = generateKeyFromPassword(username, password);
    return serverAutoReconnect();
  },
  // Returns the seed of the recovery key as string
  register: (username: string, password: string): Promise<string> => {
    return new Promise((resolve, reject) => {
      if (!Validator.validateUsername(username)) {
        return reject();
      }
      myUsername = username;
      myPrivateKey = generateKeyFromPassword(username, password);

      const rpk = generateRandomRecoveryKey();
      const myRecoveryPrivateKey = rpk.key;

      const newProfile = ContentFactory.createNewProfile(myPrivateKey, myUsername, myPrivateKey.publicKey, myRecoveryPrivateKey.publicKey);
      const firstPost = ContentFactory.createPost(myPrivateKey, 1, PostType.PROFILE_UPDATE, undefined);

      ConnectionManager.getServerAuthKey(serverAutoReconnect).then((authKey) => {
        const pkSig = signString(authKey, myPrivateKey.keyObj);
        const rpkSig = signString(authKey, myRecoveryPrivateKey.keyObj);

        return ServerDispatcher.sendRegisterRequest(newProfile, firstPost, pkSig, rpkSig);
      }).then(() => {
        myProfile = newProfile;
        myPosts = [firstPost];
        return ProfilesStorage.add(myProfile);
      }).then(() => {
        return PostsStorage.addOne(myProfile.userId, firstPost);
      }).then(() => {
        resolve(rpk.seed); // Registration succeeded, returning the seed of the recovery key
      }).catch(() => {
        console.log('Registration failed');
        myUsername = undefined;
        reject();
      });
    });
  },
  changePassword: (username, newPassword, recoveryKeySeed): Promise<void> => {
    return new Promise((resolve, reject) => {
      myUsername = username;
      myPrivateKey = generateKeyFromPassword(username, newPassword);
      const myRecoveryPrivateKey = generateKeyFromSeed(recoveryKeySeed);

      ConnectionManager.getServerAuthKey(serverAutoReconnect).then((authKey) => {
        const pkSig = signString(authKey, myPrivateKey.keyObj);
        const rpkSig = signString(authKey, myRecoveryPrivateKey.keyObj);

        return ServerDispatcher.sendAuthRequest(username, myPrivateKey.publicKey, pkSig, myRecoveryPrivateKey.publicKey, rpkSig);
      }).then((profile) => {
        return loadProfileAfterAuth(profile);
      }).then(() => {
        const clone = ContentFactory.cloneProfile(myProfile);
        clone.publicKey = myPrivateKey.publicKey;
        const newProfile = ContentFactory.incrementProfilePostCount(myPrivateKey, clone);
        const post = ContentFactory.createPost(myRecoveryPrivateKey, newProfile.postCount, PostType.KEY_CHANGE,
          {oldPublicKey: myProfile.publicKey});
        return dispatchNewPost(newProfile, post);
      }).then(() => {
        resolve();
      }).catch(() => {
        console.log('Change password failed');
        myUsername = undefined;
        reject();
      });
    });
  },
  createNewContentPost: (text: string, location: string = undefined): Promise<void> => {
    if (text.length < 1) {
      return Promise.reject();
    }
    const newProfile = ContentFactory.incrementProfilePostCount(myPrivateKey, myProfile);
    const post = ContentFactory.createContentPost(myPrivateKey, newProfile.postCount, text, Date.now(), location);

    return dispatchNewPost(newProfile, post);
  },
  updateMyProfileDetails: (newDesc: string, newBDay: number, newBMonth: number, newBYear: number, newLocation: string, newPicture: any)
    : Promise<void> => {
    const clone = ContentFactory.cloneProfile(myProfile);
    clone.details.description = newDesc;
    clone.details.birthday = {
      day: newBDay,
      month: newBMonth,
      year: newBYear
    };
    clone.details.location = newLocation;
    clone.profilePicture.picture = newPicture;
    return dispatchProfileUpdate(clone);
  },
  searchProfileAndPosts: (username: string) => {
    return new Promise<{ profile: UserProfile, posts: Post[] }>((resolve, reject) => {
      ProfilesStorage.findByUsername(username).then((result) => {
        if (!result) {
          ServerDispatcher.sendUserSearchReq(undefined, username, undefined).then((result2: UserProfile) => {
            if (!result2) {
              return reject();
            }
            if (result2.deleted) {
              DataController.removeFriend(result2.userId).catch(() => {
              });
              DataController.removeBlockedUser(result2.userId).catch(() => {
              });
              return reject();
            }
            ProfilesStorage.add(result2).catch((err) => logStorageError(err));
            ServerDispatcher.sendPostsReq(result2, 1, result2.postCount).then((posts: Post[]) => {
              PostsStorage.addAll(result2.userId, posts).catch((err) => logStorageError(err));
              resolve({profile: result2, posts});
            });
          });
        } else {
          if (result.deleted) {
            DataController.removeFriend(result.userId).catch(() => {
            });
            DataController.removeBlockedUser(result.userId).catch(() => {
            });
            return reject();
          }
          ConnectionManager.searchProfileUpdates(result).then((updates: UserProfile) => {
            if (Object.keys(updates).length === 0) {
              PostsStorage.findForUser(result.userId).then((posts) => {
                if (posts.length === result.postCount) {
                  resolve({profile: result, posts});
                } else {
                  ConnectionManager.searchPosts(result, 1, result.publicKey).then((postsSearch: Post[]) => {
                    PostsStorage.removeAll(result.userId).then(() => {
                      PostsStorage.addAll(result.userId, postsSearch).catch((err) => logStorageError(err));
                      resolve({profile: result, posts: postsSearch});
                    });
                  });
                }
              }).catch((err) => logStorageError(err));
            } else {
              if (updates.deleted) {
                ProfilesStorage.update(updates).catch((err) => logStorageError(err));
                PostsStorage.removeAll(result.userId).catch((err) => logStorageError(err));
                DataController.removeFriend(updates.userId).catch(() => {
                });
                DataController.removeBlockedUser(updates.userId).catch(() => {
                });
                return reject();
              }
              const completeProfile = mergeProfileUpdates(result, updates);
              PostsStorage.findForUser(completeProfile.userId).then((localPosts) => {
                if (localPosts.length === result.postCount) {
                  // All the old posts are in storage
                  ConnectionManager.searchPosts(completeProfile, result.postCount + 1, result.publicKey).then((postsSearch: Post[]) => {
                    addNewPostsToDb(completeProfile.userId, postsSearch).catch((err) => logStorageError(err));
                    resolve({profile: completeProfile, posts: localPosts.concat(postsSearch)});
                  });
                } else {
                  // Some of the old posts are missing from local storage, replacing them
                  ConnectionManager.searchPosts(completeProfile, 1, result.publicKey).then((postsSearch: Post[]) => {
                    PostsStorage.removeAll(completeProfile.userId).then(() => {
                      PostsStorage.addAll(completeProfile.userId, postsSearch).catch((err) => logStorageError(err));
                      resolve({profile: completeProfile, posts: postsSearch});
                    });
                  });
                }
              });
            }
          });
        }
      });
    });
  },
  addFriend: (id: string, username: string): Promise<void> => {
    if (!canBeFriendOrBlocked(id)) {
      return Promise.reject();
    }
    const clone = ContentFactory.cloneProfile(myProfile);
    clone.friends.elements.push({id, username});
    return dispatchProfileUpdate(clone);
  },
  addBlockedUser: (id: string, username: string) => {
    if (!canBeFriendOrBlocked(id)) {
      return Promise.reject();
    }
    const clone = ContentFactory.cloneProfile(myProfile);
    clone.blocked.elements.push({id, username});
    return dispatchProfileUpdate(clone).then(() => {
      ConnectionManager.removePeer(id);
    });
  },
  removeFriend: (id: string): Promise<void> => {
    if (!myProfile.friends.elements.find(x => x.id === id)) {
      return Promise.reject();
    }
    const clone = ContentFactory.cloneProfile(myProfile);
    clone.friends.elements = clone.friends.elements.filter(x => x.id !== id);
    return dispatchProfileUpdate(clone);
  },
  removeBlockedUser: (id: string) => {
    if (!myProfile.blocked.elements.find(x => x.id === id)) {
      return Promise.reject();
    }
    const clone = ContentFactory.cloneProfile(myProfile);
    clone.blocked.elements = clone.blocked.elements.filter(x => x.id !== id);
    return dispatchProfileUpdate(clone);
  },
  deletePost: (postId: number) => {
    return PostsStorage.findOne(myProfile.userId, postId).then((toDelete) => {
      if (!toDelete || toDelete.deleted || toDelete.postType !== PostType.CONTENT) {
        return Promise.reject();
      }
      const clone = ContentFactory.cloneProfile(myProfile);
      const newProfile = ContentFactory.incrementProfilePostCount(myPrivateKey, clone);
      const post = ContentFactory.createPost(myPrivateKey, newProfile.postCount, PostType.POST_DELETION, {deletedPostId: postId});
      return dispatchNewPost(newProfile, post).then(() => {
        myPosts = myPosts.filter(x => x.id !== postId);
      });
    });
  },
  deleteAccount: (recoveryKey: string) => {
    const rk = generateKeyFromSeed(recoveryKey);
    if (rk.publicKey !== myProfile.recoveryPublicKey) {
      return Promise.reject();
    }
    const clone = ContentFactory.cloneProfile(myProfile);
    clone.deleted = true;
    const newProfile = getBasicProfileFields(ContentFactory.incrementProfilePostCount(myPrivateKey, clone));
    const post = ContentFactory.createPost(rk, newProfile.postCount, PostType.ACCOUNT_DELETION, undefined);
    return dispatchNewPost(newProfile, post).then(() => {
      myProfile = undefined;
      myPosts = undefined;
      myUsername = undefined;
      ConnectionManager.disconnectAll();
    });
  },
  getMyProfile: () => {
    return myProfile;
  },
  getMyPosts: () => {
    return myPosts;
  },
  getMyPrivateKey: () => {
    return myPrivateKey;
  },
  addNewProfile: (profile: UserProfile) => {
    ProfilesStorage.findById(profile.userId).then((result) => {
      if (!result) {
        ProfilesStorage.add(profile).catch((err) => logStorageError(err));
      } else {
        ProfilesStorage.update(profile).catch((err) => logStorageError(err));
      }
    });
  },
  addNewPostToDb: (profile: UserProfile, post: Post) => {
    ProfilesStorage.findById(profile.userId).then((stored) => {
      if (stored.postCount >= profile.postCount || stored.deleted) {
        return;
      }
      if (post.postType === PostType.ACCOUNT_DELETION) {
        ProfilesStorage.update(profile).catch((err) => logStorageError(err));
        PostsStorage.removeAll(profile.userId).catch((err) => logStorageError(err));
        return;
      }

      mergeProfileUpdates(stored, profile);
      addNewPostsToDb(profile.userId, [post]).catch((err) => logStorageError(err));
    });
  },
};

const addNewPostsToDb = (userId: string, posts: Post[]) => {
  for (const p of posts) {
    if (p.postType === PostType.POST_DELETION) {
      processPostDelete(userId, p.content.deletedPostId);
    }
  }
  return PostsStorage.addAll(userId, posts);
};

const processPostDelete = (userId: string, postId: number) => {
  PostsStorage.findOne(userId, postId).then((toDelete) => {
    if (!toDelete || toDelete.deleted || toDelete.postType !== PostType.CONTENT) {
      return;
    }
    PostsStorage.update(userId, {id: postId, deleted: true}).catch((err) => logStorageError(err));
  });
};

const dispatchProfileUpdate = (modifiedProfile: UserProfile): Promise<void> => {
  const newProfile = ContentFactory.incrementProfilePostCount(myPrivateKey, modifiedProfile);
  const post = ContentFactory.createPost(myPrivateKey, newProfile.postCount, PostType.PROFILE_UPDATE, undefined);
  return dispatchNewPost(newProfile, post);
};

const dispatchNewPost = (newProfile: UserProfile, post: Post): Promise<void> => {
  const toSendProfile =
    (post.postType === PostType.CONTENT || post.postType === PostType.POST_DELETION) ? getBasicProfileFields(newProfile) : newProfile;
  return ServerDispatcher.sendNewPost(toSendProfile, post).then(() => {
    // Post was accepted by the server
    ConnectionManager.broadcastNewPost(toSendProfile, post);
    myPosts.push(post);
    myProfile = newProfile;
    return DataController.addNewPostToDb(newProfile, post);
  });
};

const serverAutoReconnect = () => {
  if (!myUsername) {
    return;
  }
  return new Promise<void>((resolve, reject) => {
    ConnectionManager.getServerAuthKey(serverAutoReconnect).then((authKey) => {
      const verificationSignature = signString(authKey, myPrivateKey.keyObj);
      return ServerDispatcher.sendAuthRequest(myUsername, myPrivateKey.publicKey, verificationSignature);
    }).then((serverResponse) => {
      return loadProfileAfterAuth(serverResponse);
    }).then(() => {
      resolve(); // Authentication succeeded, profile successfully loaded in localStorage
    }).catch(() => {
      console.log('Server authentication failed');
      myUsername = undefined;
      reject();
    });
  });
};

const loadProfileAfterAuth = (serverProfile: UserProfile) => {
  return new Promise<void>((resolve, reject) => {
    myProfile = serverProfile;
    ProfilesStorage.findById(serverProfile.userId).then((localProfile) => {
      if (!localProfile) {
        ProfilesStorage.add(serverProfile).catch((err) => {
          logStorageError(err);
          reject();
        });
        ServerDispatcher.sendPostsReq(serverProfile, 1, serverProfile.postCount).then((posts: Post[]) => {
          PostsStorage.addAll(serverProfile.userId, posts).catch((err) => logStorageError(err));
          myPosts = posts;
          resolve();
        });
      } else if (localProfile.postCount !== serverProfile.postCount) {
        ProfilesStorage.update(serverProfile).catch((err) => {
          logStorageError(err);
          reject();
        });
        ServerDispatcher.sendPostsReq(serverProfile, localProfile.postCount + 1, serverProfile.postCount).then((posts: Post[]) => {
          PostsStorage.addAll(serverProfile.userId, posts).then(() => {
            return PostsStorage.findForUser(serverProfile.userId);
          }).then((posts2) => {
            myPosts = posts2;
            resolve();
          });
        });
      } else {
        PostsStorage.findForUser(serverProfile.userId).then((posts) => {
          myPosts = posts;
          resolve();
        });
      }
    });
  });
};

// Merges the updated fields of a profile with the old version from local DB and updates the database
// oldProfile must exist in the database
// updatedProfileFields must contain profile identification info, and only the updated optional fields
const mergeProfileUpdates = (oldProfile: UserProfile, updatedProfileFields): UserProfile => {
  if (updatedProfileFields.deleted) {
    ProfilesStorage.update(updatedProfileFields).catch((err) => logStorageError(err));
    PostsStorage.removeAll(updatedProfileFields.userId).catch((err) => logStorageError(err));
    return updatedProfileFields; // This should be a profile with only basic fields
  }

  // updatedProfileFields must contain identification info, so we will add the unmodified fields from oldProfile
  if (!updatedProfileFields.details) {
    updatedProfileFields.details = oldProfile.details;
  }
  if (!updatedProfileFields.profilePicture) {
    updatedProfileFields.profilePicture = oldProfile.profilePicture;
  }
  if (!updatedProfileFields.friends) {
    updatedProfileFields.friends = oldProfile.friends;
  }
  if (!updatedProfileFields.blocked) {
    updatedProfileFields.blocked = oldProfile.blocked;
  }

  ProfilesStorage.update(updatedProfileFields).catch((err) => logStorageError(err));
  return updatedProfileFields;
};

const canBeFriendOrBlocked = (userId: string): boolean => {
  return userId !== myProfile.userId && myProfile.friends.elements.find(x => x.id === userId) === undefined
    && myProfile.blocked.elements.find(x => x.id === userId) === undefined;
};

const logStorageError = (err) => {
  console.log('Storage error: ' + JSON.stringify(err));
};

