/**
 * NeuroRehab CareTrack — main app logic, Firebase-backed
 */
(function () {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };

  // ─── State ────────────────────────────────────────────────────
  var state = {
    user: null,
    profile: null,
    clients: [],
    reports: [],
    page: 'dashboard',
    channel: 'General Ward',
    lang: 'en',
    unsubMessages: null
  };

  // Default clinical lists (can be customised in Settings)
  var PSY = ['Orientation (Time/Place/Person)', 'Mood & Affect', 'Thought Content', 'Thought Process', 'Perceptual Disturbances', 'Insight into Illness', 'Judgment', 'Psychomotor Activity', 'Sleep Pattern', 'Appetite & Eating'];
  var BEH = ['Cooperation with Staff', 'Interaction with Peers', 'Aggression / Irritability', 'Substance Craving', 'Wandering / Restlessness', 'Emotional Regulation', 'Response to Redirection', 'Ward Routine Participation'];
  var ADL = ['Personal Hygiene', 'Dressing', 'Toileting', 'Feeding', 'Mobility', 'Room Maintenance', 'Laundry', 'Money Handling', 'Time Management', 'Phone Use'];
  var THER = ['Occupational Therapy', 'Group Therapy', 'Individual Counseling', 'Yoga / Exercise', 'Art / Music / Dance', 'Vocational Training', 'Life Skills', 'Recreation', 'Psychoeducation', 'Cognitive Remediation'];
  var RISK = ['Suicidal Ideation / Self-harm', 'Aggression / Violence', 'Absconding Risk', 'Substance Relapse', 'Falls / Physical Safety', 'Vulnerability / Exploitation', 'Medication Safety'];

  var DEFAULTS = { PSY: PSY.slice(), BEH: BEH.slice(), ADL: ADL.slice(), THER: THER.slice(), RISK: RISK.slice() };
  var RC = ['', '#dc2626', '#ea580c', '#d97706', '#16a34a', '#0d7377'];
  var PCOL = { none: ['#6b7280', '#e5e7eb'], low: ['#16a34a', '#dcfce7'], medium: ['#d97706', '#fef3c7'], high: ['#dc2626', '#fee2e2'] };

  // Bilingual strings for family report
  var STRINGS = {
    en: {
      frTitle: 'Family progress reports', frSub: 'Monthly — supportive language only',
      lblC: 'Client', lblM: 'Report month', lblL: 'Language',
      noc: 'Select a client to preview.',
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
      print: 'To save as PDF: Browser menu → Print → Save as PDF',
      locale: 'en-IN'
    },
    mr: {
      frTitle: 'कुटुंब प्रगती अहवाल', frSub: 'मासिक — सहाय्यक भाषा',
      lblC: 'रुग्ण निवडा', lblM: 'अहवाल महिना', lblL: 'भाषा',
      noc: 'वरून रुग्ण निवडा.',
      center: 'न्यूरो-मनोरुग्ण पुनर्वसन केंद्र', rTitle: 'मासिक कुटुंब प्रगती अहवाल',
      cLbl: 'रुग्ण', tLbl: 'उपचारक', aLbl: 'प्रवेश', pTitle: 'या महिन्याची प्रगती',
      mTitle: 'मासिक प्रगती', wTitle: 'साप्ताहिक कल सारांश',
      wCols: ['क्षेत्र', 'आठवडा १', 'आठवडा २', 'आठवडा ३', 'आठवडा ४', 'बदल'],
      bars: ['दैनंदिन जीवन कौशल्ये', 'उपचार सहभाग', 'वर्तणूक स्थिरता', 'सुरक्षा निरीक्षण'],
      sections: [
        { t: 'दैनंदिन जीवन कौशल्ये', b: 'आपल्या कुटुंब सदस्याने वैयक्तिक काळजी आणि दैनंदिन दिनचर्येत प्रगती केली आहे. व्यावसायिक उपचार संघ मार्गदर्शन देत आहे.' },
        { t: 'उपचारात्मक सहभाग', b: 'या महिन्यात उपचारात्मक सत्रांमध्ये उपस्थिती नियमित राहिली. गट कार्यक्रम आणि आरोग्य कार्यक्रम चालू आहेत.' },
        { t: 'वर्तणूक व भावनिक स्थिरता', b: 'काळजी संघाने भावनिक स्थिरतेत वाढ आणि सुधारलेले संबंध निरीक्षण केले आहेत.' },
        { t: 'सुरक्षा निरीक्षण', b: 'सुरक्षा निरीक्षण योग्य प्रकारे चालू आहे. वैद्यकीय संघ लक्ष ठेवत आहे.' }
      ],
      tipsTitle: 'आपण कुटुंब सदस्याला कसे सहाय्य करू शकता',
      tips: ['नियमित भेट द्या.', 'कुटुंब समुपदेशन सत्रांमध्ये सहभागी व्हा.', 'छोट्या प्रगतीलाही प्रोत्साहन द्या.', 'शंका असल्यास सामाजिक कार्यकर्त्याशी संपर्क करा.', 'काळजीवाहू मार्गदर्शक पाळा.'],
      disc: 'हा अहवाल सहाय्यक भाषेत आहे. निदान किंवा औषध तपशील नाही. वैद्यकीय माहितीसाठी उपचार संघाशी बोला.',
      footer: 'न्यूरो-मनोरुग्ण पुनर्वसन केंद्र  |  कुटुंब अहवाल — गोपनीय  |  NeuroRehab CareTrack',
      print: 'PDF: ब्राउझर मेनू → Print → Save as PDF',
      locale: 'mr-IN'
    }
  };

  function showToast(msg) {
    var el = $('toast');
    if (!el) return;
    el.textContent = msg;
    el.setAttribute('data-show', 'true');
    clearTimeout(state._toastTimer);
    state._toastTimer = setTimeout(function () { el.setAttribute('data-show', 'false'); }, 3000);
  }

  function showLoginError(msg) {
    var el = $('login-error');
    if (!el) return;
    el.textContent = msg || '';
    el.style.display = msg ? 'block' : 'none';
  }

  // ─── Firebase ready check ──────────────────────────────────────
  function init() {
    if (!window.AppDB || !AppDB.ready) {
      var msg = AppDB && AppDB.error ? AppDB.error : 'Firebase not configured.';
      showLoginError(msg + ' Copy js/firebase-config.sample.js to js/firebase-config.js and add your keys.');
      return;
    }
    AppDB.onAuthStateChanged(function (user) {
      if (user) {
        state.user = user;
        AppDB.getUserProfile(user.uid).then(function (profile) {
          state.profile = profile || {};
          showApp();
          loadData();
        }).catch(function () {
          state.profile = {};
          showApp();
          loadData();
        });
      } else {
        state.user = null;
        state.profile = null;
        showLogin();
      }
    });
  }

  function showLogin() {
    $('login-screen').classList.remove('hidden');
    $('app-shell').setAttribute('hidden', '');
  }

  function showApp() {
    $('login-screen').classList.add('hidden');
    $('app-shell').removeAttribute('hidden');
    var p = state.profile || {};
    var name = p.displayName || state.user.displayName || state.user.email || 'Staff';
    var role = p.role || 'Staff';
    var shift = p.shift || 'morning';
    $('dr-name').textContent = name;
    $('dr-role').textContent = role;
    $('shift-badge').textContent = shift === 'morning' ? 'Morning' : 'Evening';
    var h = new Date().getHours();
    var greet = 'Good ' + (h < 12 ? 'Morning' : h < 17 ? 'Afternoon' : 'Evening');
    $('d-greet').textContent = greet + ', ' + name;
    $('d-date-display').textContent = new Date().toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    var d = new Date();
    var dateInput = $('d-date');
    if (dateInput) dateInput.value = d.toISOString().split('T')[0];
    if ($('fr-mon')) $('fr-mon').value = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
    bindNavigation();
    bindLogin();
    buildPsychiatricRiskPills();
    buildMedicationSideEffects();
    buildFamilyFields();
    buildMDTMembers();
    buildChanTabs();
    buildADL();
    buildTher();
    buildRisk();
    goPage('dashboard');
  }

  function loadData() {
    AppDB.getClients().then(function (list) {
      state.clients = list;
      fillClientSelects();
      updateDashboard();
      renderClients();
    }).catch(function (err) {
      console.error('Load clients', err);
      showToast('Could not load clients');
    });
    AppDB.getRecentReports(15).then(function (list) {
      state.reports = list;
      updateDashboard();
    }).catch(function () {});
  }

  // ─── Auth: Login form (email + password only; role/name from Firestore profile) ──
  function bindLogin() {
    var form = $('login-form');
    var btn = $('login-btn');
    if (!form) return;
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      showLoginError('');
      var email = ($('l-email') || {}).value.trim();
      var password = ($('l-password') || {}).value;
      if (!email || !password) {
        showLoginError('Enter email and password.');
        return;
      }
      btn.disabled = true;
      AppDB.signIn(email, password).then(function () {
        btn.disabled = false;
      }).catch(function (err) {
        if (err.code === 'auth/user-not-found') {
          AppDB.signUp(email, password).then(function () {
            btn.disabled = false;
          }).catch(function (e) {
            showLoginError(e.message || 'Sign up failed');
            btn.disabled = false;
          });
        } else {
          showLoginError(err.message || 'Sign in failed');
          btn.disabled = false;
        }
      });
    });
  }

  $('logout-btn').addEventListener('click', function () {
    if (state.unsubMessages) state.unsubMessages();
    AppDB.signOut().catch(function () {});
  });

  // ─── Navigation ───────────────────────────────────────────────
  function bindNavigation() {
    document.querySelectorAll('.ni[data-page]').forEach(function (a) {
      a.addEventListener('click', function (e) {
        e.preventDefault();
        goPage(a.getAttribute('data-page'));
        closeDrawer();
      });
    });
    $('menu-btn').addEventListener('click', toggleDrawer);
    $('drawer-bg').addEventListener('click', closeDrawer);
    document.querySelectorAll('[data-goto]').forEach(function (btn) {
      btn.addEventListener('click', function () { goPage(btn.getAttribute('data-goto')); });
    });
  }

  function goPage(page) {
    state.page = page;
    document.querySelectorAll('.page').forEach(function (el) { el.classList.remove('active'); });
    document.querySelectorAll('.ni').forEach(function (el) { el.classList.remove('active'); });
    var pageEl = $('page-' + page);
    var navEl = document.querySelector('.ni[data-page="' + page + '"]');
    if (pageEl) pageEl.classList.add('active');
    if (navEl) navEl.classList.add('active');
    if (page === 'dashboard') updateDashboard();
    if (page === 'clients') renderClients();
    if (page === 'comms') renderComms();
    if (page === 'freport') renderFamilyReport();
    if (page === 'settings') renderSettings();
    if (page === 'daily') updateDailyForm();
  }

  function toggleDrawer() {
    var ov = $('drawer-overlay');
    ov.setAttribute('aria-hidden', ov.getAttribute('aria-hidden') === 'true' ? 'false' : 'true');
  }

  function closeDrawer() {
    $('drawer-overlay').setAttribute('aria-hidden', 'true');
  }

  // ─── Client selects ──────────────────────────────────────────
  function fillClientSelects() {
    var opts = '<option value="">— Choose client —</option>' + (state.clients || []).map(function (c) {
      return '<option value="' + c.id + '">' + (c.name || 'Unknown') + ' (' + c.id + ')</option>';
    }).join('');
    ['d-client', 'psy-cl', 'med-cl', 'beh-cl', 'adl-cl', 'ther-cl', 'fam-cl', 'risk-cl', 'mdt-cl', 'fr-cl'].forEach(function (id) {
      var el = $(id);
      if (!el) return;
      var prev = el.value;
      el.innerHTML = opts;
      if (prev) el.value = prev;
    });
  }

  function getSelectedClient(fieldId) {
    var id = ($(fieldId) || {}).value;
    return state.clients.filter(function (c) { return c.id === id; })[0] || null;
  }

  // ─── Dashboard ────────────────────────────────────────────────
  function updateDashboard() {
    var clients = state.clients || [];
    var reports = state.reports || [];
    var highRisk = clients.filter(function (c) { return c.risk === 'high'; });
    var medRisk = clients.filter(function (c) { return c.risk === 'medium'; });
    var statsHtml = '<div class="stat"><div class="stat-n" style="color:var(--teal)">' + clients.length + '</div><div class="stat-l">Active clients</div></div>' +
      '<div class="stat"><div class="stat-n" style="color:var(--teal)">' + reports.length + '</div><div class="stat-l">Reports</div></div>' +
      '<div class="stat"><div class="stat-n" style="color:var(--red)">' + highRisk.length + '</div><div class="stat-l">High risk</div></div>' +
      '<div class="stat"><div class="stat-n" style="color:var(--amber)">' + medRisk.length + '</div><div class="stat-l">Medium risk</div></div>';
    $('dashboard-stats').innerHTML = statsHtml;
    var alerts = (highRisk.length || medRisk.length) ? (highRisk.concat(medRisk).map(function (c) {
      var cls = c.risk === 'high' ? 'ar' : 'alert-warn';
      return '<div class="alert ' + cls + '"><strong>' + (c.name || c.id) + '</strong> (' + c.id + ') — ' + (c.risk || '').toUpperCase() + ' risk</div>';
    }).join('')) : '<div class="alert alert-success">No high or medium risk alerts.</div>';
    $('risk-alerts').innerHTML = alerts;
    var recent = reports.length ? reports.slice(0, 8).map(function (r) {
      var time = r.createdAt ? new Date(r.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '';
      return '<div style="padding:8px 0;border-bottom:1px solid #f1f5f9;font-size:0.9rem;"><strong>' + (r.section || 'Report') + '</strong> — ' + (r.clientName || r.clientId) + ' <span style="color:var(--slate-light);font-size:0.75rem"> by ' + (r.userName || '') + ' · ' + time + '</span></div>';
    }).join('') : '<div style="font-size:0.9rem;color:var(--slate-light);">No reports yet. Use Daily reports or other sections to add.</div>';
    $('recent-rpts').innerHTML = recent;
    var guide = '<p><strong>All staff</strong> → <a href="#" data-page="daily">Daily reports</a>: Select client, fill and save.</p>' +
      '<p><strong>Psychiatrist/Nurse</strong> → <a href="#" data-page="psychiatric">Psychiatric</a>: Rate 1–5.</p>' +
      '<p><strong>Nurse</strong> → <a href="#" data-page="medication">Medication</a>: Compliance and vitals.</p>' +
      '<p><strong>Rehab</strong> → <a href="#" data-page="behavioral">Behavioral</a>: Rate parameters, log incidents.</p>' +
      '<p><strong>OT</strong> → <a href="#" data-page="adl">ADL</a>: Independent / Prompting / Assistance / Dependent.</p>' +
      '<p><strong>All</strong> → <a href="#" data-page="risk">Risk</a>: Set risk level per domain each shift.</p>';
    $('quick-guide').innerHTML = guide;
    $('quick-guide').querySelectorAll('[data-page]').forEach(function (a) {
      a.addEventListener('click', function (e) { e.preventDefault(); goPage(a.getAttribute('data-page')); });
    });
  }

  // ─── Clients ───────────────────────────────────────────────────
  function renderClients() {
    var list = state.clients || [];
    var html = list.map(function (c) {
      var riskClass = c.risk === 'high' ? 'tag-risk-high' : c.risk === 'medium' ? 'tag-risk-medium' : 'tag-risk-low';
      var riskLabel = c.risk === 'high' ? 'High risk' : c.risk === 'medium' ? 'Medium risk' : 'Low risk';
      return '<div class="client-card" data-id="' + c.id + '">' +
        '<div class="client-name">' + (c.name || c.id) + '</div>' +
        '<div class="client-meta">' + c.id + ' · Admitted: ' + (c.admission || '—') + '</div>' +
        '<div class="client-detail">' + (c.therapist || '—') + ' · ' + (c.gender || '') + '</div>' +
        '<div class="client-tags"><span class="tag ' + riskClass + '">' + riskLabel + '</span><span class="tag tag-dx">' + (c.diagnosis || '—') + '</span></div></div>';
    }).join('');
    $('client-grid').innerHTML = html || '<p style="color:var(--slate-light);">No clients. Add one to get started.</p>';
    $('client-grid').querySelectorAll('.client-card').forEach(function (el) {
      el.addEventListener('click', function () {
        var id = el.getAttribute('data-id');
        ['d-client', 'psy-cl', 'med-cl', 'beh-cl', 'adl-cl', 'ther-cl', 'fam-cl', 'risk-cl', 'mdt-cl'].forEach(function (sid) {
          var s = $(sid);
          if (s) s.value = id;
        });
        updateDailyForm();
        goPage('daily');
      });
    });
  }

  $('btn-add-client').addEventListener('click', function () {
    $('modal-client').setAttribute('aria-hidden', 'false');
  });

  $('modal-client-close').addEventListener('click', function () { $('modal-client').setAttribute('aria-hidden', 'true'); });
  $('cancel-client').addEventListener('click', function () { $('modal-client').setAttribute('aria-hidden', 'true'); });

  $('submit-client').addEventListener('click', function () {
    var name = ($('nc-name') || {}).value.trim();
    if (!name) { showToast('Enter client name'); return; }
    var data = {
      name: name,
      gender: ($('nc-gender') || {}).value,
      dob: ($('nc-dob') || {}).value || null,
      admission: ($('nc-adm') || {}).value || null,
      legal: ($('nc-legal') || {}).value,
      referral: ($('nc-ref') || {}).value,
      therapist: ($('nc-therapist') || {}).value.trim(),
      psychiatrist: ($('nc-psych') || {}).value.trim(),
      emergency: ($('nc-emergency') || {}).value.trim(),
      payment: ($('nc-pay') || {}).value,
      diagnosis: ($('nc-dx') || {}).value.trim() || 'Not specified',
      risk: 'low'
    };
    AppDB.addClient(data).then(function (id) {
      showToast('Client registered');
      $('modal-client').setAttribute('aria-hidden', 'true');
      $('nc-name').value = '';
      return AppDB.getClients();
    }).then(function (list) {
      state.clients = list;
      fillClientSelects();
      renderClients();
      updateDashboard();
    }).catch(function (err) {
      showToast('Failed to add client');
      console.error(err);
    });
  });

  // ─── Daily report ─────────────────────────────────────────────
  function updateDailyForm() {
    var c = getSelectedClient('d-client');
    var prompt = $('d-prompt');
    var form = $('d-form');
    if (c) {
      prompt.style.display = 'none';
      form.removeAttribute('hidden');
      $('d-banner').textContent = 'Reporting for: ' + c.name + ' (' + c.id + ')';
      $('d-sbar').textContent = 'Quick shift summary — ' + c.name;
    } else {
      prompt.style.display = 'block';
      form.setAttribute('hidden', '');
    }
  }

  $('d-client').addEventListener('change', updateDailyForm);

  function saveReport(section, payload) {
    var c = getSelectedClient(state.page === 'daily' ? 'd-client' : state.page === 'psychiatric' ? 'psy-cl' : state.page === 'medication' ? 'med-cl' : state.page === 'behavioral' ? 'beh-cl' : state.page === 'adl' ? 'adl-cl' : state.page === 'therapeutic' ? 'ther-cl' : state.page === 'family' ? 'fam-cl' : state.page === 'risk' ? 'risk-cl' : 'mdt-cl');
    if (!c) { showToast('Select a client first'); return; }
    var profile = state.profile || {};
    AppDB.saveReport({
      clientId: c.id,
      clientName: c.name,
      section: section,
      userId: state.user.uid,
      userName: profile.displayName || state.user.email,
      shift: profile.shift || 'morning',
      payload: payload || {}
    }).then(function () {
      showToast(section + ' report saved');
      AppDB.getRecentReports(15).then(function (list) { state.reports = list; updateDashboard(); });
    }).catch(function () { showToast('Failed to save'); });
  }

  $('save-daily').addEventListener('click', function () {
    var payload = {
      condition: ($('q-cond') || {}).value,
      mood: ($('q-mood') || {}).value,
      sleep: ($('q-sleep') || {}).value,
      notes: ($('q-notes') || {}).value
    };
    saveReport('Daily Report', payload);
  });

  // ─── Psychiatric ──────────────────────────────────────────────
  function buildRatingRows(containerId, params, prefix) {
    var html = params.map(function (p, i) {
      var btns = '';
      for (var v = 1; v <= 5; v++) btns += '<button type="button" class="rbtn" data-prefix="' + prefix + '" data-i="' + i + '" data-v="' + v + '">' + v + '</button>';
      return '<div class="rrow"><div class="rrow-lbl">' + p + '</div><div class="rrow-c"><div class="rbtns">' + btns + '</div><input class="rnote" placeholder="Note" data-prefix="' + prefix + '" data-i="' + i + '"></div></div>';
    }).join('');
    $(containerId).innerHTML = html;
    $(containerId).querySelectorAll('.rbtn').forEach(function (b) {
      b.addEventListener('click', function () {
        var pfx = b.getAttribute('data-prefix');
        var i = parseInt(b.getAttribute('data-i'), 10);
        var v = parseInt(b.getAttribute('data-v'), 10);
        setRating(pfx, i, v);
      });
    });
  }

  function setRating(prefix, rowIndex, value) {
    var container = prefix === 'psy' ? $('psy-rows') : $('beh-rows');
    if (!container) return;
    var row = container.querySelectorAll('.rrow')[rowIndex];
    if (!row) return;
    row.dataset.rating = value > 0 ? value : '';
    row.querySelectorAll('.rbtn').forEach(function (b) {
      var v = parseInt(b.getAttribute('data-v'), 10);
      if (v <= value) {
        b.style.background = RC[value];
        b.style.borderColor = RC[value];
        b.style.color = '#fff';
      } else {
        b.style.background = '#fff';
        b.style.borderColor = 'var(--border)';
        b.style.color = 'var(--slate-light)';
      }
    });
  }

  function buildPsychiatricRiskPills() {
    var html = ['none', 'low', 'medium', 'high'].map(function (lv) {
      var col = PCOL[lv];
      var label = lv === 'none' ? 'None' : lv === 'low' ? 'Low' : lv === 'medium' ? 'Medium' : 'High';
      return '<button type="button" class="rpill" data-risk="' + lv + '" style="border-color:' + col[0] + ';background:' + col[1] + ';color:' + col[0] + '">' + label + '</button>';
    }).join('');
    $('psy-risk').innerHTML = html;
    $('psy-risk').querySelectorAll('.rpill').forEach(function (b) {
      b.addEventListener('click', function () {
        var risk = b.getAttribute('data-risk');
        $('psy-risk').dataset.selectedRisk = risk;
        $('psy-risk').querySelectorAll('.rpill').forEach(function (p) {
          var c = PCOL[p.getAttribute('data-risk')];
          p.style.borderColor = c[0];
          p.style.background = c[1];
          p.style.color = c[0];
        });
      });
    });
  }

  function getPsychiatricPayload() {
    var ratings = {};
    var rows = ($('psy-rows') || {}).querySelectorAll('.rrow') || [];
    PSY.forEach(function (p, i) {
      var row = rows[i];
      if (!row) return;
      var note = row.querySelector('.rnote');
      ratings['r' + i] = row.dataset.rating ? parseInt(row.dataset.rating, 10) : null;
      ratings['n' + i] = note ? note.value : '';
    });
    var risk = ($('psy-risk') && $('psy-risk').dataset.selectedRisk) || 'none';
    return { ratings: ratings, risk: risk, notes: ($('psy-notes') || {}).value };
  }

  (function () {
    buildRatingRows('psy-rows', PSY, 'psy');
    $('save-psychiatric').addEventListener('click', function () { saveReport('Psychiatric', getPsychiatricPayload()); });
    $('clear-psy').addEventListener('click', function () {
      PSY.forEach(function (_, i) { setRating('psy', i, 0); });
      $('psy-notes').value = '';
    });
  })();

  // ─── Medication ───────────────────────────────────────────────
  function buildMedicationSideEffects() {
    var opts = ['None', 'EPS', 'Sedation', 'Metabolic', 'Other'];
    $('med-sideeffects').innerHTML = opts.map(function (o) {
      return '<label class="cb-l"><input type="checkbox" name="med-se" value="' + o + '"> ' + o + '</label>';
    }).join('');
  }

  $('save-medication').addEventListener('click', function () {
    var se = [];
    ($('med-sideeffects') || {}).querySelectorAll('input:checked').forEach(function (c) { se.push(c.value); });
    var payload = {
      compliance: ($('med-compliance') || {}).value,
      reason: ($('med-reason') || {}).value,
      sideEffects: se,
      prn: ($('med-prn') || {}).value,
      prnDesc: ($('med-prn-desc') || {}).value,
      bp: ($('med-bp') || {}).value,
      pulse: ($('med-pulse') || {}).value,
      weight: ($('med-weight') || {}).value,
      temp: ($('med-temp') || {}).value,
      notes: ($('med-notes') || {}).value
    };
    saveReport('Medication', payload);
  });

  // ─── Behavioral ──────────────────────────────────────────────
  (function () {
    buildRatingRows('beh-rows', BEH, 'beh');
    $('beh-inc').addEventListener('change', function () {
      var show = $('beh-inc').value === 'yes';
      $('beh-inc-f').hidden = !show;
    });
    $('save-behavioral').addEventListener('click', function () {
      var payload = { incident: $('beh-inc').value, incidentDesc: $('beh-inc-desc').value };
      saveReport('Behavioral', payload);
    });
    $('clear-beh').addEventListener('click', function () {
      BEH.forEach(function (_, i) { setRating('beh', i, 0); });
    });
  })();

  // ─── ADL ───────────────────────────────────────────────────────
  function buildADL() {
    var html = ADL.map(function (d, i) {
      var rad = [4, 3, 2, 1].map(function (v) {
        return '<td><input type="radio" name="adl-' + i + '" value="' + v + '" data-i="' + i + '"></td>';
      }).join('');
      return '<tr><td>' + d + '</td>' + rad + '<td class="adl-score" id="as-' + i + "'>–</td></tr>";
    }).join('');
    $('adl-body').innerHTML = html;
    $('adl-body').querySelectorAll('input[type="radio"]').forEach(function (r) {
      r.addEventListener('change', updateADLTotal);
    });
  }

  function updateADLTotal() {
    var tot = 0;
    ADL.forEach(function (_, i) {
      var r = document.querySelector('input[name="adl-' + i + '"]:checked');
      var cell = $('as-' + i);
      if (r) {
        tot += parseInt(r.value, 10);
        if (cell) cell.textContent = r.value;
      } else if (cell) cell.textContent = '–';
    });
    var totEl = $('adl-tot');
    if (totEl) totEl.textContent = tot;
  }

  $('save-adl').addEventListener('click', function () {
    var scores = {};
    ADL.forEach(function (_, i) {
      var r = document.querySelector('input[name="adl-' + i + '"]:checked');
      scores['adl' + i] = r ? parseInt(r.value, 10) : null;
    });
    var payload = { scores: scores, total: parseInt(($('adl-tot') || {}).textContent, 10) || 0, trend: ($('adl-trend') || {}).value, notes: ($('adl-notes') || {}).value };
    saveReport('ADL', payload);
  });

  // ─── Therapeutic ──────────────────────────────────────────────
  function buildTher() {
    var html = THER.map(function (a, i) {
      var btns = '';
      for (var v = 1; v <= 5; v++) btns += '<button type="button" class="ebtn" data-ai="' + i + '" data-v="' + v + '">' + v + '</button>';
      return '<div class="ther-row"><div class="ther-c"><label class="ther-lbl"><input type="checkbox" class="ther-att" data-i="' + i + '"> ' + a + '</label><div class="ebtns">' + btns + '</div></div></div>';
    }).join('');
    $('ther-rows').innerHTML = html;
    $('ther-rows').querySelectorAll('.ebtn').forEach(function (b) {
      b.addEventListener('click', function () {
        var ai = parseInt(b.getAttribute('data-ai'), 10);
        var v = parseInt(b.getAttribute('data-v'), 10);
        var row = $('ther-rows').querySelectorAll('.ther-row')[ai];
        if (!row) return;
        row.querySelectorAll('.ebtn').forEach(function (x) {
          var xv = parseInt(x.getAttribute('data-v'), 10);
          if (xv <= v) {
            x.style.background = 'var(--teal)';
            x.style.borderColor = 'var(--teal)';
            x.style.color = '#fff';
          } else {
            x.style.background = '#fff';
            x.style.borderColor = 'var(--border)';
            x.style.color = 'var(--slate-light)';
          }
        });
      });
    });
  }

  $('save-therapeutic').addEventListener('click', function () {
    var payload = {};
    THER.forEach(function (_, i) {
      var row = $('ther-rows').querySelectorAll('.ther-row')[i];
      if (!row) return;
      var att = row.querySelector('.ther-att');
      var eng = row.querySelector('.ebtn[style*="background: var(--teal)"]');
      payload['att' + i] = att ? att.checked : false;
      payload['eng' + i] = eng ? parseInt(eng.getAttribute('data-v'), 10) : null;
    });
    saveReport('Therapeutic', payload);
  });

  // ─── Family ────────────────────────────────────────────────────
  function buildFamilyFields() {
    var fields = [
      { id: 'fam-visits', lbl: 'Visits / week', type: 'select', opts: [0,1,2,3,4,5,6,7] },
      { id: 'fam-quality', lbl: 'Visit quality', type: 'select', opts: ['Not Applicable', 'Good', 'Moderate', 'Poor'] },
      { id: 'fam-attitude', lbl: 'Family attitude', type: 'select', opts: ['Supportive', 'Ambivalent', 'Hostile', 'Over-involved'] },
      { id: 'fam-understanding', lbl: 'Understanding of illness', type: 'select', opts: ['Good', 'Partial', 'Poor'] },
      { id: 'fam-counseling', lbl: 'Counseling attended', type: 'select', opts: ['Yes', 'No', 'N/A'] },
      { id: 'fam-home', lbl: 'Home environment', type: 'select', opts: ['Conducive', 'Needs Improvement', 'Not Assessed'] },
      { id: 'fam-discharge', lbl: 'Discharge involvement', type: 'select', opts: ['Active', 'Passive', 'Absent'] }
    ];
    var html = fields.map(function (f) {
      var opts = (f.opts || []).map(function (o) { return '<option>' + o + '</option>'; }).join('');
      return '<div class="fld"><label class="lbl">' + f.lbl + '</label><select id="' + f.id + '" class="fi">' + opts + '</select></div>';
    }).join('');
    $('family-fields').innerHTML = html;
  }

  $('save-family').addEventListener('click', function () {
    var payload = {
      visits: ($('fam-visits') || {}).value,
      quality: ($('fam-quality') || {}).value,
      attitude: ($('fam-attitude') || {}).value,
      understanding: ($('fam-understanding') || {}).value,
      counseling: ($('fam-counseling') || {}).value,
      home: ($('fam-home') || {}).value,
      discharge: ($('fam-discharge') || {}).value,
      notes: ($('fam-notes') || {}).value
    };
    saveReport('Family Involvement', payload);
  });

  // ─── Risk ─────────────────────────────────────────────────────
  function buildRisk() {
    var html = RISK.map(function (d, i) {
      var pills = ['none', 'low', 'medium', 'high'].map(function (lv) {
        var col = PCOL[lv];
        var label = lv === 'none' ? 'None' : lv === 'low' ? 'Low' : lv === 'medium' ? 'Medium' : 'High';
        return '<button type="button" class="rpill rpill-risk" data-di="' + i + '" data-lv="' + lv + '">' + label + '</button>';
      }).join('');
      return '<div style="padding:10px 0;border-bottom:1px solid #f1f5f9"><div style="font-weight:500;font-size:0.9rem;margin-bottom:6px">' + d + '</div><div class="rpills" id="rp-' + i + '">' + pills + '</div></div>';
    }).join('');
    $('risk-rows').innerHTML = html;
    $('risk-rows').querySelectorAll('.rpill-risk').forEach(function (b) {
      b.addEventListener('click', function () {
        var di = parseInt(b.getAttribute('data-di'), 10);
        var lv = b.getAttribute('data-lv');
        var col = PCOL[lv];
        var parent = $('rp-' + di);
        parent.dataset.selected = lv;
        parent.querySelectorAll('.rpill').forEach(function (p) {
          p.style.borderColor = 'var(--border)';
          p.style.background = '#fff';
          p.style.color = 'var(--slate-mid)';
        });
        b.style.borderColor = col[0];
        b.style.background = col[1];
        b.style.color = col[0];
      });
    });
    $('risk-rest').addEventListener('change', function () {
      $('risk-rest-f').hidden = $('risk-rest').value !== 'yes';
    });
  }

  $('save-risk').addEventListener('click', function () {
    var riskLevels = {};
    RISK.forEach(function (_, i) {
      var el = $('rp-' + i);
      riskLevels['r' + i] = (el && el.dataset.selected) || 'none';
    });
    var payload = {
      riskLevels: riskLevels,
      restraint: $('risk-rest').value,
      restraintDesc: $('risk-rest-desc').value,
      notes: $('risk-notes').value
    };
    saveReport('Risk Monitoring', payload);
  });

  // ─── MDT ───────────────────────────────────────────────────────
  function buildMDTMembers() {
    var roles = ['Psychiatrist', 'Psychologist', 'OT', 'Social Worker', 'Nurse', 'Rehab Worker', 'Psychotherapist'];
    $('mdt-members').innerHTML = roles.map(function (r) {
      return '<label class="cb-l"><input type="checkbox" name="mdt-m" value="' + r + '"> ' + r + '</label>';
    }).join('');
  }

  $('save-mdt').addEventListener('click', function () {
    var members = [];
    ($('mdt-members') || {}).querySelectorAll('input:checked').forEach(function (c) { members.push(c.value); });
    var payload = {
      members: members,
      progress: $('mdt-progress').value,
      concerns: $('mdt-concerns').value,
      changes: $('mdt-changes').value,
      goals: $('mdt-goals').value,
      discharge: $('mdt-discharge').value
    };
    saveReport('MDT Review', payload);
  });

  // ─── Team comms ───────────────────────────────────────────────
  function buildChanTabs() {
    var chans = AppDB.CHANNELS || ['General Ward', 'Urgent Alerts', 'Shift Handover', 'Nursing', 'Psychiatry', 'Rehab'];
    $('chan-tabs').innerHTML = chans.map(function (ch) {
      var active = ch === state.channel ? ' active' : '';
      return '<button type="button" class="ctab' + active + '" data-chan="' + ch.replace(/"/g, '&quot;') + '">' + ch + '</button>';
    }).join('');
    $('chan-tabs').querySelectorAll('.ctab').forEach(function (b) {
      b.addEventListener('click', function () {
        state.channel = b.getAttribute('data-chan');
        document.querySelectorAll('.ctab').forEach(function (x) { x.classList.remove('active'); });
        b.classList.add('active');
        $('chan-title').textContent = state.channel;
        renderComms();
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
      $('msg-list').innerHTML = html || '<div style="color:var(--slate-light);font-size:0.9rem;">No messages yet.</div>';
      var ml = $('msg-list');
      if (ml) ml.scrollTop = ml.scrollHeight;
    });
  }

  $('send-msg').addEventListener('click', sendMessage);
  $('msg-in').addEventListener('keydown', function (e) {
    if (e.key === 'Enter') { e.preventDefault(); sendMessage(); }
  });

  function sendMessage() {
    var inp = $('msg-in');
    var t = (inp && inp.value || '').trim();
    if (!t) return;
    var sender = (state.profile && state.profile.displayName) || state.user.email || 'Staff';
    AppDB.sendMessage(state.channel, t, sender).then(function () {
      inp.value = '';
    }).catch(function () { showToast('Failed to send'); });
  }

  // ─── Family report (preview) ──────────────────────────────────
  document.querySelectorAll('.lbtn[data-lang]').forEach(function (b) {
    b.addEventListener('click', function () {
      state.lang = b.getAttribute('data-lang');
      document.querySelectorAll('.lbtn').forEach(function (x) { x.classList.remove('active'); });
      b.classList.add('active');
      var s = STRINGS[state.lang] || STRINGS.en;
      $('fr-title').textContent = s.frTitle;
      $('fr-sub').textContent = s.frSub;
      $('fr-lbl-c').textContent = s.lblC;
      $('fr-lbl-m').textContent = s.lblM;
      $('fr-lbl-l').textContent = s.lblL;
      $('fr-noc').textContent = s.noc;
      $('fr-info').textContent = s.disc;
      renderFamilyReport();
    });
  });

  function renderFamilyReport() {
    var c = getSelectedClient('fr-cl');
    var prev = $('fr-prev');
    var noc = $('fr-noc');
    if (!c) {
      prev.hidden = true;
      noc.hidden = false;
      return;
    }
    noc.hidden = true;
    prev.hidden = false;
    var s = STRINGS[state.lang] || STRINGS.en;
    var mon = ($('fr-mon') || {}).value || new Date().toISOString().slice(0, 7);
    var mStr = new Date(mon + '-01').toLocaleDateString(s.locale || 'en-IN', { month: 'long', year: 'numeric' });
    var bars = [[78, s.bars[0]], [75, s.bars[1]], [72, s.bars[2]], [85, s.bars[3]]];
    var trend = [[s.bars[0], 60, 65, 72, 78, '+18%'], [s.bars[1], 55, 65, 70, 75, '+20%'], [s.bars[2], 50, 58, 66, 72, '+22%'], [s.bars[3], 75, 80, 82, 85, '+10%']];
    prev.innerHTML =
      '<div class="rh"><div class="rh-c">' + s.center + '</div><div class="rh-t">' + s.rTitle + '</div><div class="rh-d">' + s.cLbl + ': <strong>' + c.name + '</strong> | ID: ' + c.id + ' | ' + s.tLbl + ': ' + (c.therapist || '—') + '</div><div class="rh-s">' + mStr + ' | ' + s.aLbl + ': ' + (c.admission || '—') + '</div></div>' +
      '<div class="alert alert-warn">' + s.disc + '</div>' +
      '<div class="card"><div style="font-weight:700;font-size:1rem;color:var(--teal);margin-bottom:12px">' + s.pTitle + '</div>' +
      s.sections.map(function (x) { return '<div class="frs"><div class="frs-t">' + x.t + '</div><div class="frs-b">' + x.b + '</div></div>'; }).join('') + '</div>' +
      '<div class="card"><div style="font-weight:700;margin-bottom:12px">' + s.mTitle + '</div>' +
      bars.map(function (b) { return '<div class="pbw"><div class="pbt"><span>' + b[1] + '</span><span style="font-weight:700;color:var(--teal)">' + b[0] + '%</span></div><div class="pbtr"><div class="pbf" style="width:' + b[0] + '%"></div></div></div>'; }).join('') + '</div>' +
      '<div class="card"><div style="font-weight:700;margin-bottom:12px">' + s.wTitle + '</div><div class="table-wrap"><table class="wt"><thead><tr>' + s.wCols.map(function (h) { return '<th>' + h + '</th>'; }).join('') + '</tr></thead><tbody>' +
      trend.map(function (r) { return '<tr><td style="text-align:left;font-weight:500">' + r[0] + '</td><td>' + r[1] + '%</td><td>' + r[2] + '%</td><td>' + r[3] + '%</td><td>' + r[4] + '%</td><td class="chg">' + r[5] + '</td></tr>'; }).join('') + '</tbody></table></div></div>' +
      '<div class="card" style="background:var(--teal-pale)"><div style="font-weight:700;margin-bottom:12px">' + s.tipsTitle + '</div>' +
      s.tips.map(function (t, i) { return '<div class="tipr"><div class="tipn">' + (i + 1) + '</div><div class="tipt">' + t + '</div></div>'; }).join('') + '</div>' +
      '<div class="fr-foot">' + s.footer + '</div>' +
      '<div class="alert alert-warn">' + s.print + '</div>';
  }

  $('fr-cl').addEventListener('change', renderFamilyReport);
  $('fr-mon').addEventListener('change', renderFamilyReport);

  // ─── Settings (list editor + export/import) ────────────────────
  var SET_SECTIONS = [
    { key: 'PSY', icon: 'Psychiatric', title: 'Mental state parameters', arr: function () { return PSY; }, set: function (v) { PSY.length = 0; v.forEach(function (x) { PSY.push(x); }); }, rebuild: function () { buildRatingRows('psy-rows', PSY, 'psy'); } },
    { key: 'BEH', icon: 'Behavioral', title: 'Behavioral parameters', arr: function () { return BEH; }, set: function (v) { BEH.length = 0; v.forEach(function (x) { BEH.push(x); }); }, rebuild: function () { buildRatingRows('beh-rows', BEH, 'beh'); } },
    { key: 'ADL', icon: 'ADL', title: 'ADL domains', arr: function () { return ADL; }, set: function (v) { ADL.length = 0; v.forEach(function (x) { ADL.push(x); }); }, rebuild: function () { buildADL(); } },
    { key: 'THER', icon: 'Therapeutic', title: 'Therapeutic activity types', arr: function () { return THER; }, set: function (v) { THER.length = 0; v.forEach(function (x) { THER.push(x); }); }, rebuild: function () { buildTher(); } },
    { key: 'RISK', icon: 'Risk', title: 'Risk domains', arr: function () { return RISK; }, set: function (v) { RISK.length = 0; v.forEach(function (x) { RISK.push(x); }); }, rebuild: function () { buildRisk(); } }
  ];

  function renderSettings() {
    var html = SET_SECTIONS.map(function (sec) {
      return '<div class="card"><div class="set-hdr"><span class="set-title">' + sec.icon + ' — ' + sec.title + '</span><span class="set-badge">' + sec.arr().length + ' items</span></div><div class="set-desc">Edit list below. Add, rename, reorder, or remove.</div><div id="set-list-' + sec.key + '"></div><div class="add-row"><input class="add-inp" id="set-inp-' + sec.key + '" placeholder="New item…"><button type="button" class="add-btn" data-add="' + sec.key + '">+ Add</button></div></div>';
    }).join('');
    $('settings-lists').innerHTML = html;
    SET_SECTIONS.forEach(function (sec) { renderList(sec.key); });
    $('settings-lists').querySelectorAll('[data-add]').forEach(function (b) {
      b.addEventListener('click', function () {
        var key = b.getAttribute('data-add');
        var inp = $('set-inp-' + key);
        var val = (inp && inp.value || '').trim();
        if (!val) { showToast('Enter item name'); return; }
        var sec = SET_SECTIONS.filter(function (s) { return s.key === key; })[0];
        if (sec) { sec.arr().push(val); inp.value = ''; renderList(key); sec.rebuild(); showToast('Added'); }
      });
    });
  }

  function renderList(key) {
    var sec = SET_SECTIONS.filter(function (s) { return s.key === key; })[0];
    if (!sec) return;
    var items = sec.arr();
    var html = items.map(function (item, i) {
      var safe = (item || '').replace(/'/g, '&#39;').replace(/"/g, '&quot;');
      return '<div class="list-item"><input class="li-txt" value="' + safe + '" data-key="' + key + '" data-i="' + i + '"><button type="button" class="li-up" data-key="' + key + '" data-i="' + i + '" data-dir="-1">↑</button><button type="button" class="li-dn" data-key="' + key + '" data-i="' + i + '" data-dir="1">↓</button><button type="button" class="li-del" data-key="' + key + '" data-i="' + i + '">×</button></div>';
    }).join('');
    $('set-list-' + key).innerHTML = html || '<p style="color:var(--slate-light);font-size:0.9rem">No items. Add one below.</p>';
    $('set-list-' + key).querySelectorAll('.li-txt').forEach(function (inp) {
      inp.addEventListener('blur', function () {
        var k = inp.getAttribute('data-key');
        var i = parseInt(inp.getAttribute('data-i'), 10);
        var v = inp.value.trim();
        var s = SET_SECTIONS.filter(function (x) { return x.key === k; })[0];
        if (s && v) { s.arr()[i] = v; s.rebuild(); }
      });
    });
    $('set-list-' + key).querySelectorAll('.li-up, .li-dn').forEach(function (b) {
      b.addEventListener('click', function () {
        var k = b.getAttribute('data-key');
        var i = parseInt(b.getAttribute('data-i'), 10);
        var dir = parseInt(b.getAttribute('data-dir'), 10);
        var s = SET_SECTIONS.filter(function (x) { return x.key === k; })[0];
        if (!s) return;
        var arr = s.arr();
        var j = i + dir;
        if (j < 0 || j >= arr.length) return;
        var t = arr[i]; arr[i] = arr[j]; arr[j] = t;
        renderList(k);
        s.rebuild();
      });
    });
    $('set-list-' + key).querySelectorAll('.li-del').forEach(function (b) {
      b.addEventListener('click', function () {
        var k = b.getAttribute('data-key');
        var i = parseInt(b.getAttribute('data-i'), 10);
        var s = SET_SECTIONS.filter(function (x) { return x.key === k; })[0];
        if (!s || s.arr().length <= 1) { showToast('Keep at least one item'); return; }
        s.arr().splice(i, 1);
        renderList(k);
        s.rebuild();
        showToast('Removed');
      });
    });
  }

  $('export-config').addEventListener('click', function () {
    var cfg = {};
    SET_SECTIONS.forEach(function (s) { cfg[s.key] = s.arr().slice(); });
    var blob = new Blob([JSON.stringify(cfg, null, 2)], { type: 'application/json' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'NeuroRehab_Config.json';
    a.click();
    showToast('Config exported');
  });

  $('import-config-btn').addEventListener('click', function () { $('cfg-file').click(); });
  $('cfg-file').addEventListener('change', function (e) {
    var file = (e.target && e.target.files && e.target.files[0]);
    if (!file) return;
    var r = new FileReader();
    r.onload = function () {
      try {
        var cfg = JSON.parse(r.result);
        SET_SECTIONS.forEach(function (sec) {
          if (cfg[sec.key] && Array.isArray(cfg[sec.key]) && cfg[sec.key].length) {
            sec.set(cfg[sec.key]);
            sec.rebuild();
          }
        });
        if (state.page === 'settings') renderSettings();
        showToast('Config imported');
      } catch (err) { showToast('Invalid config file'); }
    };
    r.readAsText(file);
    e.target.value = '';
  });

  $('reset-config').addEventListener('click', function () {
    if (!confirm('Reset all lists to defaults? This cannot be undone.')) return;
    SET_SECTIONS.forEach(function (sec) {
      sec.set((DEFAULTS[sec.key] || []).slice());
      sec.rebuild();
    });
    if (state.page === 'settings') renderSettings();
    showToast('Reset to defaults');
  });

  // ─── Run ──────────────────────────────────────────────────────
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
