import {UserProfile} from './model/ProfileContent';
import {Post, PostType} from './model/Post';
import {DataController} from './DataController';

let currentProfile: UserProfile;
let currentPosts: Post[];
let isOwnProfile: boolean;
let isFollowed: boolean;
let isBlocked: boolean;
let youAreBlocked: boolean;

export const UIController = {
  init: () => {
    DataController.init();

    currentProfile = undefined;
    currentPosts = [];
    isOwnProfile = false;
    isFollowed = false;
    isBlocked = false;
    youAreBlocked = false;
  },
  getCurrentProfile: () => {
    return currentProfile;
  },
  getCurrentPosts: () => {
    return currentPosts;
  },
  isOwnProfile: () => {
    return isOwnProfile;
  },
  isFollowed: () => {
    return isFollowed;
  },
  isBlocked: () => {
    return isBlocked;
  },
  youAreBlocked: () => {
    return youAreBlocked;
  },
  login: (username: string, password: string) => {
    return DataController.authenticate(username, password).then(() => {
      currentProfile = DataController.getMyProfile();
      currentPosts = DataController.getMyPosts();
      isOwnProfile = true;
    });
  },
  register: (username: string, password: string) => {
    return DataController.register(username, password).then((recoveryKey) => {
      currentProfile = DataController.getMyProfile();
      currentPosts = DataController.getMyPosts();
      isOwnProfile = true;
      return recoveryKey;
    });
  },
  newPost: (text: string, location: string = undefined) => {
    return DataController.createNewContentPost(text, location).then(() => {
      currentProfile = DataController.getMyProfile();
      currentPosts = DataController.getMyPosts();
    });
  },
  updateProfile: (newDesc: string, newBDay: string, newBMonth: string, newBYear: string, newLocation: string, newPicture: any)
    : Promise<void> => {
    let bDay = parseInt(newBDay, 10);
    let bMonth = parseInt(newBMonth, 10);
    let bYear = parseInt(newBYear, 10);

    if (isNaN(bDay)) {
      bDay = undefined;
    }
    if (isNaN(bMonth)) {
      bMonth = undefined;
    }
    if (isNaN(bYear)) {
      bYear = undefined;
    }
    return DataController.updateMyProfileDetails(newDesc, bDay, bMonth, bYear, newLocation, newPicture).then(() => {
      currentProfile = DataController.getMyProfile();
      currentPosts = DataController.getMyPosts();
    });
  },
  changeProfilePage: (username: string): Promise<void> => {
    if (username === DataController.getMyProfile().username) {
      currentProfile = DataController.getMyProfile();
      currentPosts = DataController.getMyPosts();
      isOwnProfile = true;
      isFollowed = false;
      isBlocked = false;
      youAreBlocked = false;
      return Promise.resolve();
    }
    return DataController.searchProfileAndPosts(username).then((result) => {
      currentProfile = result.profile;
      currentPosts = result.posts;
      isOwnProfile = false;

      isFollowed = DataController.getMyProfile().friends.elements.find(x => x.id === currentProfile.userId) !== undefined;
      isBlocked = DataController.getMyProfile().blocked.elements.find(x => x.id === currentProfile.userId) !== undefined;

      youAreBlocked = currentProfile.blocked.elements.find(x => x.id === DataController.getMyProfile().userId) !== undefined;
    });
  },
  goHome: () => {
    return UIController.changeProfilePage(DataController.getMyProfile().username);
  },
  followUser: () => {
    return DataController.addFriend(currentProfile.userId, currentProfile.username).then(() => {
      isFollowed = true;
    });
  },
  blockUser: () => {
    return DataController.addBlockedUser(currentProfile.userId, currentProfile.username).then(() => {
      isBlocked = true;
    });
  },
  unfollowUser: () => {
    return DataController.removeFriend(currentProfile.userId).then(() => {
      isFollowed = false;
    });
  },
  unblockUser: () => {
    return DataController.removeBlockedUser(currentProfile.userId).then(() => {
      isBlocked = false;
    });
  },
  deletePost: (postId: number) => {
    return DataController.deletePost(postId).then(() => {
      currentPosts = DataController.getMyPosts();
    });
  },
  deleteAccount: (recoveryKey: string) => {
    return DataController.deleteAccount(recoveryKey).then(() => {
      currentProfile = undefined;
      currentPosts = undefined;
    });
  },
  changePassword: (username: string, password: string, recoveryKey: string) => {
    return DataController.changePassword(username, password, recoveryKey).then(() => {
      currentProfile = DataController.getMyProfile();
      currentPosts = DataController.getMyPosts();
      isOwnProfile = true;
    });
  }
};
