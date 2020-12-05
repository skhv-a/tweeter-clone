import express, {json} from 'express';
import {compareSync, hashSync} from 'bcrypt';
import {Client, QueryResult} from 'pg';
import dotenv from 'dotenv';
import {SignInReq, SignUpReq} from './models/auth.model';
import {User} from './models/user.model';
import {Post, PostPostReq, GetPostReq} from './models/post.model';

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

app.post('/posts', async (req, res) => {
  try {
    const {created_by, content} = req.body as PostPostReq;

    const postPostText =
      'INSERT INTO posts(created_by, content, created_at) VALUES($1, $2, $3) RETURNING *';
    const postPostValues = [Number(created_by), content, new Date()];
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

app.get('/posts', async (req, res) => {
  try {
    const {user_id} = req.body as GetPostReq;

    const response = await client.query(
      'SELECT * FROM posts WHERE created_by = $1',
      [user_id]
    );

    const posts = response.rows;

    res.json(posts);
  } catch (error) {
    res.status(400).json({message: 'cannot get posts'});
  }
});

app.listen(port, () => {
  console.log(`Example app listening at http://localhost:${port}`);
});
