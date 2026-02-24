/**
 * Patients list page — search, filter, add patient.
 */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var _inited = false;
  var _therapistDefaultViewSet = false;

  function render(state) {
    var profile = state.profile || {};
    var addBtn = $('add-patient-btn');
    if (addBtn && window.Permissions) addBtn.style.display = window.Permissions.canAddPatient(profile) ? '' : 'none';

    var clients = state.clients || [];
    var q = ($('pt-search') || {}).value || '';
    var sf = ($('pt-filter-status') || {}).value || '';
    var rf = ($('pt-filter-risk') || {}).value || '';
    var viewFilter = ($('pt-filter-view') || {}).value || 'all';
    var viewEl = $('pt-filter-view');
    var isDoctorOrTherapist = window.Permissions && (
      window.Permissions.hasRole(profile, 'therapist') ||
      window.Permissions.hasRole(profile, 'medical_officer') ||
      window.Permissions.hasRole(profile, 'doctor')
    );
    if (viewEl) {
      viewEl.style.display = isDoctorOrTherapist ? '' : 'none';
      if (!isDoctorOrTherapist) viewFilter = 'all';
      else if (!_therapistDefaultViewSet) { viewEl.value = 'mine'; _therapistDefaultViewSet = true; viewFilter = 'mine'; }
    }
    var myName = (profile.displayName || '').trim();
    function isMyPatient(c) {
      if (!myName) return false;
      if ((c.assignedTherapist || '').trim() === myName) return true;
      var doctors = c.assignedDoctors || [];
      return doctors.some(function (d) { return (d || '').trim() === myName; });
    }

    var filtered = clients.filter(function (c) {
      if (viewFilter === 'mine' && isDoctorOrTherapist && !isMyPatient(c)) return false;
      if (q && (c.name || '').toLowerCase().indexOf(q.toLowerCase()) === -1) return false;
      if (sf && c.status !== sf) return false;
      if (rf && c.currentRisk !== rf) return false;
      return true;
    });

    if (!filtered.length) {
      $('patients-table').innerHTML = '<div class="empty-state" style="padding:32px"><i class="fas fa-hospital-user"></i><p>' + (clients.length ? 'No matches' : 'No patients registered yet') + '</p></div>';
      return;
    }

    var html = '<table><thead><tr><th>Name</th><th>Initial diagnosis</th><th>Admission</th><th>Planned Discharge</th><th>Risk</th><th>Status</th></tr></thead><tbody>';
    filtered.forEach(function (c) {
      var diagDisplay = c.diagnosis || (c.diagnoses && c.diagnoses.length ? c.diagnoses[0] : '—');
      if (c.diagnoses && c.diagnoses.length > 1) diagDisplay += ' <span class="text-muted">+' + (c.diagnoses.length - 1) + '</span>';
      var nameCell = '<strong>' + esc(c.name || '—') + '</strong>';
      if (isDoctorOrTherapist && isMyPatient(c)) nameCell += ' <span class="badge-my-patient">My patient</span>';
      html += '<tr class="clickable" data-id="' + c.id + '">' +
        '<td>' + nameCell + '</td>' +
        '<td>' + diagDisplay + '</td>' +
        '<td>' + (c.admissionDate || '—') + '</td>' +
        '<td>' + (c.plannedDischargeDate || '—') + '</td>' +
        '<td><span class="risk-badge risk-' + (c.currentRisk || 'none') + '">' + (c.currentRisk || 'none') + '</span></td>' +
        '<td><span class="status-badge status-' + (c.status || 'active') + '">' + (c.status || 'active') + '</span></td></tr>';
    });
    html += '</tbody></table>';
    $('patients-table').innerHTML = html;

    $('patients-table').querySelectorAll('tr.clickable').forEach(function (tr) {
      tr.addEventListener('click', function () {
        if (window.CareTrack) window.CareTrack.openPatient(tr.getAttribute('data-id'));
      });
    });
  }

  function esc(s) { var d = document.createElement('div'); d.textContent = s; return d.innerHTML; }

  var AP_STEPS = 3;

  function showAddModal() {
    var html =
      '<div class="modal-card modal-card-wizard">' +
        '<h3 class="modal-title">Register New Patient</h3>' +
        '<div class="wizard-steps" id="ap-wizard-steps">' +
          '<span class="wizard-dot active" data-step="1">1</span>' +
          '<span class="wizard-line"></span>' +
          '<span class="wizard-dot" data-step="2">2</span>' +
          '<span class="wizard-line"></span>' +
          '<span class="wizard-dot" data-step="3">3</span>' +
        '</div>' +
        '<div class="wizard-pane" id="ap-pane-1" data-step="1">' +
          '<div class="form-grid">' +
            fg('ap-name', 'Full Name', 'text', '', true, true) +
            fg('ap-dob', 'Date of Birth', 'date') +
            fg('ap-gender', 'Gender', 'select', '<option value="">—</option><option>Male</option><option>Female</option><option>Other</option>') +
            fg('ap-admission', 'Admission Date', 'date', '', false, true) +
            fg('ap-admission-days', 'Days of admission (e.g. 15 or 30)', 'number', '', true) +
            fg('ap-planned-discharge', 'Planned Discharge Date (optional if days set)', 'date', '', true) +
          '</div>' +
        '</div>' +
        '<div class="wizard-pane" id="ap-pane-2" data-step="2" style="display:none">' +
          '<div class="form-grid">' +
            multiselectFg('ap-diag', 'Initial diagnosis') +
            multiselectFg('ap-doctors', 'Assigned doctor(s)') +
            searchableFg('ap-ward', 'Ward', 'Select or type') +
            searchableFg('ap-room', 'Room / Bed', 'Select or type') +
          '</div>' +
        '</div>' +
        '<div class="wizard-pane" id="ap-pane-3" data-step="3" style="display:none">' +
          '<div class="form-grid">' +
            fg('ap-legal', 'Legal Status', 'text', '', true) +
            fg('ap-emergency', 'Emergency Contact', 'text', '', true) +
            fg('ap-consent', 'Consent (e.g. URL or note)', 'text', '', true) +
          '</div>' +
        '</div>' +
        '<div class="modal-actions wizard-actions" style="margin-top:18px">' +
          '<button type="button" class="btn btn-ghost" id="ap-cancel">Cancel</button>' +
          '<button type="button" class="btn btn-ghost" id="ap-back" style="display:none">Back</button>' +
          '<button type="button" class="btn" id="ap-next">Next</button>' +
          '<button type="button" class="btn" id="ap-save" style="display:none">Save Patient</button>' +
        '</div>' +
      '</div>';

    AppModal.open(html, {
      onReady: function () {
        var currentStep = 1;
        function goToStep(step) {
          currentStep = step;
          document.querySelectorAll('.wizard-pane').forEach(function (p) {
            p.style.display = parseInt(p.getAttribute('data-step'), 10) === step ? 'block' : 'none';
          });
          document.querySelectorAll('#ap-wizard-steps .wizard-dot').forEach(function (d) {
            d.classList.toggle('active', parseInt(d.getAttribute('data-step'), 10) <= step);
          });
          document.getElementById('ap-back').style.display = step > 1 ? '' : 'none';
          document.getElementById('ap-next').style.display = step < AP_STEPS ? '' : 'none';
          document.getElementById('ap-save').style.display = step === AP_STEPS ? '' : 'none';
        }
        document.getElementById('ap-cancel').addEventListener('click', AppModal.close);
        document.getElementById('ap-back').addEventListener('click', function () { goToStep(currentStep - 1); });
        document.getElementById('ap-next').addEventListener('click', function () {
          if (currentStep === 1) {
            var name = (document.getElementById('ap-name') || {}).value || '';
            var admissionDate = (document.getElementById('ap-admission') || {}).value || '';
            if (!name.trim()) { window.CareTrack.toast('Full name is required'); return; }
            if (!admissionDate) { window.CareTrack.toast('Admission date is required'); return; }
          }
          goToStep(currentStep + 1);
        });
        document.getElementById('ap-save').addEventListener('click', saveNewPatient);
        bindSearchableDropdowns();
        bindMultiselects();
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
    optionsContainer.querySelectorAll('input[type=checkbox]').forEach(function (cb) {
      cb.addEventListener('change', updateTrigger);
    });
    trigger.addEventListener('click', function () {
      wrap.classList.toggle('open');
      if (searchInp && wrap.classList.contains('open')) { searchInp.value = ''; filterOptions(); searchInp.focus(); }
    });
    document.addEventListener('click', function (e) {
      if (!wrap.contains(e.target)) wrap.classList.remove('open');
    });
  }

  function getMultiselectValues(id) {
    var optionsContainer = document.getElementById(id + '-options');
    if (!optionsContainer) return [];
    var vals = [];
    optionsContainer.querySelectorAll('input[type=checkbox]:checked').forEach(function (cb) { vals.push(cb.value); });
    return vals;
  }

  function bindMultiselects() {
    var state = window.CareTrack && window.CareTrack.getState ? window.CareTrack.getState() : {};
    var cfg = state.config || {};
    var diagnosisOptions = (cfg.diagnosisOptions && cfg.diagnosisOptions.length) ? cfg.diagnosisOptions
      : (window.Pages && window.Pages.settings && window.Pages.settings.ICD11_DIAGNOSIS_OPTIONS) || [];
    bindMultiselect('ap-diag', diagnosisOptions, []);
    AppDB.getAllStaff().then(function (staff) {
      var doctorOptions = staff.filter(function (s) { return s.isActive !== false; })
        .map(function (s) { return s.displayName || s.email || ''; })
        .filter(Boolean);
      bindMultiselect('ap-doctors', doctorOptions, []);
    }).catch(function () { bindMultiselect('ap-doctors', [], []); });
  }

  function searchableFg(inputId, label, placeholder) {
    return '<div class="fg"><label>' + label + '</label>' +
      '<div class="searchable-select" data-for="' + inputId + '">' +
      '<input id="' + inputId + '" type="text" class="fi" placeholder="' + (placeholder || 'Select or type') + '" autocomplete="off">' +
      '<ul class="searchable-options" id="' + inputId + '-list" role="listbox"></ul></div></div>';
  }

  function bindSearchableDropdowns() {
    var state = window.CareTrack && window.CareTrack.getState ? window.CareTrack.getState() : {};
    var cfg = state.config || {};
    var wardOptions = cfg.wardNames || [];
    var roomOptions = cfg.roomBedNumbers || [];
    bindOneSearchable('ap-ward', wardOptions);
    bindOneSearchable('ap-room', roomOptions);
  }

  function bindOneSearchable(inputId, options) {
    var inp = document.getElementById(inputId);
    var listEl = document.getElementById(inputId + '-list');
    if (!inp || !listEl) return;
    var wrap = inp.closest('.searchable-select');
    if (!wrap) return;

    function showList(filter) {
      var q = (filter || '').toLowerCase();
      var filtered = options.filter(function (o) { return (o || '').toLowerCase().indexOf(q) !== -1; });
      listEl.innerHTML = filtered.slice(0, 50).map(function (o) {
        return '<li class="searchable-option" role="option" data-value="' + esc(o) + '">' + esc(o) + '</li>';
      }).join('');
      listEl.style.display = filtered.length ? 'block' : 'none';
    }

    function pick(value) {
      inp.value = value || '';
      listEl.style.display = 'none';
      inp.blur();
    }

    inp.addEventListener('focus', function () { showList(inp.value); });
    inp.addEventListener('input', function () { showList(inp.value); });
    inp.addEventListener('blur', function () {
      setTimeout(function () {
        if (!wrap.contains(document.activeElement)) listEl.style.display = 'none';
      }, 150);
    });
    listEl.addEventListener('mousedown', function (e) {
      var li = e.target.closest('.searchable-option');
      if (li) { e.preventDefault(); pick(li.getAttribute('data-value')); }
    });
  }

  function fg(id, label, type, extra, full, required) {
    var cls = full ? ' fg-full' : '';
    var req = required ? ' required' : '';
    if (type === 'select') {
      return '<div class="fg' + cls + '"><label>' + label + (required ? ' <span class="required-asterisk">*</span>' : '') + '</label><select id="' + id + '" class="fi"' + req + '>' + (extra || '') + '</select></div>';
    }
    return '<div class="fg' + cls + '"><label>' + label + (required ? ' <span class="required-asterisk">*</span>' : '') + '</label><input id="' + id + '" type="' + type + '" class="fi" placeholder="' + label + '"' + (extra ? ' value="' + (extra === true ? '' : extra) + '"' : '') + req + '></div>';
  }

  function saveNewPatient() {
    var name = (document.getElementById('ap-name') || {}).value || '';
    var admissionDate = (document.getElementById('ap-admission') || {}).value || '';
    if (!name.trim()) { window.CareTrack.toast('Full name is required'); return; }
    if (!admissionDate) { window.CareTrack.toast('Admission date is required'); return; }
    var diagnoses = getMultiselectValues('ap-diag');
    var assignedDoctors = getMultiselectValues('ap-doctors');
    var admissionDaysRaw = (document.getElementById('ap-admission-days') || {}).value || '';
    var admissionDays = admissionDaysRaw ? parseInt(admissionDaysRaw, 10) : null;
    var data = {
      name: name.trim(),
      dob: (document.getElementById('ap-dob') || {}).value || '',
      gender: (document.getElementById('ap-gender') || {}).value || '',
      diagnosis: diagnoses[0] || '',
      diagnoses: diagnoses,
      admissionDate: admissionDate,
      plannedDischargeDate: (document.getElementById('ap-planned-discharge') || {}).value || '',
      admissionDays: admissionDays || undefined,
      legalStatus: (document.getElementById('ap-legal') || {}).value || '',
      emergencyContact: (document.getElementById('ap-emergency') || {}).value || '',
      consent: (document.getElementById('ap-consent') || {}).value || '',
      assignedTherapist: assignedDoctors[0] || '',
      assignedDoctors: assignedDoctors,
      ward: (document.getElementById('ap-ward') || {}).value || '',
      roomNumber: (document.getElementById('ap-room') || {}).value || '',
      createdBy: (AppDB.getCurrentUser() || {}).uid || ''
    };
    document.getElementById('ap-save').disabled = true;
    AppDB.addClient(data)
      .then(function () { AppModal.close(); window.CareTrack.toast('Patient registered'); window.CareTrack.refreshData(); })
      .catch(function (e) { window.CareTrack.toast('Error: ' + e.message); document.getElementById('ap-save').disabled = false; });
  }

  function init() {
    if (_inited) return; _inited = true;
    $('add-patient-btn').addEventListener('click', showAddModal);
    $('pt-search').addEventListener('input', function () { if (window.CareTrack) render(window.CareTrack.getState()); });
    $('pt-filter-status').addEventListener('change', function () { if (window.CareTrack) render(window.CareTrack.getState()); });
    $('pt-filter-risk').addEventListener('change', function () { if (window.CareTrack) render(window.CareTrack.getState()); });
    var viewFilterEl = $('pt-filter-view');
    if (viewFilterEl) viewFilterEl.addEventListener('change', function () { if (window.CareTrack) render(window.CareTrack.getState()); });
  }

  window.Pages = window.Pages || {};
  window.Pages.patients = { render: render, init: init };
})();
