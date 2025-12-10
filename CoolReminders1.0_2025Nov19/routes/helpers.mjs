/* routes/helpers.mjs */
/* Shared helpers: auth guard, session sync, demo seeding, and demo user fetch */

import bcrypt from 'bcryptjs';
import { User, Settings, List, Task, Tag, ensureSettingsForUser } from '../db.mjs';
import { info } from './utils/log.mjs';

/*
  attachSessionUser

  Normalizes req.session.user from either req.user (passport) or the
  existing session object and exposes a userDisplay value on res.locals
  so views and middleware can use a consistent user identity.
*/
export function attachSessionUser(req, res, next) {
  const u = req.user || req.session?.user;
  if (u) {
    req.session.user = {
      _id: u._id.toString(),
      username: u.username,
      displayName: u.displayName || u.username,
      email: u.email,
    };
  }

  res.locals.userDisplay =
    req.session.user?.displayName || req.session.user?.username;

  next();
}

/*
  requireAuth

  Guards routes that need authentication by checking for a logged in
  user, logging a miss and redirecting to /login when absent, and
  otherwise syncing session and locals via attachSessionUser before
  passing control to the next handler.
*/
export function requireAuth(req, res, next) {
  const u = req.user || req.session?.user;
  if (!u) {
    info('AUTH miss', req._rid, 'redirect to /login');
    return res.redirect('/login');
  }

  /* normalize session and locals before continuing */
  attachSessionUser(req, res, () => {
    info('AUTH ok', req._rid, req.session.user.username);
    next();
  });
}

/*
  ensureDemoData

  Creates or reuses a demo user with email demo@example.com, ensures
  that user has settings, an Urgent tag, three lists, and a small set
  of example tasks in the first list, then returns the demo user,
  settings, and lists.
*/
export async function ensureDemoData() {
  /* user */
  let user = await User.findOne({ email: 'demo@example.com' });
  if (!user) {
    const hash = await bcrypt.hash('demo1234', 10); /* demo login password */
    user = await User.create({
      username: 'Nikticks Reminders',
      email: 'demo@example.com',
      passwordHash: hash,
      displayName: 'Nikticks',
    });
  }

  /* settings (demo uses push and email and morning summary on) */
  const settings = await ensureSettingsForUser(user._id, {
    notificationChannels: ['email', 'push'],
    morningSummaryEmail: true,
  });

  /* tag */
  const urgentTag =
    (await Tag.findOne({ userId: user._id, name: 'Urgent' })) ||
    (await Tag.create({ userId: user._id, name: 'Urgent', color: '#d63031' }));

  /* lists */
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

  /* seed a few tasks in first list if empty */
  const mainList = lists[0];
  const taskCount = await Task.countDocuments({
    userId: user._id,
    listId: mainList._id,
  });

  if (taskCount === 0) {
    await Task.create({
      userId: user._id,
      listId: mainList._id,
      title: 'Random Task',
      notes: 'Notes...',
      links: [{ url: 'https://example.com', title: 'Random_Link' }],
      priority: 'high',
      tagIds: [urgentTag._id],
      dueAt: new Date('2025-11-07T00:00:00Z'),
      section: 'Applied Internet Tech',
    });
    await Task.create({
      userId: user._id,
      listId: mainList._id,
      title: 'Second Task',
      notes: 'Write app.mjs',
      links: [{ url: 'https://cs.nyu.edu', title: 'Course link' }],
      priority: 'normal',
      dueAt: new Date('2025-11-07T00:00:00Z'),
    });
    await Task.create({
      userId: user._id,
      listId: mainList._id,
      title: 'Third Task',
      notes: 'Add layout page',
      priority: 'low',
      dueAt: new Date('2025-11-07T00:00:00Z'),
    });
  }

  return { user, settings, lists };
}

/*
  getDemoUser

  Convenience helper that calls ensureDemoData and returns only the
  demo user document, ignoring the associated settings and lists.
*/
export async function getDemoUser() {
  const { user } = await ensureDemoData();
  return user;
}
74