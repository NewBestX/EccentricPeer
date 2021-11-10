export interface UserProfile {
  // This info will be shared with anyone (incl. blocked), but may not contain the optional fields
  userId: string;
  username: string; // Must be unique
  publicKey: string;
  recoveryPublicKey: string;
  postCount: number;
  postCountSignature: string;
  sharePermission: number; // 0 = Can share to anyone*, 1 = Can share to my friends (with permission 2)*,
                           // 2 = Can share to people in "friends"; * = Except blocked
  details?: UserProfileDetails;
  profilePicture?: ProfilePicture;
  friends?: UserList;
  blocked?: UserList;
  deleted?: boolean; // Only true if account was deleted
}

export interface MyInfo {
  profile: UserProfile;
  privateKey: string;
}

export interface UserList extends VersionLockedContent {
  elements: IdUsernamePair[]; // List of userIds
}

export interface IdUsernamePair {
  id: string;
  username: string;
}

export interface ProfilePicture extends VersionLockedContent {
  picture: any;
}

export interface UserProfileDetails extends VersionLockedContent {
  // All fields in a user's bio. This info may be private
  registrationTimestamp: number;
  birthday?: UserBirthday;
  description?: string;
  location?: string;
  education?: string;
}

export interface UserBirthday {
  year?: number;
  month?: number;
  day?: number;
}

export interface VersionLockedContent {
  versionLock: VersionLock;
}

export interface VersionLock {
  version: number; // Timestamp of last edit
  signature: string; // Signature for the content this is attached to (incl. version number)
}
