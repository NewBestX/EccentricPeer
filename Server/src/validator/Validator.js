import {PostType} from "../serverManager.js";
import {checkProfileSignatures, checkSignature} from "./signatureValidator.js";
import {Logger} from "../main.js";

const USERNAME_REGEX = /^(?!.*\.\.)(?!.*\.$)[^\W][\w.]{3,29}$/;

export const Validator = {
    // Checks if a new UserProfile is valid: contains all the necessary fields, in a valid format (eg. no empty username)
    // Note: new profile is different from arbitrary profile (all fields should be empty...)
    validateNewUserProfile: (profile) => {
        return Validator.validateUserProfile(profile)
            && profile.postCount === 1 && profile.sharePermission === 0
            && profile.details
            && profile.profilePicture && profile.profilePicture.picture === undefined
            && profile.friends && profile.friends.elements.length === 0
            && profile.blocked && profile.blocked.elements.length === 0;
    },
    validateUserProfile: (profile) => {
        if (!profile || !profile.userId || !profile.username || !profile.publicKey || !profile.recoveryPublicKey || !profile.postCount
            || !profile.postCountSignature || profile.sharePermission === undefined) {
            return false;
        }
        if (!USERNAME_REGEX.test(profile.username)) {
            return false;
        }
        if (profile.details && (!profile.details.registrationTimestamp || !completeVersionLock(profile.details))) {
            return false;
        }
        if (profile.profilePicture && !completeVersionLock(profile.profilePicture)) {
            return false;
        }
        if (profile.friends && (!Array.isArray(profile.friends.elements)
            || !completeVersionLock(profile.friends) || !checkListElements(profile.friends.elements, profile.userId, profile.username))) {
            return false;
        }
        if (profile.blocked && (!Array.isArray(profile.blocked.elements)
            || !completeVersionLock(profile.blocked) || !checkListElements(profile.blocked.elements, profile.userId, profile.username))) {
            return false;
        }
        return checkProfileSignatures(profile);
    },
    /*
        Validates an array of **successive** posts (sorted ASC by id), performing signature checks with the given keys.
        lastPublicKey must be the one used to sign the last post in the array (previous posts may contain key changes)
        firstPublicKey - the key the user had when the first post in the array was made (will check for continuity)
                       - should ONLY be skipped if the first post has index 1
        Deleted posts: If the array contains any post marked as deleted, it must also contain the post that deleted it!
    */
    validatePostsArray: (posts, recoveryPublicKey, lastPublicKey, firstPublicKey) => {
        const beginIndex = posts[0].id;
        const endIndex = posts[posts.length - 1].id;

        if (!beginIndex || !endIndex || posts.length !== endIndex - beginIndex + 1)
            return false;

        const allowedDeleted = [];
        let currentPk = lastPublicKey;
        let i;
        for (i = posts.length - 1; i >= 0; i--) {
            if (posts[i].deleted === true && Object.keys(posts[i]).length === 2 && posts[i].id === beginIndex + i) {
                const index = allowedDeleted.indexOf(posts[i].id);
                if (index === -1)
                    return false;
                allowedDeleted.splice(index, 1);
                continue;
            }

            if (!Validator.validateSinglePost(posts[i], currentPk, recoveryPublicKey) || posts[i].id !== beginIndex + i)
                return false;

            if (posts[i].postType === PostType.KEY_CHANGE)
                currentPk = posts[i].content.oldPublicKey;
            else if (posts[i].postType === PostType.POST_DELETION)
                allowedDeleted.push(posts[i].content.deletedPostId);
        }
        // If the key was changed in the sequence, we should have reached first public key
        return (beginIndex !== 1) ? currentPk === firstPublicKey : true;
    },
    // DOES NOT validate deleted posts!
    validateSinglePost: (post, publicKey, recoveryPublicKey) => {
        if (!post || !post.id)
            return false;

        if (!post.signature || post.postType === undefined)
            return false;

        if (!post.content && (post.postType === PostType.CONTENT || post.postType === PostType.POST_DELETION || post.postType === PostType.KEY_CHANGE))
            return false;

        const sig = post.signature;
        post.signature = '';

        let key = publicKey;
        if (post.postType === PostType.KEY_CHANGE || post.postType === PostType.ACCOUNT_DELETION)
            key = recoveryPublicKey;

        const postStr = JSON.stringify(post);
        post.signature = sig;

        if (postStr.length > 1000000) {
            Logger.log('Post failed validation because of size check.', Logger.MessageLevel.WARNING);
            return false;
        }

        if (post.postType === PostType.CONTENT && (!post.content.timestamp || !post.content.text))
            return false;

        if (post.postType === PostType.POST_DELETION && !post.content.deletedPostId)
            return false;

        if (post.postType === PostType.KEY_CHANGE && !post.content.oldPublicKey)
            return false;

        return checkSignature(postStr, sig, key);
    },
}

const completeVersionLock = (vlc) => {
    return !(!vlc.versionLock || !vlc.versionLock.version || !vlc.versionLock.signature);
};

const checkListElements = (elements, ownerId, ownerUsername) => {
    for (const e of elements) {
        if (!e.id || !e.username || e.id === ownerId || e.username === ownerUsername) {
            return false;
        }
    }
    return true;
};
