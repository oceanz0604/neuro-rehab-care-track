/**
 * Tasks page — JIRA-style: Board (Kanban) + List view, open task in task.html
 */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var _inited = false;
  var _tasks = [];
  var _staff = [];
  var _currentView = 'board'; // 'board' | 'list'
  var STATUS_OPTIONS = [
    { value: 'todo', label: 'To Do' },
    { value: 'in_progress', label: 'In Progress' },
    { value: 'done', label: 'Done' }
  ];
  var PRIORITY_OPTIONS = [
    { value: 'high', label: 'High' },
    { value: 'medium', label: 'Medium' },
    { value: 'low', label: 'Low' }
  ];

  function esc(s) { var d = document.createElement('div'); d.textContent = s == null ? '' : s; return d.innerHTML; }
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

  function openTask(id) {
    if (window.CareTrack && window.CareTrack.openTask) {
      window.CareTrack.openTask(id);
      return;
    }
    window.location.href = '/task.html?id=' + encodeURIComponent(id);
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
    var boardWrap = $('tasks-board-wrap');
    var listWrap = $('tasks-list-wrap');
    if (!boardWrap && !listWrap) return;

    function done() {
      populateFilterDropdowns(state);
      if (_currentView === 'board') renderBoard(state);
      else renderTable(state);
    }
    AppDB.getTasks().then(function (list) {
      _tasks = list || [];
      if (_staff.length) done();
      else AppDB.getAllStaff().then(function (list) { _staff = list || []; done(); }).catch(done);
    }).catch(function () {
      var container = $('tasks-list');
      if (container) container.innerHTML = '<div class="empty-state"><i class="fas fa-exclamation-triangle"></i> Failed to load tasks.</div>';
      var colTodo = $('task-col-todo');
      if (colTodo) colTodo.innerHTML = '<div class="empty-state">Failed to load.</div>';
    });
  }

  function renderBoard(state) {
    var filtered = getFilteredTasks();
    ['todo', 'in_progress', 'done'].forEach(function (status) {
      var col = $('task-col-' + status);
      if (!col) return;
      var list = filtered.filter(function (t) { return (t.status || 'todo') === status; });
      if (!list.length) {
        col.innerHTML = '<div class="task-board-empty">No tasks</div>';
        return;
      }
      col.innerHTML = list.map(function (t) {
        var key = t.key || ('T-' + (t.id || '').slice(-6));
        var priority = (t.priority || 'medium');
        return '<div class="task-card" data-task-id="' + esc(t.id) + '" role="button" tabindex="0">' +
          '<span class="task-card-key">' + esc(key) + '</span>' +
          '<span class="task-card-priority priority-' + priority + '"></span>' +
          '<div class="task-card-title">' + esc(t.title || '—') + '</div>' +
          (t.assignedToName ? '<div class="task-card-assignee"><i class="fas fa-user"></i> ' + esc(t.assignedToName) + '</div>' : '') +
          (t.dueDate ? '<div class="task-card-due"><i class="fas fa-calendar"></i> ' + esc(t.dueDate) + '</div>' : '') +
          '</div>';
      }).join('');
      col.querySelectorAll('.task-card').forEach(function (card) {
        card.addEventListener('click', function () { openTask(card.getAttribute('data-task-id')); });
        card.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openTask(card.getAttribute('data-task-id')); } });
      });
    });
  }

  function renderTable(state) {
    var container = $('tasks-list');
    var filtered = getFilteredTasks();

    if (!container) return;
    if (!filtered.length) {
      container.innerHTML = '<div class="empty-state"><i class="fas fa-list-check"></i><p>' + (_tasks.length ? 'No tasks match the filters' : 'No tasks yet. Create one to get started.') + '</p></div>';
      return;
    }

    var html = '<table class="staff-table task-list-table"><thead><tr><th>Key</th><th>Title</th><th>Priority</th><th>Patient</th><th>Assignee</th><th>Due date</th><th>Status</th><th>Actions</th></tr></thead><tbody>';
    filtered.forEach(function (t) {
      var statusLabel = (STATUS_OPTIONS.filter(function (s) { return s.value === t.status; })[0] || {}).label || t.status;
      var key = t.key || ('T-' + (t.id || '').slice(-6));
      var priorityLabel = (PRIORITY_OPTIONS.filter(function (p) { return p.value === (t.priority || 'medium'); })[0] || {}).label || 'Medium';
      html += '<tr class="task-list-row" data-task-id="' + esc(t.id) + '">' +
        '<td><span class="task-list-key">' + esc(key) + '</span></td>' +
        '<td><strong>' + esc(t.title || '—') + '</strong></td>' +
        '<td><span class="task-priority-badge priority-' + (t.priority || 'medium') + '">' + esc(priorityLabel) + '</span></td>' +
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

    container.querySelectorAll('.task-list-row').forEach(function (row) {
      row.style.cursor = 'pointer';
      row.addEventListener('click', function (e) {
        if (e.target.closest('button')) return;
        openTask(row.getAttribute('data-task-id'));
      });
    });
    container.querySelectorAll('[data-edit]').forEach(function (b) {
      b.addEventListener('click', function (e) { e.stopPropagation(); showEditModal(b.getAttribute('data-edit'), state); });
    });
    container.querySelectorAll('[data-delete]').forEach(function (b) {
      b.addEventListener('click', function (e) {
        e.stopPropagation();
        var id = b.getAttribute('data-delete');
        var t = _tasks.filter(function (x) { return x.id === id; })[0];
        if (!window.AppModal || !AppModal.confirm) {
          if (confirm('Delete "' + (t ? t.title : '') + '"?')) doDel(id);
          return;
        }
        AppModal.confirm('Delete Task', 'Delete "' + esc(t ? t.title : '') + '"?' , function () { doDel(id); }, 'Delete');
      });
    });

    function doDel(id) {
      AppDB.deleteTask(id).then(function () {
        _tasks = _tasks.filter(function (x) { return x.id !== id; });
        renderTable(state);
        if (window.CareTrack) window.CareTrack.toast('Task deleted');
      }).catch(function () { if (window.CareTrack) window.CareTrack.toast('Delete failed'); });
    }
  }

  function buildTaskModalHtml(task, state) {
    var clients = state.clients || [];
    var clientOpts = '<option value="">-- No patient --</option>' + clients.filter(function (c) { return c.status === 'active'; }).map(function (c) {
      var sel = (task && task.clientId === c.id) ? ' selected' : '';
      return '<option value="' + esc(c.id) + '"' + sel + '>' + esc(c.name || '') + '</option>';
    }).join('');
    var staffOpts = '<option value="">-- Unassigned --</option>' + _staff.map(function (s) {
      var sel = (task && task.assignedTo === s.uid) ? ' selected' : '';
      return '<option value="' + esc(s.uid) + '"' + sel + '>' + esc(s.displayName || s.email || '') + '</option>';
    }).join('');
    var statusOpts = STATUS_OPTIONS.map(function (s) {
      var sel = (task && task.status === s.value) ? ' selected' : (!task && s.value === 'todo') ? ' selected' : '';
      return '<option value="' + s.value + '"' + sel + '>' + s.label + '</option>';
    }).join('');
    var priorityOpts = PRIORITY_OPTIONS.map(function (p) {
      var sel = (task ? (task.priority || 'medium') : 'medium') === p.value ? ' selected' : '';
      return '<option value="' + p.value + '"' + sel + '>' + p.label + '</option>';
    }).join('');
    return '<div class="modal-card modal-card-task"><h3 class="modal-title">' + (task ? 'Edit Task' : 'Create Task') + '</h3>' +
      '<div class="form-grid">' +
        '<div class="fg fg-full"><label>Title</label><input id="task-title" type="text" class="fi" placeholder="Task title" value="' + esc(task ? task.title : '') + '"></div>' +
        '<div class="fg fg-full"><label>Priority</label><select id="task-priority" class="fi">' + priorityOpts + '</select></div>' +
        '<div class="fg fg-full"><label>Patient (optional)</label><select id="task-client" class="fi">' + clientOpts + '</select></div>' +
        '<div class="fg fg-full"><label>Assigned to (optional)</label><select id="task-assignee" class="fi">' + staffOpts + '</select></div>' +
        '<div class="fg fg-full"><label>Due date</label><input id="task-due" type="date" class="fi" value="' + esc(task && task.dueDate ? task.dueDate : '') + '"></div>' +
        '<div class="fg fg-full"><label>Status</label><select id="task-status" class="fi">' + statusOpts + '</select></div>' +
        '<div class="fg fg-full"><label>Description</label><textarea id="task-notes" class="fi" rows="3" placeholder="Optional description">' + esc(task ? task.notes : '') + '</textarea></div>' +
      '</div>' +
      '<div class="modal-actions" style="margin-top:18px">' +
        '<button type="button" class="btn btn-ghost" id="task-modal-cancel">Cancel</button>' +
        '<button type="button" class="btn" id="task-modal-save">' + (task ? 'Save' : 'Create') + '</button>' +
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
          try { saveTaskFromModal(null, state); } catch (err) { showToast('Create failed: ' + errMsg(err)); }
        });
      }
    });
  }

  function showEditModal(taskId, state) {
    var task = _tasks.filter(function (t) { return t.id === taskId; })[0];
    if (!task) return;
    if (!window.AppModal || typeof window.AppModal.open !== 'function') {
      showToast('Modal not available');
      return;
    }
    window.AppModal.open(buildTaskModalHtml(task, state), {
      onReady: function () {
        var modalEl = document.getElementById('modal-container');
        if (!modalEl) return;
        var cancelBtn = modalEl.querySelector('#task-modal-cancel');
        var saveBtn = modalEl.querySelector('#task-modal-save');
        if (cancelBtn) cancelBtn.addEventListener('click', AppModal.close);
        if (saveBtn) saveBtn.addEventListener('click', function () {
          try { saveTaskFromModal(taskId, state); } catch (err) { showToast('Update failed: ' + errMsg(err)); }
        });
      }
    });
  }

  function saveTaskFromModal(taskId, state) {
    var title = (document.getElementById('task-title') || {}).value;
    if (title !== undefined) title = (title || '').trim();
    if (!title) { showToast('Enter a title'); return; }
    var clientId = (document.getElementById('task-client') || {}).value || null;
    var clientName = '';
    if (clientId) {
      var c = (state.clients || []).filter(function (x) { return x.id === clientId; })[0];
      clientName = c ? (c.name || '') : '';
    }
    var assignedTo = (document.getElementById('task-assignee') || {}).value || null;
    var assignedToName = '';
    if (assignedTo) {
      var s = _staff.filter(function (x) { return x.uid === assignedTo; })[0];
      assignedToName = s ? (s.displayName || s.email || '') : '';
    }
    var dueDate = (document.getElementById('task-due') || {}).value || null;
    var status = (document.getElementById('task-status') || {}).value || 'todo';
    var priority = (document.getElementById('task-priority') || {}).value || 'medium';
    var notes = (document.getElementById('task-notes') || {}).value;
    if (notes !== undefined) notes = (notes || '').trim();
    var profile = (state && state.profile) || {};

    if (taskId) {
      AppDB.updateTask(taskId, { title: title, clientId: clientId, clientName: clientName, assignedTo: assignedTo, assignedToName: assignedToName, dueDate: dueDate || null, status: status, priority: priority, notes: notes })
        .then(function () {
          var idx = _tasks.findIndex(function (t) { return t.id === taskId; });
          if (idx !== -1) {
            _tasks[idx] = Object.assign({}, _tasks[idx], { title: title, clientId: clientId, clientName: clientName, assignedTo: assignedTo, assignedToName: assignedToName, dueDate: dueDate, status: status, priority: priority, notes: notes });
          }
          AppModal.close();
          if (_currentView === 'board') renderBoard(state); else renderTable(state);
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
        priority: priority,
        notes: notes,
        createdByName: (profile && profile.displayName) ? profile.displayName : ''
      }).then(function (ref) {
        var newTask = {
          id: ref.id,
          key: 'T-' + (ref.id.length >= 6 ? ref.id.slice(-6).toUpperCase() : ref.id),
          title: title,
          clientId: clientId,
          clientName: clientName,
          assignedTo: assignedTo,
          assignedToName: assignedToName,
          dueDate: dueDate,
          status: status,
          priority: priority,
          notes: notes,
          createdAt: new Date().toISOString()
        };
        _tasks.unshift(newTask);
        AppModal.close();
        if (_currentView === 'board') renderBoard(state); else renderTable(state);
        showToast('Task created');
      }).catch(function (e) {
        showToast('Create failed: ' + errMsg(e));
      });
    }
  }

  function init(state) {
    if (_inited) return;
    _inited = true;
    AppDB.getAllStaff().then(function (list) { _staff = list || []; }).catch(function () {});

    function applyFilters() {
      if (_currentView === 'board') renderBoard(state);
      else renderTable(state);
    }
    var statusFilter = $('tasks-filter-status');
    var clientFilter = $('tasks-filter-client');
    var assigneeFilter = $('tasks-filter-assignee');
    if (statusFilter) statusFilter.addEventListener('change', applyFilters);
    if (clientFilter) clientFilter.addEventListener('change', applyFilters);
    if (assigneeFilter) assigneeFilter.addEventListener('change', applyFilters);

    document.querySelectorAll('.tasks-view-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var view = btn.getAttribute('data-view');
        if (!view || view === _currentView) return;
        _currentView = view;
        document.querySelectorAll('.tasks-view-btn').forEach(function (b) {
          b.classList.toggle('active', b.getAttribute('data-view') === view);
          b.classList.toggle('btn-outline', b.getAttribute('data-view') !== view);
          b.setAttribute('aria-selected', b.getAttribute('data-view') === view ? 'true' : 'false');
        });
        var boardWrap = $('tasks-board-wrap');
        var listWrap = $('tasks-list-wrap');
        if (boardWrap) boardWrap.style.display = view === 'board' ? '' : 'none';
        if (listWrap) listWrap.style.display = view === 'list' ? '' : 'none';
        if (view === 'board') renderBoard(state);
        else renderTable(state);
      });
    });
  }

  window.Pages = window.Pages || {};
  window.Pages.tasks = { render: render, init: init };

  window.CareTrackOpenAddTask = function () {
    try {
      var s = window.CareTrack && window.CareTrack.getState ? window.CareTrack.getState() : null;
      if (!s) { showToast('App not ready'); return; }
      showAddModal(s);
    } catch (err) {
      showToast('Could not open Create Task: ' + errMsg(err));
    }
  };

  document.addEventListener('click', function (e) {
    if (!e.target || !e.target.closest) return;
    if (!e.target.closest('#tasks-add-btn')) return;
    e.preventDefault();
    window.CareTrackOpenAddTask();
  });
})();
