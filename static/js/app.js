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
  var _profileListenerUnsub = null;

  // Short topbar labels only; page content keeps the real heading (avoids duplicate titles)
  var PAGE_TITLES = {
    dashboard: 'Dashboard',
    patients: 'Patients',
    reports: 'Reports',
    comms: 'Team Chat',
    freport: 'Progress Report',
    tasks: 'Tasks',
    settings: 'Settings',
    admin: 'Admin'
  };

  var _pageInited = {};
  var _navigatingFromPopstate = false;

  function getIndexBasePath() {
    var p = (typeof location !== 'undefined' && location.pathname) || '';
    return (p === '/' || p === '') ? '/index.html' : p;
  }

  function getPageFromUrl() {
    try {
      var params = new URLSearchParams(window.location.search);
      return params.get('page');
    } catch (e) { return null; }
  }

  function updateUrlForPage(page, replace) {
    if (_navigatingFromPopstate) return;
    var base = getIndexBasePath();
    var url = base + '?page=' + (page || 'dashboard');
    if (replace) history.replaceState({ page: page }, '', url);
    else history.pushState({ page: page }, '', url);
  }

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

    var toggleBtn = $('login-toggle-password');
    var pwInput = $('l-password');
    if (toggleBtn && pwInput) {
      toggleBtn.addEventListener('click', function () {
        var isPass = pwInput.type === 'password';
        pwInput.type = isPass ? 'text' : 'password';
        toggleBtn.setAttribute('aria-label', isPass ? 'Hide password' : 'Show password');
        toggleBtn.title = isPass ? 'Hide password' : 'Show password';
        var icon = toggleBtn.querySelector('i');
        if (icon) icon.className = isPass ? 'fas fa-eye-slash' : 'fas fa-eye';
      });
    }

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
          var code = err && err.code;
          if (code === 'auth/user-not-found' || code === 'auth/invalid-credential' || code === 'auth/invalid-login-credentials') {
            showLoginError('Account not found or invalid credentials. Contact your administrator.');
          } else if (code === 'auth/wrong-password') {
            showLoginError('Incorrect password.');
          } else {
            showLoginError(err.message || 'Sign in failed.');
          }
        });
    });
  }

  function hideLoading() {
    var el = $('loading-screen');
    if (el) el.classList.add('hidden');
  }

  function showLogin() {
    hideLoading();
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

  function updateSidebarBrand() {
    var p = state.profile || {};
    var nameStr = (p.displayName || (state.user || {}).email || 'Staff').trim() || 'Staff';
    var nameEl = $('sb-name');
    if (nameEl) nameEl.textContent = nameStr;
    var brandEl = $('sb-brand-text');
    if (brandEl) brandEl.textContent = (state.config && state.config.orgName) ? String(state.config.orgName).trim() : 'Maitra Wellness';
    var avatarEl = $('sb-user-avatar');
    if (avatarEl) {
      var parts = nameStr.split(/\s+/);
      var initials = parts.length >= 2 ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase() : nameStr.substring(0, 2).toUpperCase();
      avatarEl.textContent = initials;
    }
  }

  function updateBreadcrumb(page) {
    var el = $('tb-breadcrumb');
    if (!el) return;
    var label = (page && PAGE_TITLES[page]) ? PAGE_TITLES[page] : (page || 'Dashboard');
    el.innerHTML = '<span class="bc-current">' + label + '</span>';
  }

  function updateBottomNav(page) {
    var nav = $('bottom-nav');
    if (!nav) return;
    nav.querySelectorAll('.bottom-nav-item').forEach(function (btn) {
      btn.classList.toggle('active', btn.getAttribute('data-page') === page);
    });
  }

  function showApp() {
    hideLoading();
    $('login-screen').style.display = 'none';
    $('app-shell').removeAttribute('hidden');
    updateSidebarBrand();

    var adminLink = $('nav-admin');
    if (adminLink) adminLink.style.display = (window.Permissions && window.Permissions.canAccessAdmin(state.profile)) ? '' : 'none';

    if (window.Pages && window.Pages.comms) {
      if (Pages.comms.startUnreadListeners) Pages.comms.startUnreadListeners();
      if (Pages.comms.setOnUnreadChange) Pages.comms.setOnUnreadChange(updateChatBadge);
      updateChatBadge();
    }
    if (window.AppPush && state.user) setTimeout(function () { AppPush.init(state.user); }, 2500);
  }

  /* ─── Data loading ──────────────────────────────────────────── */
  function loadData(force) {
    return Promise.all([
      AppDB.getClients(force),
      AppDB.getRecentReports(20)
    ]).then(function (results) {
      state.clients = results[0] || [];
      state.recentReports = results[1] || [];
      renderCurrentPage();
      return true;
    }).catch(function (err) {
      console.error('loadData error:', err);
      toast('Failed to load data');
      return false;
    });
  }

  function loadConfig() {
    var defaults = (window.Pages && window.Pages.settings && window.Pages.settings.DEFAULTS) || {};
    var icd11Diagnosis = (window.Pages && window.Pages.settings && window.Pages.settings.ICD11_DIAGNOSIS_OPTIONS) || [];
    return AppDB.getOrgConfig().then(function (cfg) {
      state.config = cfg || {};
      Object.keys(defaults).forEach(function (k) {
        if (k === 'diagnosisOptions') {
          var saved = state.config.diagnosisOptions && Array.isArray(state.config.diagnosisOptions) ? state.config.diagnosisOptions : [];
          var merged = icd11Diagnosis.slice();
          var inIcd11 = {};
          icd11Diagnosis.forEach(function (s) { inIcd11[s] = true; });
          saved.forEach(function (s) {
            var v = (s || '').trim();
            if (v && !inIcd11[v]) { inIcd11[v] = true; merged.push(v); }
          });
          state.config.diagnosisOptions = merged;
        } else if (!state.config[k] || !Array.isArray(state.config[k])) {
          state.config[k] = (defaults[k] || []).slice();
        }
      });
    }).catch(function () {
      state.config = {};
      Object.keys(defaults).forEach(function (k) { state.config[k] = (defaults[k] || []).slice(); });
    });
  }

  function refreshData() {
    return loadData(true).then(function (ok) {
      if (ok !== false) toast('Data refreshed');
    });
  }

  /* ─── Navigation ────────────────────────────────────────────── */
  function navigate(page) {
    if (!page || !PAGE_TITLES[page]) return;
    var prevPage = state.page;
    if (Pages[prevPage] && Pages[prevPage].destroy) Pages[prevPage].destroy();

    state.page = page;
    state.selectedClient = null;
    state.selectedClientData = null;

    document.querySelectorAll('.page').forEach(function (el) { el.classList.remove('active'); });
    var target = $('page-' + page);
    if (target) target.classList.add('active');

    $('tb-title').textContent = PAGE_TITLES[page] || page;
    updateBreadcrumb(page);
    updateBottomNav(page);

    document.querySelectorAll('.nav-link').forEach(function (a) {
      a.classList.toggle('active', a.getAttribute('data-page') === page);
    });

    closeSidebar();
    initPage(page);
    renderCurrentPage();
    if (page === 'comms') updateChatBadge();

    /* Replace URL so tab switches don't pile up history; back goes to previous page. If we're the only entry, push once so back can go to previous tab. */
    var replace = history.length > 1;
    updateUrlForPage(page, replace);
  }

  function handleQuickAction(action) {
    if (action === 'add-report') {
      navigate('patients');
      toast('Select a patient to add a report');
    } else if (action === 'add-patient') {
      navigate('patients');
      setTimeout(function () {
        var btn = $('add-patient-btn');
        if (btn) btn.click();
      }, 300);
    } else if (action === 'add-task') {
      navigate('tasks');
      setTimeout(function () {
        var btn = $('tasks-add-btn');
        if (btn) btn.click();
      }, 300);
    }
  }

  function openPatient(clientId) {
    if (!clientId) return;
    window.location.href = '/patient.html?id=' + encodeURIComponent(clientId);
  }

  function openTask(taskId) {
    if (!taskId) return;
    window.location.href = '/task.html?id=' + encodeURIComponent(taskId);
  }

  function initPage(page) {
    var key = page;
    if (Pages[key] && Pages[key].init && !_pageInited[page]) {
      Pages[key].init(state);
      _pageInited[page] = true;
    }
  }

  function renderCurrentPage() {
    var page = state.page;
    var key = page;
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
    var sidebarIcon = $('sidebar-theme-icon');
    var isDark = getTheme() === 'dark';
    var cls = isDark ? 'fas fa-sun' : 'fas fa-moon';
    var title = isDark ? 'Switch to light theme' : 'Switch to dark theme';
    if (icon) { icon.className = cls; if (icon.parentNode) icon.parentNode.setAttribute('title', title); }
    if (sidebarIcon) { sidebarIcon.className = cls; if (sidebarIcon.parentNode) sidebarIcon.parentNode.setAttribute('title', title); }
  }

  /* ─── Init ──────────────────────────────────────────────────── */
  function init() {
    var params = new URLSearchParams(window.location.search);
    if (params.get('page') === 'patient-detail' && params.get('id')) {
      window.location.replace('/patient.html?id=' + encodeURIComponent(params.get('id')));
      return;
    }
    if (params.get('page') === 'task-detail' && params.get('id')) {
      window.location.replace('/task.html?id=' + encodeURIComponent(params.get('id')));
      return;
    }
    if (!window.AppDB || !AppDB.ready) {
      showLoginError((AppDB && AppDB.error) || 'Firebase not configured.');
      return;
    }
    bindLogin();
    bindPwaInstall();

    // Theme toggle (only visible in app shell)
    var themeBtn = $('theme-toggle');
    if (themeBtn) themeBtn.addEventListener('click', toggleTheme);

    // Back/forward: sync view to URL
    window.addEventListener('popstate', function (e) {
      var page = (e.state && e.state.page) || getPageFromUrl();
      if (page && PAGE_TITLES[page]) {
        _navigatingFromPopstate = true;
        try { navigate(page); } finally { _navigatingFromPopstate = false; }
      }
    });

    // Sidebar nav (only links with a valid data-page; logout has no data-page)
    document.querySelectorAll('.nav-link').forEach(function (a) {
      a.addEventListener('click', function (e) {
        var page = a.getAttribute('data-page');
        if (!page || !PAGE_TITLES[page]) return;
        e.preventDefault();
        navigate(page);
      });
    });

    // Global refresh (navbar)
    var globalRefresh = $('global-refresh-btn');
    if (globalRefresh) globalRefresh.addEventListener('click', function () {
      if (window.CareTrack) window.CareTrack.refreshData();
    });
    // Sidebar refresh & theme (mobile More menu)
    var sidebarRefresh = $('sidebar-refresh-btn');
    if (sidebarRefresh) sidebarRefresh.addEventListener('click', function () {
      if (window.CareTrack) window.CareTrack.refreshData();
      closeSidebar();
    });
    var sidebarTheme = $('sidebar-theme-btn');
    if (sidebarTheme) sidebarTheme.addEventListener('click', toggleTheme);

    // Quick-action menu
    var qaBtn = $('tb-quick-add');
    var qaMenu = $('quick-add-menu');
    if (qaBtn && qaMenu) {
      qaBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        qaMenu.classList.toggle('visible');
      });
      document.addEventListener('click', function () { qaMenu.classList.remove('visible'); });
      qaMenu.querySelectorAll('.quick-add-item').forEach(function (item) {
        item.addEventListener('click', function () {
          qaMenu.classList.remove('visible');
          handleQuickAction(item.getAttribute('data-action'));
        });
      });
    }
    // Dashboard quick action cards
    document.querySelectorAll('.quick-action-card[data-action]').forEach(function (card) {
      card.addEventListener('click', function () {
        handleQuickAction(card.getAttribute('data-action'));
      });
    });

    // Bottom nav
    var bottomNav = $('bottom-nav');
    if (bottomNav) {
      bottomNav.querySelectorAll('.bottom-nav-item').forEach(function (btn) {
        btn.addEventListener('click', function () {
          var page = btn.getAttribute('data-page');
          if (page === 'more') {
            $('sidebar').classList.add('open');
            $('sb-overlay').classList.add('visible');
          } else if (page && PAGE_TITLES[page]) {
            navigate(page);
          }
        });
      });
    }

    // Mobile sidebar
    $('menu-btn').addEventListener('click', function () {
      $('sidebar').classList.toggle('open');
      $('sb-overlay').classList.toggle('visible');
    });
    $('sb-overlay').addEventListener('click', closeSidebar);

    // Logout (with confirmation)
    $('logout-btn').addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      var overlay = document.getElementById('modal-overlay');
      if (overlay && overlay.classList.contains('visible')) return;
      if (!window.AppModal || !AppModal.confirm) {
        doLogout();
        return;
      }
      AppModal.confirm('Sign out', 'Are you sure you want to sign out?', doLogout, 'Sign out');
    });

    // Auth state
    AppDB.onAuthStateChanged(function (user) {
      if (user) {
        state.user = user;
        if (_profileListenerUnsub) { _profileListenerUnsub(); _profileListenerUnsub = null; }
        _profileListenerUnsub = AppDB.listenUserProfile && AppDB.listenUserProfile(user.uid, function (profile) {
          if (profile && profile.isActive === false) {
            showLoginError('Your account has been deactivated. Contact your administrator.');
            AppDB.signOut();
          } else if (profile && state.user && $('app-shell') && !$('app-shell').hasAttribute('hidden')) {
            state.profile = profile;
            updateSidebarBrand();
          }
        });
        AppDB.getUserProfile(user.uid).then(function (profile) {
          if (!profile) {
            showLoginError('Account not found. Contact your administrator.');
            AppDB.signOut();
            return;
          }
          if (profile.isActive === false) {
            showLoginError('Your account has been deactivated. Contact your administrator.');
            AppDB.signOut();
            return;
          }
          state.profile = profile;
          showApp();
          updateThemeIcon();
          setTimeout(function () { showPwaBanner(); }, 1500);
          return loadConfig().then(function () {
            updateSidebarBrand();
            return loadData();
          }).then(function () {
            var params = new URLSearchParams(window.location.search);
            var page = params.get('page');
            navigate(page && PAGE_TITLES[page] ? page : 'dashboard');
          });
        }).catch(function (err) {
          showLoginError('Could not load your profile. Contact your administrator.');
          AppDB.signOut();
        });
      } else {
        if (_profileListenerUnsub) { _profileListenerUnsub(); _profileListenerUnsub = null; }
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
    openTask: openTask,
    refreshData: refreshData,
    getState: function () { return state; },
    toast: toast
  };
})();
