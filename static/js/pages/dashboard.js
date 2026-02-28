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
      var tips = [
        'Ready to make a difference today.', 'Your patients are counting on you.', 'Every report helps the team.', 'Small steps lead to big progress.',
        'Consistency builds trust.', 'Your attention to detail matters.', 'Care today shapes recovery tomorrow.', 'One note can change a care plan.',
        'Stay present for your patients.', 'Documentation protects everyone.', 'Kindness is part of the treatment.', 'Progress is built day by day.',
        'You are part of something meaningful.', 'Clear notes help the whole team.', 'Rest when you need to; then give your best.', 'Every interaction counts.',
        'Quality care starts with listening.', 'Your observations matter.', 'Teamwork makes recovery possible.', 'Celebrate small wins.',
        'Stay curious; stay compassionate.', 'Safety and dignity first.', 'Your energy affects the room.', 'One kind word can lift a day.',
        'Focus on what you can control.', 'Consent and respect in every step.', 'Recovery is a journey; you are a guide.', 'Document with care.',
        'Balance effort with self-care.', 'Advocate for those who need it.', 'Clarity in notes helps continuity.', 'Patience is a clinical skill.',
        'You make the system human.', 'Follow up; it shows you care.', 'Boundaries help you give more.', 'Every handover matters.',
        'Learn something new today.', 'Ask when unsure.', 'Support your colleagues too.', 'Rest and hydration help you perform.',
        'Eyes on the person, not just the chart.', 'Timely updates keep everyone aligned.', 'Your calm helps theirs.', 'Honesty builds trust.',
        'Small gestures, big impact.', 'Prioritise; then execute.', 'Feedback is a gift.', 'Today is a fresh page.',
        'You are enough for today.', 'Progress over perfection.', 'Speak up for safety.', 'Take a breath before the next task.',
        'Your presence is therapeutic.', 'Consistency over intensity.', 'Team handovers save lives.', 'One task at a time.',
        'Celebrate someone else today.', 'Notes are for the next caregiver too.', 'Rest is part of the job.', 'Clarity reduces errors.',
        'You chose a caring profession.', 'Today’s effort matters.', 'Boundaries let you care longer.', 'Listen more than you speak.',
        'Document the positive too.', 'Ask for help when needed.', 'Your wellbeing enables theirs.', 'Simple actions compound.',
        'Stay organised; stay kind.', 'Recovery has no single path.', 'Your tone sets the tone.', 'Finish one thing well.',
        'Advocate with kindness.', 'Safety checks are never wasted.', 'You are a link in the chain of care.', 'Pause before replying.',
        'Empathy is evidence-based.', 'Clear goals, clearer progress.', 'Support families as well.', 'One good conversation changes things.',
        'Your energy is finite; use it well.', 'Follow the plan; adjust when needed.', 'Thank a colleague today.', 'Small wins are still wins.',
        'Document with the next shift in mind.', 'Rest your eyes and mind.', 'Consent and dignity every time.', 'You are seen and valued.',
        'Prioritise high-risk first.', 'Handover with care.', 'One step at a time.', 'Your calm is contagious.',
        'Notes protect the patient.', 'Team care is better care.', 'Take your break.', 'Clarity prevents harm.',
        'You matter to your patients.', 'Stay hydrated and focused.', 'Recovery takes time; so does good care.', 'Ask the patient first.',
        'Consistency builds confidence.', 'One kind act ripples.', 'Document accurately; it matters.', 'Support yourself to support others.',
        'Listen before you act.', 'Safety first, always.', 'Your presence is a intervention.', 'Celebrate progress, however small.',
        'Rest so you can give more.', 'Clear communication saves time.', 'You are part of the solution.', 'Today, do one thing well.',
        'Advocate with respect.', 'Notes are for the future too.', 'Kindness costs nothing.', 'Prioritise and breathe.',
        'You chose to care; that matters.', 'One task, then the next.', 'Teamwork multiplies impact.', 'Document with the reader in mind.',
        'Take a moment for yourself.', 'Recovery is non-linear.', 'Your attitude shapes the day.', 'Follow up with care.',
        'Small steps, big outcomes.', 'Safety checks are care.', 'You are not alone in this.', 'Clarity over speed when it counts.',
        'Rest is part of the plan.', 'Listen to the family too.', 'One good note helps everyone.', 'Stay curious and kind.',
        'Your wellbeing matters.', 'Consent every time.', 'Prioritise what only you can do.', 'Thank yourself for showing up.',
        'Document the why, not just the what.', 'Recovery needs patience.', 'You make a difference.', 'Take breaks; they help.',
        'Advocate calmly and clearly.', 'Notes enable continuity.', 'Kindness is professional.', 'One interaction at a time.',
        'You are a critical part of the team.', 'Rest when you can.', 'Safety and dignity in every action.', 'Celebrate a win today.',
        'Listen to understand.', 'Clear handovers help patients.', 'Your effort is enough for today.', 'Support your peers.',
        'Document with care and clarity.', 'Recovery is a team effort.', 'You bring more than tasks.', 'Pause and prioritise.',
        'One kind word can change a day.', 'Follow the process; improve it when needed.', 'You are valued here.', 'Take care of you too.',
        'Notes are for the patient’s story.', 'Consistency shows you care.', 'Rest to restore.', 'Speak up with respect.',
        'Your attention saves effort later.', 'Team support is real support.', 'Today: one priority at a time.', 'Listen first.',
        'Document accurately and kindly.', 'Recovery takes a village.', 'You show up; that counts.', 'Breathe before the next task.',
        'Advocate for safe, dignified care.', 'Clarity in communication is care.', 'You are enough.', 'Celebrate a colleague.',
        'Notes protect and inform.', 'Small consistent actions matter.', 'Rest is not laziness.', 'Ask; don’t assume.',
        'Your calm helps the whole room.', 'Handover with clarity.', 'One good decision at a time.', 'Support and be supported.',
        'Document for the next caregiver.', 'Recovery has many paths.', 'You matter to the team.', 'Take your break fully.',
        'Kindness is part of the protocol.', 'Prioritise safety and dignity.', 'You are a caregiver; care for you too.', 'Finish one thing well.',
        'Listen to the person, not just the chart.', 'Clear notes are kind notes.', 'You are part of recovery.', 'Pause when overwhelmed.',
        'Advocate with evidence and empathy.', 'Team handovers are care.', 'Today: focus on what matters most.', 'Rest and return stronger.',
        'Your presence is part of the treatment.', 'Consistency builds trust.', 'Document with the future in mind.', 'One step, then the next.',
        'You chose to help; that is enough.', 'Safety first; then efficiency.', 'You are a link in the chain.', 'Take a breath.',
        'Notes help the whole team.', 'Recovery is possible.', 'You make the system humane.', 'Support yourself today.',
        'Kindness and clarity together.', 'Prioritise; then act.', 'You are seen.', 'Celebrate progress.',
        'Listen with full attention.', 'Document with care.', 'You are part of something bigger.', 'Rest when you need it.',
        'Advocate with compassion.', 'Clear communication is care.', 'You matter.', 'One task done well.',
        'Your effort enables recovery.', 'Consistency over intensity.', 'Take your break.', 'Thank a teammate.',
        'Notes protect patients.', 'Recovery needs you.', 'You bring care to life.', 'Pause and prioritise.',
        'Safety and dignity always.', 'You are valued.', 'Document clearly.', 'One kind act today.',
        'Teamwork makes the difference.', 'You show up; that matters.', 'Rest to give more.', 'Listen before you act.',
        'Your calm helps.', 'Clarity saves time and stress.', 'You are enough for today.', 'Celebrate a small win.',
        'Document for continuity.', 'Recovery takes time.', 'You make a difference.', 'Take care of you.',
        'Kindness first.', 'Prioritise well.', 'You are part of the team.', 'Breathe and focus.',
        'Notes matter.', 'You are important.', 'Rest and return.', 'One step at a time.',
        'Your work has meaning.', 'Care with intention.', 'Today is a new chance.', 'Build trust through consistency.',
        'Document with purpose.', 'Recovery is possible every day.', 'You are part of the solution.', 'Rest restores capacity.',
        'Listen to understand, not to reply.', 'Safety is non-negotiable.', 'One note can clarify everything.', 'Support your future self with good notes.',
        'Kindness is never wasted.', 'Prioritise the person.', 'You are a key part of the team.', 'Take that break.',
        'Clarity prevents errors.', 'Recovery needs patience and you.', 'Your calm is a resource.', 'Finish well, then rest.',
        'Advocate with clarity.', 'Notes are for the patient.', 'You matter to many.', 'One interaction at a time.',
        'Consistency shows reliability.', 'Document for the next shift.', 'You bring warmth to the system.', 'Pause when needed.',
        'Team care is stronger care.', 'Your presence is valuable.', 'Rest to sustain care.', 'Speak up with care.',
        'Small actions add up.', 'Follow up with intention.', 'You are enough.', 'Celebrate someone today.',
        'Document the progress too.', 'Recovery has good days and hard days.', 'You help both.', 'Breathe and focus.',
        'Safety and respect always.', 'You chose care; honour that.', 'Clear handovers are care.', 'One task, full attention.',
        'Notes protect and guide.', 'You are a bridge for the patient.', 'Rest is part of the job.', 'Listen first, then act.',
        'Kindness and competence together.', 'Prioritise what matters most.', 'You are valued.', 'Thank yourself for trying.',
        'Document with the reader in mind.', 'Recovery is a partnership.', 'You show up; that is enough.', 'Take care of you first.',
        'Your attention to detail helps.', 'Teamwork reduces burden.', 'Today: one priority.', 'Support and be supported.',
        'Notes enable safe care.', 'You make the path clearer.', 'Rest so you can care.', 'One step, then the next.',
        'Advocate with evidence.', 'Clarity is kindness.', 'You are part of recovery.', 'Pause and breathe.',
        'Consistency builds safety.', 'Document accurately.', 'You bring hope to the process.', 'Take your break without guilt.',
        'Listen to the whole story.', 'Recovery takes teamwork.', 'You are that team.', 'Celebrate progress.',
        'Your effort enables outcomes.', 'Prioritise and proceed.', 'You are seen and needed.', 'Rest to give your best.',
        'Notes are a safety net.', 'You matter to the team.', 'Kindness in every action.', 'One thing well.',
        'Handover with care.', 'You are a critical piece.', 'Document for continuity.', 'Breathe before responding.',
        'Recovery needs advocates.', 'You are one.', 'Take rest seriously.', 'Support your colleagues.',
        'Clear notes, better care.', 'You make a difference daily.', 'Rest and return with focus.', 'One moment at a time.',
        'Safety first, then speed.', 'You are trusted.', 'Document with care.', 'Celebrate a win.',
        'Your calm helps the team.', 'Consistency is professional.', 'You are enough today.', 'Pause when overwhelmed.',
        'Notes tell the story.', 'Recovery is ongoing.', 'You are part of it.', 'Take care of yourself.',
        'Kindness is professional.', 'Prioritise high-impact work.', 'You are valued here.', 'Rest and recharge.',
        'Listen with empathy.', 'Document for the future.', 'You bring care to life.', 'One good decision.',
        'Advocate for the patient.', 'Clarity reduces risk.', 'You matter.', 'Thank a colleague.',
        'Team handovers save time.', 'You are essential.', 'Document clearly.', 'Breathe and continue.',
        'Recovery needs you today.', 'You show up; that counts.', 'Rest when you can.', 'Support each other.',
        'Notes protect everyone.', 'You are part of the chain.', 'Kindness costs nothing.', 'One task at a time.',
        'Your presence matters.', 'Consistency builds confidence.', 'You are important.', 'Take a short break.',
        'Document with intention.', 'Recovery has many faces.', 'You see them.', 'Pause and prioritise.',
        'Safety and dignity first.', 'You are a caregiver.', 'Care for you too.', 'Finish one thing well.',
        'Clear communication is care.', 'You are the team.', 'Rest to restore.', 'One step forward.',
        'Notes help the next person.', 'You make it easier.', 'Kindness is strength.', 'Prioritise and breathe.',
        'Listen before acting.', 'You are valued and needed.', 'Document with care.', 'Celebrate today.',
        'Recovery is possible.', 'You help make it so.', 'Rest is necessary.', 'Support the team.',
        'Your work has impact.', 'Clarity prevents harm.', 'You are enough.', 'Take care.'
      ];
      motivEl.textContent = tips[Math.floor(Math.random() * tips.length)];
    }
    var dateEl = $('d-date');
    if (dateEl) dateEl.textContent = new Date().toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

    var clients = state.clients || [];
    var active = clients.filter(function (c) { return c.status === 'active'; });
    var highRisk = active.filter(function (c) { return c.currentRisk === 'high'; });

    function daysUntilDischarge(plannedDischargeDate) {
      if (!plannedDischargeDate) return null;
      var d = new Date(plannedDischargeDate);
      d.setHours(0, 0, 0, 0);
      var today = new Date();
      today.setHours(0, 0, 0, 0);
      return Math.ceil((d - today) / (24 * 60 * 60 * 1000));
    }
    var dischargeSoonCount = active.filter(function (c) {
      var days = daysUntilDischarge(c.plannedDischargeDate);
      return days !== null && days >= 0 && days <= 7;
    }).length;

    var taskCounts = { pendingOnYou: 0, createdByYou: 0 };
    function buildStats(tc) {
      var html = statCardNav('fa-hospital-user', 'teal', 'Active Patients', active.length, 'patients', 'active', '') +
        statCardNav('fa-triangle-exclamation', 'red', 'High Risk', highRisk.length, 'patients', 'active', 'high') +
        statCardNav('fa-calendar-days', 'amber', 'Discharge within 7 Days', dischargeSoonCount, 'patients', 'active', '');
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

    var myPatients = getMyPatients(active, state.profile || {});
    renderMyPatientsWithList(myPatients, state);
    renderHighRiskExpandable(highRisk, state.profile || {});

    var profile = state.profile || {};
    var isAdmin = window.Permissions && window.Permissions.getRole && window.Permissions.getRole(profile) === 'admin';
    var isDoctor = window.Permissions && window.Permissions.getRole && (window.Permissions.getRole(profile) === 'medical_officer' || window.Permissions.getRole(profile) === 'psychiatrist');
    var canSeeRecentActivity = isAdmin || isDoctor;
    var recentActivityWrap = $('dash-recent-activity-wrap');
    if (recentActivityWrap) recentActivityWrap.style.display = canSeeRecentActivity ? '' : 'none';
    if (canSeeRecentActivity) {
      var recentList = isAdmin ? (state.recentReports || []) : (function () {
        var myPatientIds = {};
        myPatients.forEach(function (c) { myPatientIds[c.id] = true; });
        return (state.recentReports || []).filter(function (r) { return r.clientId && myPatientIds[r.clientId]; });
      })();
      renderRecentReports(recentList);
    }
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

  /** Returns the list of patients "owned" by the current user (for Recent Activity filtering and My Patients). */
  function getMyPatients(active, profile) {
    var p = profile || {};
    var myName = (p.displayName || '').trim();
    var isTherapist = window.Permissions && window.Permissions.hasRole(p, 'therapist');
    var isDoctor = window.Permissions && (window.Permissions.hasRole(p, 'medical_officer') || window.Permissions.hasRole(p, 'psychiatrist'));
    var isAdmin = window.Permissions && window.Permissions.getRole && window.Permissions.getRole(p) === 'admin';

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
    if (!myPatients.length && !isAdmin) myPatients = active.slice();
    return myPatients;
  }

  function renderMyPatientsWithList(myPatients, state) {
    var container = $('dash-my-patients');
    if (!container) return;

    var profile = state.profile || {};
    var myName = (profile.displayName || '').trim();
    var isTherapist = window.Permissions && window.Permissions.hasRole(profile, 'therapist');
    var isDoctor = window.Permissions && (window.Permissions.hasRole(profile, 'medical_officer') || window.Permissions.hasRole(profile, 'psychiatrist'));

    var latestByClient = {};
    (state.recentReports || []).forEach(function (r) {
      var cid = r.clientId;
      if (!cid) return;
      if (!latestByClient[cid] || r.createdAt > latestByClient[cid].createdAt) {
        latestByClient[cid] = r;
      }
    });

    myPatients.sort(function (a, b) {
      var ta = latestByClient[a.id] ? new Date(latestByClient[a.id].createdAt).getTime() : 0;
      var tb = latestByClient[b.id] ? new Date(latestByClient[b.id].createdAt).getTime() : 0;
      return tb - ta;
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
