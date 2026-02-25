/**
 * Patient detail page — overview, clinical tabs with pre-fill, report history.
 */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var _bound = false;
  var _currentTab = 'overview';
  var _client = null;
  var _lastRenderedClientId = null;
  var _latestReports = {};
  var _cachedReports100 = { clientId: null, docs: [] };

  var ALL_TABS = [
    { key: 'overview',  label: 'Overview',  icon: 'fa-id-card' },
    { key: 'notes',     label: 'Comments',  icon: 'fa-comment-dots' },
    { key: 'history',   label: 'History',   icon: 'fa-clock-rotate-left' }
  ];

  function getVisibleTabs(client, state) {
    var profile = (state && state.profile) || {};
    var Perm = window.Permissions;
    if (!Perm) return ALL_TABS.filter(function (t) { return t.key === 'overview'; });
    var tabs = [];
    if (Perm.canViewOverview(profile)) tabs.push(ALL_TABS[0]); /* Overview */
    if (Perm.canViewOverview(profile)) tabs.push(ALL_TABS[1]); /* Comments */
    if (client && Perm.canViewHistoryFor(profile, client)) tabs.push(ALL_TABS[2]); /* History */
    return tabs.length ? tabs : [ALL_TABS[0]];
  }

  var REPORT_SECTIONS = [
    { key: 'psychiatric', label: 'Psychiatric',  icon: 'fa-brain' },
    { key: 'behavioral',  label: 'Behavioral',   icon: 'fa-comments' },
    { key: 'medication',  label: 'Medication & Compliance', icon: 'fa-pills' },
    { key: 'adl',         label: 'ADL',          icon: 'fa-hands-helping' },
    { key: 'therapeutic', label: 'Therapeutic',  icon: 'fa-dumbbell' },
    { key: 'risk',        label: 'Risk',         icon: 'fa-shield-halved' }
  ];

  function getTabFromUrl() {
    var params = new URLSearchParams(window.location.search);
    var t = params.get('tab');
    var state = window.CareTrack && window.CareTrack.getState ? window.CareTrack.getState() : {};
    var visible = getVisibleTabs(_client, state);
    return visible.some(function (x) { return x.key === t; }) ? t : (visible[0] ? visible[0].key : 'overview');
  }

  function setTabInUrl(tab, replace) {
    var url = new URL(window.location.href);
    url.searchParams.set('tab', tab);
    if (replace) window.history.replaceState({ tab: tab }, '', url.toString());
    else window.history.pushState({ tab: tab }, '', url.toString());
  }

  function render(state) {
    _client = state.selectedClientData;
    if (!_client) { $('pd-header').innerHTML = '<p>Patient not found.</p>'; $('pd-tabs').innerHTML = ''; $('pd-content').innerHTML = ''; if ($('tb-title')) $('tb-title').textContent = 'Patient'; return; }

    if ($('tb-title')) $('tb-title').textContent = _client.name || 'Patient';
    if (_client.id !== _lastRenderedClientId) {
      _lastRenderedClientId = _client.id;
      _currentTab = 'overview';
      setTabInUrl('overview', true);
    } else {
      _currentTab = getTabFromUrl();
      setTabInUrl(_currentTab, true);
    }
    $('pd-header').innerHTML = headerHTML(_client, state);
    var visibleTabs = getVisibleTabs(_client, state);
    if (visibleTabs.length && visibleTabs.every(function (t) { return t.key !== _currentTab; })) {
      _currentTab = visibleTabs[0].key;
      setTabInUrl(_currentTab, true);
    }
    $('pd-tabs').innerHTML = visibleTabs.map(function (t) {
      return '<button type="button" class="tab-btn' + (t.key === _currentTab ? ' active' : '') + '" data-tab="' + t.key + '"><i class="fas ' + t.icon + '"></i> ' + t.label + '</button>';
    }).join('');

    bindTabs();
    renderTab(_currentTab, state);
  }

  function headerHTML(c, state) {
    var profile = (state && state.profile) || {};
    var Perm = window.Permissions;
    var canEdit = Perm && Perm.canEditPatientFor(profile, c);
    var canAddDiag = Perm && Perm.canAddDiagnosisFor(profile, c);
    var canAddReport = Perm && Perm.canAddReport(profile);
    var riskLabel = (c.currentRisk && c.currentRisk !== 'none') ? (c.currentRisk) : 'Low';
    var riskClass = (c.currentRisk && c.currentRisk !== 'none') ? c.currentRisk : 'low';
    var riskBadge = '<span class="risk-badge risk-' + riskClass + '">Risk: ' + riskLabel + '</span>';
    var actions = '';
    if (canAddDiag && c.status !== 'discharged') actions += '<button type="button" class="btn btn-outline btn-sm" id="pd-add-diagnosis-header-btn"><i class="fas fa-stethoscope"></i> Add Diagnosis</button>';
    if (canAddReport && c.status !== 'discharged') actions += '<button type="button" class="btn btn-outline btn-sm" id="pd-add-report-btn"><i class="fas fa-file-lines"></i> Add Report</button>';
    if (canEdit) actions += '<button type="button" class="btn btn-outline btn-sm" id="pd-edit-btn"><i class="fas fa-pen"></i> Edit</button>';
    var assignedDisplay = (c.assignedDoctors && c.assignedDoctors.length ? c.assignedDoctors.join(', ') : c.assignedTherapist) || '';
    var wardBed = [c.ward, c.roomNumber].filter(Boolean).join(' / ') || '';
    var rows = [];
    if (c.gender) rows.push('<div class="patient-detail-row"><span class="patient-detail-label">Gender</span><span class="patient-detail-value">' + esc(c.gender) + '</span></div>');
    rows.push('<div class="patient-detail-row"><span class="patient-detail-label">Admission Date</span><span class="patient-detail-value">' + (c.admissionDate ? esc(c.admissionDate) : '—') + '</span></div>');
    if (c.plannedDischargeDate) rows.push('<div class="patient-detail-row"><span class="patient-detail-label">Planned Discharge Date</span><span class="patient-detail-value">' + esc(c.plannedDischargeDate) + '</span></div>');
    if (c.status === 'discharged' && c.dischargeDate) rows.push('<div class="patient-detail-row"><span class="patient-detail-label">Final Discharge Date</span><span class="patient-detail-value">' + esc(c.dischargeDate) + '</span></div>');
    if (assignedDisplay) rows.push('<div class="patient-detail-row"><span class="patient-detail-label">Assigned Doctors</span><span class="patient-detail-value">' + esc(assignedDisplay) + '</span></div>');
    if (wardBed) rows.push('<div class="patient-detail-row"><span class="patient-detail-label">Ward & Bed</span><span class="patient-detail-value">' + esc(wardBed) + '</span></div>');
    var topRow = '<div class="patient-header-top">' + riskBadge + (actions ? '<div class="patient-actions">' + actions + '</div>' : '') + '</div>';
    var detailsHtml = rows.length ? '<div class="patient-details-vertical">' + rows.join('') + '</div>' : '';
    return '<div class="patient-header">' + topRow + detailsHtml + '</div>';
  }

  function bindTabs() {
    $('pd-tabs').querySelectorAll('.tab-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        _currentTab = btn.getAttribute('data-tab');
        setTabInUrl(_currentTab, false);
        $('pd-tabs').querySelectorAll('.tab-btn').forEach(function (b) { b.classList.remove('active'); });
        btn.classList.add('active');
        renderTab(_currentTab, window.CareTrack.getState());
      });
    });
    bindHeaderActions();
  }

  function bindHeaderActions() {
    var addDiag = document.getElementById('pd-add-diagnosis-header-btn');
    if (addDiag) addDiag.addEventListener('click', showAddDiagnosisModal);
    var addReport = document.getElementById('pd-add-report-btn');
    if (addReport) addReport.addEventListener('click', showAddReportModal);
    var edit = document.getElementById('pd-edit-btn');
    if (edit) edit.addEventListener('click', showEditModal);
    /* Discharge button is bound in renderOverview (bottom section) */
  }

  function showEditModal() {
    var c = _client;
    var html =
      '<div class="modal-card"><h3 class="modal-title">Edit Patient</h3><div class="form-grid">' +
      fgv('ep-name', 'Full Name', 'text', c.name) +
      fgv('ep-dob', 'Date of Birth', 'date', c.dob) +
      fgs('ep-gender', 'Gender', ['', 'Male', 'Female', 'Other'], c.gender) +
      multiselectFg('ep-diag', 'Initial diagnosis') +
      fgv('ep-planned-discharge', 'Planned Discharge Date', 'date', c.plannedDischargeDate) +
      fgv('ep-legal', 'Legal Status', 'text', c.legalStatus) +
      fgv('ep-emergency', 'Emergency Contact', 'text', c.emergencyContact) +
      fgv('ep-consent', 'Consent', 'text', c.consent) +
      multiselectFg('ep-doctors', 'Assigned doctor(s)') +
      fgv('ep-ward', 'Ward', 'text', c.ward) +
      fgv('ep-room', 'Room', 'text', c.roomNumber) +
      fgs('ep-risk', 'Risk Level', ['none', 'low', 'medium', 'high'], c.currentRisk) +
      '</div><div class="modal-actions" style="margin-top:18px">' +
      '<button type="button" class="btn btn-ghost" id="ep-cancel">Cancel</button>' +
      '<button type="button" class="btn" id="ep-save">Save</button></div></div>';

    AppModal.open(html, {
      onReady: function () {
        var state = window.CareTrack && window.CareTrack.getState ? window.CareTrack.getState() : {};
        var cfg = state.config || {};
        var diagnosisOptions = cfg.diagnosisOptions || [];
        var selectedDiag = (c.diagnoses && c.diagnoses.length ? c.diagnoses : (c.diagnosis ? [c.diagnosis] : []));
        var diagOpts = diagnosisOptions.slice();
        selectedDiag.forEach(function (d) { if (d && diagOpts.indexOf(d) === -1) diagOpts.push(d); });
        bindMultiselect('ep-diag', diagOpts, selectedDiag);
        AppDB.getAllStaff().then(function (staff) {
          var doctorOptions = staff.filter(function (s) { return s.isActive !== false; })
            .map(function (s) { return s.displayName || s.email || ''; })
            .filter(Boolean);
          var selectedDoctors = (c.assignedDoctors && c.assignedDoctors.length ? c.assignedDoctors : (c.assignedTherapist ? [c.assignedTherapist] : []));
          selectedDoctors.forEach(function (d) { if (d && doctorOptions.indexOf(d) === -1) doctorOptions.push(d); });
          bindMultiselect('ep-doctors', doctorOptions, selectedDoctors);
        }).catch(function () {
          var selectedDoctors = (c.assignedDoctors && c.assignedDoctors.length ? c.assignedDoctors : (c.assignedTherapist ? [c.assignedTherapist] : []));
          bindMultiselect('ep-doctors', selectedDoctors.length ? selectedDoctors : [], selectedDoctors);
        });

        document.getElementById('ep-cancel').addEventListener('click', AppModal.close);
        document.getElementById('ep-save').addEventListener('click', function () {
          var diagnoses = getMultiselectValues('ep-diag');
          var assignedDoctors = getMultiselectValues('ep-doctors');
          var data = {
            name: v('ep-name'), dob: v('ep-dob'), gender: v('ep-gender'),
            plannedDischargeDate: v('ep-planned-discharge') || null,
            legalStatus: v('ep-legal'), emergencyContact: v('ep-emergency'), consent: v('ep-consent'),
            ward: v('ep-ward'), roomNumber: v('ep-room'), currentRisk: v('ep-risk'),
            diagnoses: diagnoses,
            diagnosis: diagnoses[0] || '',
            assignedDoctors: assignedDoctors,
            assignedTherapist: assignedDoctors[0] || ''
          };
          if (!data.name) { window.CareTrack.toast('Name required'); return; }
          AppDB.updateClient(_client.id, data).then(function () {
            AppModal.close(); window.CareTrack.toast('Patient updated');
            window.CareTrack.refreshData().then(function () {
              window.CareTrack.openPatient(_client.id);
            });
          }).catch(function (e) { window.CareTrack.toast('Error: ' + e.message); });
        });
      }
    });
  }

  function multiselectFg(id, label) {
    return '<div class="fg fg-full"><label>' + label + '</label>' +
      '<div class="multiselect-wrap" id="' + id + '-ms">' +
      '<button type="button" class="multiselect-trigger fi" id="' + id + '-trigger">Select...</button>' +
      '<div class="multiselect-panel" id="' + id + '-panel">' +
      '<input type="text" class="multiselect-search fi" id="' + id + '-search" placeholder="Search..." autocomplete="off">' +
      '<div class="multiselect-options" id="' + id + '-options"></div></div></div></div>';
  }
  function bindMultiselect(id, options, selected) {
    var wrap = document.getElementById(id + '-ms');
    var trigger = document.getElementById(id + '-trigger');
    var panel = document.getElementById(id + '-panel');
    var optionsContainer = document.getElementById(id + '-options');
    var searchInp = document.getElementById(id + '-search');
    if (!wrap || !trigger || !panel || !optionsContainer) return;
    var selectedSet = {};
    (selected || []).forEach(function (v) { selectedSet[v] = true; });
    var opts = (options || []).map(function (o) { return (o || '').trim(); }).filter(Boolean);
    optionsContainer.innerHTML = opts.map(function (val) {
      var checked = selectedSet[val] ? ' checked' : '';
      return '<label data-value="' + esc(val) + '"><input type="checkbox" value="' + esc(val) + '"' + checked + '>' + esc(val) + '</label>';
    }).join('');
    function filterOptions() {
      var q = (searchInp && searchInp.value) ? searchInp.value.trim().toLowerCase() : '';
      optionsContainer.querySelectorAll('label').forEach(function (label) {
        var text = (label.getAttribute('data-value') || label.textContent || '').toLowerCase();
        label.style.display = !q || text.indexOf(q) !== -1 ? '' : 'none';
      });
    }
    if (searchInp) {
      searchInp.addEventListener('input', filterOptions);
      searchInp.addEventListener('focus', function (e) { e.stopPropagation(); });
    }
    function updateTrigger() {
      var vals = getMultiselectValues(id);
      if (vals.length === 0) { trigger.innerHTML = '<span class="multiselect-placeholder">Select...</span>'; return; }
      trigger.innerHTML = vals.map(function (v) { return '<span class="multiselect-chip">' + esc(v) + '</span>'; }).join('');
    }
    updateTrigger();
    optionsContainer.querySelectorAll('input[type=checkbox]').forEach(function (cb) { cb.addEventListener('change', updateTrigger); });
    trigger.addEventListener('click', function () {
      wrap.classList.toggle('open');
      if (searchInp && wrap.classList.contains('open')) { searchInp.value = ''; filterOptions(); searchInp.focus(); }
    });
    document.addEventListener('click', function (e) { if (!wrap.contains(e.target)) wrap.classList.remove('open'); });
  }
  function getMultiselectValues(id) {
    var optionsContainer = document.getElementById(id + '-options');
    if (!optionsContainer) return [];
    var vals = [];
    optionsContainer.querySelectorAll('input[type=checkbox]:checked').forEach(function (cb) { vals.push(cb.value); });
    return vals;
  }

  function v(id) { return (document.getElementById(id) || {}).value || ''; }
  function fgv(id, label, type, val) { return '<div class="fg"><label>' + label + '</label><input id="' + id + '" type="' + type + '" class="fi" value="' + esc(val || '') + '"></div>'; }
  function fgs(id, label, opts, sel) {
    return '<div class="fg"><label>' + label + '</label><select id="' + id + '" class="fi">' +
      opts.map(function (o) { return '<option value="' + o + '"' + (o === sel ? ' selected' : '') + '>' + (o || '—') + '</option>'; }).join('') +
    '</select></div>';
  }

  /* ─── Tab rendering ────────────────────────────────────────── */
  function renderTab(tab, state) {
    var el = $('pd-content');
    if (tab === 'overview') { renderOverview(el); return; }
    if (tab === 'notes') { renderNotesTab(el, state); return; }
    if (tab === 'history')  { renderHistory(el); return; }
    renderClinicalTab(el, tab, state);
  }

  function collapsible(id, title, bodyHtml, expanded) {
    var cls = expanded !== false ? 'collapsible-section' : 'collapsible-section collapsed';
    return '<div class="' + cls + '" id="' + id + '">' +
      '<button type="button" class="collapsible-head" aria-expanded="' + (expanded !== false ? 'true' : 'false') + '">' +
      '<i class="fas fa-chevron-down"></i> ' + title +
      '</button><div class="collapsible-body">' + bodyHtml + '</div></div>';
  }

  function bindCollapsibles(container) {
    if (!container) return;
    container.querySelectorAll('.collapsible-section .collapsible-head').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var section = btn.closest('.collapsible-section');
        if (section) {
          section.classList.toggle('collapsed');
          btn.setAttribute('aria-expanded', section.classList.contains('collapsed') ? 'false' : 'true');
        }
      });
    });
  }

  function renderOverview(el) {
    var state = window.CareTrack && window.CareTrack.getState ? window.CareTrack.getState() : {};
    var profile = (state && state.profile) || {};
    var canDischarge = window.Permissions && window.Permissions.canDischargePatientFor(profile, _client);
    var showDischarge = _client && _client.status === 'active' && canDischarge;
    var bottomSection = showDischarge
      ? '<div class="patient-detail-bottom"><div class="patient-detail-bottom-actions"><button type="button" class="btn btn-danger btn-sm" id="pd-discharge-btn"><i class="fas fa-right-from-bracket"></i> Discharge</button></div></div>'
      : '';
    el.innerHTML = '<div id="pd-status-body"><i class="fas fa-spinner fa-spin"></i> Loading...</div>' + bottomSection;
    loadOverviewStatus();
    var dis = document.getElementById('pd-discharge-btn');
    if (dis) dis.addEventListener('click', function () {
      AppModal.confirm('Discharge Patient', 'Are you sure you want to discharge <strong>' + esc(_client.name) + '</strong>?', function () {
        AppDB.dischargeClient(_client.id).then(function () {
          window.CareTrack.toast('Patient discharged');
          window.CareTrack.refreshData();
          window.CareTrack.navigate('patients');
        });
      });
    });
  }

  function renderNotesTab(el, state) {
    if (!_client) return;
    var profile = (state && state.profile) || {};
    var displayName = (profile.displayName || profile.email || 'Staff').trim();
    el.innerHTML =
      '<div class="patient-notes-wrap">' +
        '<div class="patient-notes-list" id="pd-notes-list"><div class="empty-state" style="padding:20px"><i class="fas fa-spinner fa-spin"></i> Loading...</div></div>' +
        '<div class="patient-notes-compose">' +
          '<textarea id="pd-notes-input" class="fi patient-notes-textarea" rows="2" placeholder="Add a note or comment..." maxlength="2000"></textarea>' +
          '<button type="button" class="btn btn-sm" id="pd-notes-send"><i class="fas fa-paper-plane"></i> Send</button>' +
        '</div>' +
      '</div>';
    loadPatientNotes();
    var input = document.getElementById('pd-notes-input');
    var sendBtn = document.getElementById('pd-notes-send');
    function sendNote() {
      var text = (input && input.value) ? input.value.trim() : '';
      if (!text) return;
      sendBtn.disabled = true;
      AppDB.addClientNote(_client.id, { text: text, addedByName: displayName }).then(function () {
        input.value = '';
        sendBtn.disabled = false;
        loadPatientNotes();
      }).catch(function (e) {
        if (window.CareTrack.toast) window.CareTrack.toast('Failed to add note: ' + (e.message || ''));
        sendBtn.disabled = false;
      });
    }
    if (sendBtn) sendBtn.addEventListener('click', sendNote);
    if (input) input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendNote(); }
    });
  }

  function loadPatientNotes() {
    var list = document.getElementById('pd-notes-list');
    if (!list || !_client) return;
    AppDB.getClientNotes(_client.id).then(function (notes) {
      if (!notes.length) {
        list.innerHTML = '<div class="empty-state patient-notes-empty"><i class="fas fa-comment-dots"></i><p>No comments yet. Add a note below.</p></div>';
        return;
      }
      list.innerHTML = notes.map(function (n) {
        var dateTime = n.createdAt ? new Date(n.createdAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';
        var by = esc(n.addedByName || '—');
        var text = esc((n.text || '').trim() || '(no text)');
        return '<div class="patient-note-msg">' +
          '<div class="patient-note-meta">' + by + ' · ' + dateTime + '</div>' +
          '<div class="patient-note-text">' + text + '</div></div>';
      }).join('');
      list.scrollTop = list.scrollHeight;
    }).catch(function () {
      list.innerHTML = '<div class="empty-state patient-notes-empty"><p>Could not load notes.</p></div>';
    });
  }

  function loadOverviewObservations() {
    var el = document.getElementById('pd-observations-body');
    if (!el || !_client) return;
    AppDB.getClientDiagnosisHistory(_client.id).then(function (entries) {
      if (!entries.length) {
        el.innerHTML = '<p class="empty-state" style="margin:0">No notes or observations yet.</p>';
        return;
      }
      el.innerHTML = '<ul class="diagnosis-history-list">' + entries.map(function (e) {
        var fromStr = e.fromDate || '—';
        var addedStr = e.addedByName ? ' by ' + esc(e.addedByName) : '';
        return '<li><span class="diagnosis-history-text">' + esc(e.diagnosis || '—') + '</span>' +
          '<span class="diagnosis-history-meta">From ' + fromStr + addedStr + '</span></li>';
      }).join('') + '</ul>';
    }).catch(function () { if (el) el.innerHTML = '<p class="empty-state" style="margin:0">Could not load.</p>'; });
  }

  function loadOverviewStatus() {
    var el = document.getElementById('pd-status-body');
    if (!el || !_client) return;
    var sections = ['psychiatric', 'behavioral', 'medication', 'adl', 'therapeutic', 'risk'];

    function diagnosisBlock(entries) {
      if (!entries || !entries.length) return '<div class="status-diagnosis-block"><p class="status-empty">No consultation notes yet.</p></div>';
      var latest = entries[0];
      var diagnosisStr = (latest.diagnosis || '').trim();
      var items = diagnosisStr ? diagnosisStr.split(',').map(function (s) { return s.trim(); }).filter(Boolean) : [];
      var latestDiagnosisHtml = items.length
        ? '<ul class="consult-diagnosis-list">' + items.map(function (item) { return '<li>' + esc(item) + '</li>'; }).join('') + '</ul>'
        : '<span class="consult-no-diagnosis">—</span>';
      var html = '<div class="status-diagnosis-block">';
      html += '<div class="status-sub-hd"><i class="fas fa-stethoscope"></i> Latest diagnosis</div>';
      html += '<div class="consult-latest-diagnosis">' + latestDiagnosisHtml + '</div>';
      html += '<div class="status-sub-hd consult-notes-hd"><i class="fas fa-comments"></i> Consultation notes</div>';
      html += '<div class="consult-chat">';
      var sorted = entries.slice().sort(function (a, b) {
        var ta = a.createdAt ? (typeof a.createdAt === 'string' ? new Date(a.createdAt).getTime() : 0) : 0;
        var tb = b.createdAt ? (typeof b.createdAt === 'string' ? new Date(b.createdAt).getTime() : 0) : 0;
        return ta - tb;
      });
      sorted.forEach(function (e) {
        var dateTimeStr = e.createdAt
          ? new Date(e.createdAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
          : (e.fromDate ? new Date(e.fromDate + 'T12:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—');
        var meta = (e.addedByName ? esc(e.addedByName) + ' · ' : '') + dateTimeStr;
        var note = (e.notes && e.notes.trim()) ? esc(e.notes) : '<span class="consult-no-note">No note text</span>';
        html += '<div class="consult-chat-msg">';
        html += '<div class="consult-chat-meta">' + meta + '</div>';
        html += '<div class="consult-chat-body">' + note + '</div>';
        html += '</div>';
      });
      html += '</div></div>';
      return html;
    }

    function renderStatus(bodyEl, bySection, diagnosisEntries) {
      var html = diagnosisBlock(diagnosisEntries || []);
      html += sections.map(function (sec) {
        var item = bySection[sec];
        var dt = '—', sub = '—', bodyHtml = '<p class="status-empty">No report yet.</p>';
        if (item && item.report) {
          var r = item.report;
          dt = r.createdAt ? new Date(r.createdAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : '—';
          sub = r.submittedByName || '—';
          bodyHtml = formatPayloadHorizontal(sec, r.payload || {});
        }
        return '<div class="latest-summary-item status-section-item">' +
          '<div class="latest-summary-hd"><span class="risk-badge risk-' + sectionColor(sec) + '">' + capitalize(sec) + '</span>' +
          '<span style="font-size:.8rem;color:var(--text-3)">' + dt + ' · ' + esc(sub) + '</span></div>' +
          '<div class="status-section-detail">' + bodyHtml + '</div></div>';
      }).join('');
      bodyEl.innerHTML = html;
    }

    function finish(bySection, diagnosisEntries) {
      renderStatus(el, bySection, diagnosisEntries);
    }

    var reportsPromise = _cachedReports100.clientId === _client.id && _cachedReports100.docs.length > 0
      ? Promise.resolve(_cachedReports100.docs)
      : AppDB.getClientReports(_client.id, null, 100, null).then(function (res) {
          _cachedReports100 = { clientId: _client.id, docs: res.docs || [] };
          return _cachedReports100.docs;
        });
    var diagnosisPromise = AppDB.getClientDiagnosisHistory(_client.id).catch(function () { return []; });

    Promise.all([reportsPromise, diagnosisPromise]).then(function (results) {
      var docs = results[0] || [];
      var diagnosisEntries = results[1] || [];
      finish(getLatestReportPerSection(docs), diagnosisEntries);
    }).catch(function () {
      if (el) el.innerHTML = '<p class="empty-state" style="margin:0">Could not load status.</p>';
    });
  }

  function renderDiagnosisTab(el) {
    var profile = (window.CareTrack && window.CareTrack.getState().profile) || {};
    var canEdit = window.Permissions && window.Permissions.canEditPatient(profile);
    el.innerHTML = '<div class="card">' +
      '<div class="card-hd" style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px">' +
      '<span><i class="fas fa-stethoscope"></i> Diagnosis &amp; consultation</span>' +
      (canEdit ? '<button type="button" class="btn btn-outline btn-sm" id="pd-add-diagnosis-btn"><i class="fas fa-plus"></i> Add note</button>' : '') +
      '</div>' +
      '<p class="pg-sub" style="margin-top:-8px;margin-bottom:12px">Patient-level diagnosis. Latest consultation note below.</p>' +
      '<div id="pd-diagnosis-history-body"><i class="fas fa-spinner fa-spin"></i> Loading...</div></div>';
    loadDiagnosisHistory();
    var addBtn = document.getElementById('pd-add-diagnosis-btn');
    if (addBtn) addBtn.addEventListener('click', showAddDiagnosisModal);
  }

  function renderReportsTab(el, state) {
    if (!_client) return;
    el.innerHTML = '<p class="pd-reports-summary-line" style="margin-bottom:16px;color:var(--text-2);font-size:.9rem"><i class="fas fa-spinner fa-spin"></i> Loading...</p>';
    AppDB.getClientReports(_client.id, null, 100, null).then(function (res) {
      var bySection = getLatestReportPerSection(res.docs || []);
      var summaryParts = REPORT_SECTIONS.map(function (s) {
        var item = bySection[s.key];
        var txt = item && item.report ? new Date(item.report.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) + ' ' + new Date(item.report.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : 'No report yet';
        return capitalize(s.key) + ': ' + txt;
      });
      var summaryHtml = '<p class="pd-reports-summary-line" style="margin-bottom:16px;color:var(--text-2);font-size:.9rem">' + esc(summaryParts.join(' &middot; ')) + '</p>';
      var profile = (state && state.profile) || {};
      var sectionsHtml = REPORT_SECTIONS.map(function (s) {
        var payload = (bySection[s.key] && bySection[s.key].report && bySection[s.key].report.payload) ? bySection[s.key].report.payload : {};
        var params = getParams(s.key, state);
        var formHtml = getSectionFormHtml(s.key, params, payload);
        var canSave = window.Permissions && window.Permissions.canSubmitSection(profile, s.key);
        var cardInner = '<div class="card-hd"><i class="fas ' + s.icon + '"></i> ' + s.label + '</div>' + formHtml +
          '<div class="fg fg-full" style="margin-top:14px"><label>Notes</label><textarea class="fi ct-notes" rows="3">' + esc(payload.notes || '') + '</textarea></div>' +
          (canSave ? '<div style="margin-top:14px"><button type="button" class="btn ct-save" disabled data-section="' + esc(s.key) + '"><i class="fas fa-save"></i> Save Report</button></div>' : '');
        return collapsible('pd-reports-' + s.key, s.label, '<div class="card ct-card" data-section="' + s.key + '">' + cardInner + '</div>', false);
      }).join('');
      el.innerHTML = summaryHtml + sectionsHtml;
      bindCollapsibles(el);
      var _reportDirty = {};
      REPORT_SECTIONS.forEach(function (s) {
        var card = el.querySelector('.ct-card[data-section="' + s.key + '"]');
        if (!card) return;
        var saveBtn = card.querySelector('.ct-save');
        card.querySelectorAll('.rating-btn').forEach(function (btn) {
          btn.addEventListener('click', function () {
            var param = btn.getAttribute('data-param');
            card.querySelectorAll('.rating-btn[data-param="' + param + '"]').forEach(function (b) { b.classList.remove('selected'); });
            btn.classList.add('selected');
            _reportDirty[s.key] = true; if (saveBtn) saveBtn.disabled = false;
          });
        });
        function setDirty() { _reportDirty[s.key] = true; if (saveBtn) saveBtn.disabled = false; }
        card.querySelectorAll('input, select, textarea').forEach(function (inp) {
          inp.addEventListener('change', setDirty); inp.addEventListener('input', setDirty);
        });
        if (saveBtn) saveBtn.addEventListener('click', function () {
          if (!_reportDirty[s.key]) return;
          doSaveReport(card, s.key, getParams(s.key, state), state);
          _reportDirty[s.key] = false; saveBtn.disabled = true;
        });
      });
    }).catch(function () {
      el.innerHTML = '<p class="empty-state">Could not load reports.</p>';
    });
  }

  function renderSummaryTab(el) {
    if (!_client) return;
    el.innerHTML = '<div class="card"><div class="card-hd"><i class="fas fa-list-check"></i> Latest reports summary</div><div id="pd-summary-body"><i class="fas fa-spinner fa-spin"></i> Loading...</div></div>';
    function renderSummary(bodyEl, bySection) {
      var sections = ['psychiatric', 'behavioral', 'medication', 'adl', 'therapeutic', 'risk'];
      var html = sections.map(function (sec) {
        var item = bySection[sec];
        var dt = '—', sub = '—', summary = 'No report yet.';
        if (item && item.report) {
          var r = item.report;
          dt = r.createdAt ? new Date(r.createdAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : '—';
          sub = r.submittedByName || '—';
          summary = summarizePayload(sec, r.payload || {});
        }
        return '<div class="latest-summary-item">' +
          '<div class="latest-summary-hd"><span class="risk-badge risk-' + sectionColor(sec) + '">' + capitalize(sec) + '</span>' +
          '<span style="font-size:.8rem;color:var(--text-3)">' + dt + ' · ' + esc(sub) + '</span></div>' +
          '<p class="latest-summary-body">' + esc(summary) + '</p></div>';
      }).join('');
      bodyEl.innerHTML = html;
    }
    if (_cachedReports100.clientId === _client.id && _cachedReports100.docs.length > 0) {
      renderSummary(document.getElementById('pd-summary-body'), getLatestReportPerSection(_cachedReports100.docs));
      return;
    }
    AppDB.getClientReports(_client.id, null, 100, null).then(function (res) {
      _cachedReports100 = { clientId: _client.id, docs: res.docs || [] };
      renderSummary(document.getElementById('pd-summary-body'), getLatestReportPerSection(res.docs || []));
    }).catch(function () {
      var b = document.getElementById('pd-summary-body');
      if (b) b.innerHTML = '<p class="empty-state">Could not load.</p>';
    });
  }

  function loadDiagnosisHistory() {
    var el = document.getElementById('pd-diagnosis-history-body');
    if (!el || !_client) return;
    AppDB.getClientDiagnosisHistory(_client.id).then(function (entries) {
      if (!entries.length) {
        el.innerHTML = '<p class="empty-state" style="padding:16px;margin:0">No consultation notes yet. Add an entry after a visit.</p>';
        return;
      }
      var sorted = entries.slice().sort(function (a, b) {
        var da = (a.fromDate || a.addedAt || '').toString();
        var db = (b.fromDate || b.addedAt || '').toString();
        return db.localeCompare(da);
      });
      var e = sorted[0];
      var dateStr = e.fromDate ? new Date(e.fromDate + 'T12:00:00').toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }) : '—';
      var addedStr = e.addedByName ? esc(e.addedByName) : '—';
      var notesHtml = (e.notes && e.notes.trim()) ? '<div class="diagnosis-consult-notes" style="margin-top:12px;padding:14px;background:var(--grey-bg);border-radius:var(--radius-sm);white-space:pre-wrap">' + esc(e.notes) + '</div>' : '<p class="text-muted" style="margin:8px 0 0 0">No note text.</p>';
      el.innerHTML = '<div class="diagnosis-consult-card" style="border:1px solid var(--border);border-radius:var(--radius);padding:18px">' +
        '<div class="diagnosis-consult-head" style="display:flex;flex-wrap:wrap;gap:12px;margin-bottom:10px;font-size:.9rem;color:var(--text-2)">' +
        '<span class="diagnosis-consult-date"><i class="fas fa-calendar-check"></i> ' + dateStr + '</span>' +
        '<span class="diagnosis-consult-by">Seen by ' + addedStr + '</span></div>' +
        '<div class="diagnosis-consult-diagnosis" style="font-weight:600;font-size:1rem">' + esc(e.diagnosis || '—') + '</div>' +
        notesHtml +
        '</div>';
    }).catch(function () {
      if (el) el.innerHTML = '<p class="empty-state" style="padding:16px;margin:0">Could not load history.</p>';
    });
  }

  function showAddDiagnosisModal() {
    if (!_client) return;
    var html = '<div class="modal-card modal-card-wide"><h3 class="modal-title">Add consultation note</h3>' +
      '<p class="modal-sub">Record diagnosis and clinical findings from this visit.</p>' +
      '<div class="form-grid">' +
      '<div class="fg"><label>Date of visit</label><input id="dh-from" type="date" class="fi" value="' + (new Date().toISOString().slice(0, 10)) + '"></div>' +
      multiselectFg('dh-diag', 'Diagnosis (select one or more)') +
      '<div class="fg fg-full"><label>Clinical notes / Findings from visit</label><textarea id="dh-notes" class="fi" rows="4" placeholder="What did you observe? Mental state, behaviour, progress, concerns..."></textarea></div>' +
      '</div><div class="modal-actions" style="margin-top:18px">' +
      '<button type="button" class="btn btn-ghost" id="dh-cancel">Cancel</button>' +
      '<button type="button" class="btn" id="dh-save">Save entry</button></div></div>';
    AppModal.open(html, {
      onReady: function () {
        var state = window.CareTrack && window.CareTrack.getState ? window.CareTrack.getState() : {};
        var cfg = state.config || {};
        var diagnosisOptions = (cfg.diagnosisOptions && cfg.diagnosisOptions.length) ? cfg.diagnosisOptions
          : (window.Pages && window.Pages.settings && window.Pages.settings.ICD11_DIAGNOSIS_OPTIONS) || [];
        var existingDiag = (_client.diagnoses && _client.diagnoses.length) ? _client.diagnoses : (_client.diagnosis ? [_client.diagnosis] : []);
        var diagOpts = diagnosisOptions.slice();
        existingDiag.forEach(function (d) { if (d && diagOpts.indexOf(d) === -1) diagOpts.push(d); });
        bindMultiselect('dh-diag', diagOpts, existingDiag);

        document.getElementById('dh-cancel').addEventListener('click', AppModal.close);
        document.getElementById('dh-save').addEventListener('click', function () {
          var selected = getMultiselectValues('dh-diag');
          var diagnosis = selected.join(', ');
          var fromDate = (document.getElementById('dh-from') || {}).value || '';
          var notes = (document.getElementById('dh-notes') || {}).value || '';
          if (!diagnosis.trim()) { window.CareTrack.toast('Select at least one diagnosis'); return; }
          var profile = (state && state.profile) || {};
          AppDB.addClientDiagnosisEntry(_client.id, { diagnosis: diagnosis.trim(), fromDate: fromDate, notes: notes.trim(), addedByName: profile.displayName || '' }).then(function () {
            if (window.AppPush && AppPush.triggerPush) {
              AppPush.triggerPush({
                clientId: _client.id,
                type: 'diagnosis',
                clientName: _client.name,
                addedBy: (AppDB.getCurrentUser() || {}).uid,
                addedByName: profile.displayName || '',
                diagnosis: diagnosis.trim()
              });
            }
            return AppDB.updateClient(_client.id, { diagnoses: selected, diagnosis: selected[0] || '' }).then(function () {
              AppModal.close();
              window.CareTrack.toast('Consultation note saved');
              loadDiagnosisHistory();
              window.CareTrack.refreshData();
              if (_currentTab === 'overview') {
                var el = document.getElementById('pd-content');
                if (el && typeof renderTab === 'function') renderTab('overview', window.CareTrack.getState());
              }
            });
          }).catch(function (e) { window.CareTrack.toast('Error: ' + e.message); });
        });
      }
    });
  }

  function showAddReportModal() {
    if (!_client) return;
    var state = window.CareTrack && window.CareTrack.getState ? window.CareTrack.getState() : {};
    var profile = (state && state.profile) || {};
    var allowedSections = REPORT_SECTIONS.filter(function (s) {
      return window.Permissions && window.Permissions.canSubmitSection(profile, s.key);
    });
    if (!allowedSections.length) {
      if (window.CareTrack.toast) window.CareTrack.toast('You cannot add reports for this patient.');
      return;
    }
    var firstSection = allowedSections[0];
    var firstIcon = firstSection ? (REPORT_SECTIONS.find(function (x) { return x.key === firstSection.key; }) || {}).icon || 'fa-file-lines' : 'fa-file-lines';
    var sectionOptions = allowedSections.map(function (s) {
      var sec = REPORT_SECTIONS.find(function (x) { return x.key === s.key; });
      return '<option value="' + esc(s.key) + '" data-icon="' + (sec ? sec.icon : '') + '">' + esc(s.label) + '</option>';
    }).join('');
    var html = '<div class="modal-card modal-card-wide"><h3 class="modal-title">Add Report</h3>' +
      '<div class="fg pd-add-report-section-row" style="margin-bottom:14px"><label>Section</label>' +
      '<div class="pd-add-report-section-wrap"><span id="pd-add-report-section-icon" class="pd-add-report-section-icon"><i class="fas ' + firstIcon + '"></i></span>' +
      '<select id="pd-add-report-section" class="fi">' + sectionOptions + '</select></div></div>' +
      '<div id="pd-add-report-form-wrap"><div class="empty-state" style="padding:20px;margin:0"><i class="fas fa-spinner fa-spin"></i> Loading...</div></div>' +
      '<div class="modal-actions" style="margin-top:16px"><button type="button" class="btn btn-ghost" id="pd-add-report-cancel">Cancel</button></div></div>';
    AppModal.open(html, {
      onReady: function () {
        var formWrap = document.getElementById('pd-add-report-form-wrap');
        var sectionSelect = document.getElementById('pd-add-report-section');
        function updateSectionIcon(sectionKey) {
          var iconEl = document.getElementById('pd-add-report-section-icon');
          if (iconEl) {
            var sec = REPORT_SECTIONS.find(function (x) { return x.key === sectionKey; });
            iconEl.innerHTML = sec ? '<i class="fas ' + sec.icon + '"></i>' : '';
          }
        }
        function renderForm(sectionKey) {
          updateSectionIcon(sectionKey);
          formWrap.innerHTML = '<div class="empty-state" style="padding:20px;margin:0"><i class="fas fa-spinner fa-spin"></i> Loading...</div>';
          var params = getParams(sectionKey, state);
          AppDB.getLatestReport(_client.id, sectionKey).then(function (report) {
            var payload = (report && report.payload) ? report.payload : {};
            var formHtml = getSectionFormHtml(sectionKey, params, payload);
            var notesVal = (payload && payload.notes) ? esc(payload.notes) : '';
            var cardInner = formHtml +
              '<div class="fg fg-full" style="margin-top:14px"><label>Notes</label><textarea class="fi ct-notes" rows="3">' + notesVal + '</textarea></div>' +
              '<div style="margin-top:14px"><button type="button" class="btn ct-save" data-section="' + esc(sectionKey) + '"><i class="fas fa-save"></i> Save Report</button></div>';
            formWrap.innerHTML = '<div class="card ct-card" data-section="' + sectionKey + '">' + cardInner + '</div>';
            var card = formWrap.querySelector('.ct-card');
            var saveBtn = card.querySelector('.ct-save');
            card.querySelectorAll('.rating-btn').forEach(function (btn) {
              btn.addEventListener('click', function () {
                var param = btn.getAttribute('data-param');
                card.querySelectorAll('.rating-btn[data-param="' + param + '"]').forEach(function (b) { b.classList.remove('selected'); });
                btn.classList.add('selected');
              });
            });
            if (saveBtn) saveBtn.addEventListener('click', function () {
              var p = doSaveReport(card, sectionKey, params, state);
              if (p && p.then) p.then(function () {
                AppModal.close();
                _cachedReports100 = { clientId: null, docs: [] };
                if (window.CareTrack.refreshData) window.CareTrack.refreshData();
                var el = document.getElementById('pd-content');
                if (el && typeof renderTab === 'function') renderTab(_currentTab, window.CareTrack.getState());
              });
            });
          }).catch(function () {
            var payload = {};
            var formHtml = getSectionFormHtml(sectionKey, params, payload);
            formWrap.innerHTML = '<div class="card ct-card" data-section="' + sectionKey + '">' +
              formHtml +
              '<div class="fg fg-full" style="margin-top:14px"><label>Notes</label><textarea class="fi ct-notes" rows="3"></textarea></div>' +
              '<div style="margin-top:14px"><button type="button" class="btn ct-save" data-section="' + esc(sectionKey) + '"><i class="fas fa-save"></i> Save Report</button></div></div>';
            var card = formWrap.querySelector('.ct-card');
            var saveBtn = card.querySelector('.ct-save');
            card.querySelectorAll('.rating-btn').forEach(function (btn) {
              btn.addEventListener('click', function () {
                var param = btn.getAttribute('data-param');
                card.querySelectorAll('.rating-btn[data-param="' + param + '"]').forEach(function (b) { b.classList.remove('selected'); });
                btn.classList.add('selected');
              });
            });
            if (saveBtn) saveBtn.addEventListener('click', function () {
              var p = doSaveReport(card, sectionKey, params, state);
              if (p && p.then) p.then(function () {
                AppModal.close();
                _cachedReports100 = { clientId: null, docs: [] };
                if (window.CareTrack.refreshData) window.CareTrack.refreshData();
                var el = document.getElementById('pd-content');
                if (el && typeof renderTab === 'function') renderTab(_currentTab, window.CareTrack.getState());
              });
            });
          });
        }
        renderForm(sectionSelect.value);
        sectionSelect.addEventListener('change', function () { renderForm(sectionSelect.value); });
        var cancelBtn = document.getElementById('pd-add-report-cancel');
        if (cancelBtn) cancelBtn.addEventListener('click', AppModal.close);
      }
    });
  }

  function info(label, val) {
    return '<div class="fg"><label style="font-size:.78rem;color:var(--text-3)">' + label + '</label><div style="font-size:.9rem;font-weight:500">' + (val || '—') + '</div></div>';
  }

  /* ─── Clinical tab (psychiatric, behavioral, adl, therapeutic, risk) ── */
  function renderClinicalTab(el, section, state) {
    el.innerHTML = '<div class="card" id="ct-card"><div class="card-hd"><i class="fas fa-spinner fa-spin"></i> Loading last report...</div></div>';

    AppDB.getLatestReport(_client.id, section).then(function (report) {
      _latestReports[section] = report;
      var params = getParams(section, state);
      var payload = (report && report.payload) ? report.payload : {};
      var lastDate = report && report.createdAt ? new Date(report.createdAt).toLocaleString('en-IN') : null;

      var html = '<div class="card" id="ct-card">';
      html += '<div class="card-hd"><i class="fas fa-pen-to-square"></i> ' + capitalize(section) + ' Assessment';
      if (lastDate) html += '<span style="font-size:.78rem;color:var(--text-3);margin-left:auto">Last: ' + lastDate + '</span>';
      html += '</div>';

      if (section === 'adl') {
        html += buildADLForm(params, payload);
      } else if (section === 'therapeutic') {
        html += buildTherapeuticForm(params, payload);
      } else if (section === 'risk') {
        html += buildRiskForm(params, payload);
      } else if (section === 'medication') {
        html += buildMedicationForm(payload);
      } else {
        html += buildRatingForm(params, payload);
      }

      html += '<div class="fg fg-full" style="margin-top:14px"><label>Notes</label><textarea class="fi ct-notes" rows="3">' + esc(payload.notes || '') + '</textarea></div>';
      var profile = (state && state.profile) || {};
      var canSave = window.Permissions && window.Permissions.canSubmitSection(profile, section);
      if (canSave) html += '<div style="margin-top:14px;display:flex;gap:8px"><button type="button" class="btn ct-save" id="ct-save"><i class="fas fa-save"></i> Save Report</button></div>';
      html += '</div>';

      el.innerHTML = html;
      bindClinicalSave(section, params, state);
    }).catch(function (err) {
      if (window.CareTrack) window.CareTrack.toast(err && err.message ? err.message : 'Could not load last report.');
      _latestReports[section] = null;
      var params = getParams(section, state);
      var payload = {};
      var html = '<div class="card" id="ct-card"><div class="card-hd"><i class="fas fa-pen-to-square"></i> ' + capitalize(section) + ' Assessment</div>';
      if (section === 'adl') html += buildADLForm(params, payload);
      else if (section === 'therapeutic') html += buildTherapeuticForm(params, payload);
      else if (section === 'risk') html += buildRiskForm(params, payload);
      else if (section === 'medication') html += buildMedicationForm(payload);
      else html += buildRatingForm(params, payload);
      html += '<div class="fg fg-full" style="margin-top:14px"><label>Notes</label><textarea class="fi ct-notes" rows="3"></textarea></div>';
      var profile = (state && state.profile) || {};
      var canSave = window.Permissions && window.Permissions.canSubmitSection(profile, section);
      if (canSave) html += '<div style="margin-top:14px"><button type="button" class="btn ct-save" id="ct-save"><i class="fas fa-save"></i> Save Report</button></div>';
      html += '</div>';
      el.innerHTML = html;
      bindClinicalSave(section, params, state);
    });
  }

  function getSectionFormHtml(section, params, payload) {
    if (section === 'adl') return buildADLForm(params, payload);
    if (section === 'therapeutic') return buildTherapeuticForm(params, payload);
    if (section === 'risk') return buildRiskForm(params, payload);
    if (section === 'medication') return buildMedicationForm(payload);
    return buildRatingForm(params, payload);
  }

  function getParams(section, state) {
    var cfg = state.config || {};
    var defaults = {
      psychiatric: ['Orientation', 'Mood & Affect', 'Thought Content', 'Thought Process', 'Perceptual Disturbances', 'Insight', 'Judgment', 'Psychomotor Activity', 'Sleep Pattern', 'Appetite'],
      behavioral: ['Cooperation', 'Peer Interaction', 'Aggression/Irritability', 'Substance Craving', 'Wandering', 'Emotional Regulation', 'Response to Redirection', 'Routine Participation'],
      medication: [],
      adl: ['Personal Hygiene', 'Dressing', 'Toileting', 'Feeding', 'Mobility', 'Room Maintenance', 'Laundry', 'Money Handling', 'Time Management', 'Phone Use'],
      therapeutic: ['Occupational Therapy', 'Group Therapy', 'Individual Counseling', 'Yoga/Exercise', 'Art/Music/Dance', 'Vocational Training', 'Life Skills', 'Recreation', 'Psychoeducation', 'Cognitive Remediation'],
      risk: ['Suicidal Ideation', 'Aggression/Violence', 'Absconding Risk', 'Substance Relapse', 'Falls/Physical Safety', 'Vulnerability', 'Medication Safety']
    };
    var keyMap = { psychiatric: 'PSY', behavioral: 'BEH', adl: 'ADL', therapeutic: 'THER', risk: 'RISK' };
    return cfg[keyMap[section]] || defaults[section] || [];
  }

  function buildMedicationForm(payload) {
    var p = payload || {};
    var sel = function (name, opts, val) {
      return '<select class="fi" id="med-' + name + '" data-med="' + name + '">' +
        opts.map(function (o) { return '<option value="' + o + '"' + (p[name] === o ? ' selected' : '') + '>' + (o || '—') + '</option>'; }).join('') +
      '</select>';
    };
    var html = '<div class="form-grid" style="gap:10px">';
    html += '<div class="fg"><label>Medication Given</label>' + sel('medicationGiven', ['', 'Yes', 'No'], p.medicationGiven) + '</div>';
    html += '<div class="fg"><label>Compliance</label>' + sel('compliance', ['', 'Full', 'Partial', 'Refused'], p.compliance) + '</div>';
    html += '<div class="fg"><label>Side Effects</label>' + sel('sideEffects', ['', 'None', 'EPS', 'Sedation', 'Other'], p.sideEffects) + '</div>';
    html += '<div class="fg"><label>PRN Given</label>' + sel('prnGiven', ['', 'Yes', 'No'], p.prnGiven) + '</div>';
    html += '<div class="fg"><label>Lab Due</label>' + sel('labDue', ['', 'Yes', 'No'], p.labDue) + '</div>';
    html += '<div class="fg fg-full"><label>PRN Reason</label><input type="text" class="fi" id="med-prnReason" data-med="prnReason" value="' + esc(p.prnReason || '') + '" placeholder="If PRN given"></div>';
    html += '<div class="fg"><label>BP</label><input type="text" class="fi" id="med-bp" data-med="bp" value="' + esc(p.bp || '') + '" placeholder="e.g. 120/80"></div>';
    html += '<div class="fg"><label>Pulse</label><input type="text" class="fi" id="med-pulse" data-med="pulse" value="' + esc(p.pulse || '') + '" placeholder="/min"></div>';
    html += '<div class="fg"><label>Temp</label><input type="text" class="fi" id="med-temp" data-med="temp" value="' + esc(p.temp || '') + '" placeholder="°C"></div>';
    html += '<div class="fg"><label>Weight</label><input type="text" class="fi" id="med-weight" data-med="weight" value="' + esc(p.weight || '') + '" placeholder="kg"></div>';
    html += '</div>';
    return html;
  }

  function buildRatingForm(params, payload) {
    var ratings = payload.ratings || {};
    return params.map(function (p) {
      var val = ratings[p] || 0;
      return '<div class="rating-row"><span class="rating-label">' + esc(p) + '</span><div class="rating-btns">' +
        [1,2,3,4,5].map(function (n) {
          return '<button type="button" class="rating-btn' + (val === n ? ' selected' : '') + '" data-param="' + esc(p) + '" data-val="' + n + '">' + n + '</button>';
        }).join('') +
      '</div></div>';
    }).join('');
  }

  function buildADLForm(params, payload) {
    var levels = payload.levels || {};
    var opts = ['Dependent', 'Max Assist', 'Mod Assist', 'Min Assist', 'Supervised', 'Independent'];
    return params.map(function (p) {
      var val = levels[p] || '';
      return '<div class="adl-row"><span class="adl-label">' + esc(p) + '</span>' +
        '<select class="adl-select" data-param="' + esc(p) + '">' +
          '<option value="">—</option>' +
          opts.map(function (o) { return '<option' + (val === o ? ' selected' : '') + '>' + o + '</option>'; }).join('') +
        '</select></div>';
    }).join('');
  }

  function buildTherapeuticForm(params, payload) {
    var activities = payload.activities || {};
    return params.map(function (p) {
      var a = activities[p] || {};
      return '<div class="rating-row" style="flex-wrap:wrap;gap:6px">' +
        '<span class="rating-label">' + esc(p) + '</span>' +
        '<select class="fi" style="width:auto;padding:4px 8px;font-size:.82rem" data-ther="' + esc(p) + '" data-field="attendance">' +
          '<option value="">Attendance</option><option' + (a.attendance === 'Present' ? ' selected' : '') + '>Present</option><option' + (a.attendance === 'Absent' ? ' selected' : '') + '>Absent</option><option' + (a.attendance === 'Refused' ? ' selected' : '') + '>Refused</option>' +
        '</select>' +
        '<select class="fi" style="width:auto;padding:4px 8px;font-size:.82rem" data-ther="' + esc(p) + '" data-field="engagement">' +
          '<option value="">Engagement</option><option' + (a.engagement === 'Active' ? ' selected' : '') + '>Active</option><option' + (a.engagement === 'Passive' ? ' selected' : '') + '>Passive</option><option' + (a.engagement === 'Minimal' ? ' selected' : '') + '>Minimal</option>' +
        '</select>' +
      '</div>';
    }).join('');
  }

  function buildRiskForm(params, payload) {
    var levels = payload.levels || {};
    var opts = ['None', 'Low', 'Medium', 'High'];
    var html = params.map(function (p) {
      var val = levels[p] || '';
      return '<div class="adl-row"><span class="adl-label">' + esc(p) + '</span>' +
        '<select class="adl-select" data-risk="' + esc(p) + '">' +
          '<option value="">—</option>' +
          opts.map(function (o) { return '<option' + (val === o ? ' selected' : '') + '>' + o + '</option>'; }).join('') +
        '</select></div>';
    }).join('');
    html += '<div class="fg fg-full" style="margin-top:12px"><label>Restraint Used</label><select class="fi ct-restraint">' +
      '<option value="">—</option><option value="Yes"' + (payload.restraintUsed === 'Yes' ? ' selected' : '') + '>Yes</option><option value="No"' + (payload.restraintUsed === 'No' ? ' selected' : '') + '>No</option></select></div>';
    html += '<div class="fg fg-full"><label>Restraint Justification</label><input type="text" class="fi ct-restraint-just" value="' + esc(payload.restraintJustification || '') + '" placeholder="If applicable"></div>';
    html += '<div class="fg fg-full"><label>Intervention Taken</label><input type="text" class="fi ct-intervention" value="' + esc(payload.interventionTaken || '') + '" placeholder="Brief description"></div>';
    return html;
  }

  function bindClinicalSave(section, params, state) {
    var card = document.getElementById('ct-card');
    if (!card) return;

    card.querySelectorAll('.rating-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var param = btn.getAttribute('data-param');
        card.querySelectorAll('.rating-btn[data-param="' + param + '"]').forEach(function (b) { b.classList.remove('selected'); });
        btn.classList.add('selected');
      });
    });

    var saveBtn = card.querySelector('.ct-save') || document.getElementById('ct-save');
    if (saveBtn) saveBtn.addEventListener('click', function () {
      doSaveReport(card, section, params, state);
      if (saveBtn) saveBtn.disabled = true;
    });
  }

  function doSaveReport(card, section, params, state) {
    var payload = {};
    if (section === 'psychiatric' || section === 'behavioral') {
      payload.ratings = {};
      card.querySelectorAll('.rating-btn.selected').forEach(function (b) {
        payload.ratings[b.getAttribute('data-param')] = parseInt(b.getAttribute('data-val'), 10);
      });
    } else if (section === 'adl') {
      payload.levels = {};
      card.querySelectorAll('.adl-select').forEach(function (s) {
        if (s.value) payload.levels[s.getAttribute('data-param')] = s.value;
      });
    } else if (section === 'therapeutic') {
      payload.activities = {};
      card.querySelectorAll('[data-ther]').forEach(function (s) {
        var name = s.getAttribute('data-ther');
        var field = s.getAttribute('data-field');
        if (!payload.activities[name]) payload.activities[name] = {};
        if (s.value) payload.activities[name][field] = s.value;
      });
    } else if (section === 'risk') {
      payload.levels = {};
      card.querySelectorAll('[data-risk]').forEach(function (s) {
        if (s.value) payload.levels[s.getAttribute('data-risk')] = s.value;
      });
      var restraintEl = card.querySelector('.ct-restraint');
      var restraintJustEl = card.querySelector('.ct-restraint-just');
      var interventionEl = card.querySelector('.ct-intervention');
      if (restraintEl) payload.restraintUsed = restraintEl.value;
      if (restraintJustEl) payload.restraintJustification = restraintJustEl.value.trim();
      if (interventionEl) payload.interventionTaken = interventionEl.value.trim();
    } else if (section === 'medication') {
      card.querySelectorAll('[data-med]').forEach(function (el) {
        var key = el.getAttribute('data-med');
        if (el.value !== undefined && el.value !== null) payload[key] = el.value.trim ? el.value.trim() : el.value;
      });
    }
    var notesEl = card.querySelector('.ct-notes');
    payload.notes = notesEl ? notesEl.value.trim() : '';
    var profile = (state && state.profile) || {};
    var reportData = {
      clientId: _client.id,
      clientName: _client.name,
      section: section,
      submittedBy: (AppDB.getCurrentUser() || {}).uid || '',
      submittedByName: profile.displayName || '',
      payload: payload
    };
    return AppDB.saveReport(reportData).then(function () {
      if (window.AppPush && AppPush.triggerPush) {
        AppPush.triggerPush({
          clientId: _client.id,
          type: 'report',
          clientName: _client.name,
          section: section,
          submittedBy: reportData.submittedBy,
          submittedByName: reportData.submittedByName
        });
      }
      window.CareTrack.toast('Report saved');
      if (section === 'risk') {
        var highest = computeHighestRisk(payload.levels || {});
        if (highest !== (_client.currentRisk || 'none')) {
          return AppDB.updateClientRisk(_client.id, highest).then(function () { window.CareTrack.refreshData(); });
        }
      }
    }).catch(function (e) { window.CareTrack.toast('Save failed: ' + e.message); });
  }

  function computeHighestRisk(levels) {
    var order = { high: 3, medium: 2, low: 1, none: 0 };
    var max = 0;
    Object.keys(levels).forEach(function (k) {
      var v = (levels[k] || '').toLowerCase();
      if ((order[v] || 0) > max) max = order[v];
    });
    return ['none', 'low', 'medium', 'high'][max];
  }

  /* ─── Report History Tab ───────────────────────────────────── */
  var _historyLastDoc = null;
  var _historySection = '';
  var _historyDocs = [];

  var _historyMode = 'reports';

  function renderHistory(el) {
    _historyLastDoc = null;
    _historySection = '';
    el.innerHTML =
      '<div class="card">' +
      '<div class="card-hd" style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px">' +
        '<span><i class="fas fa-clock-rotate-left"></i> History</span>' +
        '<span id="hist-total" class="hist-total"></span>' +
      '</div>' +
      '<div style="margin-bottom:12px;display:flex;flex-wrap:wrap;gap:10px;align-items:center">' +
        '<select class="filter-select" id="hist-mode">' +
          '<option value="reports">Report History</option>' +
          '<option value="consultation">Consultation History</option>' +
        '</select>' +
        '<select class="filter-select" id="hist-filter">' +
          '<option value="">All Sections</option>' +
          '<option value="psychiatric">Psychiatric</option><option value="behavioral">Behavioral</option>' +
          '<option value="medication">Medication</option><option value="adl">ADL</option><option value="therapeutic">Therapeutic</option><option value="risk">Risk</option>' +
        '</select>' +
      '</div>' +
      '<div id="hist-list" class="report-timeline"></div>' +
      '<button type="button" class="btn btn-outline btn-sm load-more-btn" id="hist-more" style="display:none">Load more</button>' +
      '</div>';

    document.getElementById('hist-mode').addEventListener('change', function () {
      _historyMode = this.value;
      var sectionEl = document.getElementById('hist-filter');
      if (sectionEl) sectionEl.style.display = _historyMode === 'reports' ? '' : 'none';
      document.getElementById('hist-list').innerHTML = '<i class="fas fa-spinner fa-spin"></i> Loading...';
      if (_historyMode === 'consultation') loadConsultationHistory(); else loadHistory(false);
    });
    document.getElementById('hist-filter').addEventListener('change', function () {
      _historySection = this.value; _historyLastDoc = null;
      document.getElementById('hist-list').innerHTML = '';
      loadHistory(false);
    });
    document.getElementById('hist-more').addEventListener('click', function () {
      if (_historyMode === 'consultation') return;
      loadHistory(true);
    });
    if (_historyMode === 'consultation') loadConsultationHistory(); else loadHistory(false);
  }

  function loadConsultationHistory() {
    var list = document.getElementById('hist-list');
    var moreBtn = document.getElementById('hist-more');
    var totalEl = document.getElementById('hist-total');
    if (!list || !_client) return;
    moreBtn.style.display = 'none';
    AppDB.getClientDiagnosisHistory(_client.id).then(function (entries) {
      if (!entries.length) {
        list.innerHTML = '<div class="empty-state"><i class="fas fa-stethoscope"></i><p>No consultation notes yet.</p></div>';
        if (totalEl) totalEl.textContent = '0 entries';
        return;
      }
      var sorted = entries.slice().sort(function (a, b) {
        var da = (a.fromDate || a.addedAt || '').toString();
        var db = (b.fromDate || b.addedAt || '').toString();
        return db.localeCompare(da);
      });
      var html = '';
      sorted.forEach(function (e) {
        var dateStr = e.fromDate ? new Date(e.fromDate + 'T12:00:00').toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }) : '—';
        var addedStr = e.addedByName ? esc(e.addedByName) : '—';
        var notesHtml = (e.notes && e.notes.trim()) ? '<div class="report-entry-body" style="margin-top:6px">' + esc(e.notes) + '</div>' : '';
        html += '<div class="hist-date-group">' +
          '<div class="hist-date-header">' + dateStr + '</div>' +
          '<div class="report-entry">' +
          '<div class="report-entry-hd"><strong>' + esc(e.diagnosis || '—') + '</strong> <span class="report-entry-time">' + addedStr + '</span></div>' +
          notesHtml + '</div></div>';
      });
      list.innerHTML = html;
      if (totalEl) totalEl.textContent = sorted.length + ' entr' + (sorted.length !== 1 ? 'ies' : 'y');
    }).catch(function () {
      list.innerHTML = '<div class="empty-state"><i class="fas fa-exclamation-triangle"></i><p>Could not load consultation history.</p></div>';
      if (totalEl) totalEl.textContent = '';
    });
  }

  function renderHistoryList(list, docs, append, moreBtn) {
    var totalEl = document.getElementById('hist-total');
    if (!docs.length && !append) {
      list.innerHTML = '<div class="empty-state"><i class="fas fa-inbox"></i><p>No reports found</p></div>';
      moreBtn.style.display = 'none';
      _historyDocs = [];
      if (totalEl) totalEl.textContent = '0 reports';
      return;
    }
    if (append) _historyDocs = _historyDocs.concat(docs); else _historyDocs = docs.slice();
    _historyDocs.sort(function (a, b) {
      var ta = a.createdAt ? (typeof a.createdAt === 'string' ? new Date(a.createdAt).getTime() : (a.createdAt.getTime ? a.createdAt.getTime() : 0)) : 0;
      var tb = b.createdAt ? (typeof b.createdAt === 'string' ? new Date(b.createdAt).getTime() : (b.createdAt.getTime ? b.createdAt.getTime() : 0)) : 0;
      return tb - ta;
    });
    var byDate = {};
    _historyDocs.forEach(function (r, idx) {
      var d = r.createdAt;
      var key = !d ? 'unknown' : (typeof d === 'string' ? d.slice(0, 10) : new Date(d).toISOString().slice(0, 10));
      if (!byDate[key]) byDate[key] = [];
      byDate[key].push({ r: r, idx: idx });
    });
    var dateKeys = Object.keys(byDate).sort().reverse();
    function formatDateHeader(isoDate) {
      if (isoDate === 'unknown') return 'Unknown date';
      var d = new Date(isoDate + 'T12:00:00');
      return d.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' });
    }
    var html = '';
    dateKeys.forEach(function (key) {
      html += '<div class="hist-date-group">';
      html += '<div class="hist-date-header">' + formatDateHeader(key) + '</div>';
      byDate[key].forEach(function (item) {
        var r = item.r;
        var idx = item.idx;
        var timeStr = r.createdAt ? new Date(r.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '—';
        var summary = summarizePayload(r.section, r.payload || {});
        html += '<div class="report-entry clickable" data-report-index="' + idx + '" role="button" tabindex="0">' +
          '<div class="report-entry-hd">' +
          '<span class="risk-badge risk-' + sectionColor(r.section) + '">' + (r.section || '') + '</span>' +
          '<strong>' + (r.submittedByName || '—') + '</strong>' +
          '<span class="report-entry-time">' + timeStr + '</span></div>' +
          '<div class="report-entry-body">' + summary + '</div></div>';
      });
      html += '</div>';
    });
    list.innerHTML = html;
    moreBtn.style.display = docs.length >= 20 ? 'block' : 'none';
    if (totalEl) totalEl.textContent = _historyDocs.length + ' report' + (_historyDocs.length !== 1 ? 's' : '');

    var state = window.CareTrack && window.CareTrack.getState ? window.CareTrack.getState() : {};
    var profile = (state && state.profile) || {};
    var canEditReport = window.Permissions && window.Permissions.canEditReport(profile);
    list.querySelectorAll('.report-entry[data-report-index]').forEach(function (el) {
      function openReportModal() {
        var idx = parseInt(el.getAttribute('data-report-index'), 10);
        var r = _historyDocs[idx];
        if (!r || !window.ReportModal) return;
        window.ReportModal.open(r, {
          canEdit: canEditReport,
          showPatientLink: false,
          onSave: refreshHistory,
          onDelete: refreshHistory
        });
      }
      el.addEventListener('click', openReportModal);
      el.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openReportModal(); } });
    });
  }

  function formatPayloadHorizontal(section, p) {
    var items = [];
    if (section === 'psychiatric' || section === 'behavioral') {
      var r = p.ratings || {};
      Object.keys(r).sort().forEach(function (k) { items.push('<span class="status-kv">' + esc(k) + ': ' + r[k] + '/5</span>'); });
    } else if (section === 'adl' || section === 'risk') {
      var l = p.levels || {};
      Object.keys(l).sort().forEach(function (k) { items.push('<span class="status-kv">' + esc(k) + ': ' + esc(l[k]) + '</span>'); });
    } else if (section === 'therapeutic') {
      var a = p.activities || {};
      Object.keys(a).forEach(function (name) {
        var act = a[name] || {};
        var att = act.attendance || '—';
        var eng = act.engagement || '—';
        items.push('<span class="status-kv">' + esc(name) + ': ' + esc(att) + ' / ' + esc(eng) + '</span>');
      });
    } else if (section === 'medication') {
      var medKeys = ['medicationGiven', 'compliance', 'sideEffects', 'prnGiven', 'prnReason', 'labDue', 'bp', 'pulse', 'temp', 'weight'];
      medKeys.forEach(function (k) {
        var v = p[k];
        if (v === undefined || v === '') return;
        var label = k.replace(/([A-Z])/g, ' $1').replace(/^./, function (s) { return s.toUpperCase(); });
        items.push('<span class="status-kv">' + esc(label) + ': ' + esc(v) + '</span>');
      });
    }
    if (p.restraintUsed) items.push('<span class="status-kv">Restraint: ' + esc(p.restraintUsed) + '</span>');
    if (p.restraintJustification) items.push('<span class="status-kv">Restraint justification: ' + esc(p.restraintJustification) + '</span>');
    if (p.interventionTaken) items.push('<span class="status-kv">Intervention: ' + esc(p.interventionTaken) + '</span>');
    if (p.notes) items.push('<span class="status-kv">Notes: ' + esc(p.notes) + '</span>');
    return items.length ? '<div class="status-inline">' + items.join('') + '</div>' : '<p class="status-empty">No details recorded.</p>';
  }

  function getLatestReportPerSection(docs) {
    var bySection = {};
    (docs || []).forEach(function (r) {
      var sec = r.section;
      if (!sec) return;
      var ts = r.createdAt ? (typeof r.createdAt === 'string' ? new Date(r.createdAt).getTime() : (r.createdAt.getTime ? r.createdAt.getTime() : 0)) : 0;
      if (!bySection[sec] || (bySection[sec]._ts < ts)) bySection[sec] = { report: r, _ts: ts };
    });
    return bySection;
  }

  function showLatestReportsSummaryModal() {
    if (!_client) return;
    var sections = ['psychiatric', 'behavioral', 'medication', 'adl', 'therapeutic', 'risk'];
    function buildModal(bySection) {
      var body = '';
      sections.forEach(function (sec) {
        var item = bySection[sec];
        var dt = '—';
        var sub = '—';
        var summary = 'No report yet.';
        var viewBtn = '';
        if (item && item.report) {
          var r = item.report;
          dt = r.createdAt ? new Date(r.createdAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : '—';
          sub = r.submittedByName || '—';
          summary = summarizePayload(sec, r.payload || {});
          viewBtn = '<button type="button" class="btn btn-outline btn-sm pd-summary-view" data-section="' + esc(sec) + '">View full report</button>';
        }
        body += '<div class="latest-summary-item">' +
          '<div class="latest-summary-hd">' +
            '<span class="risk-badge risk-' + sectionColor(sec) + '">' + capitalize(sec) + '</span>' +
            '<span style="font-size:.8rem;color:var(--text-3)">' + dt + ' · ' + sub + '</span>' +
            (viewBtn ? '<span>' + viewBtn + '</span>' : '') +
          '</div>' +
          '<p class="latest-summary-body">' + esc(summary) + '</p></div>';
      });
      var html =
        '<div class="modal-card report-detail-modal">' +
          '<h3 class="modal-title"><i class="fas fa-file-lines"></i> Latest reports summary</h3>' +
          '<p style="font-size:.88rem;color:var(--text-2);margin-bottom:12px">Most recent assessment per section for ' + esc(_client.name || 'this patient') + '.</p>' +
          '<div class="latest-summary-list">' + body + '</div>' +
          '<div class="modal-actions" style="margin-top:16px">' +
            '<button type="button" class="btn" id="pd-summary-close">Close</button>' +
          '</div>' +
        '</div>';
      AppModal.open(html, {
        onReady: function () {
          document.getElementById('pd-summary-close').addEventListener('click', AppModal.close);
          var viewBtns = document.querySelectorAll('.pd-summary-view');
          var state = window.CareTrack && window.CareTrack.getState ? window.CareTrack.getState() : {};
          var profile = (state && state.profile) || {};
          var canEditReport = window.Permissions && window.Permissions.canEditReport(profile);
          viewBtns.forEach(function (btn) {
            var sec = btn.getAttribute('data-section');
            var item = bySection[sec];
            if (item && item.report && window.ReportModal) {
              btn.addEventListener('click', function () {
                AppModal.close();
                window.ReportModal.open(item.report, { canEdit: canEditReport, showPatientLink: false, onSave: refreshHistory, onDelete: refreshHistory });
              });
            }
          });
        }
      });
    }
    if (_cachedReports100.clientId === _client.id && _cachedReports100.docs.length > 0) {
      buildModal(getLatestReportPerSection(_cachedReports100.docs));
      return;
    }
    AppModal.open(
      '<div class="modal-card"><h3 class="modal-title">Latest reports summary</h3><div class="empty-state" style="padding:24px"><i class="fas fa-spinner fa-spin"></i><p>Loading latest reports...</p></div><div class="modal-actions" style="margin-top:16px"><button type="button" class="btn" id="pd-summary-loading-close">Cancel</button></div></div>',
      { onReady: function () { document.getElementById('pd-summary-loading-close').addEventListener('click', AppModal.close); } }
    );
    AppDB.getClientReports(_client.id, null, 50, null).then(function (result) {
      AppModal.close();
      var docs = result.docs || [];
      _cachedReports100 = { clientId: _client.id, docs: docs };
      buildModal(getLatestReportPerSection(docs));
    }).catch(function () {
      AppModal.close();
      if (window.CareTrack) window.CareTrack.toast('Could not load reports.');
    });
  }

  function loadHistory(append) {
    var list = document.getElementById('hist-list');
    var moreBtn = document.getElementById('hist-more');
    var section = _historySection || null;
    AppDB.getClientReports(_client.id, section, 20, append ? _historyLastDoc : null)
      .then(function (result) {
        _historyLastDoc = result.lastDoc;
        renderHistoryList(list, result.docs, append, moreBtn);
      })
      .catch(function (err) {
        if (append) return;
        if (section) {
          function renderFiltered(docs) {
            var filtered = (docs || []).filter(function (r) { return r.section === _historySection; });
            _historyLastDoc = null;
            renderHistoryList(list, filtered.slice(0, 20), false, moreBtn);
          }
          if (_cachedReports100.clientId === _client.id && _cachedReports100.docs.length > 0) {
            renderFiltered(_cachedReports100.docs);
            return;
          }
          AppDB.getClientReports(_client.id, null, 100, null)
            .then(function (result) {
              _cachedReports100 = { clientId: _client.id, docs: result.docs || [] };
              renderFiltered(_cachedReports100.docs);
            })
            .catch(function () {
              list.innerHTML = '<div class="alert alert-danger">Could not load reports.</div>';
              moreBtn.style.display = 'none';
            });
        } else {
          list.innerHTML = '<div class="alert alert-danger">Could not load reports. Check Firestore indexes (clientId + createdAt) are enabled.</div>';
          moreBtn.style.display = 'none';
        }
      });
  }

  function sectionColor(s) {
    var m = { psychiatric: 'medium', behavioral: 'low', medication: 'medium', adl: 'none', therapeutic: 'low', risk: 'high' };
    return m[s] || 'none';
  }

  function summarizePayload(section, p) {
    if (section === 'psychiatric' || section === 'behavioral') {
      var r = p.ratings || {};
      var keys = Object.keys(r);
      if (!keys.length) return 'No ratings recorded.';
      var avg = keys.reduce(function (s, k) { return s + r[k]; }, 0) / keys.length;
      return keys.length + ' parameters rated, avg ' + avg.toFixed(1) + '/5' + (p.notes ? ' — ' + esc(p.notes).slice(0, 60) : '');
    }
    if (section === 'adl') {
      var l = p.levels || {};
      var lk = Object.keys(l);
      return lk.length + ' domains assessed' + (p.notes ? ' — ' + esc(p.notes).slice(0, 60) : '');
    }
    if (section === 'therapeutic') {
      var a = p.activities || {};
      return Object.keys(a).length + ' activities logged' + (p.notes ? ' — ' + esc(p.notes).slice(0, 60) : '');
    }
    if (section === 'risk') {
      var rl = p.levels || {};
      var rlk = Object.keys(rl);
      var highs = rlk.filter(function (k) { return rl[k] === 'High'; });
      var extra = [];
      if (p.restraintUsed) extra.push('Restraint: ' + p.restraintUsed);
      if (p.interventionTaken) extra.push('Intervention: ' + (p.interventionTaken || '').slice(0, 40));
      return rlk.length + ' domains assessed' + (highs.length ? ', ' + highs.length + ' HIGH' : '') + (extra.length ? '; ' + extra.join('; ') : '') + (p.notes ? ' — ' + esc(p.notes).slice(0, 40) : '');
    }
    if (section === 'medication') {
      var parts = [];
      if (p.medicationGiven) parts.push('Given: ' + p.medicationGiven);
      if (p.compliance) parts.push('Compliance: ' + p.compliance);
      if (p.sideEffects) parts.push('Side effects: ' + p.sideEffects);
      return parts.length ? parts.join('; ') + (p.notes ? ' — ' + esc(p.notes).slice(0, 40) : '') : (p.notes ? esc(p.notes).slice(0, 100) : 'No summary.');
    }
    return p.notes ? esc(p.notes).slice(0, 100) : 'No summary.';
  }

  function capitalize(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
  function esc(s) { var d = document.createElement('div'); d.textContent = s || ''; return d.innerHTML; }

  function init() {
    if (_bound) return; _bound = true;
    window.addEventListener('popstate', function () {
      var s = window.CareTrack && window.CareTrack.getState && window.CareTrack.getState();
      if (s && s.page === 'patient-detail') {
        _currentTab = getTabFromUrl();
        $('pd-tabs').querySelectorAll('.tab-btn').forEach(function (b) {
          b.classList.toggle('active', b.getAttribute('data-tab') === _currentTab);
        });
        renderTab(_currentTab, s);
      }
    });
  }

  function destroy() {
    _currentTab = 'overview';
    _client = null;
    _latestReports = {};
  }

  function refreshHistory() {
    if (_client && document.getElementById('hist-list')) loadHistory(false);
  }

  window.Pages = window.Pages || {};
  window.Pages.patientDetail = { render: render, init: init, destroy: destroy, refreshHistory: refreshHistory };
})();
