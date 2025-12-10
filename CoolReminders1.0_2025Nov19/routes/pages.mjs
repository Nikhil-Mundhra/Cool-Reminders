/* routes/pages.mjs */

import { Router } from 'express';
import { User, Settings, List, Task, Tag } from '../db.mjs';
import { ensureDemoData } from './helpers.mjs';

const router = Router();

/*
  GET /about

  Renders the static About page describing Cool Reminders and marks
  the "about" nav item as active.
*/
router.get('/about', (req, res) => {
  res.render('about', { title: 'About Cool Reminders', active: 'about' });
});

/*
  GET /proposal

  Renders a simple proposal page for the project using a hard coded
  proposal object that shows the basic idea and sample documents from
  the data model.
*/
router.get('/proposal', async (req, res) => {
  const proposal = {
    name: 'Cool Reminders',
    overview: 'A lists and tasks app with tags, reminders, and simple daily summaries.',
    dataModel: {
      sampleDocuments: {
        user: { username: 'Nikticks', email: 'demo@example.com' },
        settings: { theme: 'light', layoutOrder: ['Today','Scheduled','All'] },
        list: { title: 'List A', icon: '📝' },
        task: { title: 'Random Task', notes: 'Notes...', priority: 'high' },
        tag: { name: 'Urgent', color: '#d63031' },
      },
    },
  };
  res.render('proposal', { title: 'Proposal', proposal });
});

/*
  GET /debug/models

  Ensures demo data exists, counts core collections (users, settings,
  lists, tasks, tags) and returns the counts as pretty printed JSON
  text in an HTML <pre> block for quick debugging.
*/
router.get('/debug/models', async (req, res) => {
  const { user } = await ensureDemoData();
  const [users, settings, lists, tasks, tags] = await Promise.all([
    User.countDocuments(),
    Settings.countDocuments(),
    List.countDocuments({ userId: user._id }),
    Task.countDocuments({ userId: user._id }),
    Tag.countDocuments({ userId: user._id }),
  ]);
  res
    .type('html')
    .send(
      `<pre>${JSON.stringify(
        { users, settings, lists, tasks, tags },
        null,
        2
      )}</pre>`
    );
});

/*
  GET /seed

  Calls ensureDemoData to create or refresh a demo user, settings,
  lists, and tasks, then responds with a small confirmation page that
  links to the dashboard.
*/
router.get('/seed', async (req, res) => {
  await ensureDemoData();
  res
    .type('html')
    .send(
      '<h1>Seeded</h1><p>Demo data ensured.</p><p><a href="/dashboard">Go to dashboard</a></p>'
    );
});

export default router;
