# Cool Reminders 

## Overview

Your brain is an F1 car; your tasks are traffic cones. Chaos ensues. Cool Reminders corrals the cones with color tags, subtasks, and timely nudges, plus optional morning email summaries and a layout you can rearrange to feel just right.

Cool Reminders is a web app for managing multiple to do lists. Users can register and sign in, and after signing in, they can create lists, add tasks, set dates and reminders, and mark tasks complete. They can also organize with color tags, priority filters, nested sections and subtasks, plus optional morning email summaries.


## Data Model

The application will store the following data:

* User // account holder
    *  Settings // theme, layout, reminder defaults, timezone, channels
    *  Lists // all lists owned or shared
        *  List // title, icon, color, sharing
            *  Task // one item
                * Subtasks // nested children
                * Section // optional grouping
                * Notes // rich text
                * Links // {url, title}
                * Dates // start, due, repeat
                * Reminders // early offsets, scheduled events
                * Attachments // files or images
                * Tags // refs to Tag
                * Priority // low, normal, high
                * Completion // done flag, timestamp
    *  Tags
          * Tag // name, color, createdAt, updatedAt
    * Progress // 0 to 100% of the tasks_done/total_tasks
* Logins // Username, email, password sets

The following relationships are one -> one:
* User -> setting.
* Task -> section / Notes / Priority / completion

The following relationships are one -> many:
* List -> Task
* Task -> Subtask / Links / Reminders / Tags

(__TODO__: sample documents)

An Example Login:

```javascript
{
  UserID: /* unique ID linked to user's settings, lists, etc*/,
  username: "Nikticks Reminders",
  email: "nik@xyz.abc",
  hash: // a password hash,
}
```

An Example settings for a User

```javascript
{
  settingsId: /* unique ID */,
  theme: "light",                               // UI theme
  layoutOrder: ["Today", "Scheduled", "All"],   // preferred sections order
  defaultReminderOffsetMinutes: 30,             // nudge before due time
  morningSummaryEmail: true,                    // send daily summary
  timezone: "America/New_York",                 // IANA timezone
  notificationChannels: ["email", "push"],      // delivery methods
  createdAt: /*timestamp*/,
  updatedAt: /*timestamp*/
}
```

An Example Task

```javascript
{
  taskId: "tsk_7c61e901",                        // unique ID
  listId: "lst_42ac77ee",                        // parent list reference
  parentTaskId: null,                            // set to a taskId for a subtask
  title: "Finish lab",                // task title
  notes: "Debug app.mjs and add .gitignore", // rich text allowed
  links: [                                       // related links
    { url: "https://https://cs.nyu.edu/courses/fall25/CSCI-UA.0467-001/", title: "AIT" }
  ],
  tags: ["tag_priority", "tag_cs"],              // refs to Tag
  priority: "high",                              // low, normal, high
  dueAt: "2025-10-31T16:00:00Z",                 // due datetime
  repeatRule: null,                               // iCal RRULE string if repeating
  reminderOffsetsMinutes: [120, 30],             // early nudges in minutes
  attachments: [                                  // files or images
    {
      attachmentId: "att_33aa22ff",
      fileUrl: "https://cdn.example.com/files/lab-checklist.pdf",
      mimeType: "application/pdf"
    }
  ],
  section: "Applied Internet Tech",               // optional grouping label
  completed: false,                               // completion flag
  completedAt: null,                              // timestamp if completed
  position: 3,                                    // ordering within parent
  createdAt: /*timestamp*/,
  updatedAt: /*timestamp*/
}
```

## [Link to Commented First Draft Schema](db.mjs) 
https://github.com/nyu-csci-ua-0467-001-002-fall-2025/final-project-Nikhil-Mundhra/blob/main/db.mjs

## Wireframes

Wireframes for all of the pages on site; used Balsamiq.

- Page for updating profile info

![Profile Settings](documentation/Settings_Profile.png)

- Page for updating notification settings

![Notification Settings](documentation/Settings_Notifications.png)

- Page for updating layout and theme preferences

![Layout Settings](documentation/Settings_Layout.png)

- Main page with some tasks for example:

![Main Dashboard](documentation/Dashboard_main.png)

- Login Page

![Login and Home](documentation/Login.png)

## Site map

/list/slug - Here's the site map

![Site Map](documentation/site-map.png)

## User Stories or Use Cases

1. As a non registered user, I can register a new account with the site, or use a guest login.
2. As a user, I can sign in and sign out of the site.
3. As a user, I can create, view, rename, and delete my to do lists.
4. As a user, I can create tasks in a selected list and view all tasks in that list.
5. As a user, I can mark a task complete and/or delete it.
6. As a user, I can delete my account.
7. As a user, I can set date and time on a task.
8. As a user, I can double click and rename lists and set them to different colors.
9. As a user, I can add notes and links to a task to keep related information together.
10. As a user, I can create tags, edit tags, and apply tags to tasks.
11. As a user, I can filter or view tasks by tag, priority, or common lists such as Today and Scheduled.
12. As a user, I can set the priority on a task to low, normal, or high.
13. As a user, I can reorder lists in settings/layout.
14. As a user, I can share a list with other users and control whether they can view or edit it.
15. As a user, I can upload or attach files to a task.
16. As a user, I can update my personal settings such as theme, layout order, timezone, and notification channels.

## Research Topics

* (3 points) Integrate user authentication (Passport.js and bcrypt)
    * I use **Passport.js (local strategy)** and **bcrypt** to handle user signup, login, and persistent sessions.
    * Passwords are **hashed with bcrypt** before being stored in MongoDB; plain-text passwords are never saved.
    * Sessions are managed with `express-session` and `connect-mongo`, so logged-in state survives refreshes and works across routes like `/dashboard` and `/settings`.
    * A small `requireAuth` middleware protects private pages (dashboard, settings, etc.) and redirects unauthenticated users back to the login page.
    * To test:
        * Visit `/signup` to create a user.
        * Then log in via `/login` (or the root `/`) and verify that you can access `/dashboard` and see your lists and tasks.
    * Deployed examples:
        * Register:  
          `https://ait-final-project-nikhil-mundhra.onrender.com/signup`
        * Login:  
          `https://ait-final-project-nikhil-mundhra.onrender.com`

* (4 points) Learn Parsley.js to perform client side form validation
    * I include **Parsley.js from a CDN** in the layout and attach it to forms using the `data-validate="true"` attribute.
    * I add `data-parsley-*` attributes to enforce required fields, length limits, and basic sanity checks:
        * Auth forms: ensure email and password are required and correctly formatted.
        * Quick add task form (on the dashboard): 
            * `title` is required (`data-parsley-notblank`, `data-parsley-maxlength="140"`).
            * `notes` has a max length (e.g. `data-parsley-maxlength="500"`).
            * `dueDate` uses a “not in the past” rule (custom `data-parsley-notpast` validator).
    * Parsley prevents submit until the form is valid and shows inline error messages, which are styled via `.parsley-errors-list` and `.parsley-error` in `base.css`.
    * Example reference used:  
      `cs.nyu.edu/~jversoza/ait-final/my-form`

* (4 points) vue.js
    * I use **Vue.js 3 (global build)** as a progressive enhancement layer on the dashboard page instead of rebuilding the whole app as a SPA.
    * On `/dashboard`, the server renders all HTML (lists, tags, task cards) and also embeds a JSON `dashboardState` blob in:
        * `<script id="dashboard-state" type="application/json">…</script>`
    * `public/js/dashboard.js` reads this state and calls `Vue.createApp` to mount on `#dashboard-app`. The Vue instance manages:
        * Local UI flags like `quickaddExpanded` for the **collapsible quick add form** (everything except the title can be toggled open / closed).
        * Drawer state (`drawerOpen` / `drawerTask`) for the right-hand task details panel (wired to existing DOM-based drawer code).
    * Vue is chosen because its template syntax maps well onto my existing Handlebars / HTML structure, and it lets me incrementally add reactive behavior without rewriting the entire app.


10 points total out of 8 required points (___TODO__: additional points will __not__ count for extra credit)


## [Link to Initial Main Project File](app.mjs) 
https://github.com/nyu-csci-ua-0467-001-002-fall-2025/final-project-Nikhil-Mundhra/blob/main/app.mjs

## Annotations / References Used

1. [Passport.js authentication docs](http://passportjs.org/docs)  
  * Used in `app.mjs` for configuring `passport` and `passport.session()` middleware:
      https://github.com/nyu-csci-ua-0467-001-002-fall-2025/final-project-Nikhil-Mundhra/blob/1ba40e7b291cace2c7bd12e603f8834b80509d0f/app.mjs#L72
  * In `routes/auth.mjs` for the `/signup` and `/login` route handlers that call `passport.authenticate(...)`.
      https://github.com/nyu-csci-ua-0467-001-002-fall-2025/final-project-Nikhil-Mundhra/blob/1ba40e7b291cace2c7bd12e603f8834b80509d0f/routes/auth.mjs#L109
  * In `routes/passport.mjs` to `serializeUser` and `deserializeUser`.
   https://github.com/nyu-csci-ua-0467-001-002-fall-2025/final-project-Nikhil-Mundhra/blob/1ba40e7b291cace2c7bd12e603f8834b80509d0f/routes/passport.mjs#L57

2. [Vue.js 3 Guide](https://vuejs.org/guide/introduction.html)  
   Used in `public/js/dashboard.js` inside `bootstrapVueDashboard()` and the `DashboardApp` `createApp({...})` call that hydrates `#dashboard-app` and controls `quickaddExpanded` and `drawerOpen`.
   https://github.com/nyu-csci-ua-0467-001-002-fall-2025/final-project-Nikhil-Mundhra/blob/1ba40e7b291cace2c7bd12e603f8834b80509d0f/public/js/dashboard.js#L34
   https://github.com/nyu-csci-ua-0467-001-002-fall-2025/final-project-Nikhil-Mundhra/blob/1ba40e7b291cace2c7bd12e603f8834b80509d0f/public/js/dashboard.js#L49

3. [Parsley.js Documentation](https://parsleyjs.org/doc/)  
  * Used in `views/layout.hbs` to include the Parsley CDN script and 
    https://github.com/nyu-csci-ua-0467-001-002-fall-2025/final-project-Nikhil-Mundhra/blob/1ba40e7b291cace2c7bd12e603f8834b80509d0f/views/layout.hbs#L14
  * In `views/dashboard.hbs` on the quick add task form with attributes such as `data-parsley-notblank`, `data-parsley-maxlength`, and `data-parsley-notpast`.
    https://github.com/nyu-csci-ua-0467-001-002-fall-2025/final-project-Nikhil-Mundhra/blob/1ba40e7b291cace2c7bd12e603f8834b80509d0f/views/dashboard.hbs#L113
   

4. [Socket.IO Client API](https://socket.io/docs/v4/client-api/)  
  Used in `public/js/dashboard.js`:
   https://github.com/nyu-csci-ua-0467-001-002-fall-2025/final-project-Nikhil-Mundhra/blob/1ba40e7b291cace2c7bd12e603f8834b80509d0f/public/js/dashboard.js#L110
  - `socket.on('list:updated')`, `socket.on('list:deleted')`, and `socket.on('task:deleted')` keep lists and tasks in sync:
   https://github.com/nyu-csci-ua-0467-001-002-fall-2025/final-project-Nikhil-Mundhra/blob/1ba40e7b291cace2c7bd12e603f8834b80509d0f/public/js/dashboard.js#L579


5. [MDN Web Docs: Fetch API](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API)  
  * Used in `public/js/dashboard.js` in helper functions such as:
   https://github.com/nyu-csci-ua-0467-001-002-fall-2025/final-project-Nikhil-Mundhra/blob/1ba40e7b291cace2c7bd12e603f8834b80509d0f/public/js/dashboard.js#L161
   https://github.com/nyu-csci-ua-0467-001-002-fall-2025/final-project-Nikhil-Mundhra/blob/1ba40e7b291cace2c7bd12e603f8834b80509d0f/public/js/dashboard.js#L118
  * Which perform `PATCH` requests to `/api/tasks/:id` and `/api/lists/:id`.

6. [MDN Web Docs: Intl.DateTimeFormat](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/DateTimeFormat)  
  * Used in `routes/dashboard.mjs` in the `router.get('/dashboard', ...)` handler:
   https://github.com/nyu-csci-ua-0467-001-002-fall-2025/final-project-Nikhil-Mundhra/blob/1ba40e7b291cace2c7bd12e603f8834b80509d0f/routes/dashboard.mjs#L26
  * Format `t.dueAt` into `dueText` when mapping Mongo tasks to `displayTasks`.
   https://github.com/nyu-csci-ua-0467-001-002-fall-2025/final-project-Nikhil-Mundhra/blob/1ba40e7b291cace2c7bd12e603f8834b80509d0f/routes/dashboard.mjs#L125

7. [Mongoose ODM Documentation](https://mongoosejs.com/docs/guide.html)  
   Used in `db.mjs` to define `User`, `Settings`, `List`, `Task`, and `Tag` schemas and in `routes/dashboard.mjs` where `List.find`, `Tag.find`, `Task.find`, and `Task.findOne` plus `.populate('tagIds').lean()` load data for the dashboard state. 
   
   (Find in https://github.com/nyu-csci-ua-0467-001-002-fall-2025/final-project-Nikhil-Mundhra/blob/main/MILESTONE_04.md#link-to-github-line-numbers-for-schemas-dbjs-or-models-folder)
