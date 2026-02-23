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
    reports: 'Reports',
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

  function updateChatBadge() {
    var badge = $('chat-unread-badge');
    if (!badge) return;
    var total = (window.Pages && window.Pages.comms && window.Pages.comms.getUnreadTotal) ? window.Pages.comms.getUnreadTotal() : 0;
    if (total > 0) {
      badge.textContent = total > 99 ? '99+' : total;
      badge.classList.add('visible');
    } else {
      badge.textContent = '';
      badge.classList.remove('visible');
    }
  }

  function showApp() {
    $('login-screen').style.display = 'none';
    $('app-shell').removeAttribute('hidden');
    var p = state.profile || {};
    $('sb-name').textContent = p.displayName || (state.user || {}).email || 'Staff';
    $('sb-role').textContent = (window.CareTrackRoleLabel && window.CareTrackRoleLabel(p.role)) || p.role || '—';
    $('sb-avatar').textContent = ((p.displayName || 'S')[0] || 'S').toUpperCase();
    $('shift-badge').textContent = p.shift || 'Morning';

    var adminLink = $('nav-admin');
    if (adminLink) adminLink.style.display = (window.Permissions && window.Permissions.canAccessAdmin(p.role)) ? '' : 'none';

    if (window.Pages && window.Pages.comms) {
      if (Pages.comms.startUnreadListeners) Pages.comms.startUnreadListeners();
      if (Pages.comms.setOnUnreadChange) Pages.comms.setOnUnreadChange(updateChatBadge);
      updateChatBadge();
    }
  }

  /* ─── Data loading ──────────────────────────────────────────── */
  function loadData(force) {
    return Promise.all([
      AppDB.getClients(force),
      AppDB.getRecentReports(20)
    ]).then(function (results) {
      state.clients = results[0] || [];
      state.recentReports = results[1] || [];
      AppNotify.refresh(state.clients, state);
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
    if (page === 'comms') updateChatBadge();
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

  function doLogout() {
    if (AppChat && AppChat.ready) AppChat.unsubscribeAll();
    AppDB.signOut();
  }

  /* ─── PWA Install banner ─────────────────────────────────────── */
  var _deferredInstallPrompt = null;
  var PWA_DISMISS_KEY = 'pwaInstallDismissed';
  var PWA_DISMISS_DAYS = 7;

  function showPwaBanner() {
    var banner = $('pwa-install-banner');
    if (!banner || !_deferredInstallPrompt) return;
    if (window.matchMedia('(display-mode: standalone)').matches) return;
    try {
      var dismissed = localStorage.getItem(PWA_DISMISS_KEY);
      if (dismissed) {
        var t = parseInt(dismissed, 10);
        if (Date.now() - t < PWA_DISMISS_DAYS * 24 * 60 * 60 * 1000) return;
      }
    } catch (e) { /* ignore */ }
    banner.hidden = false;
  }

  function hidePwaBanner() {
    var banner = $('pwa-install-banner');
    if (banner) banner.hidden = true;
  }

  function dismissPwaBanner() {
    try { localStorage.setItem(PWA_DISMISS_KEY, String(Date.now())); } catch (e) { /* ignore */ }
    hidePwaBanner();
  }

  function bindPwaInstall() {
    window.addEventListener('beforeinstallprompt', function (e) {
      e.preventDefault();
      _deferredInstallPrompt = e;
      if ($('app-shell') && !$('app-shell').hasAttribute('hidden')) {
        setTimeout(showPwaBanner, 1500);
      }
    });
    window.addEventListener('appinstalled', function () {
      _deferredInstallPrompt = null;
      try { localStorage.setItem(PWA_DISMISS_KEY, String(Date.now())); } catch (e) { /* ignore */ }
      hidePwaBanner();
    });
    var installBtn = $('pwa-install-btn');
    var dismissBtn = $('pwa-install-dismiss');
    var closeBtn = $('pwa-install-close');
    if (installBtn) installBtn.addEventListener('click', function () {
      if (!_deferredInstallPrompt) return;
      _deferredInstallPrompt.prompt();
      _deferredInstallPrompt.userChoice.then(function (choice) {
        _deferredInstallPrompt = null;
        hidePwaBanner();
      });
    });
    if (dismissBtn) dismissBtn.addEventListener('click', dismissPwaBanner);
    if (closeBtn) closeBtn.addEventListener('click', dismissPwaBanner);
  }

  /* ─── Theme (dark/light) ────────────────────────────────────── */
  var THEME_KEY = 'caretrack-theme';
  function getTheme() {
    return document.documentElement.getAttribute('data-theme') || 'light';
  }
  function setTheme(theme) {
    theme = theme === 'dark' ? 'dark' : 'light';
    if (theme === 'dark') document.documentElement.setAttribute('data-theme', 'dark');
    else document.documentElement.removeAttribute('data-theme');
    try { localStorage.setItem(THEME_KEY, theme); } catch (e) { /* ignore */ }
    updateThemeIcon();
  }
  function toggleTheme() {
    setTheme(getTheme() === 'dark' ? 'light' : 'dark');
  }
  function updateThemeIcon() {
    var icon = $('theme-icon');
    if (!icon) return;
    if (getTheme() === 'dark') {
      icon.className = 'fas fa-sun';
      if (icon.parentNode) icon.parentNode.setAttribute('title', 'Switch to light theme');
    } else {
      icon.className = 'fas fa-moon';
      if (icon.parentNode) icon.parentNode.setAttribute('title', 'Switch to dark theme');
    }
  }

  /* ─── Init ──────────────────────────────────────────────────── */
  function init() {
    if (!window.AppDB || !AppDB.ready) {
      showLoginError((AppDB && AppDB.error) || 'Firebase not configured.');
      return;
    }
    bindLogin();
    bindPwaInstall();
    AppNotify.init();

    // Theme toggle (only visible in app shell)
    var themeBtn = $('theme-toggle');
    if (themeBtn) themeBtn.addEventListener('click', toggleTheme);

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

    // Logout (with confirmation)
    $('logout-btn').addEventListener('click', function () {
      if (!window.AppModal || !AppModal.confirm) {
        doLogout();
        return;
      }
      AppModal.confirm('Sign out', 'Are you sure you want to sign out?', doLogout, 'Sign out');
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
          updateThemeIcon();
          setTimeout(function () { showPwaBanner(); }, 1500);
          return loadConfig().then(function () { return loadData(); });
        }).catch(function () {
          state.profile = {};
          showApp();
          updateThemeIcon();
          setTimeout(function () { showPwaBanner(); }, 1500);
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
