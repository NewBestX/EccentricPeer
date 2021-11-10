export interface Post {
  signature?: string;
  postType?: PostType;
  id: number; // Corresponding postCount number (starts from 1)
  content?: PostContent;
  deleted?: boolean; // Only CONTENT posts may be deleted
}

export interface PostContent {
  oldPublicKey?: string;
  oldKeySignature?: string;
  deletedPostId?: number;
  timestamp?: number;
  location?: string;
  text?: string;
}

export enum PostType {
  CONTENT, // Must contain timestamp and text
  PROFILE_UPDATE,
  POST_DELETION, // Must contain deletedPostId
  KEY_CHANGE, // In this case, the post-list will be signed with the RECOVERY KEY and the content must have: oldPublicKey
  ACCOUNT_DELETION, // Signed with recovery key
}
