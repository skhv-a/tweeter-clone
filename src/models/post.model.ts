export interface Post {
  id: number;
  content: string;
  created_by: number;
  created_at: Date;
  updated_at: Date;
}

export interface PostPostReq {
  content: string;
  created_by: number;
}

export interface GetPostReq {
  user_id: number;
}
