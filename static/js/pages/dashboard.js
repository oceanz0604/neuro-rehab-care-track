/**
 * Dashboard page — stat cards, active patients strip, risk alerts, recent reports.
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
    var greetEl = $('d-greet');
    if (greetEl) greetEl.textContent = greet + ', ' + (p.displayName || 'Staff');
    var motivEl = $('d-motivational');
    if (motivEl) {
      var tips = ['Ready to make a difference today.', 'Your patients are counting on you.', 'Every report helps the team.', 'Small steps lead to big progress.'];
      motivEl.textContent = tips[Math.floor(Math.random() * tips.length)];
    }
    var dateEl = $('d-date');
    if (dateEl) dateEl.textContent = new Date().toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

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

    renderHighRiskExpandable(highRisk, state.profile || {});
    renderUpdatedToday(active, state.recentReports || [], state);
    renderMyPatients(active, state);
    renderRecentReports(state.recentReports || []);
  }

  function statCardNav(icon, color, label, value, page, filterStatus, filterRisk) {
    var attrs = ' data-nav="' + (page || '') + '"';
    if (filterStatus) attrs += ' data-filter-status="' + filterStatus + '"';
    if (filterRisk) attrs += ' data-filter-risk="' + filterRisk + '"';
    return '<div class="stat-card clickable"' + attrs + ' role="button" tabindex="0">' +
      '<i class="fas ' + icon + ' stat-card-icon stat-card-icon-' + color + '"></i>' +
      '<div class="stat-card-text"><div class="stat-card-label">' + esc(label) + '</div><div class="stat-card-value">' + value + '</div></div></div>';
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

  /* ── My Active Patients — horizontal scrollable cards ──────── */
  var RISK_ORDER = { high: 0, medium: 1, low: 2, none: 3 };
  var RISK_COLORS = { high: '#f43f5e', medium: '#f59e0b', low: '#22c55e', none: '#94a3b8' };
  var RISK_BG_CLASS = { high: 'risk-high-bg', medium: 'risk-medium-bg', low: 'risk-low-bg', none: 'risk-none-bg' };

  function initials(name) {
    var parts = (name || '').trim().split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    return (name || 'U').substring(0, 2).toUpperCase();
  }

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

    var title = (isTherapist || isDoctor) && myName ? 'My Patients' : 'Active Patients';

    if (!myPatients.length) {
      container.innerHTML = '<div class="dash-section">' +
        '<div class="dash-section-hd"><h3 class="dash-section-title"><i class="fas fa-hospital-user"></i> ' + title + '</h3></div>' +
        '<div class="empty-state"><i class="fas fa-check-circle" style="color:var(--green)"></i><p>No active patients</p></div></div>';
      return;
    }

    var html = '<div class="dash-section">' +
      '<div class="dash-section-hd"><h3 class="dash-section-title"><i class="fas fa-hospital-user"></i> ' + title + '</h3>' +
      '<span class="dash-section-count">' + myPatients.length + ' total</span></div>' +
      '<div class="dash-patient-strip">';

    html += myPatients.map(function (c) {
      var risk = (c.currentRisk || 'none').toLowerCase();
      var bgClass = RISK_BG_CLASS[risk] || 'risk-none-bg';
      var latest = latestByClient[c.id];
      var reportLine = '';
      if (latest) {
        var dt = latest.createdAt ? new Date(latest.createdAt) : null;
        var ts = dt ? dt.toLocaleString('en-IN', { day: 'numeric', month: 'short' }) : '';
        reportLine = '<div class="dps-report"><i class="fas fa-file-lines"></i> ' + capitalize(latest.section || '') + ' · ' + ts + '</div>';
      } else {
        reportLine = '<div class="dps-report dps-report-none"><i class="fas fa-file-lines"></i> No reports</div>';
      }

      var diagLine = '';
      var diagnosesList = (c.diagnoses && c.diagnoses.length) ? c.diagnoses.filter(Boolean) : (c.diagnosis && c.diagnosis.trim() ? [c.diagnosis.trim()] : []);
      if (diagnosesList.length) diagLine = '<div class="dps-diag">' + esc(diagnosesList[0]) + '</div>';

      return '<div class="dps-card" data-client="' + (c.id || '') + '">' +
        '<div class="dps-avatar patient-avatar ' + bgClass + '">' + esc(initials(c.name)) + '</div>' +
        '<div class="dps-name">' + esc(c.name || 'Unknown') + '</div>' +
        (risk === 'high' ? '<span class="risk-badge risk-high" style="font-size:.6rem;padding:2px 6px">HIGH</span>' : '') +
        diagLine + reportLine + '</div>';
    }).join('');

    html += '</div></div>';
    container.innerHTML = html;

    container.querySelectorAll('[data-client]').forEach(function (el) {
      var id = el.getAttribute('data-client');
      if (!id) return;
      el.addEventListener('click', function () {
        if (window.CareTrack) window.CareTrack.openPatient(id);
      });
    });
  }

  /* ── High Risk (expandable, top section) ──────────────────────── */
  function renderHighRiskExpandable(highRiskList, profile) {
    var container = $('risk-alerts');
    var wrap = $('dash-high-risk-wrap');
    var countEl = $('dash-high-risk-count');
    var hd = $('dash-high-risk-hd');
    if (!wrap) return;
    if (!highRiskList.length) {
      wrap.style.display = 'none';
      return;
    }
    wrap.style.display = '';
    if (countEl) countEl.textContent = highRiskList.length;

    var myName = (profile.displayName || '').trim();
    var isDoctorOrTherapist = window.Permissions &&
      (window.Permissions.hasRole(profile, 'therapist') || window.Permissions.hasRole(profile, 'medical_officer') || window.Permissions.hasRole(profile, 'psychiatrist'));
    function isYourPatient(c) {
      if (!isDoctorOrTherapist || !myName) return false;
      if ((c.assignedTherapist || '').trim() === myName) return true;
      var doctors = c.assignedDoctors || [];
      return doctors.some(function (d) { return (d || '').trim() === myName; });
    }

    if (container) {
      container.innerHTML = highRiskList.map(function (c) {
        var bgClass = 'risk-high-bg';
        var diagDisplay = (c.diagnosis && c.diagnosis.trim()) ? c.diagnosis : (c.diagnoses && c.diagnoses.length ? (c.diagnoses[0] || '') : '') || '—';
        var yourPatient = isYourPatient(c);
        return '<div class="risk-alert-item clickable" data-client="' + (c.id || '') + '">' +
          '<div class="risk-alert-avatar patient-avatar ' + bgClass + '">' + esc(initials(c.name)) + '</div>' +
          '<div class="risk-alert-body">' +
            '<div class="risk-alert-name">' + esc(c.name || 'Unknown') +
              (yourPatient ? ' <span class="badge-your-patient">Your patient</span>' : '') +
            '</div>' +
            '<div class="risk-alert-detail">' + esc(diagDisplay) + '</div>' +
          '</div>' +
          '<i class="fas fa-chevron-right risk-alert-arrow"></i>' +
        '</div>';
      }).join('');

      container.querySelectorAll('[data-client]').forEach(function (el) {
        var id = el.getAttribute('data-client');
        if (!id) return;
        el.addEventListener('click', function () {
          if (window.CareTrack) window.CareTrack.openPatient(id);
        });
      });
    }

    if (hd) {
      var body = wrap && wrap.querySelector('.dash-section-body');
      var chevron = hd.querySelector('.dash-section-chevron');
      hd.onclick = function () {
        var expanded = hd.getAttribute('aria-expanded') !== 'false';
        hd.setAttribute('aria-expanded', expanded ? 'false' : 'true');
        if (body) body.style.display = expanded ? 'none' : '';
        if (chevron) chevron.classList.toggle('dash-section-chevron-open', !expanded);
      };
    }
  }

  /* ── Patients Updated Today ───────────────────────────────────── */
  function renderUpdatedToday(activeList, recentReports, state) {
    var container = $('dash-updated-today');
    var countEl = $('dash-updated-count');
    var wrap = $('dash-updated-today-wrap');
    if (!container || !wrap) return;
    var today = new Date().toDateString();
    var clientIdsToday = {};
    (recentReports || []).forEach(function (r) {
      if (!r.clientId || !r.createdAt) return;
      if (new Date(r.createdAt).toDateString() === today) clientIdsToday[r.clientId] = true;
    });
    var updated = (activeList || []).filter(function (c) { return clientIdsToday[c.id]; });
    if (countEl) countEl.textContent = updated.length;
    if (!updated.length) {
      container.innerHTML = '<div class="empty-state"><i class="fas fa-calendar-check"></i><p>No patients updated today</p></div>';
      return;
    }
    var latestByClient = {};
    (recentReports || []).forEach(function (r) {
      var cid = r.clientId;
      if (!cid || !clientIdsToday[cid]) return;
      if (!latestByClient[cid] || r.createdAt > latestByClient[cid].createdAt) latestByClient[cid] = r;
    });
    var html = '<div class="dash-patient-strip">' + updated.map(function (c) {
      var risk = (c.currentRisk || 'none').toLowerCase();
      var bgClass = RISK_BG_CLASS[risk] || 'risk-none-bg';
      var latest = latestByClient[c.id];
      var reportLine = latest && latest.createdAt
        ? relativeTime(latest.createdAt)
        : 'Today';
      return '<div class="dps-card" data-client="' + (c.id || '') + '">' +
        '<div class="dps-avatar patient-avatar ' + bgClass + '">' + esc(initials(c.name)) + '</div>' +
        '<div class="dps-name">' + esc(c.name || 'Unknown') + '</div>' +
        '<div class="dps-report">' + reportLine + '</div></div>';
    }).join('') + '</div>';
    container.innerHTML = html;
    container.querySelectorAll('[data-client]').forEach(function (el) {
      var id = el.getAttribute('data-client');
      if (id && window.CareTrack) el.addEventListener('click', function () { window.CareTrack.openPatient(id); });
    });
  }

  /* ── Recent Reports — timeline feed ───────────────────────────── */
  var SECTION_ICONS = {
    psychiatric: 'fa-brain', behavioral: 'fa-comments', medication: 'fa-pills',
    adl: 'fa-hands-helping', therapeutic: 'fa-dumbbell', risk: 'fa-shield-halved'
  };
  var SECTION_COLORS = {
    psychiatric: 'teal', behavioral: 'green', medication: 'amber',
    adl: 'grey', therapeutic: 'green', risk: 'red'
  };

  function capitalize(s) { return (s || '').charAt(0).toUpperCase() + (s || '').slice(1).toLowerCase(); }

  function relativeTime(dateStr) {
    if (!dateStr) return '';
    var now = Date.now();
    var then = new Date(dateStr).getTime();
    var diff = now - then;
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return Math.floor(diff / 60000) + 'm ago';
    if (diff < 86400000) return Math.floor(diff / 3600000) + 'h ago';
    if (diff < 172800000) return 'Yesterday';
    return new Date(dateStr).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  }

  function renderRecentReports(list) {
    var container = $('recent-rpts');
    if (!container) return;
    if (!list.length) {
      container.innerHTML = '<div class="empty-state"><i class="fas fa-inbox"></i><p>No reports yet</p></div>';
      return;
    }
    var reports = list.slice(0, 8);
    container.innerHTML = '<div class="report-timeline">' + reports.map(function (r, idx) {
      var section = r.section || '';
      var icon = SECTION_ICONS[section] || 'fa-file-lines';
      var color = SECTION_COLORS[section] || 'grey';
      var time = relativeTime(r.createdAt);
      return '<div class="rt-item clickable" data-recent-index="' + idx + '" role="button" tabindex="0">' +
        '<div class="rt-icon rt-icon-' + color + '"><i class="fas ' + icon + '"></i></div>' +
        '<div class="rt-body">' +
          '<div class="rt-title">' + esc(r.clientName || '—') + ' <span class="rt-section">' + capitalize(section) + '</span></div>' +
          '<div class="rt-meta">' + esc(r.submittedByName || '') + (time ? ' · ' + time : '') + '</div>' +
        '</div>' +
      '</div>';
    }).join('') + '</div>';

    _recentReportsList = reports;
    container.querySelectorAll('.rt-item').forEach(function (el, idx) {
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
