Milestone 04 - Final Project Documentation
===

NetID
---
nm4358

Name
---
Nikhil Mundhra

Repository Link
---
https://github.com/nyu-csci-ua-0467-001-002-fall-2025/final-project-Nikhil-Mundhra

URL for deployed site 
---
https://ait-final-project-nikhil-mundhra.onrender.com/

URL for form 1 (from previous milestone) 
---
https://ait-final-project-nikhil-mundhra.onrender.com/signup

Special Instructions for Form 1
---
The form consists of three fields. The password must be at least eight characters. If it is shorter, the form will submit but the server will not create an account and instead show an inline error message on the same page.

URL for form 2 (for current milestone)
---
https://ait-final-project-nikhil-mundhra.onrender.com/dashboard

Special Instructions for Form 2
---
Clicking on the link above may redirect you to `/login` if you are not already signed in.  
You can either create an account with the signup form or use the “Continue as Guest” option on the login page to explore the dashboard.  
On the dashboard quick add form, only the “Title” field is required. The remaining fields (notes, link, tags, due date and time, priority) are optional and are hidden in a collapsible “More options” section. After you submit, the new task appears as a sticky note card just below the form. Clicking on the card opens the task detail form in a right side drawer where you can edit fields or delete the task.

URL for form 3 (from previous milestone) 
---
https://ait-final-project-nikhil-mundhra.onrender.com/settings/profile

Special Instructions for Form 3
---
This page requires you to be logged in. Use the signup form to create an account or log in as an existing user, then navigate to Settings → Profile or visit `/settings/profile` directly.  

The profile form lets you update display name and email and change your password. 
Changing the password requires filling the current password and matching new password fields. 
Client side validation will prevent submit until the required fields are valid and the new passwords match.

First link to github line number(s) for constructor, HOF, etc.
---
`routes/dashboard.mjs`  
Array higher order function `map` used to transform raw Mongo `Task` documents into plain `displayTasks` for the dashboard, including tag and subtask preview objects.  
https://github.com/nyu-csci-ua-0467-001-002-fall-2025/final-project-Nikhil-Mundhra/blob/c7831927fd614d8d995031838bd4481cc0ef976f/routes/dashboard.mjs#L71
https://github.com/nyu-csci-ua-0467-001-002-fall-2025/final-project-Nikhil-Mundhra/blob/c7831927fd614d8d995031838bd4481cc0ef976f/routes/dashboard.mjs#L89
https://github.com/nyu-csci-ua-0467-001-002-fall-2025/final-project-Nikhil-Mundhra/blob/c7831927fd614d8d995031838bd4481cc0ef976f/routes/dashboard.mjs#L144

Second link to github line number(s) for constructor, HOF, etc.
---
`public/js/dashboard.js`  
Array higher order functions `forEach` and `map` used to attach event listeners to NodeLists (for tag color pickers, list icons, and tag pills) and to transform fetched JSON into the Vue dashboard state.  
https://github.com/nyu-csci-ua-0467-001-002-fall-2025/final-project-Nikhil-Mundhra/blob/75ced9f197d58603a7486854a39745c5673e9825/public/js/dashboard.js#L474
https://github.com/nyu-csci-ua-0467-001-002-fall-2025/final-project-Nikhil-Mundhra/blob/75ced9f197d58603a7486854a39745c5673e9825/public/js/dashboard.js#L481
https://github.com/nyu-csci-ua-0467-001-002-fall-2025/final-project-Nikhil-Mundhra/blob/75ced9f197d58603a7486854a39745c5673e9825/public/js/dashboard.js#L488


Short description for links above
---
1. `routes/dashboard.mjs` uses `tasks.map((t) => { ... })` and `tagsDocs.map((tag) => { ... })` to build the view model objects that get passed into Handlebars and the Vue bootstrap JSON, which is a textbook example of using `map` as a higher order function to transform arrays of documents into arrays of plain objects.

2. `public/js/dashboard.js` uses `querySelectorAll(...).forEach((el) => { ... })` to iterate over dynamic DOM node lists and attach listeners, and also uses small helper functions plus `Array.prototype.forEach` to keep tag colors, list titles, and task cards in sync after AJAX and Socket.IO events.

Link to github line number(s) for schemas (db.js or models folder)
---
`db.mjs`  
Schemas for `User`, `Settings`, `List`, `Task`, `Tag`, etc, are defined here using Mongoose, including relationships such as `Task` referencing `listId`, `userId`, and `tagIds`.  

https://github.com/nyu-csci-ua-0467-001-002-fall-2025/final-project-Nikhil-Mundhra/blob/f77b7ef088c573e47e2468d9ee0299408ff4adc6/db.mjs#L71
https://github.com/nyu-csci-ua-0467-001-002-fall-2025/final-project-Nikhil-Mundhra/blob/f77b7ef088c573e47e2468d9ee0299408ff4adc6/db.mjs#L92
https://github.com/nyu-csci-ua-0467-001-002-fall-2025/final-project-Nikhil-Mundhra/blob/f77b7ef088c573e47e2468d9ee0299408ff4adc6/db.mjs#L109
https://github.com/nyu-csci-ua-0467-001-002-fall-2025/final-project-Nikhil-Mundhra/blob/f77b7ef088c573e47e2468d9ee0299408ff4adc6/db.mjs#L154
https://github.com/nyu-csci-ua-0467-001-002-fall-2025/final-project-Nikhil-Mundhra/blob/f77b7ef088c573e47e2468d9ee0299408ff4adc6/db.mjs#L166
https://github.com/nyu-csci-ua-0467-001-002-fall-2025/final-project-Nikhil-Mundhra/blob/f77b7ef088c573e47e2468d9ee0299408ff4adc6/db.mjs#L181
https://github.com/nyu-csci-ua-0467-001-002-fall-2025/final-project-Nikhil-Mundhra/blob/f77b7ef088c573e47e2468d9ee0299408ff4adc6/db.mjs#L208

https://github.com/nyu-csci-ua-0467-001-002-fall-2025/final-project-Nikhil-Mundhra/blob/main/db.mjs

Description of research topics above with points
---
1. **User authentication with Passport and bcrypt (3 points)**  
   Cool Reminders uses Passport’s local strategy together with bcrypt for secure authentication. Passport is configured in an auth configuration module and wired into `app.mjs` with `passport.initialize()` and `passport.session()` middleware. 

   Login and signup routes in `routes/auth.mjs` delegate credential checking to `passport.authenticate('local')`, which looks up the user, compares the submitted password against a bcrypt hash stored in MongoDB, and then calls `req.logIn(user, ...)` on success. 

   Sessions are stored in MongoDB via `connect-mongo`, and cookies are configured with `httpOnly`, `sameSite: 'lax'`, and `secure` in production so that `req.user` and `req.session.user` stay in sync and are safe to use in templates and `requireAuth`.

2. **Parsley.js client side validation (4 points)**  
   Cool Reminders integrates Parsley.js to validate forms on the client before they reach the server. Parsley is loaded globally in `views/layout.hbs` and automatically attaches to any form that includes `data-validate="true"`. 

   The signup and login forms validate usernames, emails, and password length with attributes such as `data-parsley-notblank`, `data-parsley-type="email"`, and `data-parsley-minlength`. The dashboard quick add form uses Parsley to ensure that titles are not blank and employs a custom `notpast` validator to avoid obviously past due dates. The settings profile form at `/settings/profile` uses Parsley to validate email format and to ensure that new passwords match via `data-parsley-equalto`, with errors rendered inline in a style that matches the app’s existing alerts.

3. **Vue.js integration for dashboard state and interactions (4 points)**  
   Vue.js is used to progressively enhance the dashboard while preserving the existing Handlebars templates, routes, and server logic. 
   
   The server builds a dashboardState object in routes/dashboard.mjs (containing tasks, lists, tags, and the current filters) and injects it into the page as JSON, which the Vue app in public/js/dashboard.js reads and uses as its initial reactive state. 
   
   A small Vue root mounted on #dashboard-app tracks UI specific flags such as drawerOpen, drawerTask, and quickaddExpanded, and drives template bindings for the collapsible quick add area (controlling aria-expanded, the chevron, and v-show). 
   
   Existing imperative behaviors like the task drawer, inline title edits, and due date updates still use fetch and DOM listeners, but they now call into window.dashboardVm where appropriate so that state can be migrated into Vue over time. 
   
   This structure shows that Vue is not just included, but used as a real state container and interaction layer that can scale to more components while keeping current functionality and styling intact.

Links to github line number(s) for research topics described above (one link per line)
---
(TODO: add link to github line number(s), one per line for research topics ... for example, if using auth/passport, link to auth.js or where bulk of auth code is)

1. **User authentication with Passport and bcrypt**  

Passport local strategy, bcrypt verification, serialization, and deserialization.
routes/passport.mjs:8-67
https://github.com/nyu-csci-ua-0467-001-002-fall-2025/final-project-Nikhil-Mundhra/blob/f8b10215c510462420b79c3b0a4d843c68ee4667/routes/passport.mjs#L8
routes/auth.mjs:99-163
https://github.com/nyu-csci-ua-0467-001-002-fall-2025/final-project-Nikhil-Mundhra/blob/2948c8dc9438b937d5e0055570a864df2c8401df/routes/auth.mjs#L99
routes/auth.mjs:292-318
https://github.com/nyu-csci-ua-0467-001-002-fall-2025/final-project-Nikhil-Mundhra/blob/2948c8dc9438b937d5e0055570a864df2c8401df/routes/auth.mjs#L292
app.mjs:43-75
https://github.com/nyu-csci-ua-0467-001-002-fall-2025/final-project-Nikhil-Mundhra/blob/f8b10215c510462420b79c3b0a4d843c68ee4667/app.mjs#L51

2. **Parsley.js client side validation**  

Parsley (global)
https://github.com/nyu-csci-ua-0467-001-002-fall-2025/final-project-Nikhil-Mundhra/blob/2948c8dc9438b937d5e0055570a864df2c8401df/views/layout.hbs#L14

"date not in the past" validator (layout.hbs#L26-35)
https://github.com/nyu-csci-ua-0467-001-002-fall-2025/final-project-Nikhil-Mundhra/blob/2948c8dc9438b937d5e0055570a864df2c8401df/views/layout.hbs#L26-35

Signup form with Parsley (signup.hbs#L35-80)
https://github.com/nyu-csci-ua-0467-001-002-fall-2025/final-project-Nikhil-Mundhra/blob/2948c8dc9438b937d5e0055570a864df2c8401df/views/signup.hbs#L35
https://github.com/nyu-csci-ua-0467-001-002-fall-2025/final-project-Nikhil-Mundhra/blob/2948c8dc9438b937d5e0055570a864df2c8401df/views/signup.hbs#L38

Tasks Add Form (dashboard.hbs#L97-159)
https://github.com/nyu-csci-ua-0467-001-002-fall-2025/final-project-Nikhil-Mundhra/blob/57b832b73cef95005a21ccb2f98d3c2243634f92/views/dashboard.hbs#L99

3. **Vue.js integration for dashboard state and interactions**  

Vue 3 (global build, used on Dashboard)
https://github.com/nyu-csci-ua-0467-001-002-fall-2025/final-project-Nikhil-Mundhra/blob/2948c8dc9438b937d5e0055570a864df2c8401df/views/layout.hbs#L43

routes/dashboard.mjs:155-176
https://github.com/nyu-csci-ua-0467-001-002-fall-2025/final-project-Nikhil-Mundhra/blob/2948c8dc9438b937d5e0055570a864df2c8401df/routes/dashboard.mjs#L155
https://github.com/nyu-csci-ua-0467-001-002-fall-2025/final-project-Nikhil-Mundhra/blob/2948c8dc9438b937d5e0055570a864df2c8401df/routes/dashboard.mjs#L156

public/js/dashboard.js:15-104
https://github.com/nyu-csci-ua-0467-001-002-fall-2025/final-project-Nikhil-Mundhra/blob/2948c8dc9438b937d5e0055570a864df2c8401df/public/js/dashboard.js#L15
* If Vue or the mount element is missing, skips
https://github.com/nyu-csci-ua-0467-001-002-fall-2025/final-project-Nikhil-Mundhra/blob/2948c8dc9438b937d5e0055570a864df2c8401df/public/js/dashboard.js#L45
* Extract the createApp function from the global Vue
https://github.com/nyu-csci-ua-0467-001-002-fall-2025/final-project-Nikhil-Mundhra/blob/2948c8dc9438b937d5e0055570a864df2c8401df/public/js/dashboard.js#L47
* Create Vue app instance
https://github.com/nyu-csci-ua-0467-001-002-fall-2025/final-project-Nikhil-Mundhra/blob/2948c8dc9438b937d5e0055570a864df2c8401df/public/js/dashboard.js#L49
https://github.com/nyu-csci-ua-0467-001-002-fall-2025/final-project-Nikhil-Mundhra/blob/2948c8dc9438b937d5e0055570a864df2c8401df/public/js/dashboard.js#L99
https://github.com/nyu-csci-ua-0467-001-002-fall-2025/final-project-Nikhil-Mundhra/blob/2948c8dc9438b937d5e0055570a864df2c8401df/public/js/dashboard.js#L102
https://github.com/nyu-csci-ua-0467-001-002-fall-2025/final-project-Nikhil-Mundhra/blob/2948c8dc9438b937d5e0055570a864df2c8401df/public/js/dashboard.js#L103


Optional project notes 
--- 

Sign up at /signup, then log in at / to access the dashboard. 

Use the quick add form to create tasks and the sidebar (by clicking on the created task) to switch lists and apply tag filters. 

Open the Settings pages (/settings/profile, /settings/layout, /settings/notifications) to change your display name, layout preferences, theme, and reminder options.

There are a few functional tests inside here as demos on usage:

https://github.com/nyu-csci-ua-0467-001-002-fall-2025/final-project-Nikhil-Mundhra/blob/main/documentation/Testing


Attributions
---

* routes/auth.mjs - Passport local authentication flow adapted from Passport username/password example - https://www.passportjs.org/concepts/authentication/password/

* views/layout.hbs - Parsley.js data attributes and error markup based on AIT Parsley demo form - http://cs.nyu.edu/~jversoza/ait-final/my-form

* public/js/dashboard.js - Parsley data-parsley-* usage informed by Parsley official documentation - https://parsleyjs.org/doc/

* public/js/dashboard.js - Vue createApp initialization and reactive state pattern inspired by Vue 3 application guide - https://vuejs.org/guide/essentials/application.html

* routes/dashboard.mjs & public/js/dashboard.js - Socket.IO event broadcast/listen pattern based on Socket.IO v4 documentation - https://socket.io/docs/v4/

* public/javascripts/hello.js - XHR JSON loading pattern based on MDN “Using XMLHttpRequest” examples - https://developer.mozilla.org/en-US/docs/Web/API/XMLHttpRequest/Using_XMLHttpRequest