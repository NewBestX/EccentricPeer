import {UserProfile} from '../model/ProfileContent';

export const getBasicProfileFields = (profile: UserProfile): UserProfile => {
  return {
    userId: profile.userId,
    username: profile.username,
    publicKey: profile.publicKey,
    recoveryPublicKey: profile.recoveryPublicKey,
    postCount: profile.postCount,
    postCountSignature: profile.postCountSignature,
    sharePermission: profile.sharePermission,
    deleted: profile.deleted
  };
};
