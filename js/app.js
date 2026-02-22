/**
 * NeuroRehab CareTrack — patient-centric app logic
 */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };

  var state = {
    user: null, profile: null, clients: [], reports: [],
    page: 'dashboard', selectedClient: null, patientTab: 'overview',
    channel: 'General Ward', lang: 'en', unsubMessages: null
  };

  var PSY = ['Orientation (Time/Place/Person)', 'Mood & Affect', 'Thought Content', 'Thought Process', 'Perceptual Disturbances', 'Insight into Illness', 'Judgment', 'Psychomotor Activity', 'Sleep Pattern', 'Appetite & Eating'];
  var BEH = ['Cooperation with Staff', 'Interaction with Peers', 'Aggression / Irritability', 'Substance Craving', 'Wandering / Restlessness', 'Emotional Regulation', 'Response to Redirection', 'Ward Routine Participation'];
  var ADL = ['Personal Hygiene', 'Dressing', 'Toileting', 'Feeding', 'Mobility', 'Room Maintenance', 'Laundry', 'Money Handling', 'Time Management', 'Phone Use'];
  var THER = ['Occupational Therapy', 'Group Therapy', 'Individual Counseling', 'Yoga / Exercise', 'Art / Music / Dance', 'Vocational Training', 'Life Skills', 'Recreation', 'Psychoeducation', 'Cognitive Remediation'];
  var RISK = ['Suicidal Ideation / Self-harm', 'Aggression / Violence', 'Absconding Risk', 'Substance Relapse', 'Falls / Physical Safety', 'Vulnerability / Exploitation', 'Medication Safety'];
  var DEFAULTS = { PSY: PSY.slice(), BEH: BEH.slice(), ADL: ADL.slice(), THER: THER.slice(), RISK: RISK.slice() };
  var RC = ['', '#dc2626', '#ea580c', '#d97706', '#16a34a', '#0d7377'];
  var PCOL = { none: ['#6b7280', '#e5e7eb'], low: ['#16a34a', '#dcfce7'], medium: ['#d97706', '#fef3c7'], high: ['#dc2626', '#fee2e2'] };

  var STRINGS = {
    en: {
      frTitle: 'Family progress reports', frSub: 'Monthly — supportive language only',
      lblC: 'Client', lblM: 'Report month', lblL: 'Language', noc: 'Select a client to preview.',
      center: 'Neuro-Psychiatric Rehabilitation Centre', rTitle: 'Monthly Family Progress Report',
      cLbl: 'Client', tLbl: 'Therapist', aLbl: 'Admitted', pTitle: 'Progress this month',
      mTitle: 'Monthly progress', wTitle: 'Weekly trend summary',
      wCols: ['Area', 'Week 1', 'Week 2', 'Week 3', 'Week 4', 'Change'],
      bars: ['Daily Living Skills', 'Therapy Engagement', 'Behavioral Stability', 'Safety Observations'],
      sections: [
        { t: 'Daily Living Skills', b: 'Your family member has been making steady progress in personal care, dressing, and daily routines. The occupational therapy team continues to provide structured support.' },
        { t: 'Therapy Participation', b: 'Attendance and engagement in therapeutic sessions has been consistent this month. Group activities and wellness programs are progressing well.' },
        { t: 'Behavioral Wellbeing', b: 'The care team has observed increased emotional stability and improved interactions with staff and fellow residents.' },
        { t: 'Safety & Observation', b: 'Safety observations remain on track. The clinical team is monitoring closely and all appropriate supports are in place.' }
      ],
      tipsTitle: 'How you can support your family member',
      tips: ['Regular, calm visits help your family member feel safe and connected.', 'Participate in family counseling sessions when offered.', 'Encourage every small progress — positive reinforcement matters.', 'Contact your assigned social worker for any concerns.', 'Follow caregiver guidelines from your family sessions.'],
      disc: 'This report uses supportive, family-friendly language. It does not contain diagnosis or medication details. Speak with the treating team for clinical information.',
      footer: 'Neuro-Psychiatric Rehabilitation Centre  |  Confidential Family Report  |  NeuroRehab CareTrack',
      print: 'To save as PDF: Browser menu → Print → Save as PDF', locale: 'en-IN'
    },
    mr: {
      frTitle: 'कुटुंब प्रगती अहवाल', frSub: 'मासिक — सहाय्यक भाषा',
      lblC: 'रुग्ण निवडा', lblM: 'अहवाल महिना', lblL: 'भाषा', noc: 'वरून रुग्ण निवडा.',
      center: 'न्यूरो-मनोरुग्ण पुनर्वसन केंद्र', rTitle: 'मासिक कुटुंब प्रगती अहवाल',
      cLbl: 'रुग्ण', tLbl: 'उपचारक', aLbl: 'प्रवेश', pTitle: 'या महिन्याची प्रगती',
      mTitle: 'मासिक प्रगती', wTitle: 'साप्ताहिक कल सारांश',
      wCols: ['क्षेत्र', 'आठवडा १', 'आठवडा २', 'आठवडा ३', 'आठवडा ४', 'बदल'],
      bars: ['दैनंदिन जीवन कौशल्ये', 'उपचार सहभाग', 'वर्तणूक स्थिरता', 'सुरक्षा निरीक्षण'],
      sections: [
        { t: 'दैनंदिन जीवन कौशल्ये', b: 'आपल्या कुटुंब सदस्याने वैयक्तिक काळजी आणि दैनंदिन दिनचर्येत प्रगती केली आहे.' },
        { t: 'उपचारात्मक सहभाग', b: 'या महिन्यात उपचारात्मक सत्रांमध्ये उपस्थिती नियमित राहिली.' },
        { t: 'वर्तणूक व भावनिक स्थिरता', b: 'काळजी संघाने भावनिक स्थिरतेत वाढ निरीक्षण केले आहेत.' },
        { t: 'सुरक्षा निरीक्षण', b: 'सुरक्षा निरीक्षण योग्य प्रकारे चालू आहे.' }
      ],
      tipsTitle: 'आपण कुटुंब सदस्याला कसे सहाय्य करू शकता',
      tips: ['नियमित भेट द्या.', 'कुटुंब समुपदेशन सत्रांमध्ये सहभागी व्हा.', 'छोट्या प्रगतीलाही प्रोत्साहन द्या.', 'शंका असल्यास सामाजिक कार्यकर्त्याशी संपर्क करा.', 'काळजीवाहू मार्गदर्शक पाळा.'],
      disc: 'हा अहवाल सहाय्यक भाषेत आहे. निदान किंवा औषध तपशील नाही.',
      footer: 'न्यूरो-मनोरुग्ण पुनर्वसन केंद्र  |  कुटुंब अहवाल — गोपनीय  |  NeuroRehab CareTrack',
      print: 'PDF: ब्राउझर मेनू → Print → Save as PDF', locale: 'mr-IN'
    }
  };

  function showToast(msg) {
    var el = $('toast'); if (!el) return;
    el.textContent = msg; el.setAttribute('data-show', 'true');
    clearTimeout(state._tt);
    state._tt = setTimeout(function () { el.setAttribute('data-show', 'false'); }, 3000);
  }
  function showLoginError(msg) {
    var el = $('login-error'); if (!el) return;
    el.textContent = msg || ''; el.style.display = msg ? 'block' : 'none';
  }

  // ─── Init ──────────────────────────────────────────────────────
  var loginBound = false;
  function init() {
    if (!window.AppDB || !AppDB.ready) {
      var msg = AppDB && AppDB.error ? AppDB.error : 'Firebase not configured.';
      showLoginError(msg + ' Copy firebase-config.sample.js to firebase-config.js and add your keys.');
      return;
    }
    bindLogin();
    AppDB.onAuthStateChanged(function (user) {
      if (user) {
        state.user = user;
        AppDB.getUserProfile(user.uid).then(function (p) { state.profile = p || {}; showApp(); loadData(); })
          .catch(function () { state.profile = {}; showApp(); loadData(); });
      } else { state.user = null; state.profile = null; showLoginScreen(); }
    });
  }

  function bindLogin() {
    if (loginBound) return;
    var form = $('login-form'), btn = $('login-btn');
    if (!form) return;
    loginBound = true;
    form.addEventListener('submit', function (e) {
      e.preventDefault(); showLoginError('');
      var email = ($('l-email') || {}).value.trim(), pw = ($('l-password') || {}).value;
      if (!email || !pw) { showLoginError('Enter email and password.'); return; }
      btn.disabled = true; btn.textContent = 'Signing in…';
      AppDB.signIn(email, pw).then(function () { btn.disabled = false; btn.textContent = 'Sign in'; })
        .catch(function (err) {
          if (err.code === 'auth/user-not-found' || err.code === 'auth/invalid-credential') {
            btn.textContent = 'Creating account…';
            AppDB.signUp(email, pw).then(function () { btn.disabled = false; btn.textContent = 'Sign in'; })
              .catch(function (e) { showLoginError(e.message || 'Sign up failed'); btn.disabled = false; btn.textContent = 'Sign in'; });
          } else { showLoginError(err.message || 'Sign in failed'); btn.disabled = false; btn.textContent = 'Sign in'; }
        });
    });
  }

  function showLoginScreen() { $('login-screen').classList.remove('hidden'); $('app-shell').setAttribute('hidden', ''); }

  function showApp() {
    $('login-screen').classList.add('hidden'); $('app-shell').removeAttribute('hidden');
    var p = state.profile || {};
    var name = p.displayName || (state.user && state.user.email) || 'Staff';
    var role = p.role || 'Staff';
    var shift = p.shift || 'morning';
    $('sb-name').textContent = name;
    $('sb-role').textContent = role;
    $('sb-avatar').textContent = (name.charAt(0) || 'S').toUpperCase();
    $('shift-badge').textContent = shift === 'morning' ? 'Morning' : 'Evening';
    var h = new Date().getHours();
    $('d-greet').textContent = 'Good ' + (h < 12 ? 'Morning' : h < 17 ? 'Afternoon' : 'Evening') + ', ' + name;
    $('d-date-display').textContent = new Date().toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    var d = new Date();
    if ($('d-date')) $('d-date').value = d.toISOString().split('T')[0];
    if ($('fr-mon')) $('fr-mon').value = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
    bindNav(); buildForms(); goPage('dashboard');
  }

  function loadData() {
    AppDB.getClients().then(function (list) {
      state.clients = list; fillFrSelect(); updateDashboard(); renderPatients();
    }).catch(function () { showToast('Could not load clients'); });
    AppDB.getRecentReports(15).then(function (list) { state.reports = list; updateDashboard(); }).catch(function () {});
  }

  // ─── Navigation ────────────────────────────────────────────────
  var navBound = false;
  function bindNav() {
    if (navBound) return;
    navBound = true;
    document.querySelectorAll('.nav-link[data-page]').forEach(function (a) {
      a.addEventListener('click', function (e) { e.preventDefault(); goPage(a.getAttribute('data-page')); closeSidebar(); });
    });
    $('menu-btn').addEventListener('click', toggleSidebar);
    $('sb-overlay').addEventListener('click', closeSidebar);
    $('logout-btn').addEventListener('click', function () {
      if (state.unsubMessages) state.unsubMessages();
      AppDB.signOut().catch(function () {});
    });
    $('pd-back').addEventListener('click', function () { goPage('patients'); });
    document.querySelectorAll('.ptab[data-tab]').forEach(function (b) {
      b.addEventListener('click', function () { switchTab(b.getAttribute('data-tab')); });
    });
    var search = $('patient-search');
    if (search) search.addEventListener('input', function () { renderPatients(search.value.trim().toLowerCase()); });
  }

  var PAGE_TITLES = { dashboard: 'Dashboard', patients: 'Patients', 'patient-detail': 'Patient', comms: 'Team Chat', freport: 'Family Reports', settings: 'Settings' };

  function goPage(page) {
    state.page = page;
    document.querySelectorAll('.page').forEach(function (el) { el.classList.remove('active'); });
    document.querySelectorAll('.nav-link').forEach(function (el) { el.classList.remove('active'); });
    var pageEl = $('page-' + page);
    var navKey = page === 'patient-detail' ? 'patients' : page;
    var navEl = document.querySelector('.nav-link[data-page="' + navKey + '"]');
    if (pageEl) pageEl.classList.add('active');
    if (navEl) navEl.classList.add('active');
    $('tb-title').textContent = PAGE_TITLES[page] || '';
    if (page === 'dashboard') updateDashboard();
    if (page === 'patients') renderPatients();
    if (page === 'comms') { buildChanTabs(); renderComms(); }
    if (page === 'freport') renderFamilyReport();
    if (page === 'settings') renderSettings();
  }

  function toggleSidebar() { $('sidebar').classList.toggle('open'); $('sb-overlay').classList.toggle('open'); }
  function closeSidebar() { $('sidebar').classList.remove('open'); $('sb-overlay').classList.remove('open'); }

  // ─── Patient Detail ────────────────────────────────────────────
  function openPatient(id) {
    var c = state.clients.filter(function (x) { return x.id === id; })[0];
    if (!c) return;
    state.selectedClient = c;
    $('pd-name').textContent = c.name || c.id;
    var meta = [c.id];
    if (c.admission) meta.push('Admitted: ' + c.admission);
    if (c.therapist) meta.push('Therapist: ' + c.therapist);
    if (c.diagnosis) meta.push(c.diagnosis);
    $('pd-meta').textContent = meta.join(' · ');
    var rb = $('pd-risk-badge');
    rb.textContent = (c.risk || 'low').charAt(0).toUpperCase() + (c.risk || 'low').slice(1) + ' Risk';
    rb.className = 'risk-pill rp-' + (c.risk || 'low');
    $('tb-title').textContent = c.name || 'Patient';
    goPage('patient-detail');
    switchTab('overview');
    rebuildPatientForms();
  }

  function switchTab(tab) {
    state.patientTab = tab;
    document.querySelectorAll('.ptab').forEach(function (b) { b.classList.remove('active'); });
    document.querySelectorAll('.tp').forEach(function (p) { p.classList.remove('active'); });
    var tabBtn = document.querySelector('.ptab[data-tab="' + tab + '"]');
    var panel = $('tab-' + tab);
    if (tabBtn) tabBtn.classList.add('active');
    if (panel) panel.classList.add('active');
    if (tab === 'overview') renderOverview();
  }

  function renderOverview() {
    var c = state.selectedClient;
    if (!c) return;
    var fields = [
      ['Name', c.name], ['Gender', c.gender], ['Date of Birth', c.dob || '—'], ['Admission', c.admission || '—'],
      ['Therapist', c.therapist || '—'], ['Psychiatrist', c.psychiatrist || '—'], ['Diagnosis', c.diagnosis || '—'],
      ['Risk Level', (c.risk || 'low').toUpperCase()], ['Legal Status', c.legal || '—'], ['Payment', c.payment || '—'],
      ['Emergency', c.emergency || '—'], ['Referral', c.referral || '—']
    ];
    var grid = '<div class="ov-grid">' + fields.map(function (f) {
      return '<div class="ov-item"><div class="ov-label">' + f[0] + '</div><div class="ov-value">' + (f[1] || '—') + '</div></div>';
    }).join('') + '</div>';
    var clientReports = (state.reports || []).filter(function (r) { return r.clientId === c.id; });
    var rhtml = clientReports.length ? clientReports.slice(0, 6).map(function (r) {
      var time = r.createdAt ? new Date(r.createdAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '';
      return '<div style="padding:8px 0;border-bottom:1px solid var(--border);font-size:.85rem"><strong>' + (r.section || '') + '</strong> <span style="color:var(--text-3)">by ' + (r.userName || '') + ' · ' + time + '</span></div>';
    }).join('') : '<p style="color:var(--text-3);font-size:.85rem">No reports yet for this patient.</p>';
    $('pd-overview').innerHTML = grid + '<div class="card"><div class="card-hd">Recent Reports</div>' + rhtml + '</div>';
  }

  // ─── Build forms (called once on app load) ─────────────────────
  var formsBound = false;
  function buildForms() {
    buildRatingRows('psy-rows', PSY, 'psy');
    buildRatingRows('beh-rows', BEH, 'beh');
    buildPsychiatricRiskPills();
    buildMedicationSideEffects();
    buildFamilyFields();
    buildMDTMembers();
    buildADL();
    buildTher();
    buildRisk();
    if (!formsBound) { bindFormEvents(); formsBound = true; }
  }

  function rebuildPatientForms() {
    document.querySelectorAll('.tp .fi').forEach(function (el) {
      if (el.tagName === 'SELECT') el.selectedIndex = 0;
      else if (el.type === 'checkbox' || el.type === 'radio') el.checked = false;
      else el.value = '';
    });
    document.querySelectorAll('.tp input[type="radio"], .tp input[type="checkbox"]').forEach(function (el) { el.checked = false; });
    PSY.forEach(function (_, i) { setRating('psy', i, 0); });
    BEH.forEach(function (_, i) { setRating('beh', i, 0); });
    var therRows = ($('ther-rows') || {}).querySelectorAll('.ther-row') || [];
    therRows.forEach(function (row) {
      delete row.dataset.engagement;
      row.querySelectorAll('.ebtn').forEach(function (x) { x.style.background = '#fff'; x.style.borderColor = 'var(--border)'; x.style.color = 'var(--text-3)'; });
    });
    $('risk-rows').querySelectorAll('.rpills').forEach(function (rp) {
      delete rp.dataset.selected;
      rp.querySelectorAll('.rpill').forEach(function (p) { p.style.borderColor = 'var(--border)'; p.style.background = '#fff'; p.style.color = 'var(--text-2)'; });
    });
    if ($('psy-risk')) { delete $('psy-risk').dataset.selectedRisk; $('psy-risk').querySelectorAll('.rpill').forEach(function (p) { var c = PCOL[p.getAttribute('data-risk')]; p.style.borderColor = c[0]; p.style.background = c[1]; p.style.color = c[0]; }); }
    if ($('adl-tot')) $('adl-tot').textContent = '0';
    ADL.forEach(function (_, i) { var cell = $('as-' + i); if (cell) cell.textContent = '–'; });
    if ($('beh-inc-f')) $('beh-inc-f').hidden = true;
    if ($('risk-rest-f')) $('risk-rest-f').hidden = true;
    var d = new Date();
    if ($('d-date')) $('d-date').value = d.toISOString().split('T')[0];
  }

  // ─── Dashboard ────────────────────────────────────────────────
  function updateDashboard() {
    var clients = state.clients || [], reports = state.reports || [];
    var high = clients.filter(function (c) { return c.risk === 'high'; });
    var med = clients.filter(function (c) { return c.risk === 'medium'; });
    $('dashboard-stats').innerHTML =
      '<div class="stat"><div class="stat-n" style="color:var(--primary)">' + clients.length + '</div><div class="stat-l">Patients</div></div>' +
      '<div class="stat"><div class="stat-n" style="color:var(--primary)">' + reports.length + '</div><div class="stat-l">Reports</div></div>' +
      '<div class="stat"><div class="stat-n" style="color:var(--danger)">' + high.length + '</div><div class="stat-l">High Risk</div></div>' +
      '<div class="stat"><div class="stat-n" style="color:var(--warn)">' + med.length + '</div><div class="stat-l">Med Risk</div></div>';
    var alerts = (high.length || med.length) ? high.concat(med).map(function (c) {
      var cls = c.risk === 'high' ? 'alert-danger' : 'alert-warn';
      return '<div class="alert ' + cls + '" style="cursor:pointer" data-open-patient="' + c.id + '"><strong>' + (c.name || c.id) + '</strong> — ' + (c.risk || '').toUpperCase() + ' risk</div>';
    }).join('') : '<div class="alert alert-success">No risk alerts.</div>';
    $('risk-alerts').innerHTML = alerts;
    $('risk-alerts').querySelectorAll('[data-open-patient]').forEach(function (el) {
      el.addEventListener('click', function () { openPatient(el.getAttribute('data-open-patient')); });
    });
    var recent = reports.length ? reports.slice(0, 8).map(function (r) {
      var time = r.createdAt ? new Date(r.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '';
      return '<div style="padding:6px 0;border-bottom:1px solid var(--border);font-size:.85rem"><strong>' + (r.section || '') + '</strong> — ' + (r.clientName || r.clientId) + ' <span style="color:var(--text-3);font-size:.75rem">by ' + (r.userName || '') + ' · ' + time + '</span></div>';
    }).join('') : '<p style="color:var(--text-3);font-size:.85rem">No reports yet.</p>';
    $('recent-rpts').innerHTML = recent;
    $('quick-guide').innerHTML =
      '<p><strong>All staff</strong> → Open a patient → <strong>Shift Report</strong> tab</p>' +
      '<p><strong>Psychiatrist/Nurse</strong> → <strong>Psychiatric</strong> tab: Rate MSE 1–5</p>' +
      '<p><strong>Nurse</strong> → <strong>Medication</strong> tab: Compliance & vitals</p>' +
      '<p><strong>Rehab</strong> → <strong>Behavioral</strong> tab: Rate parameters</p>' +
      '<p><strong>OT</strong> → <strong>ADL</strong> tab: Score daily living activities</p>' +
      '<p><strong>All</strong> → <strong>Risk</strong> tab: Update risk levels each shift</p>';
  }

  // ─── Patients ─────────────────────────────────────────────────
  function renderPatients(filter) {
    var list = state.clients || [];
    if (filter) list = list.filter(function (c) {
      return (c.name || '').toLowerCase().indexOf(filter) >= 0 || (c.diagnosis || '').toLowerCase().indexOf(filter) >= 0;
    });
    var html = list.map(function (c) {
      var rCls = c.risk === 'high' ? 'tag-risk-high' : c.risk === 'medium' ? 'tag-risk-medium' : 'tag-risk-low';
      var rLbl = c.risk === 'high' ? 'High risk' : c.risk === 'medium' ? 'Medium risk' : 'Low risk';
      return '<div class="client-card" data-id="' + c.id + '">' +
        '<div class="client-name">' + (c.name || c.id) + '</div>' +
        '<div class="client-meta">' + c.id + ' · Admitted: ' + (c.admission || '—') + '</div>' +
        '<div class="client-detail">' + (c.therapist || '—') + ' · ' + (c.gender || '') + '</div>' +
        '<div class="client-tags"><span class="tag ' + rCls + '">' + rLbl + '</span><span class="tag tag-dx">' + (c.diagnosis || '—') + '</span></div></div>';
    }).join('');
    $('client-grid').innerHTML = html || '<p style="color:var(--text-3)">No patients found. Add one to get started.</p>';
    $('client-grid').querySelectorAll('.client-card').forEach(function (el) {
      el.addEventListener('click', function () { openPatient(el.getAttribute('data-id')); });
    });
  }

  $('btn-add-client').addEventListener('click', function () { $('modal-client').setAttribute('aria-hidden', 'false'); });
  $('modal-client-close').addEventListener('click', function () { $('modal-client').setAttribute('aria-hidden', 'true'); });
  $('cancel-client').addEventListener('click', function () { $('modal-client').setAttribute('aria-hidden', 'true'); });
  $('modal-client').addEventListener('click', function (e) { if (e.target === $('modal-client')) $('modal-client').setAttribute('aria-hidden', 'true'); });
  $('submit-client').addEventListener('click', function () {
    var name = ($('nc-name') || {}).value.trim();
    if (!name) { showToast('Enter patient name'); return; }
    var data = {
      name: name, gender: ($('nc-gender') || {}).value, dob: ($('nc-dob') || {}).value || null,
      admission: ($('nc-adm') || {}).value || null, legal: ($('nc-legal') || {}).value,
      referral: ($('nc-ref') || {}).value, therapist: ($('nc-therapist') || {}).value.trim(),
      psychiatrist: ($('nc-psych') || {}).value.trim(), emergency: ($('nc-emergency') || {}).value.trim(),
      payment: ($('nc-pay') || {}).value, diagnosis: ($('nc-dx') || {}).value.trim() || 'Not specified', risk: 'low'
    };
    AppDB.addClient(data).then(function () {
      showToast('Patient registered'); $('modal-client').setAttribute('aria-hidden', 'true'); $('nc-name').value = '';
      return AppDB.getClients();
    }).then(function (list) { state.clients = list; fillFrSelect(); renderPatients(); updateDashboard(); })
      .catch(function () { showToast('Failed to add patient'); });
  });

  // ─── Save report (uses selectedClient) ────────────────────────
  function saveReport(section, payload) {
    var c = state.selectedClient;
    if (!c) { showToast('Open a patient first'); return; }
    var p = state.profile || {};
    AppDB.saveReport({
      clientId: c.id, clientName: c.name, section: section,
      userId: state.user.uid, userName: p.displayName || state.user.email,
      shift: p.shift || 'morning', payload: payload || {}
    }).then(function () {
      showToast(section + ' saved');
      AppDB.getRecentReports(15).then(function (list) { state.reports = list; updateDashboard(); });
    }).catch(function () { showToast('Failed to save'); });
  }

  // ─── Form Events ──────────────────────────────────────────────
  function bindFormEvents() {
    $('save-daily').addEventListener('click', function () {
      saveReport('Daily Report', { condition: v('q-cond'), mood: v('q-mood'), sleep: v('q-sleep'), notes: v('q-notes') });
    });
    $('save-psychiatric').addEventListener('click', function () { saveReport('Psychiatric', getPsyPayload()); });
    $('clear-psy').addEventListener('click', function () { PSY.forEach(function (_, i) { setRating('psy', i, 0); }); $('psy-notes').value = ''; });
    $('save-medication').addEventListener('click', function () {
      var se = []; ($('med-sideeffects') || {}).querySelectorAll('input:checked').forEach(function (c) { se.push(c.value); });
      saveReport('Medication', { compliance: v('med-compliance'), reason: v('med-reason'), sideEffects: se, prn: v('med-prn'), prnDesc: v('med-prn-desc'), bp: v('med-bp'), pulse: v('med-pulse'), weight: v('med-weight'), temp: v('med-temp'), notes: v('med-notes') });
    });
    $('beh-inc').addEventListener('change', function () { $('beh-inc-f').hidden = $('beh-inc').value !== 'yes'; });
    $('save-behavioral').addEventListener('click', function () { saveReport('Behavioral', { incident: v('beh-inc'), incidentDesc: v('beh-inc-desc') }); });
    $('clear-beh').addEventListener('click', function () { BEH.forEach(function (_, i) { setRating('beh', i, 0); }); });
    $('save-adl').addEventListener('click', function () {
      var scores = {}; ADL.forEach(function (_, i) { var r = document.querySelector('input[name="adl-' + i + '"]:checked'); scores['adl' + i] = r ? parseInt(r.value, 10) : null; });
      saveReport('ADL', { scores: scores, total: parseInt(($('adl-tot') || {}).textContent, 10) || 0, trend: v('adl-trend'), notes: v('adl-notes') });
    });
    $('save-therapeutic').addEventListener('click', function () {
      var payload = {}; THER.forEach(function (_, i) {
        var row = $('ther-rows').querySelectorAll('.ther-row')[i]; if (!row) return;
        payload['att' + i] = row.querySelector('.ther-att') ? row.querySelector('.ther-att').checked : false;
        payload['eng' + i] = row.dataset.engagement ? parseInt(row.dataset.engagement, 10) : null;
      });
      saveReport('Therapeutic', payload);
    });
    $('save-family').addEventListener('click', function () {
      saveReport('Family Involvement', { visits: v('fam-visits'), quality: v('fam-quality'), attitude: v('fam-attitude'), understanding: v('fam-understanding'), counseling: v('fam-counseling'), home: v('fam-home'), discharge: v('fam-discharge'), notes: v('fam-notes') });
    });
    $('risk-rest').addEventListener('change', function () { $('risk-rest-f').hidden = $('risk-rest').value !== 'yes'; });
    $('save-risk').addEventListener('click', function () {
      var lvls = {}; RISK.forEach(function (_, i) { var el = $('rp-' + i); lvls['r' + i] = (el && el.dataset.selected) || 'none'; });
      saveReport('Risk Monitoring', { riskLevels: lvls, restraint: v('risk-rest'), restraintDesc: v('risk-rest-desc'), notes: v('risk-notes') });
    });
    $('save-mdt').addEventListener('click', function () {
      var members = []; ($('mdt-members') || {}).querySelectorAll('input:checked').forEach(function (c) { members.push(c.value); });
      saveReport('MDT Review', { members: members, progress: v('mdt-progress'), concerns: v('mdt-concerns'), changes: v('mdt-changes'), goals: v('mdt-goals'), discharge: v('mdt-discharge') });
    });
  }
  function v(id) { return ($(id) || {}).value || ''; }

  // ─── Rating rows ──────────────────────────────────────────────
  function buildRatingRows(containerId, params, prefix) {
    var html = params.map(function (p, i) {
      var btns = ''; for (var x = 1; x <= 5; x++) btns += '<button type="button" class="rbtn" data-prefix="' + prefix + '" data-i="' + i + '" data-v="' + x + '">' + x + '</button>';
      return '<div class="rrow"><div class="rrow-lbl">' + p + '</div><div class="rrow-c"><div class="rbtns">' + btns + '</div><input class="rnote" placeholder="Note" data-prefix="' + prefix + '" data-i="' + i + '"></div></div>';
    }).join('');
    $(containerId).innerHTML = html;
    $(containerId).querySelectorAll('.rbtn').forEach(function (b) {
      b.addEventListener('click', function () { setRating(b.getAttribute('data-prefix'), parseInt(b.getAttribute('data-i'), 10), parseInt(b.getAttribute('data-v'), 10)); });
    });
  }
  function setRating(prefix, rowIndex, value) {
    var container = prefix === 'psy' ? $('psy-rows') : $('beh-rows'); if (!container) return;
    var row = container.querySelectorAll('.rrow')[rowIndex]; if (!row) return;
    row.dataset.rating = value > 0 ? value : '';
    row.querySelectorAll('.rbtn').forEach(function (b) {
      var bv = parseInt(b.getAttribute('data-v'), 10);
      if (bv <= value) { b.style.background = RC[value]; b.style.borderColor = RC[value]; b.style.color = '#fff'; }
      else { b.style.background = '#fff'; b.style.borderColor = 'var(--border)'; b.style.color = 'var(--text-3)'; }
    });
  }
  function buildPsychiatricRiskPills() {
    $('psy-risk').innerHTML = ['none', 'low', 'medium', 'high'].map(function (lv) {
      var c = PCOL[lv], l = lv.charAt(0).toUpperCase() + lv.slice(1);
      return '<button type="button" class="rpill" data-risk="' + lv + '" style="border-color:' + c[0] + ';background:' + c[1] + ';color:' + c[0] + '">' + l + '</button>';
    }).join('');
    $('psy-risk').querySelectorAll('.rpill').forEach(function (b) {
      b.addEventListener('click', function () {
        $('psy-risk').dataset.selectedRisk = b.getAttribute('data-risk');
        $('psy-risk').querySelectorAll('.rpill').forEach(function (p) { var c = PCOL[p.getAttribute('data-risk')]; p.style.borderColor = c[0]; p.style.background = c[1]; p.style.color = c[0]; });
      });
    });
  }
  function getPsyPayload() {
    var ratings = {}, rows = ($('psy-rows') || {}).querySelectorAll('.rrow') || [];
    PSY.forEach(function (p, i) { var row = rows[i]; if (!row) return; var n = row.querySelector('.rnote'); ratings['r' + i] = row.dataset.rating ? parseInt(row.dataset.rating, 10) : null; ratings['n' + i] = n ? n.value : ''; });
    return { ratings: ratings, risk: ($('psy-risk') && $('psy-risk').dataset.selectedRisk) || 'none', notes: v('psy-notes') };
  }

  // ─── Medication ───────────────────────────────────────────────
  function buildMedicationSideEffects() {
    $('med-sideeffects').innerHTML = ['None', 'EPS', 'Sedation', 'Metabolic', 'Other'].map(function (o) {
      return '<label class="cb-l"><input type="checkbox" name="med-se" value="' + o + '"> ' + o + '</label>';
    }).join('');
  }

  // ─── ADL ──────────────────────────────────────────────────────
  function buildADL() {
    $('adl-body').innerHTML = ADL.map(function (d, i) {
      var rad = [4, 3, 2, 1].map(function (x) { return '<td><input type="radio" name="adl-' + i + '" value="' + x + '"></td>'; }).join('');
      return '<tr><td>' + d + '</td>' + rad + '<td id="as-' + i + '">–</td></tr>';
    }).join('');
    $('adl-body').querySelectorAll('input[type="radio"]').forEach(function (r) { r.addEventListener('change', updateADLTotal); });
  }
  function updateADLTotal() {
    var tot = 0; ADL.forEach(function (_, i) {
      var r = document.querySelector('input[name="adl-' + i + '"]:checked'), cell = $('as-' + i);
      if (r) { tot += parseInt(r.value, 10); if (cell) cell.textContent = r.value; } else if (cell) cell.textContent = '–';
    }); if ($('adl-tot')) $('adl-tot').textContent = tot;
  }

  // ─── Therapeutic ──────────────────────────────────────────────
  function buildTher() {
    $('ther-rows').innerHTML = THER.map(function (a, i) {
      var btns = ''; for (var x = 1; x <= 5; x++) btns += '<button type="button" class="ebtn" data-ai="' + i + '" data-v="' + x + '">' + x + '</button>';
      return '<div class="ther-row"><div class="ther-c"><label class="ther-lbl"><input type="checkbox" class="ther-att" data-i="' + i + '"> ' + a + '</label><div class="ebtns">' + btns + '</div></div></div>';
    }).join('');
    $('ther-rows').querySelectorAll('.ebtn').forEach(function (b) {
      b.addEventListener('click', function () {
        var ai = parseInt(b.getAttribute('data-ai'), 10), bv = parseInt(b.getAttribute('data-v'), 10);
        var row = $('ther-rows').querySelectorAll('.ther-row')[ai]; if (!row) return;
        row.dataset.engagement = bv;
        row.querySelectorAll('.ebtn').forEach(function (x) {
          var xv = parseInt(x.getAttribute('data-v'), 10);
          if (xv <= bv) { x.style.background = 'var(--primary)'; x.style.borderColor = 'var(--primary)'; x.style.color = '#fff'; }
          else { x.style.background = '#fff'; x.style.borderColor = 'var(--border)'; x.style.color = 'var(--text-3)'; }
        });
      });
    });
  }

  // ─── Family fields ────────────────────────────────────────────
  function buildFamilyFields() {
    var fields = [
      { id: 'fam-visits', lbl: 'Visits / week', opts: [0,1,2,3,4,5,6,7] },
      { id: 'fam-quality', lbl: 'Visit quality', opts: ['Not Applicable', 'Good', 'Moderate', 'Poor'] },
      { id: 'fam-attitude', lbl: 'Family attitude', opts: ['Supportive', 'Ambivalent', 'Hostile', 'Over-involved'] },
      { id: 'fam-understanding', lbl: 'Understanding', opts: ['Good', 'Partial', 'Poor'] },
      { id: 'fam-counseling', lbl: 'Counseling', opts: ['Yes', 'No', 'N/A'] },
      { id: 'fam-home', lbl: 'Home environment', opts: ['Conducive', 'Needs Improvement', 'Not Assessed'] },
      { id: 'fam-discharge', lbl: 'Discharge involvement', opts: ['Active', 'Passive', 'Absent'] }
    ];
    $('family-fields').innerHTML = fields.map(function (f) {
      var opts = f.opts.map(function (o) { return '<option>' + o + '</option>'; }).join('');
      return '<div class="fg"><label>' + f.lbl + '</label><select id="' + f.id + '" class="fi">' + opts + '</select></div>';
    }).join('');
  }

  // ─── Risk ─────────────────────────────────────────────────────
  function buildRisk() {
    $('risk-rows').innerHTML = RISK.map(function (d, i) {
      var pills = ['none', 'low', 'medium', 'high'].map(function (lv) {
        return '<button type="button" class="rpill rpill-risk" data-di="' + i + '" data-lv="' + lv + '">' + (lv.charAt(0).toUpperCase() + lv.slice(1)) + '</button>';
      }).join('');
      return '<div style="padding:10px 0;border-bottom:1px solid var(--border)"><div style="font-weight:500;font-size:.88rem;margin-bottom:6px">' + d + '</div><div class="rpills" id="rp-' + i + '">' + pills + '</div></div>';
    }).join('');
    $('risk-rows').querySelectorAll('.rpill-risk').forEach(function (b) {
      b.addEventListener('click', function () {
        var di = parseInt(b.getAttribute('data-di'), 10), lv = b.getAttribute('data-lv'), col = PCOL[lv];
        var parent = $('rp-' + di); parent.dataset.selected = lv;
        parent.querySelectorAll('.rpill').forEach(function (p) { p.style.borderColor = 'var(--border)'; p.style.background = '#fff'; p.style.color = 'var(--text-2)'; });
        b.style.borderColor = col[0]; b.style.background = col[1]; b.style.color = col[0];
      });
    });
  }

  // ─── MDT ──────────────────────────────────────────────────────
  function buildMDTMembers() {
    $('mdt-members').innerHTML = ['Psychiatrist', 'Psychologist', 'OT', 'Social Worker', 'Nurse', 'Rehab Worker', 'Psychotherapist'].map(function (r) {
      return '<label class="cb-l"><input type="checkbox" name="mdt-m" value="' + r + '"> ' + r + '</label>';
    }).join('');
  }

  // ─── Team Chat ────────────────────────────────────────────────
  function buildChanTabs() {
    var chans = AppDB.CHANNELS || ['General Ward', 'Urgent Alerts', 'Shift Handover', 'Nursing', 'Psychiatry', 'Rehab'];
    $('chan-tabs').innerHTML = chans.map(function (ch) {
      return '<button type="button" class="ctab' + (ch === state.channel ? ' active' : '') + '" data-chan="' + ch.replace(/"/g, '&quot;') + '">' + ch + '</button>';
    }).join('');
    $('chan-tabs').querySelectorAll('.ctab').forEach(function (b) {
      b.addEventListener('click', function () {
        state.channel = b.getAttribute('data-chan');
        document.querySelectorAll('.ctab').forEach(function (x) { x.classList.remove('active'); });
        b.classList.add('active'); $('chan-title').textContent = state.channel; renderComms();
      });
    });
  }
  function renderComms() {
    $('chan-title').textContent = state.channel;
    if (state.unsubMessages) state.unsubMessages();
    state.unsubMessages = AppDB.subscribeMessages(state.channel, function (list) {
      var html = (list || []).map(function (m) {
        var mine = m.sender === (state.profile && state.profile.displayName);
        var time = m.createdAt ? new Date(m.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '';
        return '<div class="msg-wrap' + (mine ? ' mine' : '') + '"><div class="msg-bubble' + (mine ? ' mine' : ' theirs') + '">' + (m.text || '') + '<div class="msg-meta">' + (m.sender || '') + ' · ' + time + '</div></div></div>';
      }).join('');
      $('msg-list').innerHTML = html || '<p style="color:var(--text-3);font-size:.85rem">No messages yet.</p>';
      var ml = $('msg-list'); if (ml) ml.scrollTop = ml.scrollHeight;
    });
  }
  $('send-msg').addEventListener('click', sendMsg);
  $('msg-in').addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); sendMsg(); } });
  function sendMsg() {
    var inp = $('msg-in'), t = (inp && inp.value || '').trim(); if (!t) return;
    var sender = (state.profile && state.profile.displayName) || (state.user && state.user.email) || 'Staff';
    AppDB.sendMessage(state.channel, t, sender).then(function () { inp.value = ''; }).catch(function () { showToast('Failed to send'); });
  }

  // ─── Family Report ────────────────────────────────────────────
  function fillFrSelect() {
    var opts = '<option value="">— Choose client —</option>' + (state.clients || []).map(function (c) {
      return '<option value="' + c.id + '">' + (c.name || 'Unknown') + '</option>';
    }).join('');
    var el = $('fr-cl'); if (el) { var prev = el.value; el.innerHTML = opts; if (prev) el.value = prev; }
  }

  document.querySelectorAll('.lbtn[data-lang]').forEach(function (b) {
    b.addEventListener('click', function () {
      state.lang = b.getAttribute('data-lang');
      document.querySelectorAll('.lbtn').forEach(function (x) { x.classList.remove('active'); }); b.classList.add('active');
      var s = STRINGS[state.lang] || STRINGS.en;
      $('fr-title').textContent = s.frTitle; $('fr-sub').textContent = s.frSub;
      $('fr-lbl-c').textContent = s.lblC; $('fr-lbl-m').textContent = s.lblM; $('fr-lbl-l').textContent = s.lblL;
      $('fr-noc').textContent = s.noc; $('fr-info').textContent = s.disc; renderFamilyReport();
    });
  });

  function renderFamilyReport() {
    var cid = ($('fr-cl') || {}).value;
    var c = state.clients.filter(function (x) { return x.id === cid; })[0];
    var prev = $('fr-prev'), noc = $('fr-noc');
    if (!c) { prev.hidden = true; noc.hidden = false; return; }
    noc.hidden = true; prev.hidden = false;
    var s = STRINGS[state.lang] || STRINGS.en;
    var mon = ($('fr-mon') || {}).value || new Date().toISOString().slice(0, 7);
    var mStr = new Date(mon + '-01').toLocaleDateString(s.locale || 'en-IN', { month: 'long', year: 'numeric' });
    var bars = [[78, s.bars[0]], [75, s.bars[1]], [72, s.bars[2]], [85, s.bars[3]]];
    var trend = [[s.bars[0], 60, 65, 72, 78, '+18%'], [s.bars[1], 55, 65, 70, 75, '+20%'], [s.bars[2], 50, 58, 66, 72, '+22%'], [s.bars[3], 75, 80, 82, 85, '+10%']];
    prev.innerHTML =
      '<div class="rh"><div class="rh-c">' + s.center + '</div><div class="rh-t">' + s.rTitle + '</div><div class="rh-d">' + s.cLbl + ': <strong>' + c.name + '</strong> | ID: ' + c.id + ' | ' + s.tLbl + ': ' + (c.therapist || '—') + '</div><div class="rh-s">' + mStr + ' | ' + s.aLbl + ': ' + (c.admission || '—') + '</div></div>' +
      '<div class="alert alert-warn">' + s.disc + '</div>' +
      '<div class="card"><div style="font-weight:700;color:var(--primary);margin-bottom:12px">' + s.pTitle + '</div>' +
      s.sections.map(function (x) { return '<div class="frs"><div class="frs-t">' + x.t + '</div><div class="frs-b">' + x.b + '</div></div>'; }).join('') + '</div>' +
      '<div class="card"><div style="font-weight:700;margin-bottom:12px">' + s.mTitle + '</div>' +
      bars.map(function (b) { return '<div class="pbw"><div class="pbt"><span>' + b[1] + '</span><span style="font-weight:700;color:var(--primary)">' + b[0] + '%</span></div><div class="pbtr"><div class="pbf" style="width:' + b[0] + '%"></div></div></div>'; }).join('') + '</div>' +
      '<div class="card"><div style="font-weight:700;margin-bottom:12px">' + s.wTitle + '</div><div class="table-wrap"><table class="wt"><thead><tr>' + s.wCols.map(function (h) { return '<th>' + h + '</th>'; }).join('') + '</tr></thead><tbody>' +
      trend.map(function (r) { return '<tr><td style="text-align:left;font-weight:500">' + r[0] + '</td><td>' + r[1] + '%</td><td>' + r[2] + '%</td><td>' + r[3] + '%</td><td>' + r[4] + '%</td><td class="chg">' + r[5] + '</td></tr>'; }).join('') + '</tbody></table></div></div>' +
      '<div class="card" style="background:var(--primary-bg)"><div style="font-weight:700;margin-bottom:12px">' + s.tipsTitle + '</div>' +
      s.tips.map(function (t, i) { return '<div class="tipr"><div class="tipn">' + (i + 1) + '</div><div class="tipt">' + t + '</div></div>'; }).join('') + '</div>' +
      '<div class="fr-foot">' + s.footer + '</div><div class="alert alert-warn">' + s.print + '</div>';
  }
  $('fr-cl').addEventListener('change', renderFamilyReport);
  $('fr-mon').addEventListener('change', renderFamilyReport);

  // ─── Settings ─────────────────────────────────────────────────
  var SET_SECTIONS = [
    { key: 'PSY', icon: 'Psychiatric', title: 'Mental state parameters', arr: function () { return PSY; }, set: function (v) { PSY.length = 0; v.forEach(function (x) { PSY.push(x); }); }, rebuild: function () { buildRatingRows('psy-rows', PSY, 'psy'); } },
    { key: 'BEH', icon: 'Behavioral', title: 'Behavioral parameters', arr: function () { return BEH; }, set: function (v) { BEH.length = 0; v.forEach(function (x) { BEH.push(x); }); }, rebuild: function () { buildRatingRows('beh-rows', BEH, 'beh'); } },
    { key: 'ADL', icon: 'ADL', title: 'ADL domains', arr: function () { return ADL; }, set: function (v) { ADL.length = 0; v.forEach(function (x) { ADL.push(x); }); }, rebuild: function () { buildADL(); } },
    { key: 'THER', icon: 'Therapeutic', title: 'Activity types', arr: function () { return THER; }, set: function (v) { THER.length = 0; v.forEach(function (x) { THER.push(x); }); }, rebuild: function () { buildTher(); } },
    { key: 'RISK', icon: 'Risk', title: 'Risk domains', arr: function () { return RISK; }, set: function (v) { RISK.length = 0; v.forEach(function (x) { RISK.push(x); }); }, rebuild: function () { buildRisk(); } }
  ];

  function renderSettings() {
    $('settings-lists').innerHTML = SET_SECTIONS.map(function (sec) {
      return '<div class="card"><div class="set-hdr"><span class="set-title">' + sec.icon + ' — ' + sec.title + '</span><span class="set-badge">' + sec.arr().length + '</span></div><div class="set-desc">Edit, reorder, or remove items.</div><div id="set-list-' + sec.key + '"></div><div class="add-row"><input class="add-inp" id="set-inp-' + sec.key + '" placeholder="New item…"><button type="button" class="add-btn btn" data-add="' + sec.key + '">+ Add</button></div></div>';
    }).join('');
    SET_SECTIONS.forEach(function (sec) { renderList(sec.key); });
    $('settings-lists').querySelectorAll('[data-add]').forEach(function (b) {
      b.addEventListener('click', function () {
        var key = b.getAttribute('data-add'), inp = $('set-inp-' + key), val = (inp && inp.value || '').trim();
        if (!val) { showToast('Enter item name'); return; }
        var sec = SET_SECTIONS.filter(function (s) { return s.key === key; })[0];
        if (sec) { sec.arr().push(val); inp.value = ''; renderList(key); sec.rebuild(); showToast('Added'); }
      });
    });
  }
  function renderList(key) {
    var sec = SET_SECTIONS.filter(function (s) { return s.key === key; })[0]; if (!sec) return;
    var items = sec.arr();
    $('set-list-' + key).innerHTML = items.map(function (item, i) {
      var safe = (item || '').replace(/'/g, '&#39;').replace(/"/g, '&quot;');
      return '<div class="list-item"><input class="li-txt" value="' + safe + '" data-key="' + key + '" data-i="' + i + '"><button type="button" class="li-up" data-key="' + key + '" data-i="' + i + '" data-dir="-1">↑</button><button type="button" class="li-dn" data-key="' + key + '" data-i="' + i + '" data-dir="1">↓</button><button type="button" class="li-del" data-key="' + key + '" data-i="' + i + '">×</button></div>';
    }).join('') || '<p style="color:var(--text-3);font-size:.85rem">No items.</p>';
    $('set-list-' + key).querySelectorAll('.li-txt').forEach(function (inp) {
      inp.addEventListener('blur', function () { var s = SET_SECTIONS.filter(function (x) { return x.key === inp.getAttribute('data-key'); })[0]; if (s && inp.value.trim()) { s.arr()[parseInt(inp.getAttribute('data-i'), 10)] = inp.value.trim(); s.rebuild(); } });
    });
    $('set-list-' + key).querySelectorAll('.li-up, .li-dn').forEach(function (b) {
      b.addEventListener('click', function () {
        var s = SET_SECTIONS.filter(function (x) { return x.key === b.getAttribute('data-key'); })[0]; if (!s) return;
        var arr = s.arr(), i = parseInt(b.getAttribute('data-i'), 10), j = i + parseInt(b.getAttribute('data-dir'), 10);
        if (j < 0 || j >= arr.length) return; var t = arr[i]; arr[i] = arr[j]; arr[j] = t; renderList(b.getAttribute('data-key')); s.rebuild();
      });
    });
    $('set-list-' + key).querySelectorAll('.li-del').forEach(function (b) {
      b.addEventListener('click', function () {
        var s = SET_SECTIONS.filter(function (x) { return x.key === b.getAttribute('data-key'); })[0];
        if (!s || s.arr().length <= 1) { showToast('Keep at least one'); return; }
        s.arr().splice(parseInt(b.getAttribute('data-i'), 10), 1); renderList(b.getAttribute('data-key')); s.rebuild(); showToast('Removed');
      });
    });
  }
  $('export-config').addEventListener('click', function () {
    var cfg = {}; SET_SECTIONS.forEach(function (s) { cfg[s.key] = s.arr().slice(); });
    var a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(cfg, null, 2)], { type: 'application/json' }));
    a.download = 'NeuroRehab_Config.json'; a.click(); showToast('Exported');
  });
  $('import-config-btn').addEventListener('click', function () { $('cfg-file').click(); });
  $('cfg-file').addEventListener('change', function (e) {
    var file = e.target && e.target.files && e.target.files[0]; if (!file) return;
    var r = new FileReader();
    r.onload = function () {
      try { var cfg = JSON.parse(r.result); SET_SECTIONS.forEach(function (sec) { if (cfg[sec.key] && Array.isArray(cfg[sec.key]) && cfg[sec.key].length) { sec.set(cfg[sec.key]); sec.rebuild(); } }); if (state.page === 'settings') renderSettings(); showToast('Imported'); }
      catch (err) { showToast('Invalid config file'); }
    };
    r.readAsText(file); e.target.value = '';
  });
  $('reset-config').addEventListener('click', function () {
    if (!confirm('Reset all lists to defaults?')) return;
    SET_SECTIONS.forEach(function (sec) { sec.set((DEFAULTS[sec.key] || []).slice()); sec.rebuild(); });
    if (state.page === 'settings') renderSettings(); showToast('Reset to defaults');
  });

  // ─── Boot ─────────────────────────────────────────────────────
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
