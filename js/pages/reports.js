/**
 * Reports page — list reports by date (today / yesterday / this week), all patients.
 * Click row or patient name → open patient detail (full status & all reports).
 */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var _inited = false;
  var _reports = [];
  var _dateRange = 'today';
  var _lastFilteredReports = [];

  function getRangeFilter(range) {
    var now = new Date();
    var start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    var end = new Date(start.getTime());
    if (range === 'today') {
      end.setDate(end.getDate() + 1);
    } else if (range === 'yesterday') {
      start.setDate(start.getDate() - 1);
      end.setDate(start.getDate() + 1);
    } else if (range === 'week') {
      start.setDate(start.getDate() - 6);
      start.setHours(0, 0, 0, 0);
      end.setDate(end.getDate() + 1);
    } else if (range === '4weeks') {
      start.setDate(start.getDate() - 27);
      start.setHours(0, 0, 0, 0);
      end.setDate(end.getDate() + 1);
    } else if (range === 'custom') {
      var fromEl = $('reports-date-from');
      var toEl = $('reports-date-to');
      var fromStr = fromEl && fromEl.value ? fromEl.value : now.toISOString().slice(0, 10);
      var toStr = toEl && toEl.value ? toEl.value : fromStr;
      start = new Date(fromStr + 'T00:00:00');
      end = new Date(toStr + 'T23:59:59');
      end.setSeconds(59, 999);
      if (end < start) end = new Date(start.getTime());
      return { start: start.getTime(), end: end.getTime() + 1 };
    }
    return { start: start.getTime(), end: end.getTime() };
  }

  function filterReports(reports, range) {
    var f = getRangeFilter(range);
    return reports.filter(function (r) {
      var t = r.createdAt;
      if (!t) return false;
      var ms = typeof t === 'string' ? new Date(t).getTime() : (t && t.getTime ? t.getTime() : 0);
      return ms >= f.start && ms < f.end;
    });
  }

  function sectionColor(s) {
    var m = { psychiatric: 'medium', behavioral: 'low', medication: 'medium', adl: 'none', therapeutic: 'low', risk: 'high' };
    return m[s] || 'none';
  }

  function capitalize(s) { return (s || '').charAt(0).toUpperCase() + (s || '').slice(1).toLowerCase(); }

  function esc(s) { var d = document.createElement('div'); d.textContent = s || ''; return d.innerHTML; }

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
        lines.push('<tr><td>' + esc(name) + '</td><td>' + esc(act.attendance || '—') + ' / ' + esc(act.engagement || '—') + '</td></tr>');
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
    var profile = (window.CareTrack && window.CareTrack.getState && window.CareTrack.getState().profile) || {};
    var canEdit = window.Permissions && window.Permissions.canEditReport(profile);
    var editBtnHtml = canEdit ? '<button type="button" class="btn btn-outline" id="report-detail-edit">Edit Report</button>' : '';
    var html =
      '<div class="modal-card report-detail-modal">' +
        '<h3 class="modal-title"><span class="risk-badge risk-' + sectionColor(section) + '">' + capitalize(section) + '</span> Report</h3>' +
        '<div class="report-detail-meta">' +
          '<p><strong>Patient</strong> <a href="#" id="report-detail-patient-link">' + esc(r.clientName || '—') + '</a></p>' +
          '<p><strong>Submitted by</strong> ' + esc(r.submittedByName || '—') + '</p>' +
          '<p><strong>Date & time</strong> ' + dt + '</p>' +
        '</div>' +
        '<div class="report-detail-body">' + payloadHtml + '</div>' +
        '<div class="modal-actions" style="margin-top:16px;flex-wrap:wrap;gap:8px">' +
          '<button type="button" class="btn" id="report-detail-close">Close</button>' +
          '<button type="button" class="btn btn-outline" id="report-detail-open-patient">Open Patient</button>' +
          editBtnHtml +
        '</div>' +
      '</div>';
    AppModal.open(html, {
      onReady: function () {
        document.getElementById('report-detail-close').addEventListener('click', AppModal.close);
        var openBtn = document.getElementById('report-detail-open-patient');
        if (openBtn && r.clientId && window.CareTrack) {
          openBtn.addEventListener('click', function () { AppModal.close(); window.CareTrack.openPatient(r.clientId); });
        } else if (openBtn) openBtn.style.display = 'none';
        var patientLink = document.getElementById('report-detail-patient-link');
        if (patientLink && r.clientId && window.CareTrack) {
          patientLink.addEventListener('click', function (e) { e.preventDefault(); AppModal.close(); window.CareTrack.openPatient(r.clientId); });
        }
        var editBtn = document.getElementById('report-detail-edit');
        if (editBtn) editBtn.addEventListener('click', function () { AppModal.close(); showEditReportModal(r); });
      }
    });
  }

  function showEditReportModal(r) {
    var section = r.section || '';
    var p = r.payload || {};
    var notes = p.notes || '';
    var profile = (window.CareTrack && window.CareTrack.getState && window.CareTrack.getState().profile) || {};
    var canEdit = window.Permissions && window.Permissions.canEditReport(profile);
    var payloadHtml = formatPayloadForModal(section, p);
    var deleteBtnHtml = canEdit ? '<button type="button" class="btn btn-danger" id="report-edit-delete">Delete Report</button>' : '';
    var html =
      '<div class="modal-card report-detail-modal">' +
        '<h3 class="modal-title">Edit Report — <span class="risk-badge risk-' + sectionColor(section) + '">' + capitalize(section) + '</span></h3>' +
        '<div class="report-detail-meta">' +
          '<p><strong>Patient</strong> ' + esc(r.clientName || '—') + '</p>' +
          '<p><strong>Submitted by</strong> ' + esc(r.submittedByName || '—') + '</p>' +
        '</div>' +
        '<div class="report-detail-body">' + payloadHtml + '</div>' +
        '<div class="fg fg-full" style="margin-top:12px"><label>Notes</label><textarea id="report-edit-notes" class="fi" rows="3">' + esc(notes) + '</textarea></div>' +
        '<div class="modal-actions" style="margin-top:16px;flex-wrap:wrap;gap:8px">' +
          '<button type="button" class="btn btn-ghost" id="report-edit-cancel">Cancel</button>' +
          deleteBtnHtml +
          '<button type="button" class="btn" id="report-edit-save">Save</button>' +
        '</div>' +
      '</div>';
    AppModal.open(html, {
      onReady: function () {
        document.getElementById('report-edit-cancel').addEventListener('click', AppModal.close);
        document.getElementById('report-edit-save').addEventListener('click', function () {
          var newNotes = (document.getElementById('report-edit-notes') || {}).value || '';
          var payload = Object.assign({}, r.payload || {}, { notes: newNotes });
          AppDB.updateReport(r.id, { payload: payload, updatedByName: profile.displayName || '' }).then(function () {
            AppModal.close();
            window.CareTrack.toast('Report updated');
            window.CareTrack.refreshData();
            if (window.Pages.reports && window.Pages.reports.render) window.Pages.reports.render(window.CareTrack.getState());
          }).catch(function (e) { window.CareTrack.toast('Error: ' + (e && e.message)); });
        });
        var delBtn = document.getElementById('report-edit-delete');
        if (delBtn && canEdit) delBtn.addEventListener('click', function () {
          if (!window.AppModal || !AppModal.confirm) { AppDB.deleteReport(r.id).then(function () { AppModal.close(); window.CareTrack.refreshData(); }); return; }
          AppModal.confirm('Delete Report', 'Are you sure you want to delete this ' + (section || '') + ' report? This cannot be undone.', function () {
            AppDB.deleteReport(r.id).then(function () {
              AppModal.close();
              window.CareTrack.toast('Report deleted');
              window.CareTrack.refreshData();
              if (window.Pages.reports && window.Pages.reports.render) window.Pages.reports.render(window.CareTrack.getState());
            }).catch(function (e) { window.CareTrack.toast('Error: ' + (e && e.message)); });
          }, 'Delete');
        });
      }
    });
  }

  var RISK_ORDER = { high: 0, medium: 1, low: 2, none: 3 };
  function sortClientsForReports(clients, profile) {
    var myName = (profile && profile.displayName) ? profile.displayName.trim() : '';
    function isMyPatient(c) {
      if (!myName) return false;
      if ((c.assignedTherapist || '').trim() === myName) return true;
      var doctors = c.assignedDoctors || [];
      return doctors.some(function (d) { return (d || '').trim() === myName; });
    }
    return clients.slice().sort(function (a, b) {
      var aMine = isMyPatient(a); var bMine = isMyPatient(b);
      if (aMine && !bMine) return -1;
      if (!aMine && bMine) return 1;
      var ra = RISK_ORDER[a.currentRisk] !== undefined ? RISK_ORDER[a.currentRisk] : 4;
      var rb = RISK_ORDER[b.currentRisk] !== undefined ? RISK_ORDER[b.currentRisk] : 4;
      return ra - rb;
    });
  }

  function renderPatientCards(state) {
    var container = $('reports-patient-cards');
    var searchEl = $('reports-patient-search');
    if (!container) return;
    var clients = state.clients || [];
    var active = clients.filter(function (c) { return c.status === 'active'; });
    var profile = state.profile || {};
    var search = (searchEl && searchEl.value) || '';
    var q = search.toLowerCase();
    if (q) active = active.filter(function (c) { return (c.name || '').toLowerCase().indexOf(q) !== -1; });
    var sorted = sortClientsForReports(active, profile);
    var myName = (profile.displayName || '').trim();
    function isMyPatient(c) {
      if (!myName) return false;
      if ((c.assignedTherapist || '').trim() === myName) return true;
      return (c.assignedDoctors || []).some(function (d) { return (d || '').trim() === myName; });
    }
    var reportCountByClient = {};
    (_reports || []).forEach(function (r) {
      var id = r.clientId || '';
      reportCountByClient[id] = (reportCountByClient[id] || 0) + 1;
    });
    if (!sorted.length) {
      container.innerHTML = '<p class="empty-state" style="padding:16px;margin:0">No active patients' + (q ? ' match search' : '') + '.</p>';
      return;
    }
    container.innerHTML = sorted.map(function (c) {
      var count = reportCountByClient[c.id] || 0;
      var summary = count ? count + ' report' + (count !== 1 ? 's' : '') + ' in range' : 'No reports in range';
      var myBadge = (window.Permissions && (window.Permissions.hasRole(profile, 'therapist') || window.Permissions.hasRole(profile, 'medical_officer') || window.Permissions.hasRole(profile, 'doctor')) && isMyPatient(c))
        ? ' <span class="badge-my-patient">My patient</span>' : '';
      return '<div class="reports-patient-card" data-client-id="' + esc(c.id) + '" role="button" tabindex="0">' +
        '<div class="card-name">' + esc(c.name || '—') + myBadge + '</div>' +
        '<div class="card-meta">' + esc(c.diagnosis || '—') + '</div>' +
        '<div><span class="risk-badge risk-' + (c.currentRisk || 'none') + '">' + (c.currentRisk || 'none') + '</span></div>' +
        '<div class="card-summary">' + summary + '</div></div>';
    }).join('');
    container.querySelectorAll('.reports-patient-card').forEach(function (card) {
      var id = card.getAttribute('data-client-id');
      function openPatient() { if (id && window.CareTrack) window.CareTrack.openPatient(id); }
      card.addEventListener('click', openPatient);
      card.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openPatient(); } });
    });
  }

  function render(state) {
    var listEl = $('reports-table');
    var totalEl = $('reports-total');
    var rangeSelect = $('reports-date-range');
    if (!listEl) return;

    var range = (rangeSelect && rangeSelect.value) || 'today';
    _dateRange = range;

    renderPatientCards(state);

    if (!_reports.length) {
      if (state.recentReports && state.recentReports.length) {
        _reports = state.recentReports.slice();
        renderTable(state, range);
        return;
      }
      listEl.innerHTML = '<div class="empty-state"><i class="fas fa-spinner fa-spin"></i><p>Loading reports...</p></div>';
      if (totalEl) totalEl.textContent = '';
      AppDB.getRecentReports(200).then(function (reports) {
        _reports = reports || [];
        renderTable(state, range);
        renderPatientCards(window.CareTrack && window.CareTrack.getState ? window.CareTrack.getState() : state);
      }).catch(function () {
        listEl.innerHTML = '<div class="empty-state"><i class="fas fa-exclamation-triangle"></i><p>Failed to load reports.</p></div>';
        if (totalEl) totalEl.textContent = '';
      });
      return;
    }

    renderTable(state, range);
  }

  function renderTable(state, range) {
    var listEl = $('reports-table');
    var totalEl = $('reports-total');
    if (!listEl) return;

    var filtered = filterReports(_reports, range);
    var search = ($('reports-search') || {}).value || '';
    var sectionFilter = ($('reports-filter-section') || {}).value || '';
    if (search) {
      var q = search.toLowerCase();
      filtered = filtered.filter(function (r) {
        return (r.clientName || '').toLowerCase().indexOf(q) !== -1;
      });
    }
    if (sectionFilter) {
      filtered = filtered.filter(function (r) { return r.section === sectionFilter; });
    }

    if (totalEl) totalEl.textContent = filtered.length + ' report' + (filtered.length !== 1 ? 's' : '');

    if (!filtered.length) {
      listEl.innerHTML = '<div class="empty-state"><i class="fas fa-inbox"></i><p>No reports in this period.</p></div>';
      return;
    }

    _lastFilteredReports = filtered;
    var html = '<table><thead><tr><th>Time</th><th>Patient</th><th>Section</th><th>Submitted by</th></tr></thead><tbody>';
    filtered.forEach(function (r, idx) {
      var timeStr = r.createdAt ? new Date(r.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '—';
      var dateStr = r.createdAt ? new Date(r.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : '—';
      html += '<tr class="clickable" data-report-index="' + idx + '" data-client-id="' + esc(r.clientId || '') + '" role="button" tabindex="0">' +
        '<td><span style="white-space:nowrap">' + dateStr + '</span> ' + timeStr + '</td>' +
        '<td><strong>' + esc(r.clientName || '—') + '</strong></td>' +
        '<td><span class="risk-badge risk-' + sectionColor(r.section) + '">' + esc(r.section || '') + '</span></td>' +
        '<td>' + esc(r.submittedByName || '—') + '</td></tr>';
    });
    html += '</tbody></table>';
    listEl.innerHTML = html;

    listEl.querySelectorAll('tr.clickable').forEach(function (tr) {
      function openReport() {
        var idx = parseInt(tr.getAttribute('data-report-index'), 10);
        var r = _lastFilteredReports[idx];
        if (r) showReportDetailModal(r);
      }
      tr.addEventListener('click', openReport);
      tr.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openReport(); } });
    });
  }

  function init(state) {
    if (_inited) return;
    _inited = true;
    var rangeSelect = $('reports-date-range');
    var customDates = $('reports-custom-dates');
    if (rangeSelect) {
      rangeSelect.addEventListener('change', function () {
        if (customDates) customDates.style.display = this.value === 'custom' ? 'inline-flex' : 'none';
        if (this.value === 'custom') {
          var to = new Date();
          var from = new Date(to);
          from.setDate(from.getDate() - 6);
          var fromEl = $('reports-date-from');
          var toEl = $('reports-date-to');
          if (fromEl) fromEl.value = from.toISOString().slice(0, 10);
          if (toEl) toEl.value = to.toISOString().slice(0, 10);
        }
        render(window.CareTrack && window.CareTrack.getState ? window.CareTrack.getState() : state);
      });
    }
    var fromEl = $('reports-date-from');
    var toEl = $('reports-date-to');
    if (fromEl) fromEl.addEventListener('change', function () { if (rangeSelect && rangeSelect.value === 'custom') render(window.CareTrack && window.CareTrack.getState ? window.CareTrack.getState() : state); });
    if (toEl) toEl.addEventListener('change', function () { if (rangeSelect && rangeSelect.value === 'custom') render(window.CareTrack && window.CareTrack.getState ? window.CareTrack.getState() : state); });
    var searchEl = $('reports-search');
    if (searchEl) searchEl.addEventListener('input', function () {
      render(window.CareTrack && window.CareTrack.getState ? window.CareTrack.getState() : state);
    });
    var sectionEl = $('reports-filter-section');
    if (sectionEl) sectionEl.addEventListener('change', function () {
      render(window.CareTrack && window.CareTrack.getState ? window.CareTrack.getState() : state);
    });
    var patientSearch = $('reports-patient-search');
    if (patientSearch) patientSearch.addEventListener('input', function () {
      renderPatientCards(window.CareTrack && window.CareTrack.getState ? window.CareTrack.getState() : state);
    });
  }

  function destroy() {
    _reports = [];
  }

  window.Pages = window.Pages || {};
  window.Pages.reports = { render: render, init: init, destroy: destroy, showReportDetailModal: showReportDetailModal };
})();
