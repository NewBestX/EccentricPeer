import cryptico from 'cryptico-js/dist/cryptico.browser.js';
import {stripToBasicProfile} from "../ServerLocalController.js";

// Input: payload: string; signature: string, publicKey: string
// Returns: boolean (true if valid, false otherwise)
export const checkSignature = (payload, signature, publicKey) => {
    const publicKeyObj = cryptico.publicKeyFromString(publicKey);
    const signatureB16 = cryptico.b64to16(signature);
    return publicKeyObj.verifyString(payload, signatureB16);
}

// Verifies if the given UserProfile has valid digital signatures
export const checkProfileSignatures = (profile) => {
    const publicKey = profile.publicKey;
    const basicProfile = stripToBasicProfile(profile);
    const postSignature = basicProfile.postCountSignature;
    basicProfile.postCountSignature = '';
    const basicProfileString = JSON.stringify(basicProfile);
    basicProfile.postCountSignature = postSignature;

    return checkSignature(basicProfileString, postSignature, publicKey)
        && (!profile.details || checkVersionLockSignature(profile.details, publicKey))
        && (!profile.profilePicture || checkVersionLockSignature(profile.profilePicture, publicKey))
        && (!profile.friends || checkVersionLockSignature(profile.friends, publicKey))
        && (!profile.blocked || checkVersionLockSignature(profile.blocked, publicKey));
};

const checkVersionLockSignature = (vlc, publicKey) => {
    const signature = vlc.versionLock.signature;
    vlc.versionLock.signature = '';
    const str = JSON.stringify(vlc);
    vlc.versionLock.signature = signature;
    return checkSignature(str, signature, publicKey);
};
