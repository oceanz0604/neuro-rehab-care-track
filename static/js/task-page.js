/**
 * Task detail page (task.html) — JIRA-style two-column layout with inline editing.
 */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var state = { user: null, profile: null, task: null, staff: [] };
  var STATUS_LABELS = { todo: 'To Do', in_progress: 'In Progress', done: 'Done' };
  var PRIORITY_ICONS = { high: 'fa-arrow-up', medium: 'fa-minus', low: 'fa-arrow-down' };
  var PRIORITY_LABELS = { high: 'High', medium: 'Medium', low: 'Low' };

  function esc(s) { var d = document.createElement('div'); d.textContent = s == null ? '' : s; return d.innerHTML; }
  function toast(msg) {
    var el = $('toast'); if (!el) return;
    el.textContent = msg; el.setAttribute('data-show', 'true');
    setTimeout(function () { el.setAttribute('data-show', 'false'); }, 3000);
  }

  window.CareTrack = {
    getState: function () { return state; },
    toast: toast,
    navigate: function (p) { window.location.href = '/index.html?page=' + (p || 'tasks'); },
    openTask: function (id) { if (id) window.location.href = '/task.html?id=' + encodeURIComponent(id); },
    openPatient: function (id) { if (id) window.location.href = '/patient.html?id=' + encodeURIComponent(id); }
  };

  function hideLoading() { var el = $('loading-screen'); if (el) el.classList.add('hidden'); }
  function showApp() { $('task-app').removeAttribute('hidden'); hideLoading(); }

  /* ─── Render ───────────────────────────────────────────────── */
  function renderDetail() {
    var root = $('task-detail-root');
    var t = state.task;
    if (!root || !t) return;

    var key = t.key || t.id;
    var p = t.priority || 'medium';
    var pIcon = PRIORITY_ICONS[p] || 'fa-minus';
    var createdStr = t.createdAt ? new Date(t.createdAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';

    var patientHtml = '';
    if (t.clientId && t.clientName) {
      patientHtml = '<a href="/patient.html?id=' + esc(t.clientId) + '" class="task-detail-link"><i class="fas fa-hospital-user"></i> ' + esc(t.clientName) + '</a>';
    } else {
      patientHtml = '<span class="task-detail-field-value" style="color:var(--text-3)">None</span>';
    }

    var descriptionHtml = t.notes ? esc(t.notes).replace(/\n/g, '<br>') : '<span style="color:var(--text-3)">Click to add a description...</span>';

    root.innerHTML =
      '<div class="task-detail-layout">' +
        /* ── Main panel ── */
        '<div class="task-detail-main">' +
          '<div class="task-detail-breadcrumb">' +
            '<a href="/index.html?page=tasks">Tasks</a>' +
            '<span>/</span>' +
            '<span class="task-detail-key">' + esc(key) + '</span>' +
          '</div>' +

          '<div class="task-detail-title-wrap" id="title-wrap">' +
            '<h1 class="task-detail-title" id="task-title" contenteditable="true" spellcheck="false">' + esc(t.title || 'Untitled') + '</h1>' +
            '<button type="button" class="btn btn-sm task-detail-title-save" id="title-save-btn"><i class="fas fa-check"></i></button>' +
          '</div>' +

          '<div class="task-detail-desc-section">' +
            '<div class="task-detail-desc-label">Description</div>' +
            '<div class="task-detail-desc-view" id="desc-view">' + descriptionHtml + '</div>' +
            '<div class="task-detail-desc-edit" id="desc-edit">' +
              '<textarea id="desc-textarea" class="fi">' + esc(t.notes || '') + '</textarea>' +
              '<div class="task-detail-desc-actions">' +
                '<button type="button" class="btn btn-sm" id="desc-save-btn">Save</button>' +
                '<button type="button" class="btn btn-sm btn-ghost" id="desc-cancel-btn">Cancel</button>' +
              '</div>' +
            '</div>' +
          '</div>' +

          '<div class="task-detail-footer-bar">' +
            '<span class="task-detail-meta-text">Created ' + esc(createdStr) + (t.createdByName ? ' by ' + esc(t.createdByName) : '') + '</span>' +
            '<div class="task-detail-danger-actions">' +
              '<button type="button" class="btn btn-sm btn-danger" id="task-delete-btn"><i class="fas fa-trash"></i> Delete</button>' +
            '</div>' +
          '</div>' +
        '</div>' +

        /* ── Sidebar panel ── */
        '<div class="task-detail-sidebar">' +
          '<div class="task-detail-sidebar-hd">Details</div>' +
          '<div class="task-detail-sidebar-body">' +

            '<div class="task-detail-field">' +
              '<label>Status</label>' +
              '<select id="td-status" class="fi">' +
                ['todo', 'in_progress', 'done'].map(function (s) {
                  return '<option value="' + s + '"' + (t.status === s ? ' selected' : '') + '>' + esc(STATUS_LABELS[s]) + '</option>';
                }).join('') +
              '</select>' +
            '</div>' +

            '<div class="task-detail-field">' +
              '<label>Priority</label>' +
              '<select id="td-priority" class="fi">' +
                ['high', 'medium', 'low'].map(function (v) {
                  return '<option value="' + v + '"' + (p === v ? ' selected' : '') + '>' + esc(PRIORITY_LABELS[v]) + '</option>';
                }).join('') +
              '</select>' +
            '</div>' +

            '<div class="task-detail-field">' +
              '<label>Assignee</label>' +
              '<select id="td-assignee" class="fi">' +
                '<option value="">Unassigned</option>' +
                (state.staff || []).map(function (s) {
                  return '<option value="' + esc(s.uid) + '"' + (t.assignedTo === s.uid ? ' selected' : '') + '>' + esc(s.displayName || s.email || '') + '</option>';
                }).join('') +
              '</select>' +
            '</div>' +

            '<div class="task-detail-field">' +
              '<label>Due date</label>' +
              '<input type="date" id="td-due" class="fi" value="' + esc(t.dueDate || '') + '">' +
            '</div>' +

            '<div class="task-detail-field">' +
              '<label>Patient</label>' +
              '<div class="task-detail-field-value">' + patientHtml + '</div>' +
            '</div>' +

          '</div>' +
        '</div>' +
      '</div>';

    if ($('tb-title')) $('tb-title').textContent = key + '  ' + (t.title || 'Task');
    document.title = key + ' ' + (t.title || '') + ' — Maitra Wellness';

    bindEvents();
  }

  /* ─── Event binding ────────────────────────────────────────── */
  function bindEvents() {
    var t = state.task;
    if (!t) return;

    function saveField(field, value, label) {
      var payload = {}; payload[field] = value;
      if (field === 'assignedTo') {
        var s = (state.staff || []).filter(function (x) { return x.uid === value; })[0];
        payload.assignedToName = s ? (s.displayName || s.email || '') : '';
      }
      AppDB.updateTask(t.id, payload).then(function () {
        Object.keys(payload).forEach(function (k) { state.task[k] = payload[k]; });
        toast(label || 'Saved');
      }).catch(function (e) { toast('Save failed: ' + (e.message || '')); });
    }

    /* Sidebar selects: auto-save on change */
    var statusSel = $('td-status');
    var prioritySel = $('td-priority');
    var assigneeSel = $('td-assignee');
    var dueInp = $('td-due');

    if (statusSel) statusSel.addEventListener('change', function () { saveField('status', statusSel.value, 'Status updated'); });
    if (prioritySel) prioritySel.addEventListener('change', function () { saveField('priority', prioritySel.value, 'Priority updated'); });
    if (assigneeSel) assigneeSel.addEventListener('change', function () { saveField('assignedTo', assigneeSel.value || null, 'Assignee updated'); });
    if (dueInp) dueInp.addEventListener('change', function () { saveField('dueDate', dueInp.value || null, 'Due date updated'); });

    /* Title: inline contenteditable */
    var titleEl = $('task-title');
    var titleWrap = $('title-wrap');
    var titleSaveBtn = $('title-save-btn');
    var originalTitle = t.title || '';

    if (titleEl) {
      titleEl.addEventListener('focus', function () { titleWrap.classList.add('editing'); });
      titleEl.addEventListener('blur', function () {
        setTimeout(function () { titleWrap.classList.remove('editing'); }, 200);
      });
      titleEl.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') { e.preventDefault(); titleEl.blur(); commitTitle(); }
        if (e.key === 'Escape') { titleEl.textContent = originalTitle; titleEl.blur(); }
      });
    }
    if (titleSaveBtn) titleSaveBtn.addEventListener('click', commitTitle);

    function commitTitle() {
      var newTitle = (titleEl.textContent || '').trim();
      if (!newTitle) { titleEl.textContent = originalTitle; toast('Title cannot be empty'); return; }
      if (newTitle === originalTitle) return;
      AppDB.updateTask(t.id, { title: newTitle }).then(function () {
        state.task.title = newTitle;
        originalTitle = newTitle;
        if ($('tb-title')) $('tb-title').textContent = (t.key || '') + '  ' + newTitle;
        document.title = (t.key || '') + ' ' + newTitle + ' — Maitra Wellness';
        toast('Title updated');
      }).catch(function (e) { titleEl.textContent = originalTitle; toast('Failed: ' + (e.message || '')); });
    }

    /* Description: click to edit */
    var descView = $('desc-view');
    var descEdit = $('desc-edit');
    var descTextarea = $('desc-textarea');
    var descSaveBtn = $('desc-save-btn');
    var descCancelBtn = $('desc-cancel-btn');

    if (descView) descView.addEventListener('click', function () {
      descView.style.display = 'none';
      descEdit.style.display = 'block';
      descTextarea.value = state.task.notes || '';
      descTextarea.focus();
    });
    if (descCancelBtn) descCancelBtn.addEventListener('click', closeDescEditor);
    if (descSaveBtn) descSaveBtn.addEventListener('click', function () {
      var newNotes = (descTextarea.value || '').trim();
      AppDB.updateTask(t.id, { notes: newNotes }).then(function () {
        state.task.notes = newNotes;
        descView.innerHTML = newNotes ? esc(newNotes).replace(/\n/g, '<br>') : '<span style="color:var(--text-3)">Click to add a description...</span>';
        closeDescEditor();
        toast('Description saved');
      }).catch(function (e) { toast('Failed: ' + (e.message || '')); });
    });

    function closeDescEditor() {
      descEdit.style.display = 'none';
      descView.style.display = '';
    }

    /* Delete */
    var deleteBtn = $('task-delete-btn');
    if (deleteBtn) deleteBtn.addEventListener('click', function () {
      if (window.AppModal && AppModal.confirm) {
        AppModal.confirm('Delete Task', 'Delete "' + esc(t.title || '') + '"?', doDelete, 'Delete');
      } else {
        if (confirm('Delete this task?')) doDelete();
      }
    });

    function doDelete() {
      AppDB.deleteTask(t.id).then(function () {
        toast('Task deleted');
        window.location.href = '/index.html?page=tasks';
      }).catch(function (e) { toast('Delete failed: ' + (e.message || '')); });
    }
  }

  /* ─── Navigation ──────────────────────────────────────────── */
  function goBack() {
    var fromOurApp = document.referrer && document.referrer.indexOf(window.location.origin) === 0;
    if (fromOurApp && window.history.length > 1) {
      window.history.back();
    } else {
      window.location.href = '/index.html?page=tasks';
    }
  }

  /* ─── Auth + boot ──────────────────────────────────────────── */
  function run() {
    var backBtn = $('topbar-back');
    if (backBtn) backBtn.addEventListener('click', function (e) { e.preventDefault(); goBack(); });
    if (!window.AppDB || !AppDB.ready) { window.location.href = '/index.html'; return; }
    var params = new URLSearchParams(window.location.search);
    var id = params.get('id');
    if (!id) { window.location.href = '/index.html?page=tasks'; return; }

    var resolved = false;
    var unsub = AppDB.onAuthStateChanged && AppDB.onAuthStateChanged(function (user) {
      if (user) {
        if (resolved) return;
        resolved = true;
        if (typeof unsub === 'function') unsub();
        loadTask(user, id);
        return;
      }
      setTimeout(function () {
        if (resolved) return;
        resolved = true;
        if (typeof unsub === 'function') unsub();
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
      state.staff = results[1] || [];
      if (!results[0]) { toast('Task not found'); window.location.href = '/index.html?page=tasks'; return; }
      state.task = results[0];
      showApp();
      renderDetail();
    }).catch(function (err) {
      toast(err && err.message ? err.message : 'Failed to load');
      window.location.href = '/index.html?page=tasks';
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run);
  else run();
})();
