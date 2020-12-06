export interface Post {
  id: number;
  content: string;
  created_by: number;
  likes: Array<number | undefined>;
  created_at: Date;
  updated_at: Date;
}

export interface PostPostReq {
  content: string;
}

export interface GetPostReq {
  user_id: number;
}

type LikePostAction = 'like' | 'unlike';

export interface LikePostReq {
  user_id: number;
  action: LikePostAction;
}
