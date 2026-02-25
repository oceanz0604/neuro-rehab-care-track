/**
 * Shared report view/edit modal — full section parameters, used from patient-detail and reports page.
 * Exposes window.ReportModal.open(report, options)
 */
(function () {
  'use strict';

  var DEFAULT_PARAMS = {
    psychiatric: ['Orientation', 'Mood & Affect', 'Thought Content', 'Thought Process', 'Perceptual Disturbances', 'Insight', 'Judgment', 'Psychomotor Activity', 'Sleep Pattern', 'Appetite'],
    behavioral: ['Cooperation', 'Peer Interaction', 'Aggression/Irritability', 'Substance Craving', 'Wandering', 'Emotional Regulation', 'Response to Redirection', 'Routine Participation'],
    adl: ['Personal Hygiene', 'Dressing', 'Toileting', 'Feeding', 'Mobility', 'Room Maintenance', 'Laundry', 'Money Handling', 'Time Management', 'Phone Use'],
    therapeutic: ['Occupational Therapy', 'Group Therapy', 'Individual Counseling', 'Yoga/Exercise', 'Art/Music/Dance', 'Vocational Training', 'Life Skills', 'Recreation', 'Psychoeducation', 'Cognitive Remediation'],
    risk: ['Suicidal Ideation', 'Aggression/Violence', 'Absconding Risk', 'Substance Relapse', 'Falls/Physical Safety', 'Vulnerability', 'Medication Safety'],
    medication: []
  };

  var KEY_MAP = { psychiatric: 'PSY', behavioral: 'BEH', adl: 'ADL', therapeutic: 'THER', risk: 'RISK' };

  function esc(s) { var d = document.createElement('div'); d.textContent = s || ''; return d.innerHTML; }
  function sectionColor(s) { var m = { psychiatric: 'medium', behavioral: 'low', medication: 'medium', adl: 'none', therapeutic: 'low', risk: 'high' }; return m[s] || 'none'; }
  function capitalize(s) { return (s || '').charAt(0).toUpperCase() + (s || '').slice(1).toLowerCase(); }

  function getParams(section, config) {
    if (!config) return DEFAULT_PARAMS[section] || [];
    var key = KEY_MAP[section];
    return (config[key] || DEFAULT_PARAMS[section] || []).slice();
  }

  function formatPayloadForView(section, p) {
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
        lines.push('<tr><td>' + esc(name) + '</td><td>' + esc(act.attendance || '—') + ' / ' + esc(act.engagement || '—') + '</td></tr>');
      });
    } else if (section === 'medication') {
      var medKeys = ['medicationGiven', 'compliance', 'sideEffects', 'prnGiven', 'prnReason', 'labDue', 'bp', 'pulse', 'temp', 'weight'];
      medKeys.forEach(function (k) {
        var v = p[k];
        if (v === undefined || v === '') return;
        var label = k.replace(/([A-Z])/g, ' $1').replace(/^./, function (x) { return x.toUpperCase(); });
        lines.push('<tr><td>' + esc(label) + '</td><td>' + esc(v) + '</td></tr>');
      });
    }
    if (p.restraintUsed) lines.push('<tr><td>Restraint used</td><td>' + esc(p.restraintUsed) + '</td></tr>');
    if (p.restraintJustification) lines.push('<tr><td>Restraint justification</td><td>' + esc(p.restraintJustification) + '</td></tr>');
    if (p.interventionTaken) lines.push('<tr><td>Intervention taken</td><td>' + esc(p.interventionTaken) + '</td></tr>');
    if (p.notes) lines.push('<tr><td colspan="2"><strong>Notes</strong></td></tr><tr><td colspan="2">' + esc(p.notes) + '</td></tr>');
    return lines.length ? '<table class="report-detail-table"><tbody>' + lines.join('') + '</tbody></table>' : '<p>No details recorded.</p>';
  }

  function buildRatingForm(params, payload) {
    var ratings = payload.ratings || {};
    return params.map(function (p) {
      var val = ratings[p] || 0;
      return '<div class="rating-row"><span class="rating-label">' + esc(p) + '</span><div class="rating-btns">' +
        [1,2,3,4,5].map(function (n) {
          return '<button type="button" class="rating-btn' + (val === n ? ' selected' : '') + '" data-param="' + esc(p) + '" data-val="' + n + '">' + n + '</button>';
        }).join('') + '</div></div>';
    }).join('');
  }

  function buildADLForm(params, payload) {
    var levels = payload.levels || {};
    var opts = ['Dependent', 'Max Assist', 'Mod Assist', 'Min Assist', 'Supervised', 'Independent'];
    return params.map(function (p) {
      var val = levels[p] || '';
      return '<div class="adl-row"><span class="adl-label">' + esc(p) + '</span><select class="adl-select" data-param="' + esc(p) + '">' +
        '<option value="">—</option>' + opts.map(function (o) { return '<option' + (val === o ? ' selected' : '') + '>' + o + '</option>'; }).join('') + '</select></div>';
    }).join('');
  }

  function buildTherapeuticForm(params, payload) {
    var activities = payload.activities || {};
    return params.map(function (p) {
      var a = activities[p] || {};
      return '<div class="rating-row" style="flex-wrap:wrap;gap:6px">' +
        '<span class="rating-label">' + esc(p) + '</span>' +
        '<select class="fi" style="width:auto;padding:4px 8px;font-size:.82rem" data-ther="' + esc(p) + '" data-field="attendance">' +
          '<option value="">Attendance</option><option' + (a.attendance === 'Present' ? ' selected' : '') + '>Present</option><option' + (a.attendance === 'Absent' ? ' selected' : '') + '>Absent</option><option' + (a.attendance === 'Refused' ? ' selected' : '') + '>Refused</option></select>' +
        '<select class="fi" style="width:auto;padding:4px 8px;font-size:.82rem" data-ther="' + esc(p) + '" data-field="engagement">' +
          '<option value="">Engagement</option><option' + (a.engagement === 'Active' ? ' selected' : '') + '>Active</option><option' + (a.engagement === 'Passive' ? ' selected' : '') + '>Passive</option><option' + (a.engagement === 'Minimal' ? ' selected' : '') + '>Minimal</option></select></div>';
    }).join('');
  }

  function buildRiskForm(params, payload) {
    var levels = payload.levels || {};
    var opts = ['None', 'Low', 'Medium', 'High'];
    var html = params.map(function (p) {
      var val = levels[p] || '';
      return '<div class="adl-row"><span class="adl-label">' + esc(p) + '</span><select class="adl-select" data-risk="' + esc(p) + '">' +
        '<option value="">—</option>' + opts.map(function (o) { return '<option' + (val === o ? ' selected' : '') + '>' + o + '</option>'; }).join('') + '</select></div>';
    }).join('');
    html += '<div class="fg fg-full" style="margin-top:12px"><label>Restraint Used</label><select class="fi rm-restraint">' +
      '<option value="">—</option><option value="Yes"' + (payload.restraintUsed === 'Yes' ? ' selected' : '') + '>Yes</option><option value="No"' + (payload.restraintUsed === 'No' ? ' selected' : '') + '>No</option></select></div>';
    html += '<div class="fg fg-full"><label>Restraint Justification</label><input type="text" class="fi rm-restraint-just" value="' + esc(payload.restraintJustification || '') + '" placeholder="If applicable"></div>';
    html += '<div class="fg fg-full"><label>Intervention Taken</label><input type="text" class="fi rm-intervention" value="' + esc(payload.interventionTaken || '') + '" placeholder="Brief description"></div>';
    return html;
  }

  function buildMedicationForm(payload) {
    var p = payload || {};
    var sel = function (name, opts) {
      return '<select class="fi" data-med="' + name + '">' +
        opts.map(function (o) { return '<option value="' + esc(o) + '"' + (p[name] === o ? ' selected' : '') + '>' + (o || '—') + '</option>'; }).join('') + '</select>';
    };
    var html = '<div class="form-grid" style="gap:10px">';
    html += '<div class="fg"><label>Medication Given</label>' + sel('medicationGiven', ['', 'Yes', 'No']) + '</div>';
    html += '<div class="fg"><label>Compliance</label>' + sel('compliance', ['', 'Full', 'Partial', 'Refused']) + '</div>';
    html += '<div class="fg"><label>Side Effects</label>' + sel('sideEffects', ['', 'None', 'EPS', 'Sedation', 'Other']) + '</div>';
    html += '<div class="fg"><label>PRN Given</label>' + sel('prnGiven', ['', 'Yes', 'No']) + '</div>';
    html += '<div class="fg"><label>Lab Due</label>' + sel('labDue', ['', 'Yes', 'No']) + '</div>';
    html += '<div class="fg fg-full"><label>PRN Reason</label><input type="text" class="fi" data-med="prnReason" value="' + esc(p.prnReason || '') + '" placeholder="If PRN given"></div>';
    html += '<div class="fg"><label>BP</label><input type="text" class="fi" data-med="bp" value="' + esc(p.bp || '') + '" placeholder="e.g. 120/80"></div>';
    html += '<div class="fg"><label>Pulse</label><input type="text" class="fi" data-med="pulse" value="' + esc(p.pulse || '') + '" placeholder="/min"></div>';
    html += '<div class="fg"><label>Temp</label><input type="text" class="fi" data-med="temp" value="' + esc(p.temp || '') + '" placeholder="°C"></div>';
    html += '<div class="fg"><label>Weight</label><input type="text" class="fi" data-med="weight" value="' + esc(p.weight || '') + '" placeholder="kg"></div></div>';
    return html;
  }

  function buildFormHtml(section, params, payload) {
    if (section === 'adl') return buildADLForm(params, payload);
    if (section === 'therapeutic') return buildTherapeuticForm(params, payload);
    if (section === 'risk') return buildRiskForm(params, payload);
    if (section === 'medication') return buildMedicationForm(payload);
    return buildRatingForm(params, payload);
  }

  function collectPayloadFromForm(container, section, params) {
    var payload = {};
    if (section === 'psychiatric' || section === 'behavioral') {
      payload.ratings = {};
      container.querySelectorAll('.rating-btn.selected').forEach(function (b) {
        payload.ratings[b.getAttribute('data-param')] = parseInt(b.getAttribute('data-val'), 10);
      });
    } else if (section === 'adl') {
      payload.levels = {};
      container.querySelectorAll('.adl-select[data-param]').forEach(function (s) {
        if (s.value) payload.levels[s.getAttribute('data-param')] = s.value;
      });
    } else if (section === 'therapeutic') {
      payload.activities = {};
      container.querySelectorAll('[data-ther]').forEach(function (s) {
        var name = s.getAttribute('data-ther');
        var field = s.getAttribute('data-field');
        if (!payload.activities[name]) payload.activities[name] = {};
        if (s.value) payload.activities[name][field] = s.value;
      });
    } else if (section === 'risk') {
      payload.levels = {};
      container.querySelectorAll('[data-risk]').forEach(function (s) {
        if (s.value) payload.levels[s.getAttribute('data-risk')] = s.value;
      });
      var re = container.querySelector('.rm-restraint');
      var rj = container.querySelector('.rm-restraint-just');
      var iv = container.querySelector('.rm-intervention');
      if (re) payload.restraintUsed = re.value;
      if (rj) payload.restraintJustification = rj.value.trim();
      if (iv) payload.interventionTaken = iv.value.trim();
    } else if (section === 'medication') {
      container.querySelectorAll('[data-med]').forEach(function (el) {
        var key = el.getAttribute('data-med');
        if (el.value !== undefined && el.value !== null) payload[key] = el.value.trim ? el.value.trim() : el.value;
      });
    }
    var notesEl = container.querySelector('.rm-notes');
    payload.notes = notesEl ? notesEl.value.trim() : '';
    return payload;
  }

  function bindRatingButtons(container) {
    container.querySelectorAll('.rating-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var param = btn.getAttribute('data-param');
        container.querySelectorAll('.rating-btn[data-param="' + param + '"]').forEach(function (b) { b.classList.remove('selected'); });
        btn.classList.add('selected');
      });
    });
  }

  function openReportModal(report, options) {
    options = options || {};
    var canEdit = options.canEdit === true;
    var showPatientLink = options.showPatientLink === true;
    var onSave = options.onSave || function () {};
    var onDelete = options.onDelete || function () {};
    var r = report;
    var section = r.section || '';
    var state = (window.CareTrack && window.CareTrack.getState && window.CareTrack.getState()) || {};
    var config = state.config || {};
    var params = getParams(section, config);
    var payload = r.payload || {};
    var container = document.getElementById('modal-container');
    if (!container || !window.AppModal) return;

    function renderView() {
      var dt = r.createdAt ? new Date(r.createdAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : '—';
      var payloadHtml = formatPayloadForView(section, payload);
      var patientBlock = showPatientLink && r.clientId
        ? '<p><strong>Patient</strong> <a href="#" id="rm-patient-link">' + esc(r.clientName || '—') + '</a></p>'
        : '';
      var editBtn = canEdit ? '<button type="button" class="btn btn-outline btn-sm" id="rm-edit-btn"><i class="fas fa-pen"></i> Edit</button>' : '';
      var deleteBtn = canEdit ? '<button type="button" class="btn btn-danger btn-sm" id="rm-delete-btn"><i class="fas fa-trash"></i> Delete</button>' : '';
      var openPatientBtn = showPatientLink && r.clientId ? '<button type="button" class="btn btn-outline btn-sm" id="rm-open-patient">Open Patient</button>' : '';
      var html = '<div class="modal-card report-detail-modal">' +
        '<h3 class="modal-title"><span class="risk-badge risk-' + sectionColor(section) + '">' + capitalize(section) + '</span> Report</h3>' +
        '<div class="report-detail-meta">' + patientBlock +
          '<p><strong>Submitted by</strong> ' + esc(r.submittedByName || '—') + '</p>' +
          '<p><strong>Date & time</strong> ' + dt + '</p></div>' +
        '<div class="report-detail-body">' + payloadHtml + '</div>' +
        '<div class="modal-actions" style="margin-top:16px;flex-wrap:wrap;gap:8px">' +
          '<button type="button" class="btn" id="rm-close">Close</button>' + openPatientBtn + editBtn + deleteBtn + '</div></div>';
      return html;
    }

    function renderEdit() {
      var formBody = buildFormHtml(section, params, payload);
      var deleteBtn = canEdit ? '<button type="button" class="btn btn-danger btn-sm" id="rm-edit-delete"><i class="fas fa-trash"></i> Delete</button>' : '';
      return '<div class="modal-card report-detail-modal">' +
        '<h3 class="modal-title">Edit Report — <span class="risk-badge risk-' + sectionColor(section) + '">' + capitalize(section) + '</span></h3>' +
        '<div class="report-detail-meta"><p><strong>Patient</strong> ' + esc(r.clientName || '—') + '</p><p><strong>Submitted by</strong> ' + esc(r.submittedByName || '—') + '</p></div>' +
        '<div class="report-detail-body report-modal-edit-form">' + formBody + '</div>' +
        '<div class="fg fg-full" style="margin-top:12px"><label>Notes</label><textarea class="fi rm-notes" rows="3" placeholder="Notes">' + esc(payload.notes || '') + '</textarea></div>' +
        '<div class="modal-actions" style="margin-top:16px;flex-wrap:wrap;gap:8px">' +
          '<button type="button" class="btn btn-ghost" id="rm-cancel">Cancel</button>' + deleteBtn +
          '<button type="button" class="btn" id="rm-save"><i class="fas fa-save"></i> Save</button></div></div>';
    }

    function doDelete() {
      if (!window.AppModal.confirm) return;
      window.AppModal.confirm('Delete Report', 'Are you sure you want to delete this ' + (section || '') + ' report? This cannot be undone.', function () {
        window.AppDB.deleteReport(r.id).then(function () {
          window.AppModal.close();
          if (window.CareTrack) window.CareTrack.toast('Report deleted');
          if (window.CareTrack) window.CareTrack.refreshData();
          onDelete();
        }).catch(function (e) { if (window.CareTrack) window.CareTrack.toast('Error: ' + (e && e.message)); });
      }, 'Delete');
    }

    function switchToEdit() {
      container.innerHTML = renderEdit();
      bindRatingButtons(container);
      document.getElementById('rm-cancel').addEventListener('click', function () {
        container.innerHTML = renderView();
        bindView();
      });
      document.getElementById('rm-save').addEventListener('click', function () {
        var newPayload = collectPayloadFromForm(container, section, params);
        var profile = (state && state.profile) || {};
        window.AppDB.updateReport(r.id, { payload: newPayload, updatedByName: profile.displayName || '' }).then(function () {
          if (window.CareTrack) window.CareTrack.toast('Report updated');
          if (window.CareTrack) window.CareTrack.refreshData();
          r.payload = newPayload;
          payload = newPayload;
          container.innerHTML = renderView();
          bindView();
          onSave();
        }).catch(function (e) { if (window.CareTrack) window.CareTrack.toast('Error: ' + (e && e.message)); });
      });
      var delBtn = document.getElementById('rm-edit-delete');
      if (delBtn) delBtn.addEventListener('click', doDelete);
    }

    function bindView() {
      document.getElementById('rm-close').addEventListener('click', window.AppModal.close);
      var openPatient = document.getElementById('rm-open-patient');
      if (openPatient && r.clientId && window.CareTrack) openPatient.addEventListener('click', function (e) { e.preventDefault(); window.AppModal.close(); window.CareTrack.openPatient(r.clientId); });
      var patientLink = document.getElementById('rm-patient-link');
      if (patientLink && r.clientId && window.CareTrack) patientLink.addEventListener('click', function (e) { e.preventDefault(); window.AppModal.close(); window.CareTrack.openPatient(r.clientId); });
      var editBtn = document.getElementById('rm-edit-btn');
      if (editBtn) editBtn.addEventListener('click', switchToEdit);
      var delBtn = document.getElementById('rm-delete-btn');
      if (delBtn) delBtn.addEventListener('click', doDelete);
    }

    var viewHtml = renderView();
    window.AppModal.open(viewHtml, {
      onReady: function () { bindView(); }
    });
  }

  window.ReportModal = { open: openReportModal };
})();
