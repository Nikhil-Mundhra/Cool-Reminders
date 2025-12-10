/* public/js/dashboard.js */
/* ==============================================================
   DASHBOARD INTERACTIONS (+ Vue bootstrap)
   --------------------------------------------------------------
   - Card click opens drawer (details view)
   - Title and Due click -> inline editors with auto-save
   - Subtask checkbox toggles completion
   - Socket.io: double-click list icon to rename + recolor
   - Tag color pickers send POST /tags/:id/color
   - Vue: hydrated state for tasks/lists/tags, drawer + quickadd flags
   ============================================================== */

/* ---- Vue bootstrap: hydrate initial state from server JSON ---- */

let dashboardInitialState = {
  userDisplay: '',
  tasks: [],
  lists: [],
  tags: [],
  currentListId: '',
  currentTagId: '',
};

let dashboardApp = null;
let dashboardVm = null;

/*
  bootstrapVueDashboard

  Reads the initial dashboard state from the DOM, creates the Vue
  application if Vue and the mount element are available, and exposes
  the mounted instance on window for use by the rest of the script.
*/
(function bootstrapVueDashboard() {
  const stateEl = document.getElementById('dashboard-state');
  if (stateEl && stateEl.textContent) {
    try {
      dashboardInitialState = JSON.parse(stateEl.textContent);
    } catch (e) {
      console.error('Failed to parse #dashboard-state JSON', e);
    }
  }

  /* If Vue or the mount element is missing, skip gracefully */
  if (!window.Vue || !document.getElementById('dashboard-app')) return;

  const { createApp } = window.Vue;

  dashboardApp = createApp({
    name: 'DashboardApp',
    data() {
      return {
        /* hydrated from server */
        userDisplay: dashboardInitialState.userDisplay,
        tasks: dashboardInitialState.tasks,
        lists: dashboardInitialState.lists,
        tags: dashboardInitialState.tags,
        currentListId: dashboardInitialState.currentListId,
        currentTagId: dashboardInitialState.currentTagId,

        /* local UI state */
        drawerOpen: false,
        drawerTask: null,
        quickaddExpanded: false,
      };
    },
    methods: {
      /*
        setDrawerTask

        Sets the task data used by the drawer and toggles the drawer
        open state according to whether a task is provided.
      */
      setDrawerTask(task) {
        this.drawerTask = task;
        this.drawerOpen = !!task;
      },
      /*
        setQuickaddExpanded

        Controls whether the quick add panel is expanded, based on a
        simple boolean flag coming from other UI handlers.
      */
      setQuickaddExpanded(open) {
        this.quickaddExpanded = !!open;
      },
      /*
        toggleQuickaddDetails

        Flips the quick add expanded flag so the details section is
        shown or hidden when the user toggles it.
      */
      toggleQuickaddDetails() {
        this.quickaddExpanded = !this.quickaddExpanded;
      },
    },
  });

  dashboardVm = dashboardApp.mount('#dashboard-app');

  /* expose for imperative DOM code */
  window.dashboardApp = dashboardApp;
  window.dashboardVm = dashboardVm;
})();

/* ---- existing DOM based behavior (will be migrated gradually) ---- */

document.addEventListener('DOMContentLoaded', () => {
  /* socket.io client (if available) */
  const socket = window.io ? window.io() : null;
    
  /*
    renameList

    Sends a PATCH request to update the title and color of a list and
    returns the JSON response or throws if the request fails.
  */
  async function renameList(listId, title, color) {
    const payload = { title, color };
    const res = await fetch(`/api/lists/${listId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json'
      },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      throw new Error(`list PATCH failed: ${res.status}`);
    }
    return res.json();
  }

  /* ---------- Drawer refs ---------- */
  const drawer = document.getElementById('drawer');
  const dTitle = document.getElementById('d-title');
  const dBody = document.getElementById('d-body');
  const dClose = document.getElementById('d-close');
  
  /* ---------- Helpers ---------- */
  
  /*
    esc

    Escapes a string for safe insertion into HTML by replacing the
    basic special characters with their entity forms.
  */
  const esc = (s) =>
      String(s ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
  
  /*
    patchJSON

    Performs a JSON PATCH request to the given URL and returns the
    parsed JSON body, throwing an error for any non ok status.
  */
  async function patchJSON(url, payload) {
    const res = await fetch(url, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(`PATCH ${url} -> ${res.status}`);
    return res.json();
  }
  
  /* ---------- Drawer load ---------- */
  /*
    openTask

    Loads a task by id from the drawer API, builds the drawer edit
    form markup including date and time values, shows the drawer, and
    synchronizes the Vue drawer state if present.
  */
  async function openTask(taskId) {
    try {
      const res = await fetch(`/api/tasks/${taskId}`, 
          { headers: { Accept: 'application/json' } });
      if (!res.ok) throw new Error(`http ${res.status}`);
      const t = await res.json();

      const due = t.dueAt ? new Date(t.dueAt) : null;
      const ymd = due ? due.toISOString().slice(0, 10) : '';
      const hm  = due ? due.toISOString().slice(11, 16) : '';
  
      dTitle.textContent = t.title || 'Task';
      dBody.innerHTML = `
            <!-- Drawer edit form -->
            <form id="edit-${t._id}" method="post" action="/tasks/${t._id}/update" style="display:grid; gap:.75rem;">
              <label>Title</label>
              <input name="title" value="${esc(t.title || '')}" class="input">
  
              <label>Notes</label>
              <textarea name="notes" class="input" style="min-height:110px;">${esc(
                t.notes || ''
              )}</textarea>
  
              <label>Link URL</label>
              <input name="linkUrl" value="${esc(t.links?.[0]?.url || '')}" class="input">
  
              <label>Tags (comma separated)</label>
              <input name="tags" value="${esc(t.tagsCsv || '')}" class="input">

  
              <label>Due</label>
              <div style="display:flex; gap:.5rem;">
                <input
                  type="date"
                  name="dueDate"
                  value="${ymd}"
                  class="input"
                  style="flex:1;">
                <input
                  type="time"
                  name="dueTime"
                  value="${hm}"
                  class="input"
                  style="width:9rem;">
              </div>

  
              <label>Priority</label>
              <select name="priority" class="input">
                <option value="normal" ${t.priority === 'normal' ? 'selected' : ''}>normal</option>
                <option value="high"   ${t.priority === 'high' ? 'selected' : ''}>high</option>
                <option value="low"    ${t.priority === 'low' ? 'selected' : ''}>low</option>
              </select>
  
              <div style="display:flex; gap:.5rem; margin-top:.5rem;">
                <button type="submit" class="btn btn-primary" style="flex:1;">Save</button>
                <button type="submit"
                        form="delete-${t._id}"
                        class="btn"
                        style="flex:1;">Delete</button>
              </div>
            </form>
            <form id="delete-${t._id}" method="post" action="/tasks/${t._id}/delete"></form>
          `;
      drawer.style.display = 'flex';
      drawer.classList.add('show');
      if (dashboardVm && typeof dashboardVm.setDrawerTask === 'function') {
        dashboardVm.setDrawerTask(t);
      }
    } catch (e) {
      console.error('drawer open failed', e);
      alert('Could not load task details');
    }
  }
  
  /*
    dClose click handler

    Hides the drawer and resets the Vue drawer task when the close
    button is pressed.
  */
  dClose?.addEventListener('click', () => {
    drawer.classList.remove('show');
    drawer.style.display = 'none';

    if (dashboardVm && typeof dashboardVm.setDrawerTask === 'function') {
      dashboardVm.setDrawerTask(null);
    }
  });
  
  /* ---------- Card click -> drawer ---------- */
  /*
    Global click handler

    Opens the drawer when the user clicks on a task card background,
    while ignoring clicks on inputs, buttons, links, and form elements.
  */
  document.body.addEventListener('click', (e) => {
    if (
      e.target.closest('form') ||
      e.target.closest('button') ||
      e.target.closest('a') ||
      e.target.closest('input') ||
      e.target.closest('textarea') ||
      e.target.closest('select')
    ) {
      return;
    }
  
    /* open drawer when card background is clicked */
    const note = e.target.closest('.note');
    if (note) {
      const id = note.getAttribute('data-task-id');
      if (id) openTask(id);
    }
  });
  
  /* ---------- Inline edit: TITLE ---------- */
  /*
    Title inline edit handler

    Replaces the title element with an input, sends a PATCH when the
    value changes, and restores a button element with the updated text.
  */
  document.body.addEventListener('click', (e) => {
    const tBtn = e.target.closest('.js-edit-title');
    if (!tBtn) return;
  
    e.stopPropagation();
  
    const note = tBtn.closest('.note');
    const id = note.getAttribute('data-task-id');
    const initial = tBtn.textContent.trim();
  
    /* swap button -> input */
    const input = document.createElement('input');
    input.type = 'text';
    input.value = initial;
    input.className = 'input';
    input.style.margin = '2px 0';
    tBtn.replaceWith(input);
    input.focus();
    input.setSelectionRange(input.value.length, input.value.length);
  
    const save = async () => {
      const title = input.value.trim();
      if (title === initial) {
        input.replaceWith(tBtn);
        tBtn.textContent = title || initial;
        return;
      }
      try {
        await patchJSON(`/api/tasks/${id}`, { title });
        /* re render title button */
        const newBtn = tBtn.cloneNode(true);
        newBtn.textContent = title || '(untitled)';
        input.replaceWith(newBtn);
      } catch (err) {
        console.error('title save failed', err);
        input.replaceWith(tBtn);
      }
    };
  
    input.addEventListener('keydown', (ev) => {
      if (ev.key === 'Enter') {
        ev.preventDefault();
        save();
      }
      if (ev.key === 'Escape') {
        ev.preventDefault();
        input.replaceWith(tBtn);
      }
    });
    input.addEventListener('blur', save);
  });
  
  /* ---------- Inline edit: DUE DATE ---------- */
  /*
    Due date inline edit handler

    Turns the due date display into a datetime local input, converts
    between stored ISO time and local time, and saves a new dueAt
    value through the PATCH API when the user changes the input.
  */
  document.body.addEventListener('click', (e) => {
    const dueBtn = e.target.closest('.js-edit-due');
    if (!dueBtn) return;

    e.stopPropagation();

    const note = dueBtn.closest('.note');
    const id = note.getAttribute('data-task-id');
    const iso = dueBtn.getAttribute('data-current') || '';
    const base = iso ? new Date(iso) : null;

    /* convert stored ISO to local datetime local string */
    let localValue = '';
    if (base) {
      const local = new Date(base.getTime() - base.getTimezoneOffset() * 60000);
      localValue = local.toISOString().slice(0, 16); /* yyyy-mm-ddThh:mm */
    }

    const input = document.createElement('input');
    input.type = 'datetime-local';
    input.value = localValue;
    input.className = 'input';
    input.style.padding = '2px 6px';
    dueBtn.replaceWith(input);
    input.showPicker?.();
    input.focus();

    const commit = async () => {
      const value = input.value || null;
      try {
        await patchJSON(`/api/tasks/${id}`, { dueAt: value });

        const newBtn = document.createElement('button');
        newBtn.type = 'button';
        newBtn.className = 'js-edit-due';
        newBtn.setAttribute('data-field', 'dueAt');
        newBtn.style.all = 'unset';
        newBtn.style.cursor = 'text';

        let isoOut = '';
        let textOut = 'No due date';
        if (value) {
          const dt = new Date(value);
          isoOut = dt.toISOString();
          textOut = dt.toLocaleString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
          });
        }

        newBtn.setAttribute('data-current', isoOut);
        const time = document.createElement('time');
        time.dateTime = isoOut;
        time.textContent = textOut;

        newBtn.appendChild(time);
        input.replaceWith(newBtn);
      } catch (err) {
        console.error('due save failed', err);
        input.replaceWith(dueBtn);
      }
    };

    input.addEventListener('change', commit);
    input.addEventListener('blur', commit);
    input.addEventListener('keydown', (ev) => {
      if (ev.key === 'Escape') input.replaceWith(dueBtn);
    });
  });
  
  /* ---------- Subtask toggle + tag color picker ---------- */
  /*
    Change handler

    Handles both subtask completion toggles and tag color picker
    changes, sending PATCH requests and updating the related UI
    elements when tag colors are updated.
  */
  document.body.addEventListener('change', async (e) => {
    const box = e.target.closest('.js-toggle-subtask');
    if (box) {
      e.stopPropagation();
      const subId = box.getAttribute('data-subtask');
      try {
        await patchJSON(`/api/tasks/${subId}`, { completed: box.checked });
      } catch (err) {
        console.error('subtask toggle failed', err);
        box.checked = !box.checked;
      }
      return;
    }
  
    const picker = e.target.closest('.tag-color-picker');
    if (picker) {
      const tagId = picker.getAttribute('data-tag-id');
      const color = picker.value;
      try {
        const res = await fetch(`/api/tags/${tagId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({ color }),
        });          
        if (!res.ok) throw new Error('tag color save failed');
        const data = await res.json();
        const newColor = data.tag?.color || color;
  
        /* update filter button left border */
        document
          .querySelectorAll(`button[data-tag-filter-id="${tagId}"]`)
          .forEach((btn) => {
            btn.style.borderLeft = `6px solid ${newColor}`;
          });
  
        /* update tag pills on cards */
        document
          .querySelectorAll(`.tag-pill[data-tag-id="${tagId}"]`)
          .forEach((pill) => {
            pill.style.background = newColor;
          });
  
        /* sync all pickers with same id */
        document
          .querySelectorAll(`.tag-color-picker[data-tag-id="${tagId}"]`)
          .forEach((p) => {
            p.value = newColor;
          });
      } catch (err) {
        console.error(err);
      }
    }
  });
  
  /* ---------- Double click list icon to edit (REST write) ---------- */
  /*
    List rename handler

    Lets the user rename and recolor a list by double clicking its
    icon or button, then calling renameList to persist the changes.
  */
  document.body.addEventListener('dblclick', (e) => {
    /* allow double click on the dot OR the whole list button */
    const icon = e.target.closest('.list-icon');
    const btn = e.target.closest('.list-button');
    const target = icon || btn;
    if (!target) return;
  
    e.preventDefault();
    e.stopPropagation();
  
    /* always derive metadata from the icon element */
    const sourceIcon = icon || target.querySelector('.list-icon');
    if (!sourceIcon) return;
  
    const listId = sourceIcon.getAttribute('data-list-id');
    const currentTitle = sourceIcon.getAttribute('data-list-title') || '';
    const currentColor = sourceIcon.getAttribute('data-list-color') || '#dfe6e9';

    const newTitle = window.prompt('List name', currentTitle);
    if (!newTitle) return;
  
    const newColor =
      window.prompt('List color (hex, like #dfe6e9)', currentColor) || currentColor;
  
    /* write through REST; Socket.IO will broadcast list:updated */
    renameList(listId, newTitle, newColor).catch((err) => {
      console.error(err);
      alert('Could not rename list');
    });
  });    

  /* ---------- Socket listeners: live sync across tabs ---------- */
  /*
    Socket event wiring

    Listens for list and task events as well as logout events from
    the server and updates the DOM or redirects the page so that
    multiple tabs stay in sync.
  */
  if (socket) {
    socket.on('list:updated', (list) => {
      const id = list.id;
      const title = list.title;
      const color = list.color;
  
      document
        .querySelectorAll(`.list-icon[data-list-id="${id}"]`)
        .forEach((icon) => {
          icon.setAttribute('data-list-title', title);
          icon.setAttribute('data-list-color', color);

          const btn = icon.closest('.list-button');
          if (btn) {
            btn.style.background = color;
            btn.style.borderColor = color;
          }
  
          const titleSpan = icon.parentElement.querySelector('.list-title');
          if (titleSpan) titleSpan.textContent = title;
        });
    });
  
    socket.on('list:deleted', (payload) => {
      const id = payload.id;
      document
        .querySelectorAll(`.list-icon[data-list-id="${id}"]`)
        .forEach((icon) => {
          const li = icon.closest('li');
          if (li && li.parentElement) {
            li.parentElement.removeChild(li);
          }
        });
    });
  
    socket.on('task:deleted', ({ id }) => {
      const note = document.querySelector(`.note[data-task-id="${id}"]`);
      if (note) {
        note.remove();
      }
    });
  
    /* optional: debug log for task created and updated */
    socket.on('task:created', (t) => {
      console.log('task:created', t);
    });
  
    socket.on('task:updated', (t) => {
      console.log('task:updated', t);
    });
  
    socket.on('user:logout', () => {
      /* if another tab logs out, bounce this tab to login */
      window.location.href = '/login';
    });

    /*
      Quick add toggler

      Keeps all quick add fields collapsed except the title by
      default and toggles the details region when the user presses
      the expand control.
    */
    const qaToggle = document.querySelector('.quickadd-details-toggle');
    const qaDetails = document.getElementById('quickadd-details');

    if (qaToggle && qaDetails) {
      qaToggle.addEventListener('click', () => {
        const expanded = qaToggle.getAttribute('aria-expanded') === 'true';
        const next = !expanded;
        qaToggle.setAttribute('aria-expanded', String(next));
        qaDetails.hidden = !next;
      });

      /* start collapsed (everything except title hidden) */
      qaToggle.setAttribute('aria-expanded', 'false');
      qaDetails.hidden = true;
    }
  }    

  /* ---------- Tag rename on double click (pills and filters) ---------- */
  /*
    Tag rename handler

    Lets users rename a tag by double clicking either a tag pill on a
    card or a tag filter button, sends a PATCH to the tag API, and
    updates every pill and filter button text for that tag id.
  */
  document.body.addEventListener('dblclick', async (e) => {
    const pill = e.target.closest('.tag-pill');
    const filterBtn = e.target.closest('button[data-tag-filter-id]');
    const targetEl = pill || filterBtn;
    if (!targetEl) return;

    e.preventDefault();
    e.stopPropagation();

    const tagId = pill
      ? pill.getAttribute('data-tag-id')
      : filterBtn.getAttribute('data-tag-filter-id');

    const currentName = pill
      ? pill.textContent.trim()
      : (filterBtn.querySelector('.list-title')?.textContent.trim() || '');

    const newName = window.prompt('Tag name', currentName);
    if (!newName || newName.trim() === currentName) return;

    try {
      const res = await fetch(`/api/tags/${tagId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ name: newName.trim() }),
      });
      if (!res.ok) throw new Error('tag rename failed');

      const data = await res.json();
      const updatedName = data.tag?.name || newName.trim();

      /* update all tag pills */
      document
        .querySelectorAll(`.tag-pill[data-tag-id="${tagId}"]`)
        .forEach((el) => {
          el.textContent = updatedName;
        });

      /* update all tag filter buttons */
      document
        .querySelectorAll(`button[data-tag-filter-id="${tagId}"]`)
        .forEach((btn) => {
          const span = btn.querySelector('.list-title');
          if (span) span.textContent = updatedName;
        });
    } catch (err) {
      console.error(err);
      alert('Could not rename tag');
    }
  });
});
