/**
 * Tasks page (MVP-2) — list, filter, add/edit/delete tasks.
 */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var _inited = false;
  var _tasks = [];
  var _staff = [];
  var STATUS_OPTIONS = [
    { value: 'todo', label: 'To do' },
    { value: 'in_progress', label: 'In progress' },
    { value: 'done', label: 'Done' }
  ];

  function esc(s) { var d = document.createElement('div'); d.textContent = s; return d.innerHTML; }
  function vv(id) { return (document.getElementById(id) || {}).value || ''; }
  function showToast(msg) {
    if (window.CareTrack && window.CareTrack.toast) { window.CareTrack.toast(msg); return; }
    try { console.error(msg); } catch (e) {}
    alert(msg);
  }
  function errMsg(e) {
    if (!e) return 'Unknown error';
    if (typeof e === 'string') return e;
    if (e.message) return e.message;
    if (e.code) return e.code;
    try { return String(e); } catch (e2) { return 'Unknown error'; }
  }

  function getFilteredTasks() {
    var statusFilter = ($('tasks-filter-status') || {}).value || '';
    var clientFilter = ($('tasks-filter-client') || {}).value || '';
    var assigneeFilter = ($('tasks-filter-assignee') || {}).value || '';
    return _tasks.filter(function (t) {
      if (statusFilter && t.status !== statusFilter) return false;
      if (clientFilter && (t.clientId || '') !== clientFilter) return false;
      if (assigneeFilter && (t.assignedTo || '') !== assigneeFilter) return false;
      return true;
    });
  }

  function populateFilterDropdowns(state) {
    var clientSel = $('tasks-filter-client');
    var assigneeSel = $('tasks-filter-assignee');
    if (clientSel && (state.clients || []).length) {
      var first = clientSel.options.length === 0;
      if (first) {
        clientSel.innerHTML = '<option value="">All patients</option>' + (state.clients || []).filter(function (c) { return c.status === 'active'; }).map(function (c) {
          return '<option value="' + esc(c.id) + '">' + esc(c.name || '') + '</option>';
        }).join('');
      }
    }
    if (assigneeSel && _staff.length) {
      var firstA = assigneeSel.options.length === 0;
      if (firstA) {
        assigneeSel.innerHTML = '<option value="">All assignees</option>' + _staff.map(function (s) {
          return '<option value="' + esc(s.uid) + '">' + esc(s.displayName || s.email || '') + '</option>';
        }).join('');
      }
    }
  }

  function render(state) {
    var container = $('tasks-list');
    if (!container) return;

    container.innerHTML = '<div class="empty-state"><i class="fas fa-spinner fa-spin"></i> Loading tasks...</div>';
    function done() {
      populateFilterDropdowns(state);
      renderTable(state);
    }
    AppDB.getTasks().then(function (list) {
      _tasks = list || [];
      if (_staff.length) done();
      else AppDB.getAllStaff().then(function (list) { _staff = list || []; done(); }).catch(done);
    }).catch(function () {
      container.innerHTML = '<div class="empty-state"><i class="fas fa-exclamation-triangle"></i> Failed to load tasks.</div>';
    });
  }

  function renderTable(state) {
    var container = $('tasks-list');
    var filtered = getFilteredTasks();

    if (!filtered.length) {
      container.innerHTML = '<div class="empty-state"><i class="fas fa-list-check"></i><p>' + (_tasks.length ? 'No tasks match the filters' : 'No tasks yet. Add one to get started.') + '</p></div>';
      return;
    }

    var html = '<table class="staff-table"><thead><tr><th>Title</th><th>Patient</th><th>Assigned to</th><th>Due date</th><th>Status</th><th>Actions</th></tr></thead><tbody>';
    filtered.forEach(function (t) {
      var statusLabel = (STATUS_OPTIONS.filter(function (s) { return s.value === t.status; })[0] || {}).label || t.status;
      html += '<tr data-task-id="' + esc(t.id) + '">' +
        '<td><strong>' + esc(t.title || '—') + '</strong>' + (t.notes ? ' <span class="text-muted" title="' + esc(t.notes) + '">…</span>' : '') + '</td>' +
        '<td>' + esc(t.clientName || '—') + '</td>' +
        '<td>' + esc(t.assignedToName || '—') + '</td>' +
        '<td>' + (t.dueDate || '—') + '</td>' +
        '<td><span class="status-badge task-status-' + (t.status || 'todo') + '">' + esc(statusLabel) + '</span></td>' +
        '<td style="white-space:nowrap">' +
          '<button type="button" class="btn btn-sm btn-outline" data-edit="' + esc(t.id) + '" title="Edit"><i class="fas fa-pen"></i></button> ' +
          '<button type="button" class="btn btn-sm btn-danger" data-delete="' + esc(t.id) + '" title="Delete"><i class="fas fa-trash"></i></button>' +
        '</td></tr>';
    });
    html += '</tbody></table>';
    container.innerHTML = html;

    container.querySelectorAll('[data-edit]').forEach(function (b) {
      b.addEventListener('click', function () { showEditModal(b.getAttribute('data-edit'), state); });
    });
    container.querySelectorAll('[data-delete]').forEach(function (b) {
      b.addEventListener('click', function () {
        var id = b.getAttribute('data-delete');
        var t = _tasks.filter(function (x) { return x.id === id; })[0];
        AppModal.confirm('Delete Task', 'Delete “‘ + esc(t ? t.title : '') + '”?', function () {
          AppDB.deleteTask(id).then(function () {
            _tasks = _tasks.filter(function (x) { return x.id !== id; });
            renderTable(state);
            if (window.CareTrack) window.CareTrack.toast('Task deleted');
          }).catch(function () { if (window.CareTrack) window.CareTrack.toast('Delete failed'); });
        }, 'Delete');
      });
    });
  }

  function buildTaskModalHtml(task, state) {
    var clients = state.clients || [];
    var clientOpts = '<option value="">— No patient —</option>' + clients.filter(function (c) { return c.status === 'active'; }).map(function (c) {
      var sel = (task && task.clientId === c.id) ? ' selected' : '';
      return '<option value="' + esc(c.id) + '"' + sel + '>' + esc(c.name || '') + '</option>';
    }).join('');
    var staffOpts = '<option value="">— Unassigned —</option>' + _staff.map(function (s) {
      var sel = (task && task.assignedTo === s.uid) ? ' selected' : '';
      return '<option value="' + esc(s.uid) + '"' + sel + '>' + esc(s.displayName || s.email || '') + '</option>';
    }).join('');
    var statusOpts = STATUS_OPTIONS.map(function (s) {
      var sel = (task && task.status === s.value) ? ' selected' : (!task && s.value === 'todo') ? ' selected' : '';
      return '<option value="' + s.value + '"' + sel + '>' + s.label + '</option>';
    }).join('');
    return '<div class="modal-card"><h3 class="modal-title">' + (task ? 'Edit Task' : 'Add Task') + '</h3>' +
      '<div class="form-grid">' +
        '<div class="fg fg-full"><label>Title</label><input id="task-title" type="text" class="fi" placeholder="Task title" value="' + esc(task ? task.title : '') + '"></div>' +
        '<div class="fg fg-full"><label>Patient (optional)</label><select id="task-client" class="fi">' + clientOpts + '</select></div>' +
        '<div class="fg fg-full"><label>Assigned to (optional)</label><select id="task-assignee" class="fi">' + staffOpts + '</select></div>' +
        '<div class="fg fg-full"><label>Due date</label><input id="task-due" type="date" class="fi" value="' + esc(task && task.dueDate ? task.dueDate : '') + '"></div>' +
        '<div class="fg fg-full"><label>Status</label><select id="task-status" class="fi">' + statusOpts + '</select></div>' +
        '<div class="fg fg-full"><label>Notes</label><textarea id="task-notes" class="fi" rows="2" placeholder="Optional notes">' + esc(task ? task.notes : '') + '</textarea></div>' +
      '</div>' +
      '<div class="modal-actions" style="margin-top:18px">' +
        '<button type="button" class="btn btn-ghost" id="task-modal-cancel">Cancel</button>' +
        '<button type="button" class="btn" id="task-modal-save">' + (task ? 'Save' : 'Add Task') + '</button>' +
      '</div></div>';
  }

  function showAddModal(state) {
    if (!window.AppModal || typeof window.AppModal.open !== 'function') {
      showToast('Modal not available');
      return;
    }
    window.AppModal.open(buildTaskModalHtml(null, state), {
      onReady: function () {
        var modalEl = document.getElementById('modal-container');
        if (!modalEl) return;
        var cancelBtn = modalEl.querySelector('#task-modal-cancel');
        var saveBtn = modalEl.querySelector('#task-modal-save');
        if (cancelBtn) cancelBtn.addEventListener('click', AppModal.close);
        if (saveBtn) saveBtn.addEventListener('click', function () {
          try {
            saveTaskFromModal(null, state);
          } catch (err) {
            showToast('Add task failed: ' + errMsg(err));
          }
        });
      }
    });
  }

  function showEditModal(taskId, state) {
    var task = _tasks.filter(function (t) { return t.id === taskId; })[0];
    if (!task) return;
    AppModal.open(buildTaskModalHtml(task, state), {
      onReady: function () {
        var modalEl = document.getElementById('modal-container');
        if (!modalEl) return;
        var cancelBtn = modalEl.querySelector('#task-modal-cancel');
        var saveBtn = modalEl.querySelector('#task-modal-save');
        if (cancelBtn) cancelBtn.addEventListener('click', AppModal.close);
        if (saveBtn) saveBtn.addEventListener('click', function () {
          try {
            saveTaskFromModal(taskId, state);
          } catch (err) {
            showToast('Update failed: ' + errMsg(err));
          }
        });
      }
    });
  }

  function saveTaskFromModal(taskId, state) {
    var title = vv('task-title').trim();
    if (!title) { showToast('Enter a title'); return; }
    var clientId = vv('task-client') || null;
    var clientName = '';
    if (clientId) {
      var c = (state.clients || []).filter(function (x) { return x.id === clientId; })[0];
      clientName = c ? (c.name || '') : '';
    }
    var assignedTo = vv('task-assignee') || null;
    var assignedToName = '';
    if (assignedTo) {
      var s = _staff.filter(function (x) { return x.uid === assignedTo; })[0];
      assignedToName = s ? (s.displayName || s.email || '') : '';
    }
    var dueDate = vv('task-due') || null;
    var status = vv('task-status') || 'todo';
    var notes = vv('task-notes').trim();
    var profile = (state && state.profile) || {};

    if (taskId) {
      AppDB.updateTask(taskId, { title: title, clientId: clientId, clientName: clientName, assignedTo: assignedTo, assignedToName: assignedToName, dueDate: dueDate || null, status: status, notes: notes })
        .then(function () {
          var idx = _tasks.findIndex(function (t) { return t.id === taskId; });
          if (idx !== -1) {
            _tasks[idx] = Object.assign({}, _tasks[idx], { title: title, clientId: clientId, clientName: clientName, assignedTo: assignedTo, assignedToName: assignedToName, dueDate: dueDate, status: status, notes: notes });
          }
          AppModal.close();
          renderTable(state);
          showToast('Task updated');
        })
        .catch(function (e) { showToast('Update failed: ' + errMsg(e)); });
    } else {
      AppDB.addTask({
        title: title,
        clientId: clientId,
        clientName: clientName,
        assignedTo: assignedTo,
        assignedToName: assignedToName,
        dueDate: dueDate,
        status: status,
        notes: notes,
        createdByName: (profile && profile.displayName) ? profile.displayName : ''
      }).then(function (ref) {
        _tasks.unshift({
          id: ref.id,
          title: title,
          clientId: clientId,
          clientName: clientName,
          assignedTo: assignedTo,
          assignedToName: assignedToName,
          dueDate: dueDate,
          status: status,
          notes: notes,
          createdAt: new Date().toISOString()
        });
        AppModal.close();
        renderTable(state);
        showToast('Task added');
      }).catch(function (e) {
        showToast('Add failed: ' + errMsg(e));
      });
    }
  }

  function init(state) {
    if (_inited) return;
    _inited = true;
    AppDB.getAllStaff().then(function (list) { _staff = list || []; }).catch(function () {});
    var statusFilter = $('tasks-filter-status');
    var clientFilter = $('tasks-filter-client');
    var assigneeFilter = $('tasks-filter-assignee');
    function applyFilters() { renderTable(state); }
    if (statusFilter) statusFilter.addEventListener('change', applyFilters);
    if (clientFilter) clientFilter.addEventListener('change', applyFilters);
    if (assigneeFilter) assigneeFilter.addEventListener('change', applyFilters);
  }

  window.Pages = window.Pages || {};
  window.Pages.tasks = { render: render, init: init };

  // Called by button onclick (and by delegate). Guarantees Add Task works.
  window.CareTrackOpenAddTask = function () {
    try {
      var s = window.CareTrack && window.CareTrack.getState ? window.CareTrack.getState() : null;
      if (!s) {
        showToast('App not ready');
        return;
      }
      showAddModal(s);
    } catch (err) {
      showToast('Could not open Add Task: ' + errMsg(err));
    }
  };

  document.addEventListener('click', function (e) {
    var el = e.target;
    if (!el || !el.closest) return;
    if (!el.closest('#tasks-add-btn')) return;
    e.preventDefault();
    window.CareTrackOpenAddTask();
  });
})();
