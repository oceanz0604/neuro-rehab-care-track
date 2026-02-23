/**
 * Dashboard page — stat cards, risk alerts, recent reports.
 * All one-time reads from cached data.
 */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var _recentReportsList = [];
  function esc(s) { var d = document.createElement('div'); d.textContent = s != null ? s : ''; return d.innerHTML; }

  function render(state) {
    var p = state.profile || {};
    var hour = new Date().getHours();
    var greet = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
    $('d-greet').textContent = greet + ', ' + (p.displayName || 'Staff');
    $('d-date').textContent = new Date().toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

    var clients = state.clients || [];
    var active = clients.filter(function (c) { return c.status === 'active'; });
    var highRisk = active.filter(function (c) { return c.currentRisk === 'high'; });

    var todayStr = new Date().toISOString().slice(0, 10);
    var todayReports = (state.recentReports || []).filter(function (r) {
      return r.createdAt && r.createdAt.slice(0, 10) === todayStr;
    });

    $('dash-stats').innerHTML =
      statCard('fa-hospital-user', 'teal', 'Active Patients', active.length) +
      statCard('fa-triangle-exclamation', 'red', 'High Risk', highRisk.length) +
      statCard('fa-file-lines', 'amber', 'Reports Today', todayReports.length) +
      statCard('fa-users', 'green', 'Total Clients', clients.length);

    renderRiskAlerts(active, state.profile || {});
    renderRecentReports(state.recentReports || []);
  }

  function statCard(icon, color, label, value) {
    var cardClass = 'stat-card stat-card-' + color;
    return '<div class="' + cardClass + '"><div class="stat-icon ' + color + '"><i class="fas ' + icon + '"></i></div>' +
      '<div><div class="stat-label">' + label + '</div><div class="stat-value">' + value + '</div></div></div>';
  }

  var RISK_ORDER = { high: 0, medium: 1, low: 2, none: 3 };

  function renderRiskAlerts(activeList, profile) {
    if (!activeList.length) {
      $('risk-alerts').innerHTML = '<div class="empty-state"><i class="fas fa-check-circle" style="color:var(--green)"></i><p>No active patients</p></div>';
      return;
    }
    var sorted = activeList.slice().sort(function (a, b) {
      var ra = RISK_ORDER[a.currentRisk] !== undefined ? RISK_ORDER[a.currentRisk] : 4;
      var rb = RISK_ORDER[b.currentRisk] !== undefined ? RISK_ORDER[b.currentRisk] : 4;
      return ra - rb;
    });
    var myName = (profile.displayName || '').trim();
    var isDoctorOrTherapist = window.Permissions &&
      (window.Permissions.hasRole(profile, 'therapist') || window.Permissions.hasRole(profile, 'doctor') || window.Permissions.hasRole(profile, 'medical_officer'));
    function isYourPatient(c) {
      if (!isDoctorOrTherapist || !myName) return false;
      if ((c.assignedTherapist || '').trim() === myName) return true;
      var doctors = c.assignedDoctors || [];
      return doctors.some(function (d) { return (d || '').trim() === myName; });
    }

    $('risk-alerts').innerHTML = sorted.map(function (c) {
      var risk = (c.currentRisk || 'none').toLowerCase();
      var riskLabel = (c.currentRisk || 'none').toUpperCase();
      var yourPatient = isYourPatient(c);
      return '<div class="clickable risk-alert-row" data-client="' + (c.id || '') + '">' +
        '<span class="risk-badge risk-' + risk + '">' + riskLabel + '</span>' +
        (yourPatient ? '<span class="badge-your-patient">Your patient</span>' : '') +
        '<div class="risk-alert-info"><strong>' + esc(c.name || 'Unknown') + '</strong>' +
        '<div class="risk-alert-meta">' + esc(c.diagnosis || '—') + '</div></div></div>';
    }).join('');
    $('risk-alerts').querySelectorAll('[data-client]').forEach(function (el) {
      var id = el.getAttribute('data-client');
      if (!id) return;
      el.addEventListener('click', function () {
        if (window.CareTrack) window.CareTrack.openPatient(id);
      });
    });
  }

  function sectionColor(s) {
    var m = { psychiatric: 'medium', behavioral: 'low', medication: 'medium', adl: 'none', therapeutic: 'low', risk: 'high' };
    return m[s] || 'none';
  }

  function capitalize(s) { return (s || '').charAt(0).toUpperCase() + (s || '').slice(1).toLowerCase(); }

  function renderRecentReports(list) {
    if (!list.length) {
      $('recent-rpts').innerHTML = '<div class="empty-state"><i class="fas fa-inbox"></i><p>No reports yet</p></div>';
      return;
    }
    var reports = list.slice(0, 10);
    $('recent-rpts').innerHTML = reports.map(function (r, idx) {
      var dt = r.createdAt ? new Date(r.createdAt) : null;
      var ts = dt ? dt.toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '';
      var section = r.section || '';
      var secColor = sectionColor(section);
      return '<div class="clickable recent-rpt-row" data-recent-index="' + idx + '" role="button" tabindex="0">' +
        '<div class="recent-rpt-main">' +
        '<strong class="recent-rpt-name">' + esc(r.clientName || '—') + '</strong>' +
        '<div class="recent-rpt-meta">' + esc(r.submittedByName || '') + '</div>' +
        '</div>' +
        '<span class="risk-badge risk-' + secColor + ' recent-rpt-badge">' + capitalize(section) + '</span>' +
        '<span class="recent-rpt-ts">' + ts + '</span>' +
        '</div>';
    }).join('');
    _recentReportsList = reports;
    $('recent-rpts').querySelectorAll('.recent-rpt-row').forEach(function (el, idx) {
      var r = _recentReportsList[idx];
      if (!r) return;
      function openModal() {
        if (window.Pages.reports && window.Pages.reports.showReportDetailModal) {
          window.Pages.reports.showReportDetailModal(r);
        }
      }
      el.addEventListener('click', openModal);
      el.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openModal(); } });
    });
  }

  var _refreshIntervalId = null;

  function init(state) {
    var refreshBtn = $('dash-refresh');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', function () {
        if (window.CareTrack) window.CareTrack.refreshData();
      });
    }
    if (_refreshIntervalId) clearInterval(_refreshIntervalId);
    _refreshIntervalId = setInterval(function () {
      var s = window.CareTrack && window.CareTrack.getState && window.CareTrack.getState();
      if (s && s.page === 'dashboard') window.CareTrack.refreshData();
    }, 5 * 60 * 1000);
  }

  window.Pages = window.Pages || {};
  window.Pages.dashboard = { render: render, init: init };
})();
