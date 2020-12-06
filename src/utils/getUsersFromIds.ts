import {Client, QueryResult} from 'pg';
import {User} from '../models/user.model';

export const getUsersFromLikes = async (
  client: Client,
  ids: Array<number | undefined>
): Promise<User[]> => {
  try {
    const usersResponse: QueryResult<User> = await client.query(
      'SELECT * FROM users WHERE id=ANY($1)',
      [ids]
    );

    const users = usersResponse.rows;

    return users;
  } catch (error) {
    return [{} as User];
  }
};
