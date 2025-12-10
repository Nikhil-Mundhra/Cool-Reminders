/* routes/dashboard.mjs */
import { Router } from 'express';
import { Task, List, Tag, Settings } from '../db.mjs';
import { requireAuth } from './helpers.mjs';
import { info } from './utils/log.mjs';

const router = Router();

/*
  GET /dashboard

  Loads the current user's lists, tags, and tasks for the selected list,
  computes derived display data (status, colors, subtask previews, due text),
  builds a single dashboardState object for Vue hydration, and renders the
  dashboard view with everything needed for both server and client side UI.
*/
router.get('/dashboard', requireAuth, async (req, res) => {
  const userId = req.session.user._id;

  const settings = await Settings.findOne({ userId }).lean().catch(() => null);
  const dueColor = settings?.taskThemeDueColor || '#fff3b0';
  const pastDueColor = settings?.taskThemePastDueColor || '#ffe5e5';
  const doneColor = settings?.taskThemeDoneColor || '#e0f7e9';

  const timezone = settings?.timezone || 'America/New_York';
  const dueFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });

  /* pick current list */
  let currentList = null;
  if (req.query.list) {
    currentList = await List.findOne({ _id: req.query.list, userId }).lean();
  }

  /* load lists and tags in parallel */
  const [listsRaw, tagsDocs] = await Promise.all([
    List.find({ userId }).sort({ position: 1, createdAt: 1 }).lean(),
    Tag.find({ userId }).sort({ name: 1 }).lean(),
  ]);

  const lists = listsRaw;

  /* if no explicit list or not found, fall back to first list by position */
  if (!currentList && lists.length > 0) {
    currentList = lists[0];
  }

  let tasks = [];
  let subs = [];
  if (currentList) {
    const filter = {
      userId,
      listId: currentList._id,
      parentTaskId: null,
    };
    if (req.query.tag) {
      filter.tagIds = req.query.tag;
    }

    tasks = await Task.find(filter)
      .sort({ createdAt: 1 })
      .populate('tagIds')
      .lean();

    const ids = tasks.map((t) => t._id);
    subs = await Task.find({
      userId,
      parentTaskId: { $in: ids },
    })
      .sort({ createdAt: 1 })
      .lean();
  }

  const byParent = new Map();
  for (const s of subs) {
    const k = s.parentTaskId.toString();
    if (!byParent.has(k)) byParent.set(k, []);
    byParent.get(k).push(s);
  }

  const now = new Date();

  const displayTasks = tasks.map((t) => {
    const kids = byParent.get(t._id.toString()) || [];
    const preview = kids.slice(0, 2).map((s) => ({
      id: s._id.toString(),
      title: s.title,
      completed: !!s.completed,
    }));
    const more = Math.max(0, kids.length - preview.length);

    let status = 'due';
    if (t.completed) {
      status = 'done';
    } else if (t.dueAt && new Date(t.dueAt) < now) {
      status = 'pastDue';
    }

    const bgColor =
      status === 'done'
        ? doneColor
        : status === 'pastDue'
        ? pastDueColor
        : dueColor;

    const tags = Array.isArray(t.tagIds)
      ? t.tagIds.map((tag) => ({
          id: tag._id.toString(),
          name: tag.name,
          color: tag.color || '#e5e7eb',
        }))
      : [];

    return {
      id: t._id.toString(),
      title: t.title,
      notes: t.notes || '',
      link: t.links && t.links.length ? t.links[0] : null,
      dueText: t.dueAt ? dueFormatter.format(new Date(t.dueAt)) : 'No due date',
      dueISO: t.dueAt ? new Date(t.dueAt).toISOString() : '',
      completed: !!t.completed,
      priority: t.priority || 'normal',
      subtasks: preview,
      moreSubtasks: more,
      status,
      bgColor,
      tags,
    };
  });

  /* Map lists and tags once so we can reuse in template and Vue */
  const listsView = lists.map((l) => ({
    id: l._id.toString(),
    title: l.title,
    color: l.color || '#dfe6e9',
  }));

  const tagsView = tagsDocs.map((tag) => ({
    id: tag._id.toString(),
    name: tag.name,
    color: tag.color || '#e5e7eb',
  }));

  const currentListId = currentList ? currentList._id.toString() : '';
  const currentTagId = req.query.tag || '';
  const userDisplay =
    req.session.user.displayName || req.session.user.username;

  /* This is the single source of truth Vue will hydrate from */
  const dashboardState = {
    userDisplay,
    tasks: displayTasks,
    lists: listsView,
    tags: tagsView,
    currentListId,
    currentTagId,
  };

  res.render('dashboard', {
    title: 'Dashboard',
    active: 'dashboard',
    userDisplay,
    tasks: displayTasks,
    lists: listsView,
    currentListId,
    tags: tagsView,
    currentTagId,
    /* new field for Vue */
    dashboardState,
  });

  info('VIEW dashboard', req._rid, 'tasks=', tasks.length, 'lists=', lists.length);
});


/*
  POST /lists

  Creates a new list for the current user with a title and optional color,
  assigns it the next position in the user's list order, and then redirects
  back to the dashboard focused on the newly created list.
*/
router.post('/lists', requireAuth, async (req, res) => {
  try {
    const userId = req.session.user._id;
    const title = (req.body.title || '').trim();
    const color = (req.body.color || '').trim() || '#dfe6e9';

    if (!title) {
      return res.redirect('/dashboard');
    }

    const maxPos = await List.findOne({ userId }).sort({ position: -1 }).lean();
    const position = maxPos ? (maxPos.position || 0) + 1 : 1;

    const list = await List.create({
      userId,
      title,
      icon: '📝',
      color,
      position,
    });

    res.redirect('/dashboard?list=' + list._id.toString());
  } catch (e) {
    console.error('create list error', e);
    res.redirect('/dashboard');
  }
});

export default router;
