/**
 * Task detail page (task.html) — JIRA-style two-column layout with inline editing.
 */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var state = { user: null, profile: null, task: null, staff: [], clients: [], client: null, editLevel: false, canDelete: false, isEditing: false };
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
  function categoryLabel(val) {
    if (!val) return '—';
    var c = TASK_CATEGORIES.find(function (x) { return x.value === val; });
    return c ? c.label : val;
  }

  function esc(s) { var d = document.createElement('div'); d.textContent = s == null ? '' : s; return d.innerHTML; }
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
  function toast(msg) {
    var el = $('toast'); if (!el) return;
    el.textContent = msg; el.setAttribute('data-show', 'true');
    setTimeout(function () { el.setAttribute('data-show', 'false'); }, 3000);
  }

  function getBaseUrl() {
    if (typeof location === 'undefined') return '';
    var path = location.pathname || '';
    var dir = path.replace(/\/[^/]*$/, '/');
    return location.origin + dir;
  }

  window.CareTrack = {
    getState: function () { return state; },
    toast: toast,
    navigate: function (p) { window.location.href = getBaseUrl() + 'index.html?page=' + (p || 'tasks'); },
    openTask: function (id) { if (id) window.location.href = getBaseUrl() + 'task.html?id=' + encodeURIComponent(id); },
    openPatient: function (id) { if (id) window.location.href = getBaseUrl() + 'patient.html?id=' + encodeURIComponent(id); }
  };

  function hideLoading() { var el = $('loading-screen'); if (el) el.classList.add('hidden'); }
  function showApp() { $('task-app').removeAttribute('hidden'); hideLoading(); }

  function bindShareButton() {
    var shareBtn = $('task-share-btn');
    if (!shareBtn) return;
    function doCopy() {
      var url = window.location.href;
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(url).then(function () {
          toast('Link copied. Share with the creator for any doubts.');
        }).catch(function () { fallbackCopy(url); });
      } else {
        fallbackCopy(url);
      }
    }
    function fallbackCopy(url) {
      var ta = document.createElement('textarea');
      ta.value = url;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand('copy');
        toast('Link copied. Share with the creator for any doubts.');
      } catch (e) {
        toast('Copy failed. Share this link: ' + url);
      }
      document.body.removeChild(ta);
    }
    shareBtn.addEventListener('click', doCopy);
  }

  function pillLabel(val, labels) { return (labels[val] || val).toUpperCase().replace(/\s+/g, ' '); }

  /* ─── Render: view mode (read-only) ─────────────────────────── */
  function renderViewMode() {
    var root = $('task-detail-root');
    var t = state.task;
    if (!root || !t) return;

    var key = t.key || t.id;
    var p = t.priority || 'medium';
    var createdDateStr = t.createdAt ? new Date(t.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
    var canEditFull = state.editLevel === 'full';
    var canEditStatus = state.editLevel === 'full' || state.editLevel === 'progress';
    var canDelete = state.canDelete;

    var patientHtml = '';
    if (t.clientId && t.clientName) {
      patientHtml = '<a href="' + getBaseUrl() + 'patient.html?id=' + esc(t.clientId) + '" class="task-detail-link"><i class="fas fa-hospital-user"></i> ' + esc(t.clientName) + '</a>';
    } else {
      patientHtml = '<span class="task-detail-muted">None</span>';
    }

    var descriptionHtml = t.notes ? esc(t.notes).replace(/\n/g, '<br>') : '<span class="task-detail-muted">No description.</span>';
    var statusVal = t.status || 'todo';
    var statusBlock = '<span class="pill pill-status-' + statusVal + '">' + esc((STATUS_LABELS[statusVal] || statusVal).toUpperCase().replace(/\s+/g, ' ')) + '</span>';
    var priorityBlock = '<span class="pill pill-priority-' + p + '">' + esc((PRIORITY_LABELS[p] || p).toUpperCase()) + '</span>';
    var dueWrapClass = dueUrgency(t.dueDate, t.status) ? ' task-detail-due-wrap task-due-' + dueUrgency(t.dueDate, t.status) : '';
    var patientItem = '<div class="task-detail-meta-item task-detail-meta-cell"><span class="task-detail-meta-label">Patient</span><span class="task-detail-meta-value">' + patientHtml + '</span></div>';

    var statusOpts = [{ v: 'todo', l: 'To Do' }, { v: 'in_progress', l: 'In Progress' }, { v: 'done', l: 'Done' }];
    var priorityOpts = [{ v: 'high', l: 'High' }, { v: 'medium', l: 'Medium' }, { v: 'low', l: 'Low' }];
    var catOpts = TASK_CATEGORIES.map(function (c) { return { v: c.value, l: c.label }; });
    function getPillClass(field, val) {
      if (field === 'priority') return 'pill pill-priority-' + (val || 'medium');
      if (field === 'status') return 'pill pill-status-' + (val || 'todo');
      return 'pill task-detail-pill-category';
    }
    function pillDropdownHtml(field, opts, current, currentLabel) {
      var triggerPillClass = getPillClass(field, current);
      var optsHtml = opts.map(function (o) {
        var optPillClass = getPillClass(field, o.v);
        return '<div class="pill-option" role="option" tabindex="-1" data-value="' + esc(o.v) + '" data-label="' + esc(o.l) + '">' +
          '<span class="pill-option-label"><span class="' + optPillClass + '">' + esc(o.l) + '</span></span></div>';
      }).join('');
      return '<div class="task-detail-pill-dropdown" data-field="' + esc(field) + '">' +
        '<button type="button" class="pill-trigger task-detail-pill-trigger" aria-haspopup="listbox" aria-expanded="false">' +
        '<span class="task-detail-pill-value ' + triggerPillClass + '" data-value="' + esc(current) + '">' + esc(currentLabel) + '</span>' +
        '<i class="fas fa-chevron-down pill-chevron" aria-hidden="true"></i></button>' +
        '<div class="pill-dropdown-panel task-detail-pill-panel" role="listbox" hidden>' + optsHtml + '</div></div>';
    }
    var priorityLabel = (PRIORITY_LABELS[p] || p);
    var statusLabel = (STATUS_LABELS[statusVal] || statusVal);
    var categoryLabelCur = categoryLabel(t.category) || 'Uncategorized';
    var priorityValue = canEditFull ? pillDropdownHtml('priority', priorityOpts, p, priorityLabel) : priorityBlock;
    var statusValue = canEditStatus ? pillDropdownHtml('status', statusOpts, statusVal, statusLabel) : statusBlock;
    var categoryValue = canEditFull ? pillDropdownHtml('category', catOpts, t.category || '', categoryLabelCur) : esc(categoryLabelCur);

    root.innerHTML =
      '<div class="task-detail-card">' +
        '<div class="task-detail-title-wrap">' +
          '<h1 class="task-detail-title">' + esc(t.title || 'Untitled') + '</h1>' +
        '</div>' +
        '<div class="task-detail-desc-block">' +
          '<div class="task-detail-desc-view">' + descriptionHtml + '</div>' +
        '</div>' +
        '<div class="task-detail-meta-row task-detail-meta-row-1">' +
          '<div class="task-detail-meta-item task-detail-meta-cell"><span class="task-detail-meta-label">Priority</span><div class="task-detail-meta-value">' + priorityValue + '</div></div>' +
          '<div class="task-detail-meta-item task-detail-meta-cell task-detail-meta-due' + dueWrapClass + '"><span class="task-detail-meta-label">Due date</span><div class="task-detail-meta-value">' + (t.dueDate || '—') + '</div></div>' +
          patientItem +
        '</div>' +
        '<div class="task-detail-meta-row task-detail-meta-row-2">' +
          '<div class="task-detail-meta-item task-detail-meta-cell"><span class="task-detail-meta-label">Assignee</span><div class="task-detail-meta-value">' + esc(t.assignedToName || '—') + '</div></div>' +
          '<div class="task-detail-meta-item task-detail-meta-cell"><span class="task-detail-meta-label">Status</span><div class="task-detail-meta-value">' + statusValue + '</div></div>' +
          '<div class="task-detail-meta-item task-detail-meta-cell"><span class="task-detail-meta-label">Category</span><div class="task-detail-meta-value">' + categoryValue + '</div></div>' +
        '</div>' +
        '<div class="task-detail-created">Created on ' + esc(createdDateStr) + (t.createdByName ? ' by ' + esc(t.createdByName) : '') + '</div>' +
        '<hr class="task-detail-sep" />' +
        '<div class="task-detail-comments">' +
          '<h3 class="task-detail-comments-hd">Comments</h3>' +
          '<div class="task-detail-comments-form">' +
            '<textarea id="task-comment-input" class="fi" placeholder="Add a comment..." rows="2"></textarea>' +
            '<button type="button" class="btn btn-sm" id="task-comment-submit"><i class="fas fa-paper-plane"></i> Add</button>' +
          '</div>' +
          '<div class="task-detail-comments-list" id="task-comments-list"></div>' +
        '</div>' +
      '</div>';

    if ($('tb-title')) $('tb-title').textContent = key;
    document.title = key + ' — Maitra Wellness';

    var editBtn = $('task-edit-btn');
    var delBtn = $('task-delete-btn');
    if (editBtn) { editBtn.style.display = canEditFull ? '' : 'none'; editBtn.textContent = ''; editBtn.innerHTML = '<i class="fas fa-pen"></i> Edit'; }
    if (delBtn) delBtn.style.display = canDelete ? '' : 'none';

    bindInlineSelects();
    loadTaskComments();
  }

  function bindInlineSelects() {
    var t = state.task;
    if (!t) return;
    var root = $('task-detail-root');
    if (!root) return;
    var openPanels = [];
    root.querySelectorAll('.task-detail-pill-dropdown').forEach(function (wrap) {
      var field = wrap.getAttribute('data-field');
      var trigger = wrap.querySelector('.task-detail-pill-trigger');
      var panel = wrap.querySelector('.task-detail-pill-panel');
      var pillEl = wrap.querySelector('.task-detail-pill-value');
      if (!trigger || !panel || !pillEl) return;
      openPanels.push({ wrap: wrap, panel: panel, trigger: trigger });
      trigger.addEventListener('click', function (e) {
        e.stopPropagation();
        var open = !panel.hidden;
        panel.hidden = open;
        trigger.setAttribute('aria-expanded', open ? 'false' : 'true');
      });
      panel.querySelectorAll('.pill-option').forEach(function (opt) {
        opt.addEventListener('click', function () {
          var value = opt.getAttribute('data-value');
          var label = opt.getAttribute('data-label') || value;
          if (field === 'category') value = (value || '').trim();
          if (field === 'status') value = value || 'todo';
          if (field === 'priority') value = value || 'medium';
          var payload = {};
          payload[field] = value;
          AppDB.updateTask(t.id, payload).then(function () {
            state.task[field] = value;
            pillEl.setAttribute('data-value', value);
            pillEl.textContent = label;
            pillEl.className = 'task-detail-pill-value ' + (field === 'priority' ? 'pill pill-priority-' + value : field === 'status' ? 'pill pill-status-' + value : 'pill task-detail-pill-category');
            panel.hidden = true;
            trigger.setAttribute('aria-expanded', 'false');
            toast('Updated');
          }).catch(function (e) {
            toast('Update failed: ' + (e.message || ''));
          });
        });
      });
    });
    document.addEventListener('click', function closeAllPillPanels(e) {
      openPanels.forEach(function (p) {
        if (p.panel.hidden) return;
        if (p.wrap.contains(e.target)) return;
        p.panel.hidden = true;
        p.trigger.setAttribute('aria-expanded', 'false');
      });
    });
  }

  /* ─── Render: edit mode (form, no comments) ─────────────────── */
  function renderEditForm() {
    var root = $('task-detail-root');
    var t = state.task;
    if (!root || !t) return;

    var key = t.key || t.id;
    var editLevel = state.editLevel;
    var canEditFull = editLevel === 'full';

    var patientHtml = t.clientId && t.clientName
      ? '<a href="' + getBaseUrl() + 'patient.html?id=' + esc(t.clientId) + '" class="task-detail-link">' + esc(t.clientName) + '</a>'
      : '<span class="task-detail-muted">None</span>';

    var titleRow = canEditFull
      ? '<div class="task-edit-field"><label class="task-edit-label" for="task-edit-title">Title</label><input type="text" id="task-edit-title" class="fi" value="' + esc(t.title || '') + '" placeholder="Task title"></div>'
      : '';
    var descRow = canEditFull
      ? '<div class="task-edit-field"><label class="task-edit-label" for="task-edit-notes">Description</label><textarea id="task-edit-notes" class="fi" rows="4" placeholder="Description">' + esc(t.notes || '') + '</textarea></div>'
      : '';
    var statusRow = '<div class="task-edit-field"><label class="task-edit-label" for="task-edit-status">Status</label><select id="task-edit-status" class="fi">' +
      ['todo', 'in_progress', 'done'].map(function (v) {
        return '<option value="' + v + '"' + ((t.status || 'todo') === v ? ' selected' : '') + '>' + esc(STATUS_LABELS[v]) + '</option>';
      }).join('') + '</select></div>';

    var priorityRow = canEditFull
      ? '<div class="task-edit-field"><label class="task-edit-label" for="task-edit-priority">Priority</label><select id="task-edit-priority" class="fi">' +
        ['high', 'medium', 'low'].map(function (v) {
          return '<option value="' + v + '"' + ((t.priority || 'medium') === v ? ' selected' : '') + '>' + esc(PRIORITY_LABELS[v]) + '</option>';
        }).join('') + '</select></div>'
      : '';
    var dueRow = canEditFull
      ? '<div class="task-edit-field"><label class="task-edit-label" for="task-edit-due">Due date</label><input type="date" id="task-edit-due" class="fi" value="' + esc(t.dueDate || '') + '"></div>'
      : '';
    var assigneeLabel = t.assignedToName ? esc(t.assignedToName) : '<span class="multiselect-placeholder">Select...</span>';
    var assigneeRow = canEditFull
      ? '<div class="task-edit-field"><label class="task-edit-label">Assignee</label>' +
        '<input type="hidden" id="task-edit-assignee" value="' + esc(t.assignedTo || '') + '">' +
        '<div class="multiselect-wrap" id="task-edit-assignee-ms"><button type="button" class="multiselect-trigger fi" id="task-edit-assignee-trigger">' + assigneeLabel + '</button>' +
        '<div class="multiselect-panel" id="task-edit-assignee-panel"><input type="text" class="multiselect-search fi" id="task-edit-assignee-search" placeholder="Search..." autocomplete="off">' +
        '<div class="multiselect-options" id="task-edit-assignee-options"></div></div></div></div>'
      : '';
    var categoryOpts = TASK_CATEGORIES.map(function (c) {
      return '<option value="' + esc(c.value) + '"' + ((t.category || '') === c.value ? ' selected' : '') + '>' + esc(c.label) + '</option>';
    }).join('');
    var categoryRow = canEditFull
      ? '<div class="task-edit-field"><label class="task-edit-label" for="task-edit-category">Category</label><select id="task-edit-category" class="fi">' + categoryOpts + '</select></div>'
      : '';
    var clients = state.clients || [];
    var clientLabel = t.clientName ? esc(t.clientName) : '<span class="multiselect-placeholder">Select...</span>';
    var patientRow = canEditFull
      ? '<div class="task-edit-field"><label class="task-edit-label">Patient</label>' +
        '<input type="hidden" id="task-edit-client" value="' + esc(t.clientId || '') + '">' +
        '<div class="multiselect-wrap" id="task-edit-client-ms"><button type="button" class="multiselect-trigger fi" id="task-edit-client-trigger">' + clientLabel + '</button>' +
        '<div class="multiselect-panel" id="task-edit-client-panel"><input type="text" class="multiselect-search fi" id="task-edit-client-search" placeholder="Search..." autocomplete="off">' +
        '<div class="multiselect-options" id="task-edit-client-options"></div></div></div></div>'
      : '<div class="task-edit-readonly"><span class="task-edit-meta-label">Patient</span> ' + patientHtml + '</div>';

    root.innerHTML =
      '<div class="task-detail-card task-edit-card">' +
        '<h3 class="task-edit-hd">Edit task</h3>' +
        '<div class="task-edit-form">' +
          titleRow +
          descRow +
          '<div class="task-edit-meta-row">' +
            statusRow + priorityRow + dueRow + assigneeRow + categoryRow +
          '</div>' +
          patientRow +
          '<div class="task-edit-actions">' +
            '<button type="button" class="btn btn-primary" id="task-edit-save"><i class="fas fa-check"></i> Save</button>' +
            '<button type="button" class="btn btn-ghost" id="task-edit-cancel">Cancel</button>' +
          '</div>' +
        '</div>' +
      '</div>';

    if ($('tb-title')) $('tb-title').textContent = key + ' (editing)';
    var editBtn = $('task-edit-btn');
    var delBtn = $('task-delete-btn');
    if (editBtn) editBtn.style.display = 'none';
    if (delBtn) delBtn.style.display = 'none';
    if (canEditFull) {
      bindTaskEditSingleSelect('task-edit-assignee', [{ value: '', label: 'Unassigned' }].concat((state.staff || []).map(function (s) { return { value: s.uid, label: s.displayName || s.email || '' }; })), t.assignedTo || '');
      bindTaskEditSingleSelect('task-edit-client', [{ value: '', label: 'None' }].concat(clients.filter(function (c) { return c.status === 'active'; }).map(function (c) { return { value: c.id, label: c.name || '' }; })), t.clientId || '');
    }
  }

  function bindTaskEditSingleSelect(id, options, selectedValue) {
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

  function renderDetail() {
    var root = $('task-detail-root');
    if (!root || !state.task) return;
    if (state.isEditing) {
      renderEditForm();
      bindEditEvents();
    } else {
      renderViewMode();
      bindViewEvents();
    }
  }

  function renderComments(list) {
    var container = $('task-comments-list');
    if (!container) return;
    if (!list || !list.length) {
      container.innerHTML = '<div class="task-detail-comments-empty">No comments yet.</div>';
      return;
    }
    container.innerHTML = list.map(function (c) {
      var dateStr = c.createdAt ? new Date(c.createdAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';
      return '<div class="task-detail-comment">' +
        '<div class="task-detail-comment-meta">' + esc(c.createdByName || '') + ' · ' + esc(dateStr) + '</div>' +
        '<div class="task-detail-comment-text">' + esc(c.text || '') + '</div>' +
      '</div>';
    }).join('');
  }

  function loadTaskComments() {
    var t = state.task;
    if (!t || !t.id || !window.AppDB || !AppDB.getTaskComments) return;
    AppDB.getTaskComments(t.id).then(function (list) {
      renderComments(list || []);
    }).catch(function () { renderComments([]); });
  }

  /* ─── Event binding: view mode ─────────────────────────────── */
  function bindViewEvents() {
    var t = state.task;
    if (!t) return;

    var backBtn = $('task-back-btn');
    if (backBtn) backBtn.addEventListener('click', goBack);

    var editBtn = $('task-edit-btn');
    if (editBtn) editBtn.addEventListener('click', function () {
      state.isEditing = true;
      renderDetail();
    });

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
        window.location.href = getBaseUrl() + 'index.html?page=tasks';
      }).catch(function (e) { toast('Delete failed: ' + (e.message || '')); });
    }

    var commentInput = $('task-comment-input');
    var commentSubmit = $('task-comment-submit');
    if (commentSubmit && commentInput && AppDB.addTaskComment) {
      commentSubmit.addEventListener('click', function () {
        var text = (commentInput.value || '').trim();
        if (!text) return;
        if (window.CareTrack && window.CareTrack.setButtonLoading) window.CareTrack.setButtonLoading(commentSubmit, true, 'Adding...');
        AppDB.addTaskComment(t.id, text, (state.profile && state.profile.displayName) || '').then(function () {
          if (window.AppPush && AppPush.triggerPush) {
            AppPush.triggerPush({
              taskId: t.id,
              type: 'task_comment',
              taskTitle: t.title,
              addedBy: (AppDB.getCurrentUser() || {}).uid,
              addedByName: (state.profile && state.profile.displayName) || '',
              text: text.slice(0, 100)
            });
          }
          commentInput.value = '';
          if (window.CareTrack && window.CareTrack.setButtonLoading) window.CareTrack.setButtonLoading(commentSubmit, false);
          loadTaskComments();
          toast('Comment added');
        }).catch(function (e) {
          if (window.CareTrack && window.CareTrack.setButtonLoading) window.CareTrack.setButtonLoading(commentSubmit, false);
          toast('Failed: ' + (e.message || ''));
        });
      });
    }
  }

  /* ─── Event binding: edit mode ───────────────────────────────── */
  function bindEditEvents() {
    var t = state.task;
    if (!t) return;

    var backBtn = $('task-back-btn');
    if (backBtn) backBtn.addEventListener('click', goBack);

    var cancelBtn = $('task-edit-cancel');
    if (cancelBtn) cancelBtn.addEventListener('click', function () {
      state.isEditing = false;
      renderDetail();
    });

    var saveBtn = $('task-edit-save');
    if (saveBtn) saveBtn.addEventListener('click', function () {
      var editLevel = state.editLevel;
      var canEditFull = editLevel === 'full';
      var payload = {};

      var titleEl = $('task-edit-title');
      if (canEditFull && titleEl) {
        var title = (titleEl.value || '').trim();
        if (!title) { toast('Title cannot be empty'); return; }
        payload.title = title;
      }

      if (canEditFull) {
        var notesEl = $('task-edit-notes');
        if (notesEl) payload.notes = (notesEl.value || '').trim();
      }

      var statusEl = $('task-edit-status');
      if (statusEl) payload.status = statusEl.value || 'todo';

      if (canEditFull) {
        var priorityEl = $('task-edit-priority');
        if (priorityEl) payload.priority = priorityEl.value || 'medium';
        var dueEl = $('task-edit-due');
        if (dueEl) payload.dueDate = dueEl.value || null;
        var assigneeEl = $('task-edit-assignee');
        if (assigneeEl) {
          payload.assignedTo = assigneeEl.value || null;
          var s = (state.staff || []).filter(function (x) { return x.uid === payload.assignedTo; })[0];
          payload.assignedToName = s ? (s.displayName || s.email || '') : '';
        }
        var categoryEl = $('task-edit-category');
        if (categoryEl) payload.category = (categoryEl.value || '').trim();
        var clientEl = $('task-edit-client');
        if (clientEl) {
          payload.clientId = clientEl.value || null;
          var cl = (state.clients || []).filter(function (x) { return x.id === payload.clientId; })[0];
          payload.clientName = cl ? (cl.name || '') : '';
        }
      }

      if (window.CareTrack && window.CareTrack.setButtonLoading) window.CareTrack.setButtonLoading(saveBtn, true, 'Saving...');
      AppDB.updateTask(t.id, payload).then(function () {
        Object.keys(payload).forEach(function (k) { state.task[k] = payload[k]; });
        state.isEditing = false;
        renderDetail();
        toast('Task saved');
      }).catch(function (e) {
        if (window.CareTrack && window.CareTrack.setButtonLoading) window.CareTrack.setButtonLoading(saveBtn, false);
        toast('Save failed: ' + (e.message || ''));
      });
    });
  }

  /* ─── Navigation ──────────────────────────────────────────── */
  function goBack() {
    var fromOurApp = document.referrer && document.referrer.indexOf(window.location.origin) === 0;
    if (fromOurApp && window.history.length > 1) {
      window.history.back();
    } else {
      window.location.href = getBaseUrl() + 'index.html?page=tasks';
    }
  }

  /* ─── Auth + boot ──────────────────────────────────────────── */
  function run() {
    if (!window.AppDB || !AppDB.ready) { window.location.href = getBaseUrl() + 'index.html'; return; }
    var params = new URLSearchParams(window.location.search);
    var id = params.get('id');
    if (!id) { window.location.href = getBaseUrl() + 'index.html?page=tasks'; return; }

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
        else window.location.href = getBaseUrl() + 'index.html';
      }, 600);
    });
  }

  function loadTask(user, id) {
    state.user = user;
    Promise.all([
      AppDB.getTask(id),
      AppDB.getAllStaff ? AppDB.getAllStaff() : Promise.resolve([]),
      AppDB.getUserProfile ? AppDB.getUserProfile(user.uid) : Promise.resolve(null),
      AppDB.getClients ? AppDB.getClients() : Promise.resolve([])
    ]).then(function (results) {
      var task = results[0];
      state.staff = results[1] || [];
      state.profile = results[2] || {};
      state.clients = results[3] || [];
      if (!task) { toast('Task not found'); window.location.href = getBaseUrl() + 'index.html?page=tasks'; return; }
      state.task = task;
      var clientPromise = task.clientId && AppDB.getClient ? AppDB.getClient(task.clientId) : Promise.resolve(null);
      clientPromise.then(function (client) {
        state.client = client || null;
        if (window.Permissions && window.Permissions.canViewTask) {
          if (!window.Permissions.canViewTask(state.profile, state.task, state.client)) {
            toast('You do not have access to this task');
            window.location.href = getBaseUrl() + 'index.html?page=tasks';
            return;
          }
        }
        state.editLevel = (window.Permissions && window.Permissions.canEditTaskLevel)
          ? window.Permissions.canEditTaskLevel(state.profile, state.task, state.client) : 'full';
        state.canDelete = (window.Permissions && window.Permissions.canDeleteTask)
          ? window.Permissions.canDeleteTask(state.profile, state.task) : true;
        showApp();
        renderDetail();
        bindShareButton();
      }).catch(function () {
        state.client = null;
        state.editLevel = (window.Permissions && window.Permissions.canEditTaskLevel)
          ? window.Permissions.canEditTaskLevel(state.profile, state.task, null) : 'full';
        state.canDelete = (window.Permissions && window.Permissions.canDeleteTask)
          ? window.Permissions.canDeleteTask(state.profile, state.task) : true;
        showApp();
        renderDetail();
        bindShareButton();
      });
    }).catch(function (err) {
      toast(err && err.message ? err.message : 'Failed to load');
      window.location.href = getBaseUrl() + 'index.html?page=tasks';
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run);
  else run();
})();
