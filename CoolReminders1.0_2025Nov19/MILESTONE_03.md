Milestone 03
===

Repository Link
---
https://github.com/nyu-csci-ua-0467-001-002-fall-2025/final-project-Nikhil-Mundhra

URL for form 1 (from previous milestone) 
---
The form in /login (milestone 2) also works, but this is more relevant:

https://ait-final-project-nikhil-mundhra.onrender.com/signup

Special Instructions for Form 1
---
The form consists of 3 fields, the password must be 8 characters otherwise it will submit but won't make an account. It will throw a message instead.

URL for form 2 (for current milestone)
---

https://ait-final-project-nikhil-mundhra.onrender.com/dashboard

Special Instructions for Form 2
---
Clicking on the link above may redirect you to the /login page if you're not logged in. 
Ways to bypass this would be to select the "Continue as Guest" option or make an account (form 1). 
Only the "Title" is required in this form, the rest is optional. Once it submits, the page will show the task right below the form. Then to edit, you may click anywhere on the task itself and a form view will open on its right. 

## URL(s) to github repository with commits that show progress on research
--- 

**User Authentication (Auth middleware)**  
Auth middleware (JSON-aware) used to protect Task routes:  
  `routes/helpers.mjs`  
https://github.com/nyu-csci-ua-0467-001-002-fall-2025/final-project-Nikhil-Mundhra/blob/e65ec8367479c23ce7cf67a689d68956ceda7c8a/routes/helpers.mjs#L9

 Middleware Usage:
 `routes/tasks.mjs` 
https://github.com/nyu-csci-ua-0467-001-002-fall-2025/final-project-Nikhil-Mundhra/blob/e65ec8367479c23ce7cf67a689d68956ceda7c8a/routes/tasks.mjs#L37
https://github.com/nyu-csci-ua-0467-001-002-fall-2025/final-project-Nikhil-Mundhra/blob/e65ec8367479c23ce7cf67a689d68956ceda7c8a/routes/tasks.mjs#L80
https://github.com/nyu-csci-ua-0467-001-002-fall-2025/final-project-Nikhil-Mundhra/blob/e65ec8367479c23ce7cf67a689d68956ceda7c8a/routes/tasks.mjs#L111
https://github.com/nyu-csci-ua-0467-001-002-fall-2025/final-project-Nikhil-Mundhra/blob/e65ec8367479c23ce7cf67a689d68956ceda7c8a/routes/tasks.mjs#L170
https://github.com/nyu-csci-ua-0467-001-002-fall-2025/final-project-Nikhil-Mundhra/blob/e65ec8367479c23ce7cf67a689d68956ceda7c8a/routes/tasks.mjs#L226

**Client-side form validation with Parsley.js**

 Attaches Parsley to any form that opts in:
 `views/layout.hbs` 
https://github.com/nyu-csci-ua-0467-001-002-fall-2025/final-project-Nikhil-Mundhra/blob/e65ec8367479c23ce7cf67a689d68956ceda7c8a/views/layout.hbs#L13

```html
<script src="https://cdn.jsdelivr.net/npm/parsleyjs@2/dist/parsley.min.js"></script>
    <script>
      /* attach Parsley to any form that opts in */
      document.addEventListener('DOMContentLoaded', function () {
        var forms = document.querySelectorAll('form[data-validate="true"]');
        if (window.Parsley && forms.length) {
          window.Parsley.addValidator('notblank', {
            validateString: function (value) { return value.trim().length > 0; },
            messages: { en: 'Required' }
          });
          Array.prototype.forEach.call(forms, function (f) { f.parsley(); });
        }
      });
    </script>
```
References 
---
(links to annotated lines of code in github repository that were based off of tutorials / articles / sample projects)

**AJAX**
* An AJAX request: 
`routes/dashboard.mjs`
https://github.com/nyu-csci-ua-0467-001-002-fall-2025/final-project-Nikhil-Mundhra/blob/e29290e7b94ea9e8034f609d1131281a7247ec59/public/js/dashboard.js#L43
* Updating the UI without reloading: 
https://github.com/nyu-csci-ua-0467-001-002-fall-2025/final-project-Nikhil-Mundhra/blob/e29290e7b94ea9e8034f609d1131281a7247ec59/public/js/dashboard.js#L76

**Bcrypt**  
* Login + Signup routes (hash/compare):  
`routes/auth.mjs`
https://github.com/nyu-csci-ua-0467-001-002-fall-2025/final-project-Nikhil-Mundhra/blob/b60b644041218f8456109bf19ed2f9858e3a3f1e/routes/auth.mjs#L70
https://github.com/nyu-csci-ua-0467-001-002-fall-2025/final-project-Nikhil-Mundhra/blob/b60b644041218f8456109bf19ed2f9858e3a3f1e/routes/auth.mjs#L99
https://github.com/nyu-csci-ua-0467-001-002-fall-2025/final-project-Nikhil-Mundhra/blob/b60b644041218f8456109bf19ed2f9858e3a3f1e/routes/auth.mjs#L155