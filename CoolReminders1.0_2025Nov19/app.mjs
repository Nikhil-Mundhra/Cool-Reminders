/* app.mjs */
/* Cool Reminders */
/* Core server bootstrap. Views remain under views/, static under public/. */

import './config.mjs';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { config } from 'dotenv'; // config.mjs
import { engine } from 'express-handlebars';
import { createServer } from 'http';
import { initSocket } from './socket.mjs';
import session from 'express-session';
import MongoStore from 'connect-mongo';
import methodOverride from 'method-override';

import { connectDB, List, Settings } from './db.mjs';

/* Routers */
import authRouter from './routes/auth.mjs';
import dashboardRouter from './routes/dashboard.mjs';
import settingsRouter from './routes/settings.mjs';
import pagesRouter from './routes/pages.mjs';
import tasksRouter from './routes/tasks.mjs';
import passport from './routes/passport.mjs';
import { info, err, makeReqId } from './routes/utils/log.mjs';
import { attachSessionUser } from './routes/helpers.mjs';
import compression from 'compression';
app.use(compression());

config();

/* file paths */
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/* app */
const app = express();
app.set('trust proxy', 1);   /* <--- trusting render */

/* parsers */
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

/*
  sessionMiddleware

  Configures express-session to:
  - store sessions in MongoDB (via connect-mongo) using DSN or a local default
  - use a one day rolling cookie with SameSite=lax and HTTPS aware secure flag
  - share the same session store between HTTP and Socket.IO (via initSocket)
*/
const sessionMiddleware = session({
  secret: process.env.SESSION_SECRET || 'dev-secret-change-me',
  resave: false,
  saveUninitialized: false,
  proxy: true,                     /* let session look at X-Forwarded-Proto */
  cookie: {
    maxAge: 1000 * 60 * 60 * 24,
    httpOnly: true,
    sameSite: 'lax',
    secure: 'auto',                /* secure only when request is https */
    //secure: false, // process.env.NODE_ENV === 'production'
  },
  store: MongoStore.create({
    mongoUrl: process.env.DSN || 'mongodb://127.0.0.1:27017/coolreminders',
    ttl: 60 * 60 * 24,
  }),
});

/* IMPORTANT: session first, then passport */
app.use(sessionMiddleware);
app.use(passport.initialize());
app.use(passport.session());

/* attach normalized session user + res.locals.userDisplay */
app.use(attachSessionUser);

/*
  request id middleware

  Attaches a short, unique request id to each incoming request as `req._rid`
  so logs coming from different layers (routes, DB, socket) can be correlated.
*/
app.use((req, res, next) => {
  req._rid = makeReqId();
  next();
});

/* a maxAge so repeat navigations do not revalidate every time */
app.use('/public', express.static(path.join(__dirname, 'public'), { maxAge: '1h' }));

/* static */
app.use('/public', express.static(path.join(__dirname, 'public')));

/* serve images */
app.use('/documentation', express.static(path.join(__dirname, 'documentation')));

/* view engine: default layout is views/layout.hbs */
app.engine(
  'hbs',
  engine({
    extname: '.hbs',
    defaultLayout: 'layout',
    layoutsDir: path.join(__dirname, 'views'),
    partialsDir: path.join(__dirname, 'views/partials'),
    helpers: {
      json: (x) => JSON.stringify(x, null, 2),
      eq: (a, b) => a === b,
      truncate: (s, n) =>
        typeof s === 'string' && s.length > n ? s.slice(0, n).trim() + '…' : s || '',
    },
  })
);

app.set('view engine', 'hbs');
app.set('views', path.join(__dirname, 'views'));

/*
  Initial database connection

  Connects to MongoDB once at startup using the provided DSN (environment or
  local default). If the connection fails, the error is logged and the app
  continues to boot, but DB backed routes will fail until the DSN is fixed.
*/
try {
  const dsn = process.env.DSN || 'mongodb://127.0.0.1:27017/coolreminders';
  await connectDB(dsn);
} catch (error) {
  console.error('db connect failed', error);
};

/*
  theme loader middleware

  For logged in users:
    - loads their Settings document
    - exposes `res.locals.theme` so templates can render the correct theme
  For anonymous users, falls back to `"light"`.
  If anything goes wrong, it silently defaults to `"light"` and calls next().
*/
app.use(async (req, res, next) => {
  try {
    if (req.session.user) {
      const settings = await Settings.findOne({
        userId: req.session.user._id,
      }).lean();
      res.locals.theme = settings?.theme || 'light';
    } else {
      res.locals.theme = 'light';
    }
  } catch (e) {
    res.locals.theme = 'light';
  }
  next();
});

/* method override */
app.use(methodOverride('_method'));

/* mount routers */
app.use('/', authRouter);
app.use('/', dashboardRouter);
app.use('/settings', settingsRouter);
app.use('/', pagesRouter);
app.use('/', tasksRouter);

/*
  last error handler

  Catches uncaught errors from previous middleware / routes, logs the stack
  with the request id, and sends a generic 500 response unless headers are
  already committed (in which case it delegates to the default Express handler).
*/
app.use((error, req, res, next) => {
  err('ERR', req?._rid || '-', error && error.stack ? error.stack : error);
  if (res.headersSent) return next(error);
  res.status(500).type('text').send('Server error');
});

/*
  GET /debug/db

  Lightweight diagnostics endpoint to check MongoDB connectivity without
  authentication. It (re)uses connectDB, then returns connection state and
  database name as JSON or an error message on failure.
*/
app.get('/debug/db', async (req, res) => {
  try {
    const conn = await connectDB(process.env.DSN || 'mongodb://127.0.0.1:27017/coolreminders');
    res.json({ ok: true, state: conn.readyState, name: conn.name });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});


/* HTTP + socket.io server */
const PORT = process.env.PORT || 3000;
const server = createServer(app);

/* Initialize Socket.IO with shared session middleware */
initSocket(server, sessionMiddleware);

/*
  server.listen callback

  Starts the HTTP server on the configured PORT and prints the local URL
  to the console to quickly confirm that the app is running.
*/
server.listen(PORT, () => {
  console.log(`Cool Reminders running at http://localhost:${PORT}`);
});
