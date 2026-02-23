/**
 * Patients list page — search, filter, add patient.
 */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var _inited = false;

  function render(state) {
    var profile = state.profile || {};
    var addBtn = $('add-patient-btn');
    if (addBtn && window.Permissions) addBtn.style.display = window.Permissions.canAddPatient(profile.role) ? '' : 'none';

    var clients = state.clients || [];
    var q = ($('pt-search') || {}).value || '';
    var sf = ($('pt-filter-status') || {}).value || '';
    var rf = ($('pt-filter-risk') || {}).value || '';

    var filtered = clients.filter(function (c) {
      if (q && (c.name || '').toLowerCase().indexOf(q.toLowerCase()) === -1) return false;
      if (sf && c.status !== sf) return false;
      if (rf && c.currentRisk !== rf) return false;
      return true;
    });

    if (!filtered.length) {
      $('patients-table').innerHTML = '<div class="empty-state" style="padding:32px"><i class="fas fa-hospital-user"></i><p>' + (clients.length ? 'No matches' : 'No patients registered yet') + '</p></div>';
      return;
    }

    var html = '<table><thead><tr><th>Name</th><th>Diagnosis</th><th>Admission</th><th>Risk</th><th>Status</th></tr></thead><tbody>';
    filtered.forEach(function (c) {
      html += '<tr class="clickable" data-id="' + c.id + '">' +
        '<td><strong>' + esc(c.name || '—') + '</strong></td>' +
        '<td>' + esc(c.diagnosis || '—') + '</td>' +
        '<td>' + (c.admissionDate || '—') + '</td>' +
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

  function showAddModal() {
    var html =
      '<div class="modal-card">' +
        '<h3 class="modal-title">Register New Patient</h3>' +
        '<div class="form-grid">' +
          fg('ap-name', 'Full Name', 'text', '', true) +
          fg('ap-dob', 'Date of Birth', 'date') +
          fg('ap-gender', 'Gender', 'select', '<option value="">—</option><option>Male</option><option>Female</option><option>Other</option>') +
          searchableFg('ap-diag', 'Diagnosis', 'Select or type') +
          fg('ap-admission', 'Admission Date', 'date') +
          fg('ap-legal', 'Legal Status', 'text') +
          fg('ap-emergency', 'Emergency Contact', 'text') +
          fg('ap-consent', 'Consent (e.g. URL or note)', 'text') +
          searchableFg('ap-therapist', 'Assigned Therapist', 'Select staff') +
          searchableFg('ap-ward', 'Ward', 'Select or type') +
          searchableFg('ap-room', 'Room / Bed', 'Select or type') +
        '</div>' +
        '<div class="modal-actions" style="margin-top:18px">' +
          '<button type="button" class="btn btn-ghost" id="ap-cancel">Cancel</button>' +
          '<button type="button" class="btn" id="ap-save">Save Patient</button>' +
        '</div>' +
      '</div>';

    AppModal.open(html, {
      onReady: function () {
        document.getElementById('ap-cancel').addEventListener('click', AppModal.close);
        document.getElementById('ap-save').addEventListener('click', saveNewPatient);
        bindSearchableDropdowns();
      }
    });
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
    var diagnosisOptions = cfg.diagnosisOptions || [];
    var wardOptions = cfg.wardNames || [];
    var roomOptions = cfg.roomBedNumbers || [];

    AppDB.getAllStaff().then(function (staff) {
      var therapistOptions = staff.filter(function (s) { return s.isActive !== false; })
        .map(function (s) { return s.displayName || s.email || ''; })
        .filter(Boolean);
      bindOneSearchable('ap-therapist', therapistOptions);
    }).catch(function () {
      bindOneSearchable('ap-therapist', []);
    });
    bindOneSearchable('ap-diag', diagnosisOptions);
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

  function fg(id, label, type, extra, full) {
    var cls = full ? ' fg-full' : '';
    if (type === 'select') {
      return '<div class="fg' + cls + '"><label>' + label + '</label><select id="' + id + '" class="fi">' + (extra || '') + '</select></div>';
    }
    return '<div class="fg' + cls + '"><label>' + label + '</label><input id="' + id + '" type="' + type + '" class="fi" placeholder="' + label + '"></div>';
  }

  function saveNewPatient() {
    var name = (document.getElementById('ap-name') || {}).value || '';
    if (!name.trim()) { window.CareTrack.toast('Enter patient name'); return; }
    var data = {
      name: name.trim(),
      dob: (document.getElementById('ap-dob') || {}).value || '',
      gender: (document.getElementById('ap-gender') || {}).value || '',
      diagnosis: (document.getElementById('ap-diag') || {}).value || '',
      admissionDate: (document.getElementById('ap-admission') || {}).value || new Date().toISOString().slice(0, 10),
      legalStatus: (document.getElementById('ap-legal') || {}).value || '',
      emergencyContact: (document.getElementById('ap-emergency') || {}).value || '',
      consent: (document.getElementById('ap-consent') || {}).value || '',
      assignedTherapist: (document.getElementById('ap-therapist') || {}).value || '',
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
  }

  window.Pages = window.Pages || {};
  window.Pages.patients = { render: render, init: init };
})();
