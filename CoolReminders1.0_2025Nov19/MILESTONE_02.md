# Milestone 02

## Repository Link
https://github.com/nyu-csci-ua-0467-001-002-fall-2025/final-project-Nikhil-Mundhra

---

## Special Instructions for Using Form (or Login details if auth is part of your project)
Use the demo account to log in:

- **Email/Username:** demo@example.com  
- **Password:** demo1234  

Alternatively, you can sign up for a new account directly on the site.

---

## URL for form
https://ait-final-project-nikhil-mundhra.onrender.com/login

---

## URL for form result
After logging in or signing up, you are redirected to the **Dashboard** page where forms allow you to:  
- Add a new task (`POST /tasks`)  
- Mark a task complete (`POST /tasks/:id/complete`)  
- Delete a task (`POST /tasks/:id/delete`)  

URL: https://ait-final-project-nikhil-mundhra.onrender.com/dashboard

---

## URL to GitHub that shows line of code where research topic(s) are used / implemented
- **User Authentication (bcrypt)**  
  Login + Signup routes (hash/compare):  
  `routes/auth.mjs`  
  https://github.com/nyu-csci-ua-0467-001-002-fall-2025/final-project-Nikhil-Mundhra/blob/fcc0b8ceb8e0cea400fa6394f3ab70deacc1b413/routes/auth.mjs#L75

- **Working Forms (create / complete / delete tasks)**  
  `routes/tasks.mjs`  
  https://github.com/nyu-csci-ua-0467-001-002-fall-2025/final-project-Nikhil-Mundhra/blob/e72523e748884b33babbbefdd1a4ba864344777e/routes/tasks.mjs#L9-20

- **Dashboard render (shows task list with actions)**  
  `routes/dashboard.mjs`  
  https://github.com/nyu-csci-ua-0467-001-002-fall-2025/final-project-Nikhil-Mundhra/blob/main/routes/dashboard.mjs

---

## References
- [bcryptjs documentation](https://www.npmjs.com/package/bcryptjs) — used for password hashing and comparison  
- [express-session documentation](https://www.npmjs.com/package/express-session) — session management setup  
- [connect-mongo documentation](https://www.npmjs.com/package/connect-mongo) — MongoDB session store integration  
- [Parsley.js documentation](https://parsleyjs.org/doc/) — for planned client-side validation  
- [Vue.js guide](https://vuejs.org/v2/guide/) — for planned frontend component structure in dashboard  
