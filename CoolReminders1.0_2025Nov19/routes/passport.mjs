// routes/passport.mjs
import passport from 'passport';
import { Strategy as LocalStrategy } from 'passport-local';
import bcrypt from 'bcryptjs';
import { User } from '../db.mjs';

/*
  LocalStrategy: login with email or username + password

  Configures a username/password strategy that accepts either an email
  or username in the same field, looks up the User by email first and
  then by username, verifies the bcrypt password hash, and either
  fails with an "Invalid credentials" message or succeeds with the
  matching user document.
*/
passport.use(
  new LocalStrategy(
    {
      usernameField: 'emailOrUsername',  // matches your login form
      passwordField: 'password',
    },
    async (emailOrUsername, password, done) => {
      try {
        const lookup = (emailOrUsername || '').trim();
        if (!lookup || !password) {
          return done(null, false, { message: 'Missing credentials' });
        }

        const user =
          (await User.findOne({ email: lookup.toLowerCase() })) ||
          (await User.findOne({ username: lookup }));

        if (!user) {
          return done(null, false, { message: 'Invalid credentials' });
        }

        const ok = await bcrypt.compare(password, user.passwordHash);
        if (!ok) {
          return done(null, false, { message: 'Invalid credentials' });
        }

        return done(null, user);
      } catch (err) {
        return done(err);
      }
    }
  )
);

/*
  serializeUser

  Tells Passport how to store the logged in user in the session by
  reducing the full user object to a simple string id.
*/
/* Passport session glue: store user id, load user on each request */
passport.serializeUser((user, done) => {
  done(null, user._id.toString());
});

/*
  deserializeUser

  Tells Passport how to rebuild req.user on each request by loading
  the user from the database using the stored id and returning a lean
  document (or false when the user no longer exists).
*/
passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id).lean();
    if (!user) return done(null, false);
    done(null, user);
  } catch (err) {
    done(err);
  }
});

export default passport;
