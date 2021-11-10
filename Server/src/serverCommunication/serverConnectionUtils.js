import {ServerDispatcher} from "./ServerDispatcher.js";
import {ServerLocalController} from "../ServerLocalController.js";

// Checks for profile updates on all connected servers, and, if any, merges them with the local profile
// Input: profile - must contain userId, postCount and all version locks
// Returns: the complete updated profile
export const lookForProfileUpdates = (profile) => {
    return new Promise((resolve) => {
        if (profile.deleted)
            return resolve(profile);
        ServerDispatcher.sendUserInfoReq(profile.userId, profile.postCount,
            profile.details.versionLock.version, profile.profilePicture.versionLock.version,
            profile.friends.versionLock.version, profile.blocked.versionLock.version).then((result) => {
            if (Object.keys(result).length === 0) {
                // Given profile (from local storage) is up-to-date
                resolve(profile);
            } else {
                const completeProfile = ServerLocalController.mergeProfileUpdates(profile, result);
                resolve(completeProfile);
            }
        });
    });
}
