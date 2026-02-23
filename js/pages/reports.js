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
    var html =
      '<div class="modal-card report-detail-modal">' +
        '<h3 class="modal-title"><span class="risk-badge risk-' + sectionColor(section) + '">' + capitalize(section) + '</span> Report</h3>' +
        '<div class="report-detail-meta">' +
          '<p><strong>Patient</strong> ' + esc(r.clientName || '—') + '</p>' +
          '<p><strong>Submitted by</strong> ' + esc(r.submittedByName || '—') + (r.shift ? ' <span style="color:var(--text-3)">(' + esc(r.shift) + ')</span>' : '') + '</p>' +
          '<p><strong>Date & time</strong> ' + dt + '</p>' +
        '</div>' +
        '<div class="report-detail-body">' + payloadHtml + '</div>' +
        '<div class="modal-actions" style="margin-top:16px">' +
          '<button type="button" class="btn" id="report-detail-close">Close</button>' +
          '<button type="button" class="btn btn-outline" id="report-detail-open-patient">Open Patient</button>' +
        '</div>' +
      '</div>';
    AppModal.open(html, {
      onReady: function () {
        document.getElementById('report-detail-close').addEventListener('click', AppModal.close);
        var openBtn = document.getElementById('report-detail-open-patient');
        if (openBtn && r.clientId && window.CareTrack) {
          openBtn.addEventListener('click', function () {
            AppModal.close();
            window.CareTrack.openPatient(r.clientId);
          });
        } else if (openBtn) openBtn.style.display = 'none';
      }
    });
  }

  function render(state) {
    var listEl = $('reports-table');
    var totalEl = $('reports-total');
    var rangeSelect = $('reports-date-range');
    if (!listEl) return;

    var range = (rangeSelect && rangeSelect.value) || 'today';
    _dateRange = range;

    if (!_reports.length) {
      if (state.recentReports && state.recentReports.length) {
        _reports = state.recentReports.slice();
        renderTable(state, range);
        return;
      }
      listEl.innerHTML = '<div class="empty-state"><i class="fas fa-spinner fa-spin"></i><p>Loading reports...</p></div>';
      if (totalEl) totalEl.textContent = '';
      AppDB.getRecentReports(50).then(function (reports) {
        _reports = reports || [];
        renderTable(state, range);
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
    if (rangeSelect) {
      rangeSelect.addEventListener('change', function () {
        render(window.CareTrack && window.CareTrack.getState ? window.CareTrack.getState() : state);
      });
    }
    var searchEl = $('reports-search');
    if (searchEl) searchEl.addEventListener('input', function () {
      render(window.CareTrack && window.CareTrack.getState ? window.CareTrack.getState() : state);
    });
    var sectionEl = $('reports-filter-section');
    if (sectionEl) sectionEl.addEventListener('change', function () {
      render(window.CareTrack && window.CareTrack.getState ? window.CareTrack.getState() : state);
    });
  }

  function destroy() {
    _reports = [];
  }

  window.Pages = window.Pages || {};
  window.Pages.reports = { render: render, init: init, destroy: destroy };
})();
