/* routes/tasks.mjs */
import { Router } from 'express';
import { List, Task, Tag } from '../db.mjs';
import { requireAuth } from './helpers.mjs';
import { info, warn } from './utils/log.mjs';
import { emitToUser } from '../socket.mjs';

const router = Router();

/* helper: normalize user-entered link URLs to be absolute */
/*
  normalizeLinkUrl

  Normalizes a raw user entered URL into a safe, absolute URL string,
  preserving existing schemes and protocol relative URLs and defaulting
  to https:// when no scheme is provided.
*/
function normalizeLinkUrl(raw) {
  const url = (raw || '').trim();
  if (!url) { return ''; }

  /* already has a scheme: http:, https:, mailto:, etc. */
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(url)) {
    return url;
  }

  /* protocol-relative (//example.com) – keep as is */
  if (url.startsWith('//')) {
    return url;
  }

  /* fall back to https for bare domains / paths */
  return `https://${url}`;
}

/* helper: combine date and time fields into a Date */
/*
  parseDateTime

  Combines separate date and time strings from form fields into a
  JavaScript Date or returns null when input is missing or invalid.
*/
function parseDateTime(dateStr, timeStr) {
  const d = (dateStr || '').trim();
  const t = (timeStr || '').trim();
  if (!d) return null;

  const iso = t ? `${d}T${t}` : d;
  const dt = new Date(iso);
  return Number.isNaN(dt.getTime()) ? null : dt;
}

/* ------------------------------------------------------------------
   resolveListForUser: resolve a list for the given user
   - Prefer a valid listId from req.body
   - Else fall back to first list
   - If none exists, create a default list
------------------------------------------------------------------- */
async function resolveListForUser(userId, preferredListId) {
  let list = null;

  if (preferredListId) {
    list = await List.findOne({ _id: preferredListId, userId }).lean();
    if (!list) warn('resolveList: preferred list not found/owned', preferredListId);
  }

  if (!list) {
    list = await List.findOne({ userId }).sort({ createdAt: 1 }).lean();
  }

  if (!list) {
    const created = await List.create({ userId, title: 'My List', icon: '📝', color: '#dfe6e9' });
    list = created.toObject();
  }

  return list;
}

/* all task routes require auth */
router.use(requireAuth);

/* ---------------------------------------------------------------
   CREATE: main task
---------------------------------------------------------------- */
/*
  POST /tasks

  Creates a new top level task for the current user, resolving the
  target list, parsing optional due date/time, normalizing an optional
  link, creating or reusing tags, and then redirecting to the dashboard.
*/
router.post('/tasks', async (req, res) => {
  try {
    const userId = req.session.user._id;
    info('TASK CREATE start', req._rid, { userId, body: { title: req.body?.title, listId: req.body?.listId } });

    const title = (req.body.title || '').trim();
    if (!title) return res.redirect('/dashboard?error=' + encodeURIComponent('Title is required'));

    const list = await resolveListForUser(userId, req.body.listId);

    const notes      = (req.body.notes || '').trim();
    const rawLinkUrl = (req.body.linkUrl || '').trim();
    const linkUrl    = normalizeLinkUrl(rawLinkUrl);
    const links      = linkUrl
                        ? [{ url: linkUrl, title: (req.body.linkTitle || 'Link').trim() || 'Link' }]
                        : [];

    const priority = ['low', 'normal', 'high'].includes(req.body.priority)
      ? req.body.priority
      : 'normal';

    const dueAt = parseDateTime(req.body.dueDate, req.body.dueTime);

    /* tag names from comma separated input */
    const rawTags = (req.body.tags || '').split(',');
    const tagNames = rawTags
      .map(t => t.trim())
      .filter(t => t.length > 0);

    /* find or create tags for this user */
    const tagIds = [];
    for (const name of tagNames) {
      /* basic reuse, no fancy race handling needed for class scale */
      let tag = await Tag.findOne({ userId, name });
      if (!tag) {
        tag = await Tag.create({ userId, name, color: '#e5e7eb' });
      }
      tagIds.push(tag._id);
    }

    const created = await Task.create({
      userId,
      listId: list._id,
      parentTaskId: null,
      title,
      notes,
      links,
      priority,
      dueAt,
      tagIds
    });

    info('TASK CREATED', req._rid, created._id.toString());
    emitToUser(userId, 'task:created', {
      id: created._id.toString(),
      listId: list._id.toString(),
      title: created.title
    });
    res.redirect(`/dashboard?list=${list._id.toString()}`);
  } catch (err) {
    console.error('Error creating task:', err);
    res.status(500).send('<h1>Server Error</h1><p>Check /tasks route logs.</p>');
  }
});

/* ---------------------------------------------------------------
   DETAILS API (drawer)
---------------------------------------------------------------- */
/*
  GET /api/tasks/:id

  Fetches a single task for the current user, hydrates tag names into
  a CSV string for editing, and returns a DTO used to populate the
  dashboard drawer via AJAX.
*/
router.get('/api/tasks/:id', async (req, res) => {
  try {
    const userId = req.session.user._id;
    const t = await Task.findOne({ _id: req.params.id, userId }).lean();
    if (!t) {
      warn('TASK api not found', req.params.id);
      return res.status(404).json({ error: 'not found' });
    }

    /* derive a CSV of tag names for the editor */
    let tagsCsv = '';
    let tagIds = Array.isArray(t.tagIds) ? t.tagIds : [];

    if (tagIds.length) {
      const tagDocs = await Tag.find({
        _id: { $in: tagIds },
        userId,
      }).lean();

      tagsCsv = tagDocs.map((tag) => tag.name).join(', ');
      tagIds = tagDocs.map((tag) => tag._id.toString());
    }

    const dto = {
      _id: t._id.toString(),
      title: t.title || '',
      notes: t.notes || '',
      priority: t.priority || 'normal',
      dueAt: t.dueAt ? new Date(t.dueAt).toISOString() : null,
      links: Array.isArray(t.links) ? t.links : [],
      completed: !!t.completed,
      parentTaskId: t.parentTaskId ? t.parentTaskId.toString() : null,
      listId: t.listId ? t.listId.toString() : null,

      /* new fields for the drawer */
      tagsCsv,
      tags: tagIds,
    };

    info('TASK api ok', req._rid, dto._id);
    res.json(dto);

  } catch (e) {
    console.error('api error', e);
    res.status(500).json({ error: 'server error' });
  }
});

/* ===============================================================
   PATCH /api/tasks/:id  (inline edits + toggles)
================================================================ */
/*
  PATCH /api/tasks/:id

  Applies partial updates to a task for inline edits (title, notes,
  dueAt, completion, link, list change) and broadcasts a task:updated
  socket event when the update succeeds.
*/
router.patch('/api/tasks/:id', async (req, res) => {
  try {
    const userId = req.session.user._id;
    const filter = { _id: req.params.id, userId };

    const set = {};
    const unset = {};

    if (typeof req.body.title === 'string') set.title = req.body.title.trim();
    if (typeof req.body.notes === 'string') set.notes = req.body.notes.trim();

    if (typeof req.body.priority === 'string' && ['low', 'normal', 'high'].includes(req.body.priority)) {
      set.priority = req.body.priority;
    }

    if (Object.prototype.hasOwnProperty.call(req.body, 'dueAt')) {
      if (req.body.dueAt) set.dueAt = new Date(req.body.dueAt);
      else unset.dueAt = '';
    }

    if (typeof req.body.completed === 'boolean') {
      set.completed = !!req.body.completed;
      set.completedAt = req.body.completed ? new Date() : null;
    }

    if (Object.prototype.hasOwnProperty.call(req.body, 'linkUrl')) {
      const rawLinkUrl = (req.body.linkUrl || '').trim();
      const linkUrl    = normalizeLinkUrl(rawLinkUrl);
      set.links        = linkUrl ? [{ url: linkUrl, title: 'Link' }] : [];
    }

    if (req.body.listId) {
      const list = await List.findOne({ _id: req.body.listId, userId });
      if (list) set.listId = list._id;
    }

    const update = {};
    if (Object.keys(set).length) update.$set = set;
    if (Object.keys(unset).length) update.$unset = unset;
    if (!Object.keys(update).length) return res.json({ ok: true, noop: true });

    await Task.updateOne(filter, update);
    const saved = await Task.findOne(filter).lean();
    
    emitToUser(userId, 'task:updated', {
      id: saved._id.toString(),
      listId: saved.listId ? saved.listId.toString() : null,
      title: saved.title,
      completed: !!saved.completed
    });

    res.json({
      ok: true,
      task: {
        _id: saved._id.toString(),
        title: saved.title,
        notes: saved.notes || '',
        priority: saved.priority || 'normal',
        dueAt: saved.dueAt ? saved.dueAt.toISOString() : null,
        completed: !!saved.completed,
        links: saved.links || [],
        listId: saved.listId ? saved.listId.toString() : null
      }
    });
  } catch (e) {
    console.error('PATCH /api/tasks/:id error', e);
    res.status(500).json({ error: 'server error' });
  }
});

/* ---------------------------------------------------------------
   UPDATE (drawer Save)
---------------------------------------------------------------- */
/*
  POST /tasks/:id/update

  Handles full task edits submitted from the drawer form, including
  title, notes, link, due date/time, priority, tags, and optional
  list change, then redirects back to the dashboard.
*/
router.post('/tasks/:id/update', async (req, res) => {
  try {
    const userId = req.session.user._id;

    const title = (req.body.title || '').trim();
    const notes = (req.body.notes || '').trim();
    const priority = ['low','normal','high'].includes(req.body.priority)
      ? req.body.priority
      : 'normal';
    const rawLinkUrl = (req.body.linkUrl || '').trim();
    const linkUrl    = normalizeLinkUrl(rawLinkUrl);
    const dueAt = parseDateTime(req.body.dueDate, req.body.dueTime);

    const update = {
      title,
      notes,
      priority,
      dueAt,
      links: linkUrl ? [{ url: linkUrl, title: linkUrl }] : [],
    };

    /* tags from the drawer: comma separated names */
    const rawTags = (req.body.tags || '').split(',');
    const tagNames = rawTags
      .map((t) => t.trim())
      .filter((t) => t.length > 0);

    const tagIds = [];
    for (const name of tagNames) {
      let tag = await Tag.findOne({ userId, name });
      if (!tag) {
        tag = await Tag.create({ userId, name, color: '#e5e7eb' });
      }
      tagIds.push(tag._id);
    }
    update.tagIds = tagIds;

    if (req.body.listId) {
      const list = await List.findOne({ _id: req.body.listId, userId });
      if (list) {
        update.listId = list._id;
      }
    }

    await Task.updateOne({ _id: req.params.id, userId }, { $set: update });
    res.redirect('/dashboard');
  } catch (e) {
    console.error('update error', e);
    res.status(500).send('update failed');
  }
});

/* ---------------------------------------------------------------
   POST /tasks/:id/COMPLETE
---------------------------------------------------------------- */
/*
  Marks a task as completed for the current user, stamps completedAt,
  fires a task:updated socket event, and redirects back to dashboard.
*/
router.post('/tasks/:id/complete', async (req, res) => {
  const userId = req.session.user._id;
  await Task.updateOne(
    { _id: req.params.id, userId },
    { $set: { completed: true, completedAt: new Date() } }
  );
  info('TASK complete', req._rid, req.params.id);
  emitToUser(userId, 'task:updated', {
    id: req.params.id,
    completed: true
  });
  res.redirect('/dashboard');
});

/* ---------------------------------------------------------------
   DELETE
   POST /tasks/:id/delete
    Deletes a single task for the current user, emits a task:deleted
    socket event to clean up other tabs, and redirects back to dashboard.
---------------------------------------------------------------- */
router.post('/tasks/:id/delete', async (req, res) => {
  const userId = req.session.user._id;
  await Task.deleteOne({ _id: req.params.id, userId });
  info('TASK delete', req._rid, req.params.id);
  emitToUser(userId, 'task:deleted', { id: req.params.id });
  res.redirect('/dashboard');
});

/* ===============================================================
   SUBTASKS

  POST /tasks/:id/subtasks

  Creates a new subtask under the given parent task id, inheriting
  userId and listId from the parent, then redirects back to dashboard.
================================================================ */

router.post('/tasks/:id/subtasks', async (req, res) => {
  try {
    const userId = req.session.user._id;
    const parent = await Task.findOne({ _id: req.params.id, userId }).lean();
    if (!parent) return res.status(404).send('Parent task not found');

    const title = (req.body.title || '').trim();
    if (!title) return res.redirect('/dashboard?error=' + encodeURIComponent('Subtask title required'));

    await Task.create({
      userId,
      listId: parent.listId,
      parentTaskId: parent._id,
      title,
      notes: '',
      links: [],
      priority: 'normal',
      completed: false,
      dueAt: null
    });

    info('SUBTASK CREATED', req._rid, 'parent=', parent._id.toString(), 'title=', title);
    res.redirect('/dashboard');
  } catch (e) {
    console.error('create subtask error', e);
    res.status(500).send('failed to create subtask');
  }
});

/*
  GET /api/tasks/:id/subtasks

  Returns a JSON list of subtasks for the given parent task id,
  limited to the current user and sorted by creation time.
*/
router.get('/api/tasks/:id/subtasks', async (req, res) => {
  try {
    const userId = req.session.user._id;
    const subs = await Task.find({ userId, parentTaskId: req.params.id })
      .sort({ createdAt: 1 })
      .lean();

    res.json({
      ok: true,
      subtasks: subs.map(s => ({
        _id: s._id.toString(),
        title: s.title,
        completed: !!s.completed,
        priority: s.priority || 'normal',
        dueAt: s.dueAt ? s.dueAt.toISOString() : null
      }))
    });
  } catch (e) {
    console.error('list subtasks error', e);
    res.status(500).json({ error: 'server error' });
  }
});

/* ===============================================================
   LISTS API  (rename, recolor, delete)
================================================================ */

/*
  PATCH /api/lists/:id

  Renames and/or recolors a list owned by the current user, validates
  color as hex, saves the list, and broadcasts a list:updated event.
*/
router.patch('/api/lists/:id', async (req, res) => {
  try {
    const userId = req.session.user._id;
    const list = await List.findOne({ _id: req.params.id, userId });
    if (!list) return res.status(404).json({ error: 'not found' });

    const title = (req.body.title || '').trim();
    const color = (req.body.color || '').trim();
    const hex = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

    if (title) list.title = title;
    if (color && hex.test(color)) list.color = color;

    await list.save();

    const payload = {
      id: list._id.toString(),
      title: list.title,
      color: list.color || '#dfe6e9'
    };

    emitToUser(userId, 'list:updated', payload);

    res.json({ ok: true, list: payload });
  } catch (e) {
    console.error('PATCH /api/lists/:id error', e);
    res.status(500).json({ error: 'server error' });
  }
});


/*
  DELETE /api/lists/:id

  Deletes a list and all its tasks for the current user, then emits a
  list:deleted event so any open clients can remove it from the UI.
*/
router.delete('/api/lists/:id', async (req, res) => {
  try {
    const userId = req.session.user._id;
    const list = await List.findOne({ _id: req.params.id, userId });
    if (!list) return res.status(404).json({ error: 'not found' });

    await Task.deleteMany({ userId, listId: list._id });
    await List.deleteOne({ _id: list._id, userId });

    await Task.deleteMany({ userId, listId: list._id });
    await List.deleteOne({ _id: list._id, userId });

    emitToUser(userId, 'list:deleted', { id: list._id.toString() });

    res.json({ ok: true });
  } catch (e) {
    console.error('DELETE /api/lists/:id error', e);
    res.status(500).json({ error: 'server error' });
  }
});

/* ===============================================================
   TAGS API  (rename, recolor, delete)

   PATCH /api/tags/:id

    Renames and/or recolors a tag for the current user, enforcing unique
    names per user and hex color format, and returns the updated tag data.
================================================================ */

router.patch('/api/tags/:id', async (req, res) => {
  try {
    const userId = req.session.user._id;
    const tag = await Tag.findOne({ _id: req.params.id, userId });
    if (!tag) return res.status(404).json({ error: 'not found' });

    const name = (req.body.name || '').trim();
    const color = (req.body.color || '').trim();
    const hex = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

    if (name) {
      /* basic uniqueness check per user */
      const conflict = await Tag.findOne({ userId, name, _id: { $ne: tag._id } });
      if (conflict) {
        return res.status(409).json({ error: 'Tag with that name already exists' });
      }
      tag.name = name;
    }

    if (color && hex.test(color)) tag.color = color;

    await tag.save();
    res.json({
      ok: true,
      tag: {
        id: tag._id.toString(),
        name: tag.name,
        color: tag.color || '#eef2ff'
      }
    });
  } catch (e) {
    console.error('PATCH /api/tags/:id error', e);
    res.status(500).json({ error: 'server error' });
  }
});

/*
  DELETE /api/tags/:id

  Deletes a tag owned by the current user and removes it from all tasks
  that reference it via $pull, then returns a simple ok JSON response.
*/
router.delete('/api/tags/:id', async (req, res) => {
  try {
    const userId = req.session.user._id;
    const tag = await Tag.findOne({ _id: req.params.id, userId });
    if (!tag) return res.status(404).json({ error: 'not found' });

    await Task.updateMany(
      { userId, tagIds: tag._id },
      { $pull: { tagIds: tag._id } }
    );
    await Tag.deleteOne({ _id: tag._id, userId });

    res.json({ ok: true });
  } catch (e) {
    console.error('DELETE /api/tags/:id error', e);
    res.status(500).json({ error: 'server error' });
  }
});

export default router;
