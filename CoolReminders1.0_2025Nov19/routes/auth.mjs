/* routes/auth.mjs */

import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { User, Settings, List, Task, ensureSettingsForUser } from '../db.mjs';
import { info } from './utils/log.mjs';
import passport from './passport.mjs';
import { emitToUser } from '../socket.mjs';

const router = Router();

/* ---------------------------- seed defaults ---------------------------- */
/*
  seedDefaultsForUser

  Ensures a new user starts with three basic lists and a few example
  tasks (including one subtask) by creating them only when they do not
  already exist, then returns all lists created or found for that user.
*/
async function seedDefaultsForUser(user) {
  const listTitles = ['List A', 'List B', 'List C'];
  const lists = [];

  for (const title of listTitles) {
    let list = await List.findOne({ userId: user._id, title });
    if (!list) {
      list = await List.create({
        userId: user._id,
        title,
        icon: '📝',
        color: '#dfe6e9',
      });
    }
    lists.push(list);
  }

  const mainList = lists[0];
  const existing = await Task.countDocuments({
    userId: user._id,
    listId: mainList._id,
    parentTaskId: null,
  });

  if (existing === 0) {
    const t1 = await Task.create({
      userId: user._id,
      listId: mainList._id,
      title: 'Welcome to Cool Reminders',
      notes: 'Click the title to edit, or click anywhere else to open details.',
      priority: 'normal',
      dueAt: null,
    });

    await Task.create({
      userId: user._id,
      listId: mainList._id,
      title: 'Add your first real task',
      priority: 'high',
      dueAt: new Date(Date.now() + 86400000),
    });

    await Task.create({
      userId: user._id,
      listId: mainList._id,
      parentTaskId: t1._id,
      title: 'Sample subtask',
      priority: 'low',
    });
  }

  return lists;
}

/* --------------------------- GET / and /login --------------------------- */
/*
  GET /

  Renders the login page as the default entry point, with the app title
  and navbar active state set to the home section.
*/
router.get('/', (req, res) => {
  res.render('login', { title: 'Cool Reminders', active: 'home' });
});

/*
  GET /login

  Renders the login form and optionally displays an error message
  passed via the query string (e.g. after a failed login attempt).
*/
router.get('/login', (req, res) => {
  res.render('login', {
    title: 'Cool Reminders',
    active: 'home',
    error: req.query.error || null,
  });
});

/* ------------------------------ POST /login ----------------------------- */
/*
  POST /login

  Authenticates a user with the local passport strategy using either
  email or username, stores a normalized user object on the session
  on success, and redirects to /dashboard or back to /login with an
  error message on failure.
*/
router.post('/login', (req, res, next) => {
  passport.authenticate('local', (err, user, infoObj) => {
    if (err) return next(err);
    if (!user) {
      const msg = infoObj?.message || 'Invalid credentials';
      return res.redirect('/login?error=' + encodeURIComponent(msg));
    }

    req.logIn(user, (err2) => {
      if (err2) return next(err2);

      req.session.user = {
        _id: user._id.toString(),
        username: user.username,
        displayName: user.displayName || user.username,
        email: user.email,
      };
      delete req.session.isGuest;

      info('LOGIN ok', req._rid, user.username);
      return res.redirect('/dashboard');
    });
  })(req, res, next);
});

/* ------------------------------ POST /guest ----------------------------- */
/*
  POST /guest

  Creates or reuses a throwaway "guest" account for this session, seeds
  default settings and demo lists/tasks, logs the guest user in via
  passport, marks the session as a guest session, and redirects to the
  dashboard (or returns a login error redirect if something fails).
*/
router.post('/guest', async (req, res, next) => {
  try {
    /* Already logged in, go straight to dashboard */
    if (req.session.user) {
      return res.redirect('/dashboard');
    }

    const stamp = Date.now();
    const email = `guest+${stamp}@example.com`;

    let user = await User.findOne({ email });
    if (!user) {
      user = await User.create({
        username: `guest_${stamp}`,
        email,
        passwordHash: await bcrypt.hash('guest-session', 8),
        displayName: 'Guest',
      });

      /* guest defaults: no morning summary, email channel only */
      await ensureSettingsForUser(user._id, {
        morningSummaryEmail: false,
        notificationChannels: ['email'],
      });

      await seedDefaultsForUser(user);
    }

    req.logIn(user, (err) => {
      if (err) {
        console.error('guest login passport error', err);
        return next(err);
      }

      req.session.user = {
        _id: user._id.toString(),
        username: user.username,
        displayName: user.displayName || user.username,
        email: user.email,
      };
      req.session.isGuest = true;

      info('GUEST login', req._rid, user._id.toString());
      return res.redirect('/dashboard');
    });
  } catch (e) {
    console.error('guest login error', e);
    return res.redirect(
      '/login?error=' + encodeURIComponent('Guest login unavailable')
    );
  }
});

/* ------------------------------ GET /signup ----------------------------- */
/*
  GET /signup

  Renders the signup form for creating a new account and shows any
  validation or conflict error passed via the query string.
*/
router.get('/signup', (req, res) => {
  res.render('signup', {
    title: 'Create Account',
    active: 'home',
    error: req.query.error || null,
  });
});

/* ------------------------------ POST /signup ---------------------------- */
/*
  POST /signup

  Validates a new user registration, enforces minimum password length
  and unique email/username, creates the User and Settings records,
  seeds starter lists and tasks, logs the user in on success, and
  redirects to /dashboard (or back to /signup with an error message).
*/
router.post('/signup', async (req, res, next) => {
  try {
    let { username, email, password } = req.body || {};
    username = (username || '').trim();
    email = (email || '').trim().toLowerCase();
    password = password || '';

    if (!username || !email || !password) {
      return res.redirect(
        '/signup?error=' + encodeURIComponent('All fields are required')
      );
    }
    if (password.length < 8) {
      return res.redirect(
        '/signup?error=' +
          encodeURIComponent('Password must be at least 8 characters')
      );
    }

    const exists = await User.findOne({
      $or: [{ email }, { username }],
    });
    if (exists) {
      return res.redirect(
        '/signup?error=' +
          encodeURIComponent('User with that email or username exists')
      );
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await User.create({
      username,
      email,
      passwordHash,
      displayName: username,
    });

    /* normal account defaults: morning summary on, email channel */
    await ensureSettingsForUser(user._id, {
      morningSummaryEmail: true,
      notificationChannels: ['email'],
    });

    await seedDefaultsForUser(user);

    req.logIn(user, (err) => {
      if (err) {
        console.error('signup login error', err);
        return res.redirect(
          '/login?error=' +
            encodeURIComponent('Account created. Please log in.')
        );
      }

      req.session.user = {
        _id: user._id.toString(),
        username: user.username,
        displayName: user.displayName || user.username,
        email: user.email,
      };

      info('SIGNUP login', req._rid, user.username);
      return res.redirect('/dashboard');
    });
  } catch (e) {
    console.error('signup error', e);
    return res.redirect(
      '/signup?error=' +
        encodeURIComponent('Could not create account. Try again.')
    );
  }
});

/* ------------------------------ POST /logout ---------------------------- */
/*
  POST /logout

  Logs the current user out of the passport session, emits a `user:logout`
  socket event to all of their active connections so other tabs can react,
  destroys the Express session, and redirects back to the home/login page.
*/
router.post('/logout', (req, res, next) => {
  const userId = req.session?.user?._id;

  req.logout((err) => {
    if (err) return next(err);

    /* notify all sockets for this user so other tabs can redirect */
    if (userId) {
      emitToUser(userId, 'user:logout', {});
    }

    req.session.destroy(() => {
      res.redirect('/');
    });
  });
});


export default router;
