export const removeUpToDateFields = (request, updatedProfile) => {
    if (request.detailsVersion === updatedProfile.details.versionLock.version)
        delete updatedProfile.details;

    if (request.profilePictureVersion === updatedProfile.profilePicture.versionLock.version)
        delete updatedProfile.profilePicture;

    if (request.friendListVersion === updatedProfile.friends.versionLock.version)
        delete updatedProfile.friends;

    if (request.blockedListVersion === updatedProfile.blocked.versionLock.version)
        delete updatedProfile.blocked;

    return updatedProfile;
}

export const validRequest = (req, expectedType) => {
    const bol = req.type !== expectedType;
    return !(!req || !req.id || bol);
}
