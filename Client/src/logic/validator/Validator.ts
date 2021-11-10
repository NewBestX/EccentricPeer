import {UserList, UserProfile, VersionLockedContent} from '../model/ProfileContent';
import {checkPostSignature, checkProfileSignatures} from '../encryption/Encryption';
import {PostType} from '../model/Post';

const USERNAME_REGEX = /^(?!.*\.\.)(?!.*\.$)[^\W][\w.]{3,29}$/;

export const Validator = {
  validateUserProfile: (profile: UserProfile): boolean => {
    if (!profile || !profile.userId || !profile.username || !profile.publicKey || !profile.recoveryPublicKey || !profile.postCount
      || !profile.postCountSignature || profile.sharePermission === undefined) {
      return false;
    }
    if (!Validator.validateUsername(profile.username)) {
      return false;
    }
    if (profile.details && (!profile.details.registrationTimestamp || !completeVersionLock(profile.details))) {
      return false;
    }
    if (profile.profilePicture && !completeVersionLock(profile.profilePicture)) {
      return false;
    }
    if (profile.friends && (!Array.isArray(profile.friends.elements)
      || !completeVersionLock(profile.friends) || !checkListElements(profile.friends.elements))) {
      return false;
    }
    if (profile.blocked && (!Array.isArray(profile.blocked.elements)
      || !completeVersionLock(profile.blocked) || !checkListElements(profile.blocked.elements))) {
      return false;
    }
    return checkProfileSignatures(profile);
  },
  /*
      Validates an array of **successive** posts (sorted ASC by id), performing signature checks with the given keys.
      lastPublicKey must be the one used to sign the last post-list in the array (previous posts may contain key changes)
      firstPublicKey - the key the user had when the first post-list in the array was made (will check for continuity)
                     - should ONLY be skipped if the first post-list has index 1
      Deleted posts: If the array contains any post-list marked as deleted, it must also contain the post-list that deleted it!
  */
  validatePostsArray: (posts, recoveryPublicKey, lastPublicKey, firstPublicKey): boolean => {
    const beginIndex = posts[0].id;
    const endIndex = posts[posts.length - 1].id;

    if (!beginIndex || !endIndex || posts.length !== endIndex - beginIndex + 1) {
      return false;
    }

    const allowedDeleted = [];
    let currentPk = lastPublicKey;
    let i;
    for (i = posts.length - 1; i >= 0; i--) {
      if (posts[i].deleted === true && Object.keys(posts[i]).length === 2 && posts[i].id === beginIndex + i) {
        const index = allowedDeleted.indexOf(posts[i].id);
        if (index === -1) {
          return false;
        }
        allowedDeleted.splice(index, 1);
        continue;
      }

      if (!Validator.validateSinglePost(posts[i], currentPk, recoveryPublicKey) || posts[i].id !== beginIndex + i) {
        return false;
      }

      if (posts[i].postType === PostType.KEY_CHANGE) {
        currentPk = posts[i].content.oldPublicKey;
      } else if (posts[i].postType === PostType.POST_DELETION) {
        allowedDeleted.push(posts[i].content.deletedPostId);
      }
    }
    // If the key was changed in the sequence, we should have reached first public key
    return (beginIndex !== 1) ? currentPk === firstPublicKey : true;
  },
  // DOES NOT validate deleted posts!
  validateSinglePost: (post, publicKey, recoveryPublicKey): boolean => {
    if (!post || !post.id) {
      return false;
    }
    if (!post.signature || post.postType === undefined) {
      return false;
    }
    if (!post.content
      && (post.postType === PostType.CONTENT || post.postType === PostType.POST_DELETION || post.postType === PostType.KEY_CHANGE)) {
      return false;
    }
    let key = publicKey;
    if (post.postType === PostType.KEY_CHANGE || post.postType === PostType.ACCOUNT_DELETION) {
      key = recoveryPublicKey;
    }
    if (post.postType === PostType.CONTENT && (!post.content.timestamp || !post.content.text)) {
      return false;
    }
    if (post.postType === PostType.POST_DELETION && !post.content.deletedPostId) {
      return false;
    }
    if (post.postType === PostType.KEY_CHANGE && !post.content.oldPublicKey) {
      return false;
    }
    return checkPostSignature(post, key);
  },
  validateUsername: (username: string): boolean => {
    return USERNAME_REGEX.test(username);
  }
};

const completeVersionLock = (vlc: VersionLockedContent): boolean => {
  return !(!vlc.versionLock || !vlc.versionLock.version || !vlc.versionLock.signature);
};

const checkListElements = (elements): boolean => {
  for (const e of elements) {
    if (!e.id || !e.username) {
      return false;
    }
  }
  return true;
};
