export interface User {
  id: number;
  user_name: string;
  email: string;
  follows: number[];
  followers: number[];
  created_at: Date;
  updated_at: Date;
}

type SubscribeToUserAction = 'subscribe' | 'unsubscribe';
export interface SubscribeToUserReq {
  follower_id: number;
  action: SubscribeToUserAction;
}
