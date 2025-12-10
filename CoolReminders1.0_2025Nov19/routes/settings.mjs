/* routes/settings.mjs */
import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { User, Settings, List, Task, Tag, Login, ensureSettingsForUser } from '../db.mjs';
import { requireAuth } from './helpers.mjs';

const router = Router();

/* all settings routes require login */
router.use(requireAuth);

/* landing goes to profile */
/*
  GET /settings

  Redirects the generic settings root to the profile settings page
  so users always land on a concrete tab.
*/
router.get('/', (req, res) => res.redirect('/settings/profile'));

/*
  GET /settings/profile

  Loads the current user's profile and settings document, then renders
  the profile tab where name, email, and password can be managed.
*/
router.get('/profile', async (req, res) => {
  const userId = req.session.user._id;
  const user = await User.findById(userId).lean();
  const settings = await ensureSettingsForUser(userId);

  res.render('settings-profile', {
    title: 'Settings',
    active: 'settings',
    settingsTab: 'profile',
    user,
    settings,
    error: req.query.error || null,
  });
});

/*
  POST /settings/profile

  Validates the current password, then updates display name, email,
  and optionally password for the logged in user. Keeps the session
  copy of user data in sync and redirects back to the profile tab
  with any error reported via the query string.
*/
router.post('/profile', async (req, res) => {
  const userId = req.session.user._id;
  const {
    displayName,
    email,
    currentPassword,
    newPassword,
    newPasswordConfirm,
  } = req.body || {};

  function redirectError(msg) {
    return res.redirect('/settings/profile?error=' + encodeURIComponent(msg));
  }

  if (!currentPassword) {
    return redirectError('Enter your current password to save changes');
  }

  const user = await User.findById(userId);
  if (!user) {
    req.session.destroy(() => res.redirect('/login'));
    return;
  }

  const ok = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!ok) return redirectError('Current password is incorrect');

  const trimmedName = (displayName || '').trim();
  const trimmedEmail = (email || '').trim().toLowerCase();
  if (!trimmedEmail) return redirectError('Email is required');

  /* ensure email uniqueness if changed */
  if (trimmedEmail !== user.email) {
    const conflict = await User.findOne({
      email: trimmedEmail,
      _id: { $ne: userId },
    });
    if (conflict) {
      return redirectError('Another account already uses that email');
    }
  }

  /* optional password change */
  let passwordHash = user.passwordHash;
  if (newPassword || newPasswordConfirm) {
    if (!newPassword || newPassword.length < 8) {
      return redirectError('New password must be at least 8 characters');
    }
    if (newPassword !== newPasswordConfirm) {
      return redirectError('New password and confirmation do not match');
    }
    passwordHash = await bcrypt.hash(newPassword, 10);
  }

  const nameToSave = trimmedName || user.displayName || user.username;

  await User.updateOne(
    { _id: userId },
    {
      $set: {
        displayName: nameToSave,
        email: trimmedEmail,
        passwordHash,
      },
    }
  );

  /* keep session in sync */
  req.session.user.displayName = nameToSave;
  req.session.user.email = trimmedEmail;

  res.redirect('/settings/profile');
});

/*
  GET /settings/layout

  Loads the user's settings and lists, builds a simple layoutOrder
  representation, and renders the layout tab where theme, task colors,
  list order, and timezone can be adjusted.
*/
router.get('/layout', async (req, res) => {
  const userId = req.session.user._id;
  const settings = await ensureSettingsForUser(userId);

  /* load this user's real lists in the same order used on dashboard */
  const lists = await List.find({ userId })
    .sort({ position: 1, createdAt: 1 })
    .lean();

  const layoutOrder = lists.map((l) => ({
    id: l._id.toString(),
    title: l.title,
  }));

  res.render('settings-layout', {
    title: 'Settings',
    active: 'settings',
    settingsTab: 'layout',
    layoutOrder,
    theme: settings.theme || 'light',
    taskDueColor: settings.taskThemeDueColor || '#fff3b0',
    taskPastDueColor: settings.taskThemePastDueColor || '#ffe5e5',
    taskDoneColor: settings.taskThemeDoneColor || '#e0f7e9',
    timezone: settings.timezone || 'America/New_York',
  });
});

/*
  POST /settings/layout

  Saves theme choice, task status colors, and a whitelisted timezone
  into the user's Settings document, validating color fields as hex
  values and falling back to defaults when input is invalid.
*/
router.post('/layout', async (req, res) => {
  const userId = req.session.user._id;
  const theme = req.body.theme;

  const themeValue = ['light', 'dark', 'custom'].includes(theme)
    ? theme
    : 'light';

  const dueColor     = (req.body.taskDueColor || '').trim();
  const pastDueColor = (req.body.taskPastDueColor || '').trim();
  const doneColor    = (req.body.taskDoneColor || '').trim();

  /* tiny hex validator; if invalid or empty, keep defaults */
  const hex = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

  /* small whitelist of time zones */
  const allowedTz = [
    'America/New_York',
    'America/Chicago',
    'America/Denver',
    'America/Los_Angeles',
    'America/Indiana/Indianapolis',
    'Europe/Paris',
    'Asia/Dubai',
    'Asia/New Delhi'
  ];
  const requestedTz = (req.body.timezone || '').trim();
  const timezone = allowedTz.includes(requestedTz)
    ? requestedTz
    : 'America/New_York';

  const update = {
    theme: themeValue,
    taskThemeDueColor:     hex.test(dueColor)     ? dueColor     : '#fff3b0',
    taskThemePastDueColor: hex.test(pastDueColor) ? pastDueColor : '#ffe5e5',
    taskThemeDoneColor:    hex.test(doneColor)    ? doneColor    : '#e0f7e9',
    timezone,
  };

  await Settings.updateOne(
    { userId },
    { $set: update },
    { upsert: true }
  );

  res.redirect('/settings/layout');
});

/*
  POST /settings/layout/reorder

  Reorders a single list up or down within the current user's lists by
  swapping positions in memory, then writing back sequential position
  values so the dashboard and settings views stay consistent.
*/
router.post('/layout/reorder', async (req, res) => {
  const userId = req.session.user._id;
  const { listId, direction } = req.body || {};

  if (!listId || !direction) {
    return res.redirect('/settings/layout');
  }

  try {
    /* get lists in current order */
    const lists = await List.find({ userId }).sort({ position: 1, createdAt: 1 }).lean();

    const idx = lists.findIndex((l) => l._id.toString() === listId);
    if (idx === -1) {
      return res.redirect('/settings/layout');
    }

    /* swap in memory */
    if (direction === 'up' && idx > 0) {
      const tmp = lists[idx - 1];
      lists[idx - 1] = lists[idx];
      lists[idx] = tmp;
    } else if (direction === 'down' && idx < lists.length - 1) {
      const tmp = lists[idx + 1];
      lists[idx + 1] = lists[idx];
      lists[idx] = tmp;
    } else {
      /* no valid move */
      return res.redirect('/settings/layout');
    }

    /* write back sequential positions */
    const ops = lists.map((l, i) => ({
      updateOne: {
        filter: { _id: l._id, userId },
        update: { $set: { position: i + 1 } },
      },
    }));

    if (ops.length) {
      await List.bulkWrite(ops);
    }

    return res.redirect('/settings/layout');
  } catch (e) {
    console.error('layout reorder error', e);
    return res.redirect('/settings/layout');
  }
});

/*
  GET /settings/notifications

  Loads the user's Settings document and renders the notifications tab
  with checkboxes for summary mail and per priority alerts, showing a
  saved flag or error from the query string when present.
*/
router.get('/notifications', async (req, res) => {
  const userId = req.session.user._id;
  const settings = await ensureSettingsForUser(userId);

  res.render('settings-notifications', {
    title: 'Settings',
    active: 'settings',
    settingsTab: 'notifications',
    morning: !!settings.morningSummaryEmail,
    high: settings.notifyHigh !== undefined ? !!settings.notifyHigh : true,
    normal: settings.notifyNormal !== undefined ? !!settings.notifyNormal : false,
    low: settings.notifyLow !== undefined ? !!settings.notifyLow : false,
    saved: req.query.saved === '1',
    error: req.query.error || null,
  });
});

/*
  POST /settings/notifications

  Reads the notification checkboxes from the form, normalizes them to
  booleans, updates or inserts the Settings document for the user, and
  redirects back to the notifications tab with a success or error note.
*/
router.post('/notifications', async (req, res) => {
  const userId = req.session.user._id;

  try {
    /* checkboxes: present means on, missing means false */
    const morning = !!req.body.morning;
    const high    = !!req.body.high;
    const normal  = !!req.body.normal;
    const low     = !!req.body.low;

    await Settings.updateOne(
      { userId },
      {
        $set: {
          morningSummaryEmail: morning,
          notifyHigh:   high,
          notifyNormal: normal,
          notifyLow:    low,
        },
      },
      { upsert: true }
    );

    res.redirect('/settings/notifications?saved=1');
  } catch (e) {
    console.error('settings notifications update error', e);
    res.redirect(
      '/settings/notifications?error=' +
        encodeURIComponent('Could not save notification settings')
    );
  }
});

/*
  POST /settings/profile/delete

  Deletes the logged in user and all associated data after verifying
  the password for normal users or skipping the check for guest users.
  When deletion is complete, the session is destroyed and the browser
  is redirected to the login page.
*/
router.post('/profile/delete', async (req, res) => {
  const userId = req.session.user._id;
  const { confirmPassword } = req.body || {};

  try {
    const user = await User.findById(userId);
    if (!user) {
      /* if user record is missing, just clear session */
      req.session.destroy(() => res.redirect('/login'));
      return;
    }

    /* Guests can delete without password, normal users must confirm */
    if (!req.session.isGuest) {
      if (!confirmPassword) {
        return res.redirect(
          '/settings/profile?error=' +
            encodeURIComponent('Enter your password to delete your account')
        );
      }

      const ok = await bcrypt.compare(confirmPassword, user.passwordHash);
      if (!ok) {
        return res.redirect(
          '/settings/profile?error=' +
            encodeURIComponent('Password is incorrect')
        );
      }
    }

    /* Delete all associated data in parallel */
    await Promise.all([
      Task.deleteMany({ userId }),
      List.deleteMany({ userId }),
      Tag.deleteMany({ userId }),
      Settings.deleteOne({ userId }),
      Login.deleteMany({ userId }),
    ]);

    /* Finally, delete the user record */
    await User.deleteOne({ _id: userId });

    /* Destroy session and send them to home or login */
    req.session.destroy(() => {
      res.redirect('/');
    });
  } catch (e) {
    console.error('delete account error', e);
    res.redirect(
      '/settings/profile?error=' +
        encodeURIComponent('Could not delete account. Try again.')
    );
  }
});


export default router;
