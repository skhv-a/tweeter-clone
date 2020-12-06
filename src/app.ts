import express, {json} from 'express';
import {compareSync, hashSync} from 'bcrypt';
import {Client, QueryResult} from 'pg';
import dotenv from 'dotenv';
import {SignInReq, SignUpReq} from './models/auth.model';
import {SubscribeToUserReq, User} from './models/user.model';
import {Post, PostPostReq, LikePostReq} from './models/post.model';
import {getUsersFromIds} from './utils/getUsersFromIds';

dotenv.config();
const client = new Client();
client.connect(err => {
  if (err) {
    console.error('connection error', err.stack);
  }
});

const port = process.env.PORT || 3000;

const app = express();

app.use(json());

app.get('/', (_, res) => {
  res.json('Hello world!');
});

app.post('/signup', (req, res) => {
  const {email, password, user_name} = req.body as SignUpReq;
  const hash = hashSync(password, 10);

  (async () => {
    try {
      client.query('BEGIN');

      const insertUsersQuery =
        'INSERT INTO users(email, user_name, created_at) VALUES($1, $2, $3) RETURNING *';
      const insertUsersValues = [email, user_name, new Date()];
      const usersRes: QueryResult<User> = await client.query(
        insertUsersQuery,
        insertUsersValues
      );

      const [user] = usersRes.rows;

      const insertLoginText =
        'INSERT INTO login(email, user_name, hash) VALUES($1, $2, $3)';
      const inserLoginValues = [email, user_name, hash];
      await client.query(insertLoginText, inserLoginValues);
      await client.query('COMMIT');

      res.json(user);
    } catch (error) {
      await client.query('ROLLBACK');
      res.json({error: 'cannot signup'});
    }
  })();
});

app.post('/signin', (req, res) => {
  const {login, password} = req.body as SignInReq;

  (async () => {
    try {
      client.query('BEGIN');
      const getHashText =
        'SELECT hash FROM login WHERE email = $1 OR user_name = $1';

      const hashResponse = await client.query(getHashText, [login]);

      const [hashRes] = hashResponse.rows;

      const {hash} = hashRes;

      const isPasswordCorrect = compareSync(password, hash);

      if (!isPasswordCorrect) {
        throw {message: 'Wrong pass'};
      }

      const getUserText =
        'SELECT * FROM users WHERE email = $1 OR user_name = $1';
      const userResponse = await client.query(getUserText, [login]);
      const [user] = userResponse.rows;

      await client.query('COMMIT');
      res.json(user);
    } catch (error) {
      await client.query('ROLLBACK');
      res.status(401).json({message: 'Cannot signin'});
    }
  })();
});

app.get('/users', async (req, res) => {
  try {
    const usersResponse = await client.query('SELECT user_name, id FROM users');

    const users = usersResponse.rows;

    res.json(users);
  } catch (error) {
    res.status(400).json({message: 'Cannot get users'});
  }
});

app.get('/users/:id', async (req, res) => {
  try {
    const {id} = req.params;

    await client.query('BEGIN');
    const userResponse: QueryResult<User> = await client.query(
      'SELECT id, user_name, follows, followers FROM users WHERE id = $1',
      [Number(id)]
    );

    if (!userResponse.rowCount) {
      throw {message: 'user not found'};
    }

    const [user] = userResponse.rows;

    const postsResponse: QueryResult<Post> = await client.query(
      'SELECT * FROM posts WHERE created_by = $1',
      [Number(id)]
    );

    const posts = await Promise.all(
      postsResponse.rows.map(async post => {
        const [fullCreatedBy] = await getUsersFromIds(client, [
          post.created_by,
        ]);

        const fullLikes = await getUsersFromIds(client, post.likes);

        return Object.assign(post, {
          created_by: fullCreatedBy,
          likes: fullLikes,
        });
      })
    );

    const follows = await getUsersFromIds(client, user.follows);
    const followers = await getUsersFromIds(client, user.followers);

    await client.query('COMMIT');
    res.json({...user, posts, follows, followers});
  } catch (error) {
    await client.query('ROLLBACK');
    res.status(404).json({message: 'can not get user'});
  }
});

app.post('/users/:id', async (req, res) => {
  try {
    const {follower_id, action} = req.body as SubscribeToUserReq;
    const {id} = req.params;

    await client.query('BEGIN');

    const followsResponse: QueryResult<
      Pick<User, 'follows'>
    > = await client.query('SELECT follows FROM users WHERE id = $1', [
      follower_id,
    ]);

    const {follows} = followsResponse.rows[0];

    const updatedFollows =
      action === 'subscribe'
        ? follows.concat(Number(id))
        : action === 'unsubscribe'
        ? follows.filter(f => f !== Number(id))
        : follows;

    await client.query('UPDATE users SET follows = $1 WHERE id = $2', [
      updatedFollows,
      follower_id,
    ]);

    const followersResponse: QueryResult<
      Pick<User, 'followers'>
    > = await client.query('SELECT followers FROM users WHERE id = $1', [
      Number(id),
    ]);

    const {followers} = followersResponse.rows[0];

    const updatedFollowers =
      action === 'subscribe'
        ? followers.concat(follower_id)
        : action === 'unsubscribe'
        ? followers.filter(f => f !== Number(follower_id))
        : followers;

    await client.query('UPDATE users SET followers = $1 WHERE id = $2', [
      updatedFollowers,
      Number(id),
    ]);

    const usersFromFollows = await getUsersFromIds(client, updatedFollows);

    await client.query('COMMIT');
    res.json(usersFromFollows);
  } catch (error) {
    await client.query('ROLLBACK');
    res.status(400).json({message: 'can not subscribe'});
  }
});

app.post('/users/:id/posts/', async (req, res) => {
  try {
    const {id} = req.params;
    const {content} = req.body as PostPostReq;

    const postPostText =
      'INSERT INTO posts(created_by, content, created_at) VALUES($1, $2, $3) RETURNING *';
    const postPostValues = [Number(id), content, new Date()];
    const response: QueryResult<Post> = await client.query(
      postPostText,
      postPostValues
    );

    const [post] = response.rows;

    res.json(post);
  } catch (error) {
    res.status(400).json({message: 'Can not create post'});
  }
});

app.get('/users/:id/posts/', async (req, res) => {
  try {
    const {id} = req.params;

    const response: QueryResult<Post> = await client.query(
      'SELECT * FROM posts WHERE created_by = $1',
      [Number(id)]
    );

    const posts = await Promise.all(
      response.rows.map(async post => {
        const usersFromLikes = await getUsersFromIds(client, post.likes);

        return Object.assign(post, {likes: usersFromLikes});
      })
    );

    res.json(posts);
  } catch (error) {
    res.status(400).json({message: 'cannot get posts'});
  }
});

app.post('/posts/:id/like', async (req, res) => {
  try {
    const {id} = req.params;
    const {user_id, action} = req.body as LikePostReq;

    const currentUserResponse: QueryResult<User> = await client.query(
      'SELECT id FROM users WHERE id = $1',
      [user_id]
    );

    if (!currentUserResponse.rowCount) {
      throw {message: 'User doesnt exist'};
    }

    const currentLikesResponse: QueryResult<Post> = await client.query(
      'SELECT likes FROM posts WHERE id = $1',
      [Number(id)]
    );

    const {likes} = currentLikesResponse.rows[0];

    const updatedLikes =
      action === 'like'
        ? [...likes, Number(user_id)]
        : action === 'unlike'
        ? likes.filter(id => id !== Number(user_id))
        : likes;

    await client.query('UPDATE posts SET likes = $1 WHERE id = $2', [
      updatedLikes,
      id,
    ]);

    const usersFromLikes = await getUsersFromIds(client, updatedLikes);

    res.json(usersFromLikes);
  } catch (error) {
    res.status(400).json({message: 'can not like post'});
  }
});

app.listen(port, () => {
  console.log(`Example app listening at http://localhost:${port}`);
});
