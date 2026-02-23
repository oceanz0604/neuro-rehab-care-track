/**
 * NeuroRehab CareTrack — main app router, state manager, auth flow.
 * Login-only (no self sign-up). Admin creates staff via Admin panel.
 * Exposes window.CareTrack
 */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };

  var state = {
    user: null,
    profile: null,
    clients: [],
    recentReports: [],
    config: {},
    page: 'dashboard',
    selectedClient: null,
    selectedClientData: null
  };

  var PAGE_TITLES = {
    dashboard: 'Dashboard',
    patients: 'Patients',
    'patient-detail': 'Patient Detail',
    comms: 'Team Chat',
    freport: 'Family Reports',
    settings: 'Settings',
    admin: 'Staff Management'
  };

  var _pageInited = {};

  /* ─── Toast ──────────────────────────────────────────────────── */
  var _tt;
  function toast(msg) {
    var el = $('toast'); if (!el) return;
    el.textContent = msg;
    el.setAttribute('data-show', 'true');
    clearTimeout(_tt);
    _tt = setTimeout(function () { el.setAttribute('data-show', 'false'); }, 3000);
  }

  function showLoginError(msg) {
    var el = $('login-error'); if (!el) return;
    el.textContent = msg || '';
    el.style.display = msg ? 'block' : 'none';
  }

  /* ─── Auth ──────────────────────────────────────────────────── */
  var _loginBound = false;
  function bindLogin() {
    if (_loginBound) return;
    var form = $('login-form');
    if (!form) return;
    _loginBound = true;

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      showLoginError('');
      var email = ($('l-email') || {}).value.trim();
      var pw    = ($('l-password') || {}).value;
      if (!email || !pw) { showLoginError('Enter email and password.'); return; }

      var btn = $('login-btn');
      btn.disabled = true; btn.textContent = 'Signing in…';

      AppDB.signIn(email, pw)
        .then(function () { btn.disabled = false; btn.textContent = 'Sign in'; })
        .catch(function (err) {
          btn.disabled = false; btn.textContent = 'Sign in';
          if (err.code === 'auth/user-not-found' || err.code === 'auth/invalid-credential') {
            showLoginError('Account not found. Contact your administrator.');
          } else if (err.code === 'auth/wrong-password') {
            showLoginError('Incorrect password.');
          } else {
            showLoginError(err.message || 'Sign in failed.');
          }
        });
    });
  }

  function showLogin() {
    $('login-screen').classList.remove('hidden');
    $('login-screen').style.display = '';
    $('app-shell').setAttribute('hidden', '');
  }

  function showApp() {
    $('login-screen').style.display = 'none';
    $('app-shell').removeAttribute('hidden');
    var p = state.profile || {};
    $('sb-name').textContent = p.displayName || (state.user || {}).email || 'Staff';
    $('sb-role').textContent = p.role || '—';
    $('sb-avatar').textContent = ((p.displayName || 'S')[0] || 'S').toUpperCase();
    $('shift-badge').textContent = p.shift || 'Morning';

    var adminLink = $('nav-admin');
    if (adminLink) adminLink.style.display = (p.role === 'admin') ? '' : 'none';
  }

  /* ─── Data loading ──────────────────────────────────────────── */
  function loadData(force) {
    return Promise.all([
      AppDB.getClients(force),
      AppDB.getRecentReports(20)
    ]).then(function (results) {
      state.clients = results[0] || [];
      state.recentReports = results[1] || [];
      AppNotify.refresh(state.clients);
      renderCurrentPage();
    }).catch(function (err) {
      console.error('loadData error:', err);
      toast('Failed to load data');
    });
  }

  function loadConfig() {
    var defaults = (window.Pages && window.Pages.settings && window.Pages.settings.DEFAULTS) || {};
    return AppDB.getOrgConfig().then(function (cfg) {
      state.config = cfg || {};
      Object.keys(defaults).forEach(function (k) {
        if (!state.config[k] || !Array.isArray(state.config[k])) state.config[k] = (defaults[k] || []).slice();
      });
    }).catch(function () {
      state.config = {};
      Object.keys(defaults).forEach(function (k) { state.config[k] = (defaults[k] || []).slice(); });
    });
  }

  function refreshData() {
    return loadData(true);
  }

  /* ─── Navigation ────────────────────────────────────────────── */
  function navigate(page) {
    var prevPage = state.page;
    if (Pages[prevPage] && Pages[prevPage].destroy) Pages[prevPage].destroy();

    state.page = page;
    state.selectedClient = null;
    state.selectedClientData = null;

    document.querySelectorAll('.page').forEach(function (el) { el.classList.remove('active'); });
    var target = $('page-' + page);
    if (target) target.classList.add('active');

    $('tb-title').textContent = PAGE_TITLES[page] || page;

    document.querySelectorAll('.nav-link').forEach(function (a) {
      a.classList.toggle('active', a.getAttribute('data-page') === page);
    });

    closeSidebar();
    initPage(page);
    renderCurrentPage();
  }

  function openPatient(clientId) {
    state.selectedClient = clientId;
    var found = null;
    state.clients.forEach(function (c) { if (c.id === clientId) found = c; });
    if (!found) {
      AppDB.getClient(clientId).then(function (c) {
        state.selectedClientData = c;
        doOpenPatient();
      });
      return;
    }
    state.selectedClientData = found;
    doOpenPatient();
  }

  function doOpenPatient() {
    state.page = 'patient-detail';
    document.querySelectorAll('.page').forEach(function (el) { el.classList.remove('active'); });
    $('page-patient-detail').classList.add('active');
    $('tb-title').textContent = state.selectedClientData ? state.selectedClientData.name : 'Patient';
    document.querySelectorAll('.nav-link').forEach(function (a) {
      a.classList.toggle('active', a.getAttribute('data-page') === 'patients');
    });
    closeSidebar();
    initPage('patient-detail');
    renderCurrentPage();
  }

  function initPage(page) {
    var key = page === 'patient-detail' ? 'patientDetail' : page;
    if (Pages[key] && Pages[key].init && !_pageInited[page]) {
      Pages[key].init(state);
      _pageInited[page] = true;
    }
  }

  function renderCurrentPage() {
    var page = state.page;
    var key = page === 'patient-detail' ? 'patientDetail' : page;
    if (Pages[key] && Pages[key].render) Pages[key].render(state);
  }

  /* ─── Sidebar ───────────────────────────────────────────────── */
  function closeSidebar() {
    $('sidebar').classList.remove('open');
    $('sb-overlay').classList.remove('visible');
  }

  /* ─── Init ──────────────────────────────────────────────────── */
  function init() {
    if (!window.AppDB || !AppDB.ready) {
      showLoginError((AppDB && AppDB.error) || 'Firebase not configured.');
      return;
    }
    bindLogin();
    AppNotify.init();

    // Sidebar nav
    document.querySelectorAll('.nav-link').forEach(function (a) {
      a.addEventListener('click', function (e) {
        e.preventDefault();
        navigate(a.getAttribute('data-page'));
      });
    });

    // Mobile sidebar
    $('menu-btn').addEventListener('click', function () {
      $('sidebar').classList.toggle('open');
      $('sb-overlay').classList.toggle('visible');
    });
    $('sb-overlay').addEventListener('click', closeSidebar);

    // Logout
    $('logout-btn').addEventListener('click', function () {
      if (AppChat && AppChat.ready) AppChat.unsubscribeAll();
      AppDB.signOut();
    });

    // Notification bell
    $('notif-btn').addEventListener('click', function (e) {
      e.stopPropagation();
      AppNotify.togglePanel();
    });
    document.addEventListener('click', function (e) {
      var panel = $('notif-panel');
      if (panel && panel.classList.contains('visible') && !panel.contains(e.target)) {
        panel.classList.remove('visible');
      }
    });

    // Notification item clicks
    $('notif-panel').addEventListener('click', function (e) {
      var item = e.target.closest('.notif-item');
      if (!item) return;
      var page = item.getAttribute('data-page');
      var id = item.getAttribute('data-id');
      $('notif-panel').classList.remove('visible');
      if (page === 'patient-detail' && id) openPatient(id);
      else if (page) navigate(page);
    });

    // Auth state
    AppDB.onAuthStateChanged(function (user) {
      if (user) {
        state.user = user;
        AppDB.getUserProfile(user.uid).then(function (profile) {
          if (profile && profile.isActive === false) {
            showLoginError('Your account has been deactivated. Contact your administrator.');
            AppDB.signOut();
            return;
          }
          state.profile = profile || {};
          showApp();
          return loadConfig().then(function () { return loadData(); });
        }).catch(function () {
          state.profile = {};
          showApp();
          loadData();
        });
      } else {
        state.user = null;
        state.profile = null;
        state.clients = [];
        state.recentReports = [];
        showLogin();
      }
    });
  }

  /* ─── Boot ──────────────────────────────────────────────────── */
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

  /* ─── Public API ────────────────────────────────────────────── */
  window.CareTrack = {
    navigate: navigate,
    openPatient: openPatient,
    refreshData: refreshData,
    getState: function () { return state; },
    toast: toast
  };
})();
