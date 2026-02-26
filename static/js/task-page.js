/**
 * Task detail standalone page (task.html) — JIRA-style ticket view.
 */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var state = { user: null, profile: null, task: null, staff: [] };
  var STATUS_OPTIONS = [
    { value: 'todo', label: 'To Do' },
    { value: 'in_progress', label: 'In Progress' },
    { value: 'done', label: 'Done' }
  ];
  var PRIORITY_OPTIONS = [
    { value: 'high', label: 'High', icon: 'fa-arrow-up' },
    { value: 'medium', label: 'Medium', icon: 'fa-minus' },
    { value: 'low', label: 'Low', icon: 'fa-arrow-down' }
  ];

  function esc(s) { var d = document.createElement('div'); d.textContent = s == null ? '' : s; return d.innerHTML; }
  function getState() { return state; }
  function toast(msg) {
    var el = $('toast'); if (!el) return;
    el.textContent = msg;
    el.setAttribute('data-show', 'true');
    setTimeout(function () { el.setAttribute('data-show', 'false'); }, 3000);
  }
  function navigate(page) {
    if (page === 'tasks' || page === 'dashboard') window.location.href = '/index.html?page=' + (page || 'tasks');
    else window.location.href = '/index.html';
  }
  function openTask(id) {
    if (id) window.location.href = '/task.html?id=' + encodeURIComponent(id);
  }
  function openPatient(id) {
    if (id) window.location.href = '/patient.html?id=' + encodeURIComponent(id);
  }

  window.CareTrack = {
    getState: getState,
    toast: toast,
    navigate: navigate,
    openTask: openTask,
    openPatient: openPatient
  };

  function hideLoading() {
    var el = $('loading-screen');
    if (el) el.classList.add('hidden');
  }

  function showApp() {
    $('task-app').removeAttribute('hidden');
    hideLoading();
  }

  function renderTaskDetail() {
    var root = $('task-detail-root');
    var t = state.task;
    if (!root || !t) return;

    var statusLabel = (STATUS_OPTIONS.filter(function (s) { return s.value === t.status; })[0] || {}).label || t.status;
    var priorityLabel = (PRIORITY_OPTIONS.filter(function (p) { return p.value === (t.priority || 'medium'); })[0] || {}).label || 'Medium';
    var priorityIcon = (PRIORITY_OPTIONS.filter(function (p) { return p.value === (t.priority || 'medium'); })[0] || {}).icon || 'fa-minus';

    var patientLink = '';
    if (t.clientId && t.clientName) {
      patientLink = '<a href="/patient.html?id=' + esc(t.clientId) + '" class="task-detail-link"><i class="fas fa-hospital-user"></i> ' + esc(t.clientName) + '</a>';
    } else {
      patientLink = '<span class="text-muted">—</span>';
    }

    var createdStr = t.createdAt ? new Date(t.createdAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';

    root.innerHTML =
      '<div class="task-detail-card">' +
        '<div class="task-detail-header">' +
          '<span class="task-detail-key">' + esc(t.key || t.id) + '</span>' +
          '<span class="task-detail-priority priority-' + (t.priority || 'medium') + '"><i class="fas ' + priorityIcon + '"></i> ' + esc(priorityLabel) + '</span>' +
        '</div>' +
        '<h1 class="task-detail-title" id="task-detail-title">' + esc(t.title || 'Untitled') + '</h1>' +
        '<div class="task-detail-meta-row">' +
          '<div class="task-detail-field"><label>Status</label><select id="task-detail-status" class="fi">' +
            STATUS_OPTIONS.map(function (s) { return '<option value="' + s.value + '"' + (t.status === s.value ? ' selected' : '') + '>' + esc(s.label) + '</option>'; }).join('') +
          '</select></div>' +
          '<div class="task-detail-field"><label>Assignee</label><select id="task-detail-assignee" class="fi">' +
            '<option value="">Unassigned</option>' +
            (state.staff || []).map(function (s) { return '<option value="' + esc(s.uid) + '"' + (t.assignedTo === s.uid ? ' selected' : '') + '>' + esc(s.displayName || s.email || '') + '</option>'; }).join('') +
          '</select></div>' +
          '<div class="task-detail-field"><label>Due date</label><input type="date" id="task-detail-due" class="fi" value="' + esc(t.dueDate || '') + '"></div>' +
          '<div class="task-detail-field"><label>Priority</label><select id="task-detail-priority" class="fi">' +
            PRIORITY_OPTIONS.map(function (p) { return '<option value="' + p.value + '"' + ((t.priority || 'medium') === p.value ? ' selected' : '') + '>' + esc(p.label) + '</option>'; }).join('') +
          '</select></div>' +
        '</div>' +
        '<div class="task-detail-field task-detail-patient"><label>Patient</label><div>' + patientLink + '</div></div>' +
        '<div class="task-detail-description">' +
          '<label>Description</label>' +
          '<div class="task-detail-notes" id="task-detail-notes">' + (t.notes ? esc(t.notes).replace(/\n/g, '<br>') : '<span class="text-muted">No description.</span>') + '</div>' +
          '<button type="button" class="btn btn-sm btn-outline" id="task-edit-desc-btn"><i class="fas fa-pen"></i> Edit</button>' +
        '</div>' +
        '<div class="task-detail-footer">' +
          '<span class="text-muted">Created ' + esc(createdStr) + (t.createdByName ? ' by ' + esc(t.createdByName) : '') + '</span>' +
          '<div class="task-detail-actions">' +
            '<button type="button" class="btn btn-sm btn-outline" id="task-edit-title-btn"><i class="fas fa-pen"></i> Edit title</button> ' +
            '<button type="button" class="btn btn-sm btn-danger" id="task-delete-btn"><i class="fas fa-trash"></i> Delete</button>' +
          '</div>' +
        '</div>' +
      '</div>';

    if ($('tb-title')) $('tb-title').textContent = (t.key || '') + ' ' + (t.title || 'Task');
    document.title = (t.key || '') + ' ' + (t.title || '') + ' — Maitra Wellness';

    bindTaskDetailEvents();
  }

  function bindTaskDetailEvents() {
    var t = state.task;
    if (!t) return;

    function saveField(field, value, label) {
      var payload = {}; payload[field] = value;
      if (field === 'assignedTo') {
        var uid = value;
        var s = (state.staff || []).filter(function (x) { return x.uid === uid; })[0];
        payload.assignedToName = s ? (s.displayName || s.email || '') : '';
      }
      AppDB.updateTask(t.id, payload).then(function () {
        state.task[field] = value;
        if (field === 'assignedTo') state.task.assignedToName = (payload.assignedToName || '');
        toast(label || 'Saved');
      }).catch(function (e) { toast('Failed to save: ' + (e.message || '')); });
    }

    var statusSel = $('task-detail-status');
    if (statusSel) statusSel.addEventListener('change', function () {
      saveField('status', statusSel.value, 'Status updated');
    });

    var assigneeSel = $('task-detail-assignee');
    if (assigneeSel) assigneeSel.addEventListener('change', function () {
      saveField('assignedTo', assigneeSel.value || null, 'Assignee updated');
    });

    var dueInp = $('task-detail-due');
    if (dueInp) dueInp.addEventListener('change', function () {
      saveField('dueDate', dueInp.value || null, 'Due date updated');
    });

    var prioritySel = $('task-detail-priority');
    if (prioritySel) prioritySel.addEventListener('change', function () {
      saveField('priority', prioritySel.value, 'Priority updated');
    });

    var editTitleBtn = $('task-edit-title-btn');
    if (editTitleBtn) editTitleBtn.addEventListener('click', function () {
      var newTitle = window.prompt('Task title', t.title || '');
      if (newTitle === null) return;
      newTitle = (newTitle || '').trim();
      if (!newTitle) { toast('Title cannot be empty'); return; }
      AppDB.updateTask(t.id, { title: newTitle }).then(function () {
        state.task.title = newTitle;
        var el = $('task-detail-title'); if (el) el.textContent = newTitle;
        if ($('tb-title')) $('tb-title').textContent = (t.key || '') + ' ' + newTitle;
        document.title = (t.key || '') + ' ' + newTitle + ' — Maitra Wellness';
        toast('Title updated');
      }).catch(function (e) { toast('Failed: ' + (e.message || '')); });
    });

    var editDescBtn = $('task-edit-desc-btn');
    if (editDescBtn) editDescBtn.addEventListener('click', function () {
      var notesEl = $('task-detail-notes');
      var current = (t.notes || '').trim();
      var newNotes = window.prompt('Description', current);
      if (newNotes === null) return;
      AppDB.updateTask(t.id, { notes: (newNotes || '').trim() }).then(function () {
        state.task.notes = (newNotes || '').trim();
        if (notesEl) notesEl.innerHTML = state.task.notes ? esc(state.task.notes).replace(/\n/g, '<br>') : '<span class="text-muted">No description.</span>';
        toast('Description updated');
      }).catch(function (e) { toast('Failed: ' + (e.message || '')); });
    });

    var deleteBtn = $('task-delete-btn');
    if (deleteBtn) deleteBtn.addEventListener('click', function () {
      if (!window.AppModal || !AppModal.confirm) {
        if (window.confirm('Delete this task?')) doDelete();
        return;
      }
      AppModal.confirm('Delete Task', 'Delete "' + esc(t.title || '') + '"?' , function () { doDelete(); }, 'Delete');
    });

    function doDelete() {
      AppDB.deleteTask(t.id).then(function () {
        toast('Task deleted');
        window.location.href = '/index.html?page=tasks';
      }).catch(function (e) { toast('Delete failed: ' + (e.message || '')); });
    }
  }

  function run() {
    if (!window.AppDB || !AppDB.ready) {
      window.location.href = '/index.html';
      return;
    }
    var params = new URLSearchParams(window.location.search);
    var id = params.get('id');
    if (!id) {
      window.location.href = '/index.html?page=tasks';
      return;
    }

    var resolved = false;
    var unsub = AppDB.onAuthStateChanged && AppDB.onAuthStateChanged(function (user) {
      if (user) {
        if (resolved) return;
        resolved = true;
        unsub && typeof unsub === 'function' && unsub();
        loadTask(user, id);
        return;
      }
      setTimeout(function () {
        if (resolved) return;
        resolved = true;
        unsub && typeof unsub === 'function' && unsub();
        var u = AppDB.getCurrentUser && AppDB.getCurrentUser();
        if (u) loadTask(u, id);
        else window.location.href = '/index.html';
      }, 600);
    });
  }

  function loadTask(user, id) {
    state.user = user;
    Promise.all([
      AppDB.getTask(id),
      AppDB.getAllStaff ? AppDB.getAllStaff() : Promise.resolve([])
    ]).then(function (results) {
      var task = results[0];
      state.staff = results[1] || [];
      if (!task) {
        toast('Task not found');
        window.location.href = '/index.html?page=tasks';
        return;
      }
      state.task = task;
      showApp();
      renderTaskDetail();
    }).catch(function (err) {
      toast(err && err.message ? err.message : 'Failed to load task');
      window.location.href = '/index.html?page=tasks';
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run);
  else run();
})();
