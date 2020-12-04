import { User } from "./user.model";

export interface Post {
  id: number;
  content: string;
  created_by: User;
  created_at: Date;
  updated_at: Date;
}
