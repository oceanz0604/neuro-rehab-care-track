/**
 * Patient detail standalone page (patient.html).
 * Provides CareTrack stub and boots patient-detail from URL ?id=xxx.
 */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var state = { user: null, profile: null, clients: [], selectedClient: null, selectedClientData: null };

  function getState() { return state; }
  function toast(msg) {
    var el = $('toast'); if (!el) return;
    el.textContent = msg;
    el.setAttribute('data-show', 'true');
    setTimeout(function () { el.setAttribute('data-show', 'false'); }, 3000);
  }
  function navigate(page) {
    if (page === 'patients' || page === 'dashboard') window.location.href = '/index.html?page=' + (page || 'patients');
    else window.location.href = '/index.html';
  }
  function openPatient(id) {
    if (id) window.location.href = '/patient.html?id=' + encodeURIComponent(id);
  }
  function refreshData() {
    if (state.selectedClient && window.Pages && window.Pages.patientDetail) {
      window.AppDB.getClient(state.selectedClient).then(function (c) {
        state.selectedClientData = c;
        if (c && window.Pages.patientDetail.render) window.Pages.patientDetail.render(state);
      });
    }
  }

  window.CareTrack = {
    getState: getState,
    toast: toast,
    navigate: navigate,
    openPatient: openPatient,
    refreshData: refreshData
  };

  function hideLoading() {
    var el = $('loading-screen');
    if (el) el.classList.add('hidden');
  }

  function showApp() {
    $('patient-app').removeAttribute('hidden');
    hideLoading();
  }

  function goBack(fallbackPage) {
    var fallback = '/index.html?page=' + (fallbackPage || 'patients');
    var fromOurApp = document.referrer && document.referrer.indexOf(window.location.origin) === 0;
    if (fromOurApp && window.history.length > 1) {
      window.history.back();
    } else {
      window.location.href = fallback;
    }
  }

  function run() {
    var backBtn = document.getElementById('topbar-back');
    if (backBtn) backBtn.addEventListener('click', function (e) { e.preventDefault(); goBack('patients'); });
    if (!window.AppDB || !AppDB.ready) {
      window.location.href = '/index.html';
      return;
    }
    var params = new URLSearchParams(window.location.search);
    var id = params.get('id');
    if (!id) {
      window.location.href = '/index.html?page=patients';
      return;
    }
    // Wait for auth state to be restored (Firebase is async) before redirecting
    var resolved = false;
    var unsub = AppDB.onAuthStateChanged && AppDB.onAuthStateChanged(function (user) {
      if (user) {
        if (resolved) return;
        resolved = true;
        unsub && typeof unsub === 'function' && unsub();
        loadPatient(user, id);
        return;
      }
      // First event may be null before persistence restores; wait once then decide
      setTimeout(function () {
        if (resolved) return;
        resolved = true;
        unsub && typeof unsub === 'function' && unsub();
        var u = AppDB.getCurrentUser && AppDB.getCurrentUser();
        if (u) loadPatient(u, id);
        else window.location.href = '/index.html';
      }, 600);
    });
  }

  function loadPatient(user, id) {
    state.user = user;
    Promise.all([
      AppDB.getUserProfile(user.uid),
      AppDB.getClient(id)
    ]).then(function (results) {
      state.profile = results[0] || {};
      var client = results[1];
      if (!client) {
        toast('Patient not found');
        state.selectedClient = id;
        state.selectedClientData = null;
      } else {
        state.selectedClient = id;
        state.selectedClientData = client;
      }
      state.page = 'patient-detail';
      showApp();
      if (window.Pages && window.Pages.patientDetail) {
        Pages.patientDetail.render(state);
        Pages.patientDetail.init(state);
      }
      if (client && client.name) {
        document.title = client.name + ' — Maitra Wellness';
        var bcName = document.getElementById('tb-bc-name');
        if (bcName) bcName.textContent = client.name;
      }
      var fab = document.getElementById('mobile-fab-report');
      if (fab && client && client.status !== 'discharged') {
        fab.addEventListener('click', function () {
          var addBtn = document.getElementById('pd-add-report-btn');
          if (addBtn) addBtn.click();
        });
      } else if (fab) {
        fab.style.display = 'none';
      }
    }).catch(function (err) {
      toast(err && err.message ? err.message : 'Failed to load');
      window.location.href = '/index.html?page=patients';
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run);
  else run();
})();
