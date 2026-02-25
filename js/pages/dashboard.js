/**
 * Dashboard page — stat cards, active patients list, risk alerts, recent reports.
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

    var taskCounts = { pendingOnYou: 0, createdByYou: 0 };
    function buildStats(tc) {
      var html = statCardNav('fa-hospital-user', 'teal', 'Active Patients', active.length, 'patients', 'active', '') +
        statCardNav('fa-triangle-exclamation', 'red', 'High Risk', highRisk.length, 'patients', 'active', 'high');
      if (tc.pendingOnYou > 0) html += statCardNav('fa-list-check', 'teal', 'Pending on you', tc.pendingOnYou, 'tasks', '', '');
      if (tc.createdByYou > 0) html += statCardNav('fa-user-pen', 'amber', 'Created by you (pending)', tc.createdByYou, 'tasks', '', '');
      return html;
    }
    $('dash-stats').innerHTML = buildStats(taskCounts);
    bindStatLinks();

    if (window.AppDB && window.AppDB.getTasks) {
      window.AppDB.getTasks().then(function (tasks) {
        var uid = (state.user && state.user.uid) || '';
        var pendingOnYou = tasks.filter(function (t) { return (t.assignedTo || '') === uid && (t.status || '') !== 'done'; }).length;
        var createdByYou = tasks.filter(function (t) { return (t.createdBy || '') === uid && (t.status || '') !== 'done'; }).length;
        $('dash-stats').innerHTML = buildStats({ pendingOnYou: pendingOnYou, createdByYou: createdByYou });
        bindStatLinks();
      }).catch(function () {});
    }

    renderMyPatients(active, state);
    renderRiskAlerts(active, state.profile || {});
    renderRecentReports(state.recentReports || []);
  }

  /* ── Clickable stat card with optional navigation filters ── */
  function statCardNav(icon, color, label, value, page, filterStatus, filterRisk) {
    var attrs = ' data-nav="' + (page || '') + '"';
    if (filterStatus) attrs += ' data-filter-status="' + filterStatus + '"';
    if (filterRisk) attrs += ' data-filter-risk="' + filterRisk + '"';
    return '<div class="stat-card stat-card-' + color + ' clickable"' + attrs + ' role="button" tabindex="0">' +
      '<div class="stat-icon ' + color + '"><i class="fas ' + icon + '"></i></div>' +
      '<div><div class="stat-label">' + label + '</div><div class="stat-value">' + value + '</div></div></div>';
  }

  function bindStatLinks() {
    var el = $('dash-stats');
    if (!el) return;
    el.querySelectorAll('.stat-card.clickable').forEach(function (card) {
      card.addEventListener('click', function () {
        var page = card.getAttribute('data-nav');
        if (!page || !window.CareTrack) return;
        window.CareTrack.navigate(page);
        var fs = card.getAttribute('data-filter-status');
        var fr = card.getAttribute('data-filter-risk');
        if (fs || fr) {
          setTimeout(function () {
            if (fs) {
              var s = document.getElementById('pt-filter-status');
              if (s) { s.value = fs; s.dispatchEvent(new Event('change')); }
            }
            if (fr) {
              var r = document.getElementById('pt-filter-risk');
              if (r) { r.value = fr; r.dispatchEvent(new Event('change')); }
            }
          }, 100);
        }
      });
      card.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); card.click(); }
      });
    });
  }

  /* ── My Active Patients list ─────────────────────────────────── */
  var RISK_ORDER = { high: 0, medium: 1, low: 2, none: 3 };

  function renderMyPatients(active, state) {
    var container = $('dash-my-patients');
    if (!container) return;

    var profile = state.profile || {};
    var myName = (profile.displayName || '').trim();
    var isTherapist = window.Permissions && window.Permissions.hasRole(profile, 'therapist');
    var isDoctor = window.Permissions && (window.Permissions.hasRole(profile, 'medical_officer') || window.Permissions.hasRole(profile, 'psychiatrist'));

    var myPatients = [];
    if ((isTherapist || isDoctor) && myName) {
      active.forEach(function (c) {
        var tagged = false;
        if (isTherapist && (c.assignedTherapist || '').trim() === myName) tagged = true;
        if (isDoctor) {
          var doctors = c.assignedDoctors || [];
          if (doctors.some(function (d) { return (d || '').trim() === myName; })) tagged = true;
        }
        if (tagged) myPatients.push(c);
      });
    }

    if (!myPatients.length) myPatients = active;

    myPatients.sort(function (a, b) {
      var ra = RISK_ORDER[a.currentRisk] !== undefined ? RISK_ORDER[a.currentRisk] : 4;
      var rb = RISK_ORDER[b.currentRisk] !== undefined ? RISK_ORDER[b.currentRisk] : 4;
      return ra - rb;
    });

    var latestByClient = {};
    (state.recentReports || []).forEach(function (r) {
      var cid = r.clientId;
      if (!cid) return;
      if (!latestByClient[cid] || r.createdAt > latestByClient[cid].createdAt) {
        latestByClient[cid] = r;
      }
    });

    var title = (isTherapist || isDoctor) && myName ? 'My Active Patients' : 'Active Patients';
    var html = '<div class="card card-accent"><div class="card-hd card-hd-primary"><i class="fas fa-hospital-user"></i> ' + title + '</div>';

    if (!myPatients.length) {
      html += '<div class="empty-state"><i class="fas fa-check-circle" style="color:var(--green)"></i><p>No active patients</p></div>';
    } else {
      html += myPatients.map(function (c) {
        var risk = (c.currentRisk || 'none').toLowerCase();
        var isHigh = risk === 'high';
        var latest = latestByClient[c.id];
        var reportInfo = '';
        if (latest) {
          var dt = latest.createdAt ? new Date(latest.createdAt) : null;
          var ts = dt ? dt.toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '';
          reportInfo = '<div class="my-pt-report"><i class="fas fa-file-lines"></i> ' +
            capitalize(latest.section || '') + ' &mdash; ' + ts +
            (latest.submittedByName ? ' by ' + esc(latest.submittedByName) : '') + '</div>';
        } else {
          reportInfo = '<div class="my-pt-report text-muted"><i class="fas fa-file-lines"></i> No recent reports</div>';
        }

        var diagnosesList = (c.diagnoses && c.diagnoses.length) ? c.diagnoses.filter(Boolean) : (c.diagnosis && c.diagnosis.trim() ? [c.diagnosis.trim()] : []);
        var diagDisplayHtml = diagnosesList.length ? diagnosesList.map(function (d) { return '<div class="my-pt-diagnosis-line">' + esc(d) + '</div>'; }).join('') : '';
        return '<div class="my-pt-row" data-client="' + (c.id || '') + '">' +
          '<div class="my-pt-info">' +
          '<div class="my-pt-name">' + esc(c.name || 'Unknown') +
          (isHigh ? ' <span class="risk-badge risk-high">HIGH ALERT</span>' : '') +
          '</div>' +
          '<div class="my-pt-diagnosis">' + diagDisplayHtml + '</div>' +
          reportInfo +
          '</div></div>';
      }).join('');
    }

    html += '</div>';
    container.innerHTML = html;

    container.querySelectorAll('[data-client]').forEach(function (el) {
      var id = el.getAttribute('data-client');
      if (!id) return;
      el.addEventListener('click', function () {
        if (window.CareTrack) window.CareTrack.openPatient(id);
      });
    });
  }

  /* ── Risk Alerts (high-risk patients only; hide section if none) ── */
  function renderRiskAlerts(activeList, profile) {
    var highRiskOnly = (activeList || []).filter(function (c) {
      return (c.currentRisk || '').toLowerCase() === 'high';
    });
    var container = $('risk-alerts');
    var card = container && container.parentElement;

    if (!highRiskOnly.length) {
      if (card) card.style.display = 'none';
      return;
    }
    if (card) card.style.display = '';

    var myName = (profile.displayName || '').trim();
    var isDoctorOrTherapist = window.Permissions &&
      (window.Permissions.hasRole(profile, 'therapist') || window.Permissions.hasRole(profile, 'medical_officer') || window.Permissions.hasRole(profile, 'psychiatrist'));
    function isYourPatient(c) {
      if (!isDoctorOrTherapist || !myName) return false;
      if ((c.assignedTherapist || '').trim() === myName) return true;
      var doctors = c.assignedDoctors || [];
      return doctors.some(function (d) { return (d || '').trim() === myName; });
    }

    container.innerHTML = highRiskOnly.map(function (c) {
      var diagDisplay = (c.diagnosis && c.diagnosis.trim()) ? c.diagnosis : (c.diagnoses && c.diagnoses.length ? (c.diagnoses[0] || '') : '') || '—';
      var yourPatient = isYourPatient(c);
      return '<div class="clickable risk-alert-row" data-client="' + (c.id || '') + '">' +
        '<div class="risk-alert-badges">' +
        '<span class="risk-badge risk-high">HIGH</span>' +
        (yourPatient ? '<span class="badge-your-patient">Your patient</span>' : '') +
        '</div>' +
        '<div class="risk-alert-info"><strong>' + esc(c.name || 'Unknown') + '</strong>' +
        '<div class="risk-alert-meta">' + esc(diagDisplay) + '</div></div></div>';
    }).join('');
    container.querySelectorAll('[data-client]').forEach(function (el) {
      var id = el.getAttribute('data-client');
      if (!id) return;
      el.addEventListener('click', function () {
        if (window.CareTrack) window.CareTrack.openPatient(id);
      });
    });
  }

  /* ── Recent Reports ──────────────────────────────────────────── */
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

  /* ── Init & Refresh ──────────────────────────────────────────── */
  var _refreshIntervalId = null;

  function init(state) {
    if (_refreshIntervalId) clearInterval(_refreshIntervalId);
    _refreshIntervalId = setInterval(function () {
      var s = window.CareTrack && window.CareTrack.getState && window.CareTrack.getState();
      if (s && s.page === 'dashboard') window.CareTrack.refreshData();
    }, 5 * 60 * 1000);
  }

  window.Pages = window.Pages || {};
  window.Pages.dashboard = { render: render, init: init };
})();
