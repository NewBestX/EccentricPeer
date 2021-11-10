import {ProfilesDbRepository} from "./storage/ProfilesDbRepository.js";
import {Logger} from "./main.js";
import {PostsDbRepository} from "./storage/PostsDbRepository.js";
import {PostType} from "./serverManager.js";

export const ServerLocalController = {
    // Search for an account in the local database
    // Input parameters have priority in search from left to right and may be undefined to skip
    // Returns the first result found matching an input in priority order, or undefined if nothing was found
    userSearch: (userId, username, publicKey, recoveryPublicKey) => {
        return new Promise((resolve) => {
            if (userId) {
                ProfilesDbRepository.findById(userId).then((result) => {
                    if (result) resolve(result);
                    else if (username || publicKey || recoveryPublicKey) {
                        ServerLocalController.userSearch(undefined, username, publicKey, recoveryPublicKey).then((result2) => {
                            resolve(result2);
                        });
                    } else {
                        resolve(undefined);
                    }
                });
            } else if (username) {
                ProfilesDbRepository.findByUsername(username).then((result) => {
                    if (result) resolve(result);
                    else if (publicKey || recoveryPublicKey) {
                        ServerLocalController.userSearch(undefined, undefined, publicKey, recoveryPublicKey).then((result2) => {
                            resolve(result2);
                        });
                    } else {
                        resolve(undefined);
                    }
                });
            } else if (publicKey) {
                ProfilesDbRepository.findByPublicKey(publicKey).then((result) => {
                    if (result) resolve(result);
                    else if (recoveryPublicKey) {
                        ProfilesDbRepository.findByRecoveryPublicKey(recoveryPublicKey).then((result2) => {
                            resolve(result2);
                        });
                    } else {
                        resolve(undefined);
                    }
                });
            } else if (recoveryPublicKey) {
                ProfilesDbRepository.findByRecoveryPublicKey(recoveryPublicKey).then((result) => {
                    return resolve(result);
                });
            } else
                resolve(undefined);
        });
    },
    // Saves a new user profile
    // Optional: posts - will save them as belonging to this user (must be pre-validated)
    addNewUser: (profile, posts) => {
        if (profile.deleted) {
            // received a new user that is already deleted
            const p = stripDeletedProfileOptionalFields(profile);
            ProfilesDbRepository.add(p).catch((err) => {
                Logger.log('Failed to save deleted user profile, username ' + profile.username + ': ' + JSON.stringify(err), Logger.MessageLevel.ERROR);
            });
            return;
        }
        ProfilesDbRepository.add(profile).catch((err) => {
            Logger.log('Failed to save user profile for new user, username ' + profile.username + ': ' + JSON.stringify(err), Logger.MessageLevel.ERROR);
        });

        if (!!posts && posts.length > 0) {
            PostsDbRepository.add(profile.userId, posts).catch((err) => {
                Logger.log('Failed to save posts for new user, username ' + profile.username + ': ' + JSON.stringify(err), Logger.MessageLevel.ERROR);
            });
        }
    },
    // Updates a profile and saves new posts, also addresses any deleted posts
    processNewPosts: (updatedProfile, posts) => {
        const markDeletedPost = (id) => {
            PostsDbRepository.find(updatedProfile.userId, id, id).then((posts) => {
                if (posts.length !== 1 || posts[0].postType !== PostType.CONTENT)
                    return;
                PostsDbRepository.update(updatedProfile.userId, {id: id, deleted: true}).catch((err) => {
                    // Note: should not throw error if the post is not found in the db.
                    Logger.log('Failed to update deleted post: ' + JSON.stringify(err), Logger.MessageLevel.ERROR);
                });
            });
        }
        ProfilesDbRepository.findById(updatedProfile.userId).then((old) => {
            ServerLocalController.mergeProfileUpdates(old, updatedProfile);
        });
        PostsDbRepository.add(updatedProfile.userId, posts).then(() => {
            posts.forEach(p => {
                if (p.postType === PostType.POST_DELETION)
                    markDeletedPost(p.content.deletedPostId);
            });
        });
    },
    // Merges the updated fields of a profile with the old version from local DB
    // oldProfile must exist in the database
    // updatedProfileFields must contain profile identification info, and only the updated optional fields
    mergeProfileUpdates: (oldProfile, updatedProfileFields) => {
        if (updatedProfileFields.deleted) {
            ServerLocalController.deleteAccount(updatedProfileFields);
            return updatedProfileFields; // This should be a profile with only basic fields
        }

        // updatedProfileFields must contain identification info, so we will add the unmodified fields from oldProfile
        if (!updatedProfileFields.details)
            updatedProfileFields.details = oldProfile.details;

        if (!updatedProfileFields.profilePicture)
            updatedProfileFields.profilePicture = oldProfile.profilePicture;

        if (!updatedProfileFields.friends)
            updatedProfileFields.friends = oldProfile.friends;

        if (!updatedProfileFields.blocked)
            updatedProfileFields.blocked = oldProfile.blocked;

        ProfilesDbRepository.update(updatedProfileFields).catch((err) => {
            Logger.log('Failed to merge profile updates for account: username ' + updatedProfileFields.username + ': ' + JSON.stringify(err), Logger.MessageLevel.ERROR);
        });
        return updatedProfileFields;
    },
    deleteAccount: (profile) => {
        if (!profile.deleted) {
            Logger.log('Tried to delete profile without deleted flag!', Logger.MessageLevel.WARNING);
            return;
        }
        // Only keep required minimal profile fields
        const newProfile = stripDeletedProfileOptionalFields(profile);
        ProfilesDbRepository.update(newProfile).catch((err) => {
            Logger.log('Failed to update profile for account deleted, username ' + profile.username + ': ' + JSON.stringify(err), Logger.MessageLevel.ERROR);
        });
        PostsDbRepository.removeAll(profile.id).catch((err) => {
            Logger.log('Failed to delete all posts, username ' + profile.username + ': ' + JSON.stringify(err), Logger.MessageLevel.ERROR);
        });
    },
    getPosts: (userId, beginIndex, endIndex) => {
        return PostsDbRepository.find(userId, beginIndex, endIndex);
    },
    getFriendIds: (userId) => {
        return new Promise((resolve) => {
            ProfilesDbRepository.findById(userId).then((result) => {
                if (!result)
                    return resolve(undefined);
                return resolve(result.friends.elements.map(x => x.id));
            });
        });
    }
}

const stripDeletedProfileOptionalFields = (profile) => {
    const ret = stripToBasicProfile(profile);
    ret.sharePermission = 0;
    ret.deleted = true;
    return ret;
}

export const stripToBasicProfile = (profile) => {
    return {
        userId: profile.userId,
        username: profile.username,
        publicKey: profile.publicKey,
        recoveryPublicKey: profile.recoveryPublicKey,
        postCount: profile.postCount,
        postCountSignature: profile.postCountSignature,
        sharePermission: profile.sharePermission,
        deleted: profile.deleted
    }
}
