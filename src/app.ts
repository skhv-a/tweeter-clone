import { hashSync } from "bcrypt";
import bodyParser from "body-parser";
import express from "express";
import { SignInReq } from "./models/signup.model";
import { User } from "./models/user.model";

const port = process.env.PORT || 3000;

const app = express();

app.use(bodyParser.json());

app.get("/", (_, res) => {
  res.json("Hello world!");
});

app.post("/signup", (req, res) => {
  const { email, password, user_name } = req.body as SignInReq;
  const hash = hashSync(password, 10);

  res.json(hash);
});

app.listen(port, () => {
  console.log(`Example app listening at http://localhost:${port}`);
});
