import express from 'express'
import path from 'path'
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import sanitize from 'mongo-sanitize';
import './db.mjs';
import bcrypt from 'bcryptjs';
import session from 'express-session';

import {startAuthenticatedSession, endAuthenticatedSession} from './auth.mjs';

const app = express();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.set('view engine', 'hbs');

app.use(express.static(path.join(__dirname, 'public')));

app.use(express.urlencoded({ extended: false }));


app.use(session({
    secret: 'keyboard cat',
    resave: false,
    saveUninitialized: true,
}));

const User = mongoose.model('User');
const Team = mongoose.model('Team');
const Pitch = mongoose.model('Pitch');
const Match = mongoose.model('Match');
const League = mongoose.model('League');


const authRequired = (req, res, next) => {
  if(!req.session.user) 
  {
    req.session.redirectPath = req.path;
    res.redirect('/login'); 
  } else {
    next();
  }
};

app.use((req, res, next) => {
  res.locals.user = req.session.user;
  next();
});

app.get('/', authRequired, async (req, res) => 
{
  res.render('home', {user: req.session.user});
});

app.get('/signup', (req, res) => {
  res.render('signup');
});

app.post('/signup', async (req, res) => {
  const username = sanitize(req.body.username);
  const password = sanitize(req.body.password);
  const email = sanitize(req.body.email);

  try {
    const existingUser = await User.findOne({username: username}).exec();
    if (existingUser) 
    {
      res.render('signup', {message: 'Username already exists'});
      return;
    }

    const salt = await bcrypt.genSalt();
    const hash = await bcrypt.hash(password, salt);

    const newUser = new User({
      username: username,
      email: email,
      password: hash
    });
    await newUser.save();

    await startAuthenticatedSession(req, newUser);

    res.redirect('/');
  } catch (err) {
    if(err instanceof mongoose.Error.ValidationError) {
      res.render('signup', {message: err.message});
    } else {
      throw err;
    }
  }
});
        
app.get('/logout', async (req, res) => {
  await endAuthenticatedSession(req);
  res.redirect('login');
});

app.get('/login', (req, res) => {
    res.render('login');
});

app.post('/login', async (req, res) => {
  const username = sanitize(req.body.username);
  const password = sanitize(req.body.password);

  try {
    const user = await User.findOne({username: username}).exec();
    if (!user) {
      res.render('login', {message: 'Invalid login or password'});
      return;
    }

    const passwordMatch = await bcrypt.compare(password, user.password);
    if (!passwordMatch) {
      res.render('login', {message: 'Invalid login or password'});
      return;
    }

    await startAuthenticatedSession(req, user);

    const redirectPath = req.session.redirectPath || '/';
    delete req.session.redirectPath;
    res.redirect(redirectPath);
  } catch (err) {
    if(err instanceof mongoose.Error.ValidationError) {
      res.render('login', {message: err.message});
    } else {
      throw err;
    }
  }
});

app.listen(process.env.PORT || 3000);

