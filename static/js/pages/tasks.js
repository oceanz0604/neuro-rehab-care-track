/**
 * Tasks page — Kanban board only, task detail opens in task.html
 */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var _inited = false;
  var _tasks = [];
  var _staff = [];
  var STATUSES = ['todo', 'in_progress', 'done'];
  var STATUS_LABELS = { todo: 'To Do', in_progress: 'In Progress', done: 'Done' };
  var PRIORITY_ICONS = { high: 'fa-arrow-up', medium: 'fa-minus', low: 'fa-arrow-down' };
  var PRIORITY_LABELS = { high: 'High', medium: 'Medium', low: 'Low' };
  var TASK_CATEGORIES = [
    { value: '', label: 'Uncategorized' },
    { value: 'clinical', label: 'Clinical' },
    { value: 'administrative', label: 'Administrative' },
    { value: 'follow_up', label: 'Follow-up' },
    { value: 'medication', label: 'Medication' },
    { value: 'documentation', label: 'Documentation' },
    { value: 'other', label: 'Other' }
  ];
  var _tasksView = 'board'; // 'board' | 'list'

  function esc(s) { var d = document.createElement('div'); d.textContent = s == null ? '' : s; return d.innerHTML; }
  function showToast(msg) { if (window.CareTrack && CareTrack.toast) CareTrack.toast(msg); else alert(msg); }
  function errMsg(e) { return (e && (e.message || e.code)) || 'Unknown error'; }

  function getBaseUrl() {
    if (typeof location === 'undefined') return '';
    var path = location.pathname || '';
    return location.origin + path.replace(/\/[^/]*$/, '/');
  }
  function openTask(id) {
    if (window.CareTrack && CareTrack.openTask) CareTrack.openTask(id);
    else window.location.href = getBaseUrl() + 'task.html?id=' + encodeURIComponent(id);
  }

  function getClientForTask(task, clients) {
    if (!task || !task.clientId || !clients || !clients.length) return null;
    return clients.filter(function (c) { return c.id === task.clientId; })[0] || null;
  }

  function getVisibleTasks(tasks, profile, clients) {
    if (!window.Permissions || !window.Permissions.canViewTask) return tasks || [];
    if (!profile) return [];
    return (tasks || []).filter(function (t) {
      var client = getClientForTask(t, clients);
      return window.Permissions.canViewTask(profile, t, client);
    });
  }

  function getFilteredTasks(state) {
    var profile = (state && state.profile) || {};
    var clients = (state && state.clients) || [];
    return getVisibleTasks(_tasks, profile, clients);
  }

  function getListFilteredTasks(state) {
    var base = getFilteredTasks(state);
    var cat = ($('task-filter-category') || {}).value || '';
    var status = ($('task-filter-status') || {}).value || '';
    var priority = ($('task-filter-priority') || {}).value || '';
    var assignee = ($('task-filter-assignee') || {}).value || '';
    return base.filter(function (t) {
      if (cat) {
        if (cat === '__none__') { if ((t.category || '') !== '') return false; }
        else if ((t.category || '') !== cat) return false;
      }
      if (status && (t.status || 'todo') !== status) return false;
      if (priority && (t.priority || 'medium') !== priority) return false;
      if (assignee && (t.assignedTo || '') !== assignee) return false;
      return true;
    });
  }

  function initials(name) {
    if (!name) return '?';
    var parts = name.trim().split(/\s+/);
    return parts.length > 1 ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase() : name.slice(0, 2).toUpperCase();
  }

  function dueUrgency(dueDate, status) {
    if (!dueDate || status === 'done') return '';
    var d = new Date(dueDate);
    if (isNaN(d.getTime())) return '';
    d.setHours(0, 0, 0, 0);
    var today = new Date();
    today.setHours(0, 0, 0, 0);
    var diff = Math.ceil((d - today) / (24 * 60 * 60 * 1000));
    if (diff < 0) return 'overdue';
    if (diff === 0) return 'today';
    return '';
  }

  function applyView(state) {
    state = state || {};
    var addBtn = $('tasks-add-btn');
    if (addBtn && window.Permissions && window.Permissions.canCreateTask) {
      addBtn.style.display = window.Permissions.canCreateTask(state.profile) ? '' : 'none';
    }
    var viewBoard = $('tasks-view-board');
    var viewList = $('tasks-view-list');
    if (viewBoard && viewList) {
      viewBoard.classList.toggle('active', _tasksView === 'board');
      viewBoard.setAttribute('aria-selected', _tasksView === 'board' ? 'true' : 'false');
      viewList.classList.toggle('active', _tasksView === 'list');
      viewList.setAttribute('aria-selected', _tasksView === 'list' ? 'true' : 'false');
    }
    var boardWrap = $('tasks-board-wrap');
    var listWrap = $('tasks-list-wrap');
    var filtersEl = $('tasks-filters');
    if (_tasksView === 'list') {
      if (boardWrap) boardWrap.style.display = 'none';
      if (listWrap) listWrap.style.display = 'block';
      if (filtersEl) filtersEl.style.display = 'flex';
      populateAssigneeFilter();
      renderList(state);
    } else {
      if (boardWrap) boardWrap.style.display = 'block';
      if (listWrap) listWrap.style.display = 'none';
      if (filtersEl) filtersEl.style.display = 'none';
      renderBoard(state);
    }
  }

  function render(state) {
    if (!$('tasks-board-wrap')) return;
    state = state || {};
    function done() { applyView(state); }
    AppDB.getTasks().then(function (list) {
      _tasks = list || [];
      if (_staff.length) done();
      else (AppDB.getAllStaff ? AppDB.getAllStaff() : Promise.resolve([])).then(function (s) { _staff = s || []; done(); }).catch(done);
    }).catch(function () {
      var col = $('task-col-todo');
      if (col) col.innerHTML = '<div class="task-board-empty"><i class="fas fa-exclamation-triangle"></i> Failed to load</div>';
    });
  }

  function populateAssigneeFilter() {
    var sel = $('task-filter-assignee');
    if (!sel) return;
    var current = sel.value;
    sel.innerHTML = '<option value="">All assignees</option>' + (_staff || []).map(function (s) {
      return '<option value="' + esc(s.uid) + '">' + esc(s.displayName || s.email || s.uid) + '</option>';
    }).join('');
    if (current) sel.value = current;
  }

  function categoryLabel(val) {
    if (!val) return '—';
    var c = TASK_CATEGORIES.find(function (x) { return x.value === val; });
    return c ? c.label : val;
  }

  function renderList(state) {
    var tbody = $('task-list-tbody');
    var emptyEl = $('task-list-empty');
    if (!tbody) return;
    var list = getListFilteredTasks(state);
    list.sort(function (a, b) {
      var aDue = a.dueDate || '';
      var bDue = b.dueDate || '';
      if (aDue !== bDue) return aDue.localeCompare(bDue);
      var order = { todo: 0, in_progress: 1, done: 2 };
      return (order[a.status] || 0) - (order[b.status] || 0);
    });
    if (!list.length) {
      tbody.innerHTML = '';
      if (emptyEl) { emptyEl.style.display = 'block'; emptyEl.querySelector('p').textContent = 'No tasks match the filters.'; }
      return;
    }
    if (emptyEl) emptyEl.style.display = 'none';
    tbody.innerHTML = list.map(function (t) {
      var key = t.key || ('T-' + (t.id || '').slice(-6));
      var p = t.priority || 'medium';
      var urgency = dueUrgency(t.dueDate, t.status);
      var dueClass = urgency ? ' task-due-' + urgency : '';
      return '<tr class="task-list-row' + dueClass + '" data-task-id="' + esc(t.id) + '" role="button" tabindex="0">' +
        '<td><span class="task-list-key">' + esc(key) + '</span></td>' +
        '<td class="task-list-title" title="' + esc(t.title || '') + '">' + esc(t.title || '—') + '</td>' +
        '<td>' + esc(categoryLabel(t.category)) + '</td>' +
        '<td><span class="task-status-badge status-' + (t.status || 'todo') + '">' + esc(STATUS_LABELS[t.status] || t.status) + '</span></td>' +
        '<td><span class="task-priority-badge priority-' + p + '">' + esc(PRIORITY_LABELS[p] || p) + '</span></td>' +
        '<td class="task-list-due">' + (t.dueDate ? esc(t.dueDate) : '—') + '</td>' +
        '<td>' + esc(t.assignedToName || '—') + '</td>' +
        '<td>' + esc(t.clientName || '—') + '</td></tr>';
    }).join('');
    tbody.querySelectorAll('.task-list-row').forEach(function (row) {
      row.addEventListener('click', function () { openTask(row.getAttribute('data-task-id')); });
      row.addEventListener('keydown', function (e) { if (e.key === 'Enter') openTask(row.getAttribute('data-task-id')); });
    });
  }

  function renderBoard(state) {
    var filtered = getFilteredTasks(state);
    STATUSES.forEach(function (status) {
      var col = $('task-col-' + status);
      var countEl = $('task-count-' + status);
      if (!col) return;
      var list = filtered.filter(function (t) { return (t.status || 'todo') === status; });
      if (countEl) countEl.textContent = list.length;
      if (!list.length) {
        col.classList.remove('has-cards');
        col.innerHTML = '<div class="task-board-empty"><i class="fas fa-inbox"></i>No tasks here</div>';
        return;
      }
      col.classList.add('has-cards');
      col.innerHTML = list.map(function (t) { return cardHtml(t, state); }).join('');
      col.querySelectorAll('.task-card').forEach(function (card) {
        card.addEventListener('click', function () { openTask(card.getAttribute('data-task-id')); });
        card.addEventListener('keydown', function (e) { if (e.key === 'Enter') openTask(card.getAttribute('data-task-id')); });
      });
    });
  }

  function cardHtml(t, state) {
    var key = t.key || ('T-' + (t.id || '').slice(-6));
    var p = t.priority || 'medium';
    var pIcon = PRIORITY_ICONS[p] || 'fa-minus';
    var urgency = dueUrgency(t.dueDate, t.status);
    var dueClass = urgency ? ' task-due-' + urgency : '';
    var uid = (state && state.user && state.user.uid) || '';
    var youBadge = (t.assignedTo && t.assignedTo === uid) ? '<span class="task-card-you-badge">YOU</span>' : '';
    var avatar = t.assignedToName ? '<span class="task-card-avatar" title="' + esc(t.assignedToName) + '">' + initials(t.assignedToName) + '</span>' : '';
    var catLabel = (t.category && TASK_CATEGORIES.find(function (c) { return c.value === t.category; })) ? TASK_CATEGORIES.find(function (c) { return c.value === t.category; }).label : (t.category || '');
    var catTag = catLabel ? '<span class="task-card-tag task-card-category">' + esc(catLabel) + '</span>' : '';
    var patientTag = t.clientName ? '<span class="task-card-tag"><i class="fas fa-hospital-user"></i> ' + esc(t.clientName) + '</span>' : '';
    var dueTag = t.dueDate ? '<span class="task-card-tag' + (urgency ? ' task-due-tag-' + urgency : '') + '"><i class="fas fa-calendar"></i> ' + esc(t.dueDate) + '</span>' : '';
    return '<div class="task-card priority-card-' + p + dueClass + '" data-task-id="' + esc(t.id) + '" role="button" tabindex="0">' +
      '<div class="task-card-top">' +
        '<span class="task-card-key-wrap">' +
          '<span class="task-card-key">' + esc(key) + '</span>' +
          (youBadge ? youBadge : '') +
        '</span>' +
        '<span class="task-card-priority-icon priority-' + p + '" title="' + esc(PRIORITY_LABELS[p] || p) + '"><i class="fas ' + pIcon + '"></i></span>' +
      '</div>' +
      '<div class="task-card-title">' + esc(t.title || '—') + '</div>' +
      '<div class="task-card-footer">' + catTag + patientTag + dueTag + avatar + '</div>' +
    '</div>';
  }

  /* ─── Create / Edit Modal ─────────────────────────────────────── */
  function bindTaskSingleSelect(id, options, selectedValue) {
    var wrap = document.getElementById(id + '-ms');
    var trigger = document.getElementById(id + '-trigger');
    var panel = document.getElementById(id + '-panel');
    var optionsContainer = document.getElementById(id + '-options');
    var searchInp = document.getElementById(id + '-search');
    var hiddenInput = document.getElementById(id);
    if (!wrap || !trigger || !panel || !optionsContainer || !hiddenInput) return;
    var opts = options || [];
    optionsContainer.innerHTML = opts.map(function (o) {
      return '<div class="single-select-option" data-value="' + esc(o.value) + '" data-label="' + esc(o.label || '') + '">' + esc(o.label || o.value || '') + '</div>';
    }).join('');
    function filterOptions() {
      var q = (searchInp && searchInp.value) ? searchInp.value.trim().toLowerCase() : '';
      optionsContainer.querySelectorAll('.single-select-option').forEach(function (el) {
        var text = (el.getAttribute('data-label') || el.textContent || '').toLowerCase();
        el.style.display = !q || text.indexOf(q) !== -1 ? '' : 'none';
      });
    }
    if (searchInp) {
      searchInp.addEventListener('input', filterOptions);
      searchInp.addEventListener('focus', function (e) { e.stopPropagation(); });
    }
    function setSelected(val, label) {
      hiddenInput.value = val || '';
      trigger.innerHTML = (label || '').trim() ? esc(label) : '<span class="multiselect-placeholder">Select...</span>';
    }
    var selected = opts.filter(function (o) { return (o.value || '') === (selectedValue || ''); })[0];
    setSelected(selectedValue || '', selected ? (selected.label || '') : '');
    optionsContainer.querySelectorAll('.single-select-option').forEach(function (el) {
      el.addEventListener('click', function () {
        var val = el.getAttribute('data-value');
        var label = el.getAttribute('data-label') || el.textContent || '';
        setSelected(val, label);
        wrap.classList.remove('open');
      });
    });
    trigger.addEventListener('click', function () {
      wrap.classList.toggle('open');
      if (searchInp && wrap.classList.contains('open')) { searchInp.value = ''; filterOptions(); searchInp.focus(); }
    });
    document.addEventListener('click', function (e) {
      if (!wrap.contains(e.target)) wrap.classList.remove('open');
    });
  }

  function buildModalHtml(task, state) {
    var clients = state.clients || [];
    var assigneeLabel = task && task.assignedToName ? task.assignedToName : 'Unassigned';
    var clientLabel = task && task.clientName ? task.clientName : 'None';
    function selOpt(opts, cur) {
      return opts.map(function (o) { return '<option value="' + o.v + '"' + (cur === o.v ? ' selected' : '') + '>' + o.l + '</option>'; }).join('');
    }
    var statusOpts = selOpt([{v:'todo',l:'To Do'},{v:'in_progress',l:'In Progress'},{v:'done',l:'Done'}], task ? task.status : 'todo');
    var prioOpts = selOpt([{v:'high',l:'High'},{v:'medium',l:'Medium'},{v:'low',l:'Low'}], task ? (task.priority || 'medium') : 'medium');
    var catOpts = TASK_CATEGORIES.map(function (c) { return '<option value="' + esc(c.value) + '"' + (task && (task.category || '') === c.value ? ' selected' : '') + '>' + esc(c.label) + '</option>'; }).join('');

    return '<div class="modal-card modal-card-wide"><h3 class="modal-title">' + (task ? 'Edit Task' : 'Create Task') + '</h3>' +
      '<div class="form-grid" style="gap:14px">' +
        '<div class="fg fg-full"><label>Title <span style="color:var(--accent)">*</span></label><input id="task-title" type="text" class="fi" placeholder="What needs to be done?" value="' + esc(task ? task.title : '') + '" autofocus></div>' +
        '<div class="fg" style="flex:1;min-width:140px"><label>Category</label><select id="task-category" class="fi">' + catOpts + '</select></div>' +
        '<div class="fg" style="flex:1;min-width:140px"><label>Priority</label><select id="task-priority" class="fi">' + prioOpts + '</select></div>' +
        '<div class="fg" style="flex:1;min-width:140px"><label>Status</label><select id="task-status" class="fi">' + statusOpts + '</select></div>' +
        '<div class="fg" style="flex:1;min-width:140px"><label>Assignee</label>' +
        '<input type="hidden" id="task-assignee" value="' + esc(task && task.assignedTo ? task.assignedTo : '') + '">' +
        '<div class="multiselect-wrap" id="task-assignee-ms"><button type="button" class="multiselect-trigger fi" id="task-assignee-trigger">' + (assigneeLabel !== 'Unassigned' ? esc(assigneeLabel) : '<span class="multiselect-placeholder">Select...</span>') + '</button>' +
        '<div class="multiselect-panel" id="task-assignee-panel"><input type="text" class="multiselect-search fi" id="task-assignee-search" placeholder="Search..." autocomplete="off">' +
        '<div class="multiselect-options" id="task-assignee-options"></div></div></div></div>' +
        '<div class="fg" style="flex:1;min-width:140px"><label>Due date</label><input id="task-due" type="date" class="fi" value="' + esc(task && task.dueDate ? task.dueDate : '') + '"></div>' +
        '<div class="fg fg-full"><label>Patient</label>' +
        '<input type="hidden" id="task-client" value="' + esc(task && task.clientId ? task.clientId : '') + '">' +
        '<div class="multiselect-wrap" id="task-client-ms"><button type="button" class="multiselect-trigger fi" id="task-client-trigger">' + (clientLabel !== 'None' ? esc(clientLabel) : '<span class="multiselect-placeholder">Select...</span>') + '</button>' +
        '<div class="multiselect-panel" id="task-client-panel"><input type="text" class="multiselect-search fi" id="task-client-search" placeholder="Search..." autocomplete="off">' +
        '<div class="multiselect-options" id="task-client-options"></div></div></div></div>' +
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
    var task = taskId ? _tasks.filter(function (t) { return t.id === taskId; })[0] : null;
    var assigneeOpts = [{ value: '', label: 'Unassigned' }].concat(_staff.map(function (s) { return { value: s.uid, label: s.displayName || s.email || '' }; }));
    bindTaskSingleSelect('task-assignee', assigneeOpts, task ? task.assignedTo : '');
    var clientOpts = [{ value: '', label: 'None' }].concat((state.clients || []).filter(function (c) { return c.status === 'active'; }).map(function (c) { return { value: c.id, label: c.name || '' }; }));
    bindTaskSingleSelect('task-client', clientOpts, task ? task.clientId : '');
  }

  function saveFromModal(taskId, state) {
    var gv = function (id) { return (document.getElementById(id) || {}).value || ''; };
    var title = gv('task-title').trim();
    if (!title) { showToast('Title is required'); return; }
    var saveBtn = document.getElementById('task-modal-save');
    if (window.CareTrack && window.CareTrack.setButtonLoading) window.CareTrack.setButtonLoading(saveBtn, true, taskId ? 'Saving...' : 'Creating...');
    var clientId = gv('task-client') || null;
    var clientName = '';
    if (clientId) { var c = (state.clients || []).filter(function (x) { return x.id === clientId; })[0]; clientName = c ? (c.name || '') : ''; }
    var assignedTo = gv('task-assignee') || null;
    var assignedToName = '';
    if (assignedTo) { var s = _staff.filter(function (x) { return x.uid === assignedTo; })[0]; assignedToName = s ? (s.displayName || s.email || '') : ''; }
    var category = (document.getElementById('task-category') && document.getElementById('task-category').value) || '';
    var data = {
      title: title, category: category, clientId: clientId, clientName: clientName,
      assignedTo: assignedTo, assignedToName: assignedToName,
      dueDate: gv('task-due') || null, status: gv('task-status') || 'todo',
      priority: gv('task-priority') || 'medium', notes: gv('task-notes').trim()
    };
    var profile = (state && state.profile) || {};

    if (taskId) {
      AppDB.updateTask(taskId, data).then(function () {
        if (window.AppPush && AppPush.triggerPush) {
          var task = _tasks.find(function (t) { return t.id === taskId; });
          AppPush.triggerPush({
            taskId: taskId,
            type: 'task_updated',
            taskTitle: (task && task.title) || data.title,
            assignedTo: data.assignedTo !== undefined ? data.assignedTo : (task && task.assignedTo),
            addedBy: (AppDB.getCurrentUser() || {}).uid,
            addedByName: profile.displayName || ''
          });
        }
        var i = _tasks.findIndex(function (t) { return t.id === taskId; });
        if (i !== -1) _tasks[i] = Object.assign({}, _tasks[i], data);
        AppModal.close();
        refreshView(state);
        showToast('Task updated');
      }).catch(function (e) { if (window.CareTrack && window.CareTrack.setButtonLoading) window.CareTrack.setButtonLoading(saveBtn, false); showToast('Failed: ' + errMsg(e)); });
    } else {
      data.createdByName = profile.displayName || '';
      AppDB.addTask(data).then(function (ref) {
        if (window.AppPush && AppPush.triggerPush) {
          AppPush.triggerPush({
            taskId: ref.id,
            type: 'task_created',
            taskTitle: data.title,
            createdBy: (AppDB.getCurrentUser() || {}).uid,
            createdByName: profile.displayName || '',
            assignedTo: data.assignedTo,
            assignedToName: data.assignedToName || ''
          });
        }
        _tasks.unshift(Object.assign({ id: ref.id, key: 'T-' + (ref.id.length >= 6 ? ref.id.slice(-6).toUpperCase() : ref.id), createdAt: new Date().toISOString() }, data));
        AppModal.close();
        refreshView(state);
        showToast('Task created');
      }).catch(function (e) { if (window.CareTrack && window.CareTrack.setButtonLoading) window.CareTrack.setButtonLoading(saveBtn, false); showToast('Failed: ' + errMsg(e)); });
    }
  }

  function refreshView(state) {
    applyView(state);
  }

  /* ─── Init ─────────────────────────────────────────────────── */
  function init(state) {
    if (_inited) return;
    _inited = true;
    (AppDB.getAllStaff ? AppDB.getAllStaff() : Promise.resolve([])).then(function (s) { _staff = s || []; }).catch(function () {});

    var board = $('task-board');
    if (board) {
      board.addEventListener('click', function (e) {
        var hd = e.target && e.target.closest ? e.target.closest('.task-board-col-hd') : null;
        if (!hd) return;
        var col = hd.closest('.task-board-column');
        if (!col) return;
        var collapsed = col.classList.toggle('collapsed');
        hd.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
      });
      board.addEventListener('keydown', function (e) {
        var hd = e.target && e.target.closest ? e.target.closest('.task-board-col-hd') : null;
        if (!hd || (e.key !== 'Enter' && e.key !== ' ')) return;
        e.preventDefault();
        var col = hd.closest('.task-board-column');
        if (!col) return;
        var collapsed = col.classList.toggle('collapsed');
        hd.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
      });
    }

    var viewBoard = $('tasks-view-board');
    var viewList = $('tasks-view-list');
    if (viewBoard) viewBoard.addEventListener('click', function () {
      _tasksView = 'board';
      viewBoard.classList.add('active'); viewBoard.setAttribute('aria-selected', 'true');
      if (viewList) { viewList.classList.remove('active'); viewList.setAttribute('aria-selected', 'false'); }
      applyView(window.CareTrack && window.CareTrack.getState ? window.CareTrack.getState() : state);
    });
    if (viewList) viewList.addEventListener('click', function () {
      _tasksView = 'list';
      viewList.classList.add('active'); viewList.setAttribute('aria-selected', 'true');
      if (viewBoard) { viewBoard.classList.remove('active'); viewBoard.setAttribute('aria-selected', 'false'); }
      applyView(window.CareTrack && window.CareTrack.getState ? window.CareTrack.getState() : state);
    });

    ['task-filter-category', 'task-filter-status', 'task-filter-priority', 'task-filter-assignee'].forEach(function (id) {
      var el = $(id);
      if (el) el.addEventListener('change', function () {
        applyView(window.CareTrack && window.CareTrack.getState ? window.CareTrack.getState() : {});
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
