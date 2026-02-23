/**
 * Dashboard page — stat cards, risk alerts, recent reports.
 * All one-time reads from cached data.
 */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };

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

    renderRiskAlerts(highRisk);
    renderRecentReports(state.recentReports || []);
  }

  function statCard(icon, color, label, value) {
    var cardClass = 'stat-card stat-card-' + color;
    return '<div class="' + cardClass + '"><div class="stat-icon ' + color + '"><i class="fas ' + icon + '"></i></div>' +
      '<div><div class="stat-label">' + label + '</div><div class="stat-value">' + value + '</div></div></div>';
  }

  function renderRiskAlerts(list) {
    if (!list.length) {
      $('risk-alerts').innerHTML = '<div class="empty-state"><i class="fas fa-check-circle" style="color:var(--green)"></i><p>No high-risk patients</p></div>';
      return;
    }
    $('risk-alerts').innerHTML = list.map(function (c) {
      return '<div class="clickable" style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--border);cursor:pointer" data-client="' + c.id + '">' +
        '<span class="risk-badge risk-high">HIGH</span>' +
        '<div><strong style="font-size:.88rem">' + (c.name || 'Unknown') + '</strong>' +
        '<div style="font-size:.78rem;color:var(--text-3)">' + (c.diagnosis || '') + '</div></div></div>';
    }).join('');
    $('risk-alerts').querySelectorAll('[data-client]').forEach(function (el) {
      el.addEventListener('click', function () {
        if (window.CareTrack) window.CareTrack.openPatient(el.getAttribute('data-client'));
      });
    });
  }

  function renderRecentReports(list) {
    if (!list.length) {
      $('recent-rpts').innerHTML = '<div class="empty-state"><i class="fas fa-inbox"></i><p>No reports yet</p></div>';
      return;
    }
    $('recent-rpts').innerHTML = list.slice(0, 10).map(function (r) {
      var dt = r.createdAt ? new Date(r.createdAt) : null;
      var ts = dt ? dt.toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '';
      return '<div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--border)">' +
        '<div style="flex:1"><strong style="font-size:.85rem">' + (r.clientName || '—') + '</strong>' +
        '<div style="font-size:.78rem;color:var(--text-3)">' + (r.section || '') + ' &middot; ' + (r.submittedByName || '') + '</div></div>' +
        '<span style="font-size:.75rem;color:var(--text-3);white-space:nowrap">' + ts + '</span></div>';
    }).join('');
  }

  function init(state) {
    $('dash-refresh').addEventListener('click', function () {
      if (window.CareTrack) window.CareTrack.refreshData();
    });
  }

  window.Pages = window.Pages || {};
  window.Pages.dashboard = { render: render, init: init };
})();
