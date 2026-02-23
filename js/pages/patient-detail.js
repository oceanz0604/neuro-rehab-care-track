/**
 * Patient detail page — overview, clinical tabs with pre-fill, report history.
 */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var _bound = false;
  var _currentTab = 'overview';
  var _client = null;
  var _latestReports = {};
  var _cachedReports100 = { clientId: null, docs: [] };

  var TABS = [
    { key: 'overview',    label: 'Overview',     icon: 'fa-id-card' },
    { key: 'psychiatric', label: 'Psychiatric',  icon: 'fa-brain' },
    { key: 'behavioral',  label: 'Behavioral',   icon: 'fa-comments' },
    { key: 'medication',  label: 'Medication & Compliance', icon: 'fa-pills' },
    { key: 'adl',         label: 'ADL',          icon: 'fa-hands-helping' },
    { key: 'therapeutic',  label: 'Therapeutic',  icon: 'fa-dumbbell' },
    { key: 'risk',        label: 'Risk',         icon: 'fa-shield-halved' },
    { key: 'history',     label: 'History',      icon: 'fa-clock-rotate-left' }
  ];

  function render(state) {
    _client = state.selectedClientData;
    if (!_client) { $('pd-header').innerHTML = '<p>Patient not found.</p>'; return; }

    $('pd-header').innerHTML = headerHTML(_client, state);
    $('pd-tabs').innerHTML = TABS.map(function (t) {
      return '<button type="button" class="tab-btn' + (t.key === _currentTab ? ' active' : '') + '" data-tab="' + t.key + '"><i class="fas ' + t.icon + '"></i> ' + t.label + '</button>';
    }).join('');

    bindTabs();
    renderTab(_currentTab, state);
  }

  function headerHTML(c, state) {
    var profile = (state && state.profile) || {};
    var role = profile.role;
    var canEdit = window.Permissions && window.Permissions.canEditPatient(role);
    var canDischarge = window.Permissions && window.Permissions.canDischargePatient(role);
    var actions = '';
    if (canEdit) actions += '<button type="button" class="btn btn-outline btn-sm" id="pd-edit-btn"><i class="fas fa-pen"></i> Edit</button>';
    if (c.status === 'active' && canDischarge) actions += '<button type="button" class="btn btn-danger btn-sm" id="pd-discharge-btn"><i class="fas fa-right-from-bracket"></i> Discharge</button>';
    actions += '<button type="button" class="btn btn-outline btn-sm" id="pd-latest-summary-btn"><i class="fas fa-file-lines"></i> Latest reports summary</button>';
    actions += '<button type="button" class="btn btn-ghost btn-sm" id="pd-back-btn"><i class="fas fa-arrow-left"></i> Back</button>';
    return '<div class="patient-header">' +
      '<div><h2>' + esc(c.name || 'Unknown') + '</h2>' +
      '<div class="patient-meta">' +
        '<span><i class="fas fa-venus-mars"></i> ' + (c.gender || '—') + '</span>' +
        '<span><i class="fas fa-calendar"></i> Adm: ' + (c.admissionDate || '—') + '</span>' +
        '<span><i class="fas fa-stethoscope"></i> ' + (c.assignedTherapist || '—') + '</span>' +
        '<span><i class="fas fa-bed"></i> ' + (c.ward || '—') + ' / ' + (c.roomNumber || '—') + '</span>' +
        '<span class="risk-badge risk-' + (c.currentRisk || 'none') + '">' + (c.currentRisk || 'none') + ' risk</span>' +
        '<span class="status-badge status-' + (c.status || 'active') + '">' + (c.status || 'active') + '</span>' +
      '</div></div>' +
      '<div class="patient-actions">' + actions + '</div></div>';
  }

  function bindTabs() {
    $('pd-tabs').querySelectorAll('.tab-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        _currentTab = btn.getAttribute('data-tab');
        $('pd-tabs').querySelectorAll('.tab-btn').forEach(function (b) { b.classList.remove('active'); });
        btn.classList.add('active');
        renderTab(_currentTab, window.CareTrack.getState());
      });
    });
    bindHeaderActions();
  }

  function bindHeaderActions() {
    var back = document.getElementById('pd-back-btn');
    if (back) back.addEventListener('click', function () { window.CareTrack.navigate('patients'); });
    var edit = document.getElementById('pd-edit-btn');
    if (edit) edit.addEventListener('click', showEditModal);
    var summaryBtn = document.getElementById('pd-latest-summary-btn');
    if (summaryBtn) summaryBtn.addEventListener('click', showLatestReportsSummaryModal);
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

  function showEditModal() {
    var c = _client;
    var html =
      '<div class="modal-card"><h3 class="modal-title">Edit Patient</h3><div class="form-grid">' +
      fgv('ep-name', 'Full Name', 'text', c.name) +
      fgv('ep-dob', 'Date of Birth', 'date', c.dob) +
      fgs('ep-gender', 'Gender', ['', 'Male', 'Female', 'Other'], c.gender) +
      fgv('ep-diag', 'Diagnosis', 'text', c.diagnosis) +
      fgv('ep-legal', 'Legal Status', 'text', c.legalStatus) +
      fgv('ep-emergency', 'Emergency Contact', 'text', c.emergencyContact) +
      fgv('ep-consent', 'Consent', 'text', c.consent) +
      fgv('ep-therapist', 'Therapist', 'text', c.assignedTherapist) +
      fgv('ep-ward', 'Ward', 'text', c.ward) +
      fgv('ep-room', 'Room', 'text', c.roomNumber) +
      fgs('ep-risk', 'Risk Level', ['none', 'low', 'medium', 'high'], c.currentRisk) +
      '</div><div class="modal-actions" style="margin-top:18px">' +
      '<button type="button" class="btn btn-ghost" id="ep-cancel">Cancel</button>' +
      '<button type="button" class="btn" id="ep-save">Save</button></div></div>';

    AppModal.open(html, {
      onReady: function () {
        document.getElementById('ep-cancel').addEventListener('click', AppModal.close);
        document.getElementById('ep-save').addEventListener('click', function () {
          var data = {
            name: v('ep-name'), dob: v('ep-dob'), gender: v('ep-gender'),
            diagnosis: v('ep-diag'), legalStatus: v('ep-legal'), emergencyContact: v('ep-emergency'), consent: v('ep-consent'),
            assignedTherapist: v('ep-therapist'), ward: v('ep-ward'), roomNumber: v('ep-room'), currentRisk: v('ep-risk')
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
    if (tab === 'history')  { renderHistory(el); return; }
    renderClinicalTab(el, tab, state);
  }

  function renderOverview(el) {
    var c = _client;
    el.innerHTML = '<div class="card"><div class="card-hd"><i class="fas fa-id-card"></i> Patient Information</div>' +
      '<div class="form-grid">' +
      info('Name', c.name) + info('DOB', c.dob) + info('Gender', c.gender) +
      info('Diagnosis', c.diagnosis) + info('Admission', c.admissionDate) +
      info('Legal Status', c.legalStatus) + info('Emergency Contact', c.emergencyContact) + info('Consent', c.consent) +
      info('Therapist', c.assignedTherapist) + info('Ward', c.ward) + info('Room', c.roomNumber) +
      info('Risk', '<span class="risk-badge risk-' + (c.currentRisk || 'none') + '">' + (c.currentRisk || 'none') + '</span>') +
      info('Status', '<span class="status-badge status-' + (c.status || 'active') + '">' + (c.status || 'active') + '</span>') +
      '</div></div>' +
      '<div class="card" id="pd-trend-card" style="margin-top:16px"><div class="card-hd"><i class="fas fa-chart-simple"></i> Reports (last 4 weeks)</div><div id="pd-trend-body"><i class="fas fa-spinner fa-spin"></i> Loading...</div></div>';
    loadOverviewTrend();
  }

  function loadOverviewTrend() {
    var el = document.getElementById('pd-trend-body');
    if (!el || !_client) return;
    var cutoff = Date.now() - 28 * 24 * 60 * 60 * 1000;
    function useDocs(docs) {
      docs = (docs || []).filter(function (r) {
        var t = r.createdAt;
        if (!t) return false;
        var ms = typeof t === 'string' ? new Date(t).getTime() : (t && t.getTime ? t.getTime() : 0);
        return ms >= cutoff;
      });
      function getWeekKey(d) {
        var day = d.getDay();
        var toMonday = day === 0 ? -6 : 1 - day;
        var mon = new Date(d.getFullYear(), d.getMonth(), d.getDate());
        mon.setDate(mon.getDate() + toMonday);
        return mon.getTime();
      }
      function weekRangeLabel(weekStartMs) {
        var mon = new Date(weekStartMs);
        var sun = new Date(weekStartMs);
        sun.setDate(sun.getDate() + 6);
        if (mon.getMonth() === sun.getMonth()) {
          return mon.getDate() + '–' + sun.getDate() + ' ' + mon.toLocaleDateString('en-IN', { month: 'short' });
        }
        return mon.getDate() + ' ' + mon.toLocaleDateString('en-IN', { month: 'short' }) + ' – ' + sun.getDate() + ' ' + sun.toLocaleDateString('en-IN', { month: 'short' });
      }
      var byWeek = {};
      docs.forEach(function (r) {
        var t = r.createdAt;
        var d = typeof t === 'string' ? new Date(t) : (t || new Date());
        var key = getWeekKey(d);
        if (!byWeek[key]) byWeek[key] = 0;
        byWeek[key]++;
      });
      var now = new Date();
      var thisMonday = getWeekKey(now);
      var oneWeekMs = 7 * 24 * 60 * 60 * 1000;
      var keys = [];
      for (var i = 3; i >= 0; i--) {
        keys.push(thisMonday - i * oneWeekMs);
      }
      var maxCount = 0;
      keys.forEach(function (k) { maxCount = Math.max(maxCount, byWeek[k] || 0); });
      maxCount = Math.max(maxCount, 1);
      var scaleMax = Math.max(maxCount, 4);
      var html = '<div class="trend-chart" role="img" aria-label="Report count by week">' +
        '<div class="trend-scale"><span>0</span><span class="trend-scale-max">max ' + scaleMax + '</span></div>';
      keys.forEach(function (k) {
        var count = byWeek[k] || 0;
        var label = weekRangeLabel(k);
        var pct = scaleMax > 0 ? Math.min(100, Math.round(100 * count / scaleMax)) : 0;
        html += '<div class="trend-row">' +
          '<span class="trend-label" title="' + esc(label) + '">' + label + '</span>' +
          '<div class="trend-bar-wrap"><div class="trend-bar" style="width:' + pct + '%"></div></div>' +
          '<span class="trend-value">' + count + '</span>' +
        '</div>';
      });
      html += '</div>';
      el.innerHTML = html;
    }
    if (_cachedReports100.clientId === _client.id && _cachedReports100.docs.length > 0) {
      useDocs(_cachedReports100.docs);
      return;
    }
    AppDB.getClientReports(_client.id, null, 100, null).then(function (result) {
      var docs = result.docs || [];
      _cachedReports100 = { clientId: _client.id, docs: docs };
      useDocs(docs);
    }).catch(function () {
      if (el) el.innerHTML = '<p class="trend-empty">Could not load trend.</p>';
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
      } else       if (section === 'risk') {
        html += buildRiskForm(params, payload);
        var highestRisk = computeHighestRisk(payload.levels || {});
        if (highestRisk === 'medium' || highestRisk === 'high') {
          html += '<div class="fg fg-full" style="margin-top:12px"><button type="button" class="btn btn-outline btn-sm" id="ct-notify-psych"><i class="fas fa-bell"></i> Notify Psychiatrist</button></div>';
        }
      } else if (section === 'medication') {
        html += buildMedicationForm(payload);
      } else {
        html += buildRatingForm(params, payload);
      }

      html += '<div class="fg fg-full" style="margin-top:14px"><label>Notes</label><textarea id="ct-notes" class="fi" rows="3">' + esc(payload.notes || '') + '</textarea></div>';
      var profile = (state && state.profile) || {};
      var canSave = window.Permissions && window.Permissions.canSubmitSection(profile.role, section);
      if (canSave) html += '<div style="margin-top:14px;display:flex;gap:8px"><button type="button" class="btn" id="ct-save"><i class="fas fa-save"></i> Save Report</button></div>';
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
      else if (section === 'risk') {
        html += buildRiskForm(params, payload);
        var clientRisk = (_client && _client.currentRisk) || '';
        if (clientRisk === 'medium' || clientRisk === 'high') html += '<div class="fg fg-full" style="margin-top:12px"><button type="button" class="btn btn-outline btn-sm" id="ct-notify-psych"><i class="fas fa-bell"></i> Notify Psychiatrist</button></div>';
      } else if (section === 'medication') html += buildMedicationForm(payload);
      else html += buildRatingForm(params, payload);
      html += '<div class="fg fg-full" style="margin-top:14px"><label>Notes</label><textarea id="ct-notes" class="fi" rows="3"></textarea></div>';
      var profile = (state && state.profile) || {};
      var canSave = window.Permissions && window.Permissions.canSubmitSection(profile.role, section);
      if (canSave) html += '<div style="margin-top:14px"><button type="button" class="btn" id="ct-save"><i class="fas fa-save"></i> Save Report</button></div>';
      html += '</div>';
      el.innerHTML = html;
      bindClinicalSave(section, params, state);
    });
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
    html += '<div class="fg fg-full" style="margin-top:12px"><label>Restraint Used</label><select class="fi" id="ct-restraint">' +
      '<option value="">—</option><option value="Yes"' + (payload.restraintUsed === 'Yes' ? ' selected' : '') + '>Yes</option><option value="No"' + (payload.restraintUsed === 'No' ? ' selected' : '') + '>No</option></select></div>';
    html += '<div class="fg fg-full"><label>Restraint Justification</label><input type="text" class="fi" id="ct-restraint-just" value="' + esc(payload.restraintJustification || '') + '" placeholder="If applicable"></div>';
    html += '<div class="fg fg-full"><label>Intervention Taken</label><input type="text" class="fi" id="ct-intervention" value="' + esc(payload.interventionTaken || '') + '" placeholder="Brief description"></div>';
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

    var notifyBtn = document.getElementById('ct-notify-psych');
    if (notifyBtn) notifyBtn.addEventListener('click', function () {
      var profile = (state && state.profile) || {};
      AppDB.addRiskEscalation(_client.id, _client.name, profile.displayName || '').then(function () {
        window.CareTrack.toast('Psychiatrist notified');
      }).catch(function (e) { window.CareTrack.toast('Failed: ' + (e && e.message)); });
    });

    var saveBtn = document.getElementById('ct-save');
    if (saveBtn) saveBtn.addEventListener('click', function () {
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
        var restraintEl = document.getElementById('ct-restraint');
        var restraintJustEl = document.getElementById('ct-restraint-just');
        var interventionEl = document.getElementById('ct-intervention');
        if (restraintEl) payload.restraintUsed = restraintEl.value;
        if (restraintJustEl) payload.restraintJustification = restraintJustEl.value.trim();
        if (interventionEl) payload.interventionTaken = interventionEl.value.trim();
      } else if (section === 'medication') {
        card.querySelectorAll('[data-med]').forEach(function (el) {
          var key = el.getAttribute('data-med');
          if (el.value !== undefined && el.value !== null) payload[key] = el.value.trim ? el.value.trim() : el.value;
        });
      }

      var notesEl = document.getElementById('ct-notes');
      payload.notes = notesEl ? notesEl.value.trim() : '';

      var profile = state.profile || {};
      var reportData = {
        clientId: _client.id,
        clientName: _client.name,
        section: section,
        submittedBy: (AppDB.getCurrentUser() || {}).uid || '',
        submittedByName: profile.displayName || '',
        shift: profile.shift || '',
        payload: payload
      };

      if (saveBtn) saveBtn.disabled = true;
      AppDB.saveReport(reportData).then(function () {
        window.CareTrack.toast('Report saved');
        var btn = document.getElementById('ct-save');
        if (btn) btn.disabled = false;

        if (section === 'risk') {
          var highest = computeHighestRisk(payload.levels || {});
          if (highest !== (_client.currentRisk || 'none')) {
            AppDB.updateClientRisk(_client.id, highest).then(function () {
              window.CareTrack.refreshData();
            });
          }
        }
      }).catch(function (e) {
        window.CareTrack.toast('Save failed: ' + e.message);
        var b = document.getElementById('ct-save');
        if (b) b.disabled = false;
      });
    });
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

  function renderHistory(el) {
    _historyLastDoc = null;
    _historySection = '';
    el.innerHTML =
      '<div class="card">' +
      '<div class="card-hd" style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px">' +
        '<span><i class="fas fa-clock-rotate-left"></i> Report History</span>' +
        '<span id="hist-total" class="hist-total"></span>' +
      '</div>' +
      '<div style="margin-bottom:12px"><select class="filter-select" id="hist-filter">' +
        '<option value="">All Sections</option>' +
        '<option value="psychiatric">Psychiatric</option><option value="behavioral">Behavioral</option>' +
        '<option value="medication">Medication</option><option value="adl">ADL</option><option value="therapeutic">Therapeutic</option><option value="risk">Risk</option>' +
      '</select></div>' +
      '<div id="hist-list" class="report-timeline"></div>' +
      '<button type="button" class="btn btn-outline btn-sm load-more-btn" id="hist-more" style="display:none">Load more</button>' +
      '</div>';

    document.getElementById('hist-filter').addEventListener('change', function () {
      _historySection = this.value; _historyLastDoc = null;
      document.getElementById('hist-list').innerHTML = '';
      loadHistory(false);
    });
    document.getElementById('hist-more').addEventListener('click', function () { loadHistory(true); });
    loadHistory(false);
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

    list.querySelectorAll('.report-entry[data-report-index]').forEach(function (el) {
      function openReportModal() {
        var idx = parseInt(el.getAttribute('data-report-index'), 10);
        var r = _historyDocs[idx];
        if (!r) return;
        showReportDetailModal(r);
      }
      el.addEventListener('click', openReportModal);
      el.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openReportModal(); } });
    });
  }

  function formatPayloadForModal(section, p) {
    var lines = [];
    if (section === 'psychiatric' || section === 'behavioral') {
      var r = p.ratings || {};
      Object.keys(r).sort().forEach(function (k) { lines.push('<tr><td>' + esc(k) + '</td><td>' + r[k] + '/5</td></tr>'); });
    } else if (section === 'adl' || section === 'risk') {
      var l = p.levels || {};
      Object.keys(l).sort().forEach(function (k) { lines.push('<tr><td>' + esc(k) + '</td><td>' + esc(l[k]) + '</td></tr>'); });
    } else if (section === 'therapeutic') {
      var a = p.activities || {};
      Object.keys(a).forEach(function (name) {
        var act = a[name] || {};
        var att = act.attendance || '—';
        var eng = act.engagement || '—';
        lines.push('<tr><td>' + esc(name) + '</td><td>' + esc(att) + ' / ' + esc(eng) + '</td></tr>');
      });
    } else if (section === 'medication') {
      var medKeys = ['medicationGiven', 'compliance', 'sideEffects', 'prnGiven', 'prnReason', 'labDue', 'bp', 'pulse', 'temp', 'weight'];
      medKeys.forEach(function (k) {
        var v = p[k];
        if (v === undefined || v === '') return;
        var label = k.replace(/([A-Z])/g, ' $1').replace(/^./, function (s) { return s.toUpperCase(); });
        lines.push('<tr><td>' + esc(label) + '</td><td>' + esc(v) + '</td></tr>');
      });
    }
    if (p.restraintUsed) lines.push('<tr><td>Restraint used</td><td>' + esc(p.restraintUsed) + '</td></tr>');
    if (p.restraintJustification) lines.push('<tr><td>Restraint justification</td><td>' + esc(p.restraintJustification) + '</td></tr>');
    if (p.interventionTaken) lines.push('<tr><td>Intervention taken</td><td>' + esc(p.interventionTaken) + '</td></tr>');
    if (p.notes) lines.push('<tr><td colspan="2"><strong>Notes</strong></td></tr><tr><td colspan="2">' + esc(p.notes) + '</td></tr>');
    return lines.length ? '<table class="report-detail-table"><tbody>' + lines.join('') + '</tbody></table>' : '<p>No details recorded.</p>';
  }

  function showReportDetailModal(r) {
    var section = r.section || '';
    var dt = r.createdAt ? new Date(r.createdAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : '—';
    var payloadHtml = formatPayloadForModal(section, r.payload || {});
    var html =
      '<div class="modal-card report-detail-modal">' +
        '<h3 class="modal-title"><span class="risk-badge risk-' + sectionColor(section) + '">' + capitalize(section) + '</span> Report</h3>' +
        '<div class="report-detail-meta">' +
          '<p><strong>Submitted by</strong> ' + esc(r.submittedByName || '—') + (r.shift ? ' <span style="color:var(--text-3)">(' + esc(r.shift) + ')</span>' : '') + '</p>' +
          '<p><strong>Date & time</strong> ' + dt + '</p>' +
        '</div>' +
        '<div class="report-detail-body">' + payloadHtml + '</div>' +
        '<div class="modal-actions" style="margin-top:16px">' +
          '<button type="button" class="btn" id="report-detail-close">Close</button>' +
        '</div>' +
      '</div>';
    AppModal.open(html, {
      onReady: function () {
        document.getElementById('report-detail-close').addEventListener('click', AppModal.close);
      }
    });
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
          viewBtns.forEach(function (btn) {
            var sec = btn.getAttribute('data-section');
            var item = bySection[sec];
            if (item && item.report) {
              btn.addEventListener('click', function () {
                AppModal.close();
                showReportDetailModal(item.report);
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
  }

  function destroy() {
    _currentTab = 'overview';
    _client = null;
    _latestReports = {};
  }

  window.Pages = window.Pages || {};
  window.Pages.patientDetail = { render: render, init: init, destroy: destroy };
})();
