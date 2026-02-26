/**
 * Tasks page — JIRA-style Kanban board + list, task detail opens in task.html
 */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var _inited = false;
  var _tasks = [];
  var _staff = [];
  var _currentView = 'board';
  var STATUSES = ['todo', 'in_progress', 'done'];
  var STATUS_LABELS = { todo: 'To Do', in_progress: 'In Progress', done: 'Done' };
  var PRIORITY_ICONS = { high: 'fa-arrow-up', medium: 'fa-minus', low: 'fa-arrow-down' };
  var PRIORITY_LABELS = { high: 'High', medium: 'Medium', low: 'Low' };

  function esc(s) { var d = document.createElement('div'); d.textContent = s == null ? '' : s; return d.innerHTML; }
  function showToast(msg) { if (window.CareTrack && CareTrack.toast) CareTrack.toast(msg); else alert(msg); }
  function errMsg(e) { return (e && (e.message || e.code)) || 'Unknown error'; }

  function openTask(id) {
    if (window.CareTrack && CareTrack.openTask) CareTrack.openTask(id);
    else window.location.href = '/task.html?id=' + encodeURIComponent(id);
  }

  function getFilteredTasks() {
    var sf = ($('tasks-filter-status') || {}).value || '';
    var cf = ($('tasks-filter-client') || {}).value || '';
    var af = ($('tasks-filter-assignee') || {}).value || '';
    return _tasks.filter(function (t) {
      if (sf && t.status !== sf) return false;
      if (cf && (t.clientId || '') !== cf) return false;
      if (af && (t.assignedTo || '') !== af) return false;
      return true;
    });
  }

  function initials(name) {
    if (!name) return '?';
    var parts = name.trim().split(/\s+/);
    return parts.length > 1 ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase() : name.slice(0, 2).toUpperCase();
  }

  function populateFilters(state) {
    var cs = $('tasks-filter-client');
    var as = $('tasks-filter-assignee');
    if (cs && cs.options.length <= 1 && (state.clients || []).length) {
      cs.innerHTML = '<option value="">All patients</option>' + state.clients.filter(function (c) { return c.status === 'active'; }).map(function (c) {
        return '<option value="' + esc(c.id) + '">' + esc(c.name || '') + '</option>';
      }).join('');
    }
    if (as && as.options.length <= 1 && _staff.length) {
      as.innerHTML = '<option value="">All assignees</option>' + _staff.map(function (s) {
        return '<option value="' + esc(s.uid) + '">' + esc(s.displayName || s.email || '') + '</option>';
      }).join('');
    }
  }

  function render(state) {
    if (!$('tasks-board-wrap') && !$('tasks-list-wrap')) return;
    function done() {
      populateFilters(state);
      if (_currentView === 'board') renderBoard(); else renderTable(state);
    }
    AppDB.getTasks().then(function (list) {
      _tasks = list || [];
      if (_staff.length) done();
      else (AppDB.getAllStaff ? AppDB.getAllStaff() : Promise.resolve([])).then(function (s) { _staff = s || []; done(); }).catch(done);
    }).catch(function () {
      var col = $('task-col-todo');
      if (col) col.innerHTML = '<div class="task-board-empty"><i class="fas fa-exclamation-triangle"></i> Failed to load</div>';
    });
  }

  function renderBoard() {
    var filtered = getFilteredTasks();
    STATUSES.forEach(function (status) {
      var col = $('task-col-' + status);
      var countEl = $('task-count-' + status);
      if (!col) return;
      var list = filtered.filter(function (t) { return (t.status || 'todo') === status; });
      if (countEl) countEl.textContent = list.length;
      if (!list.length) {
        col.innerHTML = '<div class="task-board-empty"><i class="fas fa-inbox"></i>No tasks here</div>';
        return;
      }
      col.innerHTML = list.map(function (t) { return cardHtml(t); }).join('');
      col.querySelectorAll('.task-card').forEach(function (card) {
        card.addEventListener('click', function () { openTask(card.getAttribute('data-task-id')); });
        card.addEventListener('keydown', function (e) { if (e.key === 'Enter') openTask(card.getAttribute('data-task-id')); });
      });
    });
  }

  function cardHtml(t) {
    var key = t.key || ('T-' + (t.id || '').slice(-6));
    var p = t.priority || 'medium';
    var pIcon = PRIORITY_ICONS[p] || 'fa-minus';
    var avatar = t.assignedToName ? '<span class="task-card-avatar" title="' + esc(t.assignedToName) + '">' + initials(t.assignedToName) + '</span>' : '';
    var patientTag = t.clientName ? '<span class="task-card-tag"><i class="fas fa-hospital-user"></i> ' + esc(t.clientName) + '</span>' : '';
    var dueTag = t.dueDate ? '<span class="task-card-tag"><i class="fas fa-calendar"></i> ' + esc(t.dueDate) + '</span>' : '';
    return '<div class="task-card priority-card-' + p + '" data-task-id="' + esc(t.id) + '" role="button" tabindex="0">' +
      '<div class="task-card-top">' +
        '<span class="task-card-key">' + esc(key) + '</span>' +
        '<span class="task-card-priority-icon priority-' + p + '" title="' + esc(PRIORITY_LABELS[p] || p) + '"><i class="fas ' + pIcon + '"></i></span>' +
      '</div>' +
      '<div class="task-card-title">' + esc(t.title || '—') + '</div>' +
      '<div class="task-card-footer">' + patientTag + dueTag + avatar + '</div>' +
    '</div>';
  }

  function renderTable(state) {
    var container = $('tasks-list');
    if (!container) return;
    var filtered = getFilteredTasks();
    if (!filtered.length) {
      container.innerHTML = '<div class="empty-state" style="padding:32px"><i class="fas fa-list-check"></i><p>' + (_tasks.length ? 'No tasks match filters' : 'No tasks yet') + '</p></div>';
      return;
    }
    var html = '<table class="staff-table task-list-table"><thead><tr><th>Key</th><th>Title</th><th>Priority</th><th>Patient</th><th>Assignee</th><th>Due</th><th>Status</th></tr></thead><tbody>';
    filtered.forEach(function (t) {
      var p = t.priority || 'medium';
      var key = t.key || ('T-' + (t.id || '').slice(-6));
      html += '<tr class="task-list-row" data-task-id="' + esc(t.id) + '">' +
        '<td><span class="task-list-key">' + esc(key) + '</span></td>' +
        '<td>' + esc(t.title || '—') + '</td>' +
        '<td><span class="task-priority-badge priority-' + p + '"><i class="fas ' + (PRIORITY_ICONS[p] || 'fa-minus') + '"></i> ' + esc(PRIORITY_LABELS[p] || p) + '</span></td>' +
        '<td>' + esc(t.clientName || '—') + '</td>' +
        '<td>' + esc(t.assignedToName || '—') + '</td>' +
        '<td>' + (t.dueDate || '—') + '</td>' +
        '<td><span class="status-badge task-status-' + (t.status || 'todo') + '">' + esc(STATUS_LABELS[t.status] || t.status || 'To Do') + '</span></td>' +
      '</tr>';
    });
    html += '</tbody></table>';
    container.innerHTML = html;

    container.querySelectorAll('.task-list-row').forEach(function (row) {
      row.addEventListener('click', function () { openTask(row.getAttribute('data-task-id')); });
    });
  }

  /* ─── Create / Edit Modal ─────────────────────────────────────── */
  function buildModalHtml(task, state) {
    var clients = state.clients || [];
    var clientOpts = '<option value="">None</option>' + clients.filter(function (c) { return c.status === 'active'; }).map(function (c) {
      return '<option value="' + esc(c.id) + '"' + (task && task.clientId === c.id ? ' selected' : '') + '>' + esc(c.name || '') + '</option>';
    }).join('');
    var staffOpts = '<option value="">Unassigned</option>' + _staff.map(function (s) {
      return '<option value="' + esc(s.uid) + '"' + (task && task.assignedTo === s.uid ? ' selected' : '') + '>' + esc(s.displayName || s.email || '') + '</option>';
    }).join('');
    function selOpt(opts, cur) {
      return opts.map(function (o) { return '<option value="' + o.v + '"' + (cur === o.v ? ' selected' : '') + '>' + o.l + '</option>'; }).join('');
    }
    var statusOpts = selOpt([{v:'todo',l:'To Do'},{v:'in_progress',l:'In Progress'},{v:'done',l:'Done'}], task ? task.status : 'todo');
    var prioOpts = selOpt([{v:'high',l:'High'},{v:'medium',l:'Medium'},{v:'low',l:'Low'}], task ? (task.priority || 'medium') : 'medium');

    return '<div class="modal-card modal-card-wide"><h3 class="modal-title">' + (task ? 'Edit Task' : 'Create Task') + '</h3>' +
      '<div class="form-grid" style="gap:14px">' +
        '<div class="fg fg-full"><label>Title <span style="color:var(--accent)">*</span></label><input id="task-title" type="text" class="fi" placeholder="What needs to be done?" value="' + esc(task ? task.title : '') + '" autofocus></div>' +
        '<div class="fg" style="flex:1;min-width:140px"><label>Priority</label><select id="task-priority" class="fi">' + prioOpts + '</select></div>' +
        '<div class="fg" style="flex:1;min-width:140px"><label>Status</label><select id="task-status" class="fi">' + statusOpts + '</select></div>' +
        '<div class="fg" style="flex:1;min-width:140px"><label>Assignee</label><select id="task-assignee" class="fi">' + staffOpts + '</select></div>' +
        '<div class="fg" style="flex:1;min-width:140px"><label>Due date</label><input id="task-due" type="date" class="fi" value="' + esc(task && task.dueDate ? task.dueDate : '') + '"></div>' +
        '<div class="fg fg-full"><label>Patient</label><select id="task-client" class="fi">' + clientOpts + '</select></div>' +
        '<div class="fg fg-full"><label>Description</label><textarea id="task-notes" class="fi" rows="4" placeholder="Add details, context, acceptance criteria...">' + esc(task ? (task.notes || '') : '') + '</textarea></div>' +
      '</div>' +
      '<div class="modal-actions" style="margin-top:18px;gap:8px">' +
        '<button type="button" class="btn btn-ghost" id="task-modal-cancel">Cancel</button>' +
        '<button type="button" class="btn" id="task-modal-save">' + (task ? 'Save' : 'Create') + '</button>' +
      '</div></div>';
  }

  function showCreateModal(state) {
    if (!window.AppModal) { showToast('Modal not available'); return; }
    AppModal.open(buildModalHtml(null, state), { onReady: function () { bindModalButtons(null, state); } });
  }

  function showEditModal(taskId, state) {
    var task = _tasks.filter(function (t) { return t.id === taskId; })[0];
    if (!task || !window.AppModal) return;
    AppModal.open(buildModalHtml(task, state), { onReady: function () { bindModalButtons(taskId, state); } });
  }

  function bindModalButtons(taskId, state) {
    var m = document.getElementById('modal-container');
    if (!m) return;
    var cancel = m.querySelector('#task-modal-cancel');
    var save = m.querySelector('#task-modal-save');
    if (cancel) cancel.addEventListener('click', AppModal.close);
    if (save) save.addEventListener('click', function () { saveFromModal(taskId, state); });
    var titleInput = m.querySelector('#task-title');
    if (titleInput) titleInput.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); saveFromModal(taskId, state); } });
  }

  function saveFromModal(taskId, state) {
    var gv = function (id) { return (document.getElementById(id) || {}).value || ''; };
    var title = gv('task-title').trim();
    if (!title) { showToast('Title is required'); return; }
    var clientId = gv('task-client') || null;
    var clientName = '';
    if (clientId) { var c = (state.clients || []).filter(function (x) { return x.id === clientId; })[0]; clientName = c ? (c.name || '') : ''; }
    var assignedTo = gv('task-assignee') || null;
    var assignedToName = '';
    if (assignedTo) { var s = _staff.filter(function (x) { return x.uid === assignedTo; })[0]; assignedToName = s ? (s.displayName || s.email || '') : ''; }
    var data = {
      title: title, clientId: clientId, clientName: clientName,
      assignedTo: assignedTo, assignedToName: assignedToName,
      dueDate: gv('task-due') || null, status: gv('task-status') || 'todo',
      priority: gv('task-priority') || 'medium', notes: gv('task-notes').trim()
    };
    var profile = (state && state.profile) || {};

    if (taskId) {
      AppDB.updateTask(taskId, data).then(function () {
        var i = _tasks.findIndex(function (t) { return t.id === taskId; });
        if (i !== -1) _tasks[i] = Object.assign({}, _tasks[i], data);
        AppModal.close();
        refreshView(state);
        showToast('Task updated');
      }).catch(function (e) { showToast('Failed: ' + errMsg(e)); });
    } else {
      data.createdByName = profile.displayName || '';
      AppDB.addTask(data).then(function (ref) {
        _tasks.unshift(Object.assign({ id: ref.id, key: 'T-' + (ref.id.length >= 6 ? ref.id.slice(-6).toUpperCase() : ref.id), createdAt: new Date().toISOString() }, data));
        AppModal.close();
        refreshView(state);
        showToast('Task created');
      }).catch(function (e) { showToast('Failed: ' + errMsg(e)); });
    }
  }

  function refreshView(state) {
    if (_currentView === 'board') renderBoard(); else renderTable(state);
  }

  /* ─── Init ─────────────────────────────────────────────────── */
  function init(state) {
    if (_inited) return;
    _inited = true;
    (AppDB.getAllStaff ? AppDB.getAllStaff() : Promise.resolve([])).then(function (s) { _staff = s || []; }).catch(function () {});

    function applyFilters() { refreshView(state); }
    ['tasks-filter-status', 'tasks-filter-client', 'tasks-filter-assignee'].forEach(function (id) {
      var el = $(id); if (el) el.addEventListener('change', applyFilters);
    });

    document.querySelectorAll('.tasks-view-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var view = btn.getAttribute('data-view');
        if (!view || view === _currentView) return;
        _currentView = view;
        document.querySelectorAll('.tasks-view-btn').forEach(function (b) {
          var isActive = b.getAttribute('data-view') === view;
          b.classList.toggle('active', isActive);
          b.classList.toggle('btn-outline', !isActive);
          b.setAttribute('aria-selected', String(isActive));
        });
        $('tasks-board-wrap').style.display = view === 'board' ? '' : 'none';
        $('tasks-list-wrap').style.display = view === 'list' ? '' : 'none';
        refreshView(state);
      });
    });
  }

  window.Pages = window.Pages || {};
  window.Pages.tasks = { render: render, init: init };

  window.CareTrackOpenAddTask = function () {
    var s = window.CareTrack && CareTrack.getState ? CareTrack.getState() : null;
    if (!s) { showToast('App not ready'); return; }
    showCreateModal(s);
  };

  document.addEventListener('click', function (e) {
    if (e.target && e.target.closest && e.target.closest('#tasks-add-btn')) {
      e.preventDefault();
      window.CareTrackOpenAddTask();
    }
  });
})();
