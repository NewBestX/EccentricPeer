import {db, storageInit} from './Storage';
import {UserProfile} from '../model/ProfileContent';
import {ProfilesStorage} from './ProfilesStorage';
import {Post, PostType} from '../model/Post';
import {PostsStorage} from './PostsStorage';

describe('Storage', () => {
  beforeAll(async (done) => {
    storageInit().then(value => {
      expect(value).toEqual(0);
      done();
    });
  });

  it('should have initialized the database', () => {
    expect(db).toBeTruthy();
  });

  // Test all operations in ProfilesStorage
  it('should perform CRUD for a UserProfile', (done) => {
    const profile = getDummyProfile('testID', 'test', 'testPK', 'testRPK');
    let profileString = JSON.stringify(profile);

    let initialSize;
    let initialValuesString;
    ProfilesStorage.getAll().then(value => {
      initialSize = value.length;                         // Save the initial size of the database
      initialValuesString = JSON.stringify(value);
      return ProfilesStorage.add(profile);                // Add the dummy profile
    }).then(() => {
      return ProfilesStorage.getAll();
    }).then((value) => {                       // Check if getAll contains the dummy profile
      expect(value.length).toEqual(initialSize + 1);
      expect(value.map(x => x.userId).includes('testID')).toBeTrue();
      return ProfilesStorage.getAllUserIds();
    }).then((value) => {                      // Check if getAllKeys contains the key of the dummy profile
      expect(value.length).toEqual(initialSize + 1);
      expect(value.includes('testID')).toBeTrue();
      return ProfilesStorage.findById('testID');
    }).then((value) => {                        // Finding profile by ID
      expect(JSON.stringify(value)).toBe(profileString);
      return ProfilesStorage.findByPublicKey('testPK');
    }).then((value) => {                        // Finding profile by public key
      expect(JSON.stringify(value)).toBe(profileString);
      return ProfilesStorage.findByRecoveryPublicKey('testRPK');
    }).then((value) => {                        // Finding profile by recovery public key
      expect(JSON.stringify(value)).toBe(profileString);
      return ProfilesStorage.findByUsername('test');
    }).then((value) => {                        // Finding profile by username
      expect(JSON.stringify(value)).toBe(profileString);
      profile.username = 'test2';
      profileString = JSON.stringify(profile);
      return ProfilesStorage.update(profile);
    }).then(() => {                                       // Updated the dummy profile's username
      return ProfilesStorage.getAll();
    }).then((value) => {                       // Repeat the getAll test
      expect(value.length).toEqual(initialSize + 1);
      expect(value.map(x => x.userId).includes('testID')).toBeTrue();
      return ProfilesStorage.findById('testID');
    }).then((value) => {                        // Finding the updated profile by ID
      expect(JSON.stringify(value)).toBe(profileString);
      return ProfilesStorage.findByUsername('test');
    }).then((value) => {                        // Finding the updated profile by the old username
      expect(value).toBeUndefined();
      return ProfilesStorage.findByUsername('test2');
    }).then((value) => {                        // Finding the updated profile by the new username
      expect(JSON.stringify(value)).toBe(profileString);
      return ProfilesStorage.remove('testID');
    }).then(() => {                                       // Deleted the dummy profile
      return ProfilesStorage.getAll();
    }).then((value) => {                       // Check if the data is the same as in the beginning of the test
      expect(value.length).toEqual(initialSize);
      expect(value.map(x => x.userId).includes('testID')).toBeFalse();
      expect(JSON.stringify(value)).toBe(initialValuesString);
      done();
    }).catch(() => {
      fail();
    });
  });

  it('should find a UserProfile from multiple entries', (done) => {
    const profile1 = getDummyProfile('testUser1', 'test1', 'test1PK', 'test1RPK');
    const profile2 = getDummyProfile('testUser2', 'test2', 'test2PK', 'test2RPK');
    const profile3 = getDummyProfile('testUser3', 'test3', 'test3PK', 'test3RPK');
    const profile1String = JSON.stringify(profile1);

    let initialSize;
    let initialValuesString;
    ProfilesStorage.getAll().then(value => {
      initialSize = value.length;                         // Save the initial size of the database
      initialValuesString = JSON.stringify(value);
      return ProfilesStorage.add(profile2);               // Add the dummy profiles
    }).then(() => {
      return ProfilesStorage.add(profile1);
    }).then(() => {
      return ProfilesStorage.add(profile3);
    }).then(() => {
      return ProfilesStorage.findById('testUser1');
    }).then((value) => {                        // Test consistency of the dummy profile 1
      expect(JSON.stringify(value)).toBe(profile1String);
      return ProfilesStorage.remove('testUser1');
    }).then(() => {                                       // Deleting the dummy profiles
      return ProfilesStorage.remove('testUser2');
    }).then(() => {
      return ProfilesStorage.remove('testUser3');
    }).then(() => {
      return ProfilesStorage.getAll();
    }).then((value) => {                       // Check if the data is the same as in the beginning of the test
      expect(value.length).toEqual(initialSize);
      expect(JSON.stringify(value)).toBe(initialValuesString);
      done();
    }).catch(() => {
      fail();
    });
  });

  it('should perform CRUD for a Post', (done) => {
    const userId = 'postTestUserID';
    const post = getDummyPost(111);
    let postString = JSON.stringify(post);

    PostsStorage.findForUser(userId).then(value => {
      expect(value.length).toEqual(0);            // There should be no posts for this test user
      return PostsStorage.addOne(userId, post);           // Add the dummy post-list
    }).then(() => {
      return PostsStorage.findForUser(userId);
    }).then((value) => {                            // Check if user's posts contain the dummy post-list
      expect(value.length).toEqual(1);
      expect(value.map(p => p.id).includes(post.id)).toBeTrue();
      expect(JSON.stringify(value[0])).toBe(postString);
      return PostsStorage.findOne(userId, 111);
    }).then((value) => {
      expect(JSON.stringify(value)).toBe(postString);
      post.content = {text: 'updated'};
      postString = JSON.stringify(post);
      return PostsStorage.update(userId, post);           // Update the dummy post-list
    }).then(() => {
      return PostsStorage.findForUser(userId);
    }).then((value) => {                            // Check if user's posts contain the updated dummy post-list
      expect(value.length).toEqual(1);
      expect(JSON.stringify(value[0])).toBe(postString);
      expect(value.map(up => up.id).includes(post.id)).toBeTrue();
      return PostsStorage.findOne(userId, 111);
    }).then((value) => {
      expect(JSON.stringify(value)).toBe(postString);
      return PostsStorage.removeOne(userId, 111);       // Remove the dummy post-list
    }).then(() => {
      return PostsStorage.findForUser(userId);
    }).then((value) => {                            // Check if the data is the same as in the beginning of the test
      expect(value.length).toEqual(0);
      done();
    }).catch(() => {
      fail();
    });
  });

  it('should perform operations with multiple Posts', (done) => {
    const userId1 = 'postTestUserID1';
    const userId2 = 'postTestUserID2';
    const post1 = getDummyPost(211);
    const post2 = getDummyPost(212);
    const post3 = getDummyPost(213);
    const post1String = JSON.stringify(post1);

    PostsStorage.findForUser(userId1).then(value => {
      expect(value.length).toEqual(0);                           // There should be no posts for this test user
      return PostsStorage.addAll(userId1, [post1, post2, post3]);  // Add the dummy posts
    }).then(() => {
      return PostsStorage.addAll(userId2, [post1, post2]);
    }).then(() => {
      return PostsStorage.findForUser(userId1);
    }).then((value) => {
      expect(value.length).toEqual(3);
      const pIds = value.map(p => p.id);
      expect(pIds.includes(211)).toBeTrue();
      expect(pIds.includes(212)).toBeTrue();
      expect(pIds.includes(213)).toBeTrue();
      return PostsStorage.findInRange(userId1, 211, 212);
    }).then((value) => {
      expect(value.length).toEqual(2);
      const pIds = value.map(p => p.id);
      expect(pIds.includes(211)).toBeTrue();
      expect(pIds.includes(212)).toBeTrue();
      expect(pIds.includes(213)).toBeFalse();
      return PostsStorage.findOne(userId1, 211);
    }).then((value) => {
      expect(JSON.stringify(value)).toBe(post1String);   // Test consistency of the dummy post-list 1 for user1
      return PostsStorage.removeAll(userId1);            // Deleting the dummy posts
    }).then(() => {
      return PostsStorage.findForUser(userId2);
    }).then((value) => {                           // Check if deleting posts for user 1 affected user 2
      expect(value.length).toEqual(2);
      const retrievedPost1 = value.filter(x => x.id === 211);
      expect(retrievedPost1.length).toEqual(1);
      expect(JSON.stringify(retrievedPost1[0])).toBe(post1String);
      return PostsStorage.removeAll(userId2);
    }).then(() => {
      return PostsStorage.findForUser(userId1);
    }).then((value) => {                           // Check if the data is the same as in the beginning of the test
      expect(value.length).toEqual(0);
      return PostsStorage.findForUser(userId2);
    }).then((value) => {
      expect(value.length).toEqual(0);
      done();
    }).catch(() => {
      fail();
    });
  });
});

const getDummyProfile = (userId, username, publicKey, recoveryPublicKey): UserProfile => {
  return {
    userId,
    username,
    publicKey,
    recoveryPublicKey,
    postCount: 1,
    postCountSignature: 'testPCS',
    sharePermission: 0,
    details: {
      registrationTimestamp: 0,
      birthday: {
        year: 1999,
        month: 4,
        day: 4
      },
      description: 'testDESC',
      location: 'testLoc',
      education: 'testEd',
      versionLock: {
        version: 1,
        signature: 'testVLSD'
      }
    },
    profilePicture: {
      picture: 'testPICTURE',
      versionLock: {
        version: 1,
        signature: 'testVLSP'
      }
    },
    friends: {
      elements: [{id: 'testFLid1', username: 'testFLun1'}, {id: 'testFLid2', username: 'testFLun2'}],
      versionLock: {
        version: 1,
        signature: 'testVLSFL'
      }
    },
    blocked: {
      elements: [{id: 'testBLid1', username: 'testBLun1'}, {id: 'testBLid2', username: 'testBLun2'}],
      versionLock: {
        version: 1,
        signature: 'testVLSBL'
      }
    }
  };
};

const getDummyPost = (id): Post => {
  return {
    id,
    signature: 'testSignature',
    postType: PostType.CONTENT,
    content: {text: 'testContent'}
  };
};
