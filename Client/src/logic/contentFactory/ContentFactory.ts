import {Post, PostContent, PostType} from '../model/Post';
import {KeyWrapper, signPost, signProfile} from '../encryption/Encryption';
import {UserProfile} from '../model/ProfileContent';
import {v4 as uuid} from 'uuid';

export const ContentFactory = {
  createContentPost: (myKey: KeyWrapper, id: number, text: string, timestamp: number = undefined, location: string = undefined) => {
    return ContentFactory.createPost(myKey, id, PostType.CONTENT, {text, timestamp, location});
  },
  createPost: (myKey: KeyWrapper, id: number, type: PostType, content: PostContent): Post => {
    const post: Post = {
      id,
      postType: type,
      signature: '',
      content
    };
    signPost(post, myKey.keyObj);
    return post;
  },
  incrementProfilePostCount: (myKey: KeyWrapper, profile: UserProfile) => {
    profile.postCount = profile.postCount + 1;
    signProfile(profile, myKey.keyObj);
    return profile;
  },
  cloneProfile: (profile: UserProfile): UserProfile => {
    return JSON.parse(JSON.stringify(profile));
  },
  createNewProfile: (myKey: KeyWrapper, username: string, publicKey: string, recoveryPublicKey: string): UserProfile => {
    const profile: UserProfile = {
      userId: uuid(),
      username,
      publicKey,
      recoveryPublicKey,
      postCount: 1,
      postCountSignature: '',
      sharePermission: 0,
      details: {
        registrationTimestamp: Date.now(),
        versionLock: {
          version: Date.now(),
          signature: '',
        }
      },
      profilePicture: {
        picture: undefined,
        versionLock: {
          version: Date.now(),
          signature: '',
        }
      },
      friends: {
        elements: [],
        versionLock: {
          version: Date.now(),
          signature: '',
        }
      },
      blocked: {
        elements: [],
        versionLock: {
          version: Date.now(),
          signature: '',
        }
      }
    };
    signProfile(profile, myKey.keyObj);
    return profile;
  }
};
