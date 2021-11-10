import * as cryptico from 'cryptico-js/dist/cryptico.browser.js';
import {Post} from '../model/Post';
import {UserProfile, VersionLockedContent} from '../model/ProfileContent';
import {getBasicProfileFields} from '../contentFactory/Utils';


export interface KeyWrapper {
  keyObj: any;
  publicKey: string;
}

// Creates a digital signature and attaches it to the given Post
export const signPost = (post: Post, myKey): void => {
  post.signature = '';
  const postString = JSON.stringify(post);
  post.signature = signString(postString, myKey);
};

// Creates a digital signature and attaches it to the given UserProfile
export const signProfile = (profile: UserProfile, myKey): void => {
  const basicProfile = getBasicProfileFields(profile);
  basicProfile.postCountSignature = '';
  const basicProfileString = JSON.stringify(basicProfile);
  const signatureB16 = myKey.signString(basicProfileString, 'sha256');
  profile.postCountSignature = cryptico.b16to64(signatureB16);

  signVersionLockedContent(profile.details, myKey);
  signVersionLockedContent(profile.profilePicture, myKey);
  signVersionLockedContent(profile.friends, myKey);
  signVersionLockedContent(profile.blocked, myKey);
};

// Creates a digital signature for an arbitrary string
export const signString = (str: string, myKey): string => {
  const signatureB16 = myKey.signString(str, 'sha256');
  return cryptico.b16to64(signatureB16);
};

const signVersionLockedContent = (vlc: VersionLockedContent, myKey) => {
  vlc.versionLock.signature = '';
  const str = JSON.stringify(vlc);
  const signatureB16 = myKey.signString(str, 'sha256');
  vlc.versionLock.signature = cryptico.b16to64(signatureB16);
};

// Verifies if the Post has been signed by the given key
export const checkPostSignature = (post: Post, publicKey: string): boolean => {
  const signature = post.signature;
  post.signature = '';
  const postString = JSON.stringify(post);
  post.signature = signature;
  return checkStringSignature(postString, signature, publicKey);
};

// Verifies if the given UserProfile has valid digital signatures
export const checkProfileSignatures = (profile: UserProfile): boolean => {
  const publicKey = profile.publicKey;
  const basicProfile = getBasicProfileFields(profile);
  const postSignature = basicProfile.postCountSignature;
  basicProfile.postCountSignature = '';
  const basicProfileString = JSON.stringify(basicProfile);
  basicProfile.postCountSignature = postSignature;

  return checkStringSignature(basicProfileString, postSignature, publicKey)
    && (!profile.details || checkVersionLockSignature(profile.details, publicKey))
    && (!profile.profilePicture || checkVersionLockSignature(profile.profilePicture, publicKey))
    && (!profile.friends || checkVersionLockSignature(profile.friends, publicKey))
    && (!profile.blocked || checkVersionLockSignature(profile.blocked, publicKey));
};

const checkVersionLockSignature = (vlc: VersionLockedContent, publicKey): boolean => {
  const signature = vlc.versionLock.signature;
  vlc.versionLock.signature = '';
  const str = JSON.stringify(vlc);
  vlc.versionLock.signature = signature;
  return checkStringSignature(str, signature, publicKey);
};

// Verifies a digital signature for an arbitrary string
export const checkStringSignature = (str: string, signature: string, publicKey: string): boolean => {
  const signatureB16 = cryptico.b64to16(signature);
  const pk = cryptico.publicKeyFromString(publicKey);
  return pk.verifyString(str, signatureB16);
};

// Encrypts the given message with the given publicKey. Used for network communication with new peers (to confirm their identity)
// Generates a string containing an AES key encrypted with the given RSA public key, and the content encrypted with the mentioned AES key
// Returns null if encryption fails
export const encryptMessage = (message: string, publicKey: string): string => {
  const encrypted = cryptico.encrypt(message, publicKey);
  return (encrypted.status === 'success') ? encrypted.cipher : null;
};

// Decrypts a message encrypted with myKey's public key. See @encryptMessage for encryptedMessage's format
// Returns null if decryption fails
export const decryptMessage = (encryptedMessage: string, myKey): string => {
  const decrypted = cryptico.decrypt(encryptedMessage, myKey);
  return (decrypted.status === 'success') ? decrypted.plaintext : null;
};

// Generates a public/private RSA key pair from the username and password
export const generateKeyFromPassword = (username: string, password: string): KeyWrapper => {
  return generateKeyFromSeed(username + password);
};

// Generates a random string using a cryptographically safe random number generator
const getRandomString = (length: number) => {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*-=+<>/';
  const charLen = characters.length;

  const x = new Uint16Array(length);
  crypto.getRandomValues(x); // Populates x with random values
  const result = [];
  for (let i = 0; i < length; i++) {
    result.push(characters.charAt(x[i] % charLen));
  }
  return result.join('');
};

// Used when registering to create a random recovery key
// Returns the seed used to generate the key, and the associated public key
export const generateRandomRecoveryKey = (): { seed: string, key: KeyWrapper } => {
  const keySeed = getRandomString(64);
  const key = generateKeyFromSeed(keySeed);
  return {seed: keySeed, key: {keyObj: key.keyObj, publicKey: key.publicKey}};
};

// Generates a RSA key deterministically from a given seed
export const generateKeyFromSeed = (seed: string): KeyWrapper => {
  const key = cryptico.generateRSAKey(seed, 512);
  return {keyObj: key, publicKey: cryptico.publicKeyString(key)};
};
