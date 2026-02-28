/**
 * Patient detail standalone page (patient.html).
 * Provides CareTrack stub and boots patient-detail from URL ?id=xxx.
 */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var state = { user: null, profile: null, clients: [], config: {}, selectedClient: null, selectedClientData: null };

  function getState() { return state; }
  function toast(msg) {
    var el = $('toast'); if (!el) return;
    el.textContent = msg;
    el.setAttribute('data-show', 'true');
    setTimeout(function () { el.setAttribute('data-show', 'false'); }, 3000);
  }
  function getBaseUrl() {
    if (typeof location === 'undefined') return '';
    var path = location.pathname || '';
    return location.origin + path.replace(/\/[^/]*$/, '/');
  }
  function navigate(page) {
    if (page === 'patients' || page === 'dashboard') window.location.href = getBaseUrl() + 'index.html?page=' + (page || 'patients');
    else window.location.href = getBaseUrl() + 'index.html';
  }
  function openPatient(id) {
    if (id) window.location.href = getBaseUrl() + 'patient.html?id=' + encodeURIComponent(id);
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
    goBack: goBack,
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
    var fallback = getBaseUrl() + 'index.html?page=' + (fallbackPage || 'patients');
    var fromOurApp = document.referrer && document.referrer.indexOf(window.location.origin) === 0;
    if (fromOurApp && window.history.length > 1) {
      window.history.back();
    } else {
      window.location.href = fallback;
    }
  }

  function run() {
    if (!window.AppDB || !AppDB.ready) {
      window.location.href = getBaseUrl() + 'index.html';
      return;
    }
    var params = new URLSearchParams(window.location.search);
    var id = params.get('id');
    if (!id) {
      window.location.href = getBaseUrl() + 'index.html?page=patients';
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
        else window.location.href = getBaseUrl() + 'index.html';
      }, 600);
    });
  }

  function loadConfig() {
    var defaults = (window.Pages && window.Pages.settings && window.Pages.settings.DEFAULTS) || {};
    var icd11Diagnosis = (window.Pages && window.Pages.settings && window.Pages.settings.ICD11_DIAGNOSIS_OPTIONS) || [];
    var configPromise = AppDB.getOrgConfig ? AppDB.getOrgConfig() : Promise.resolve({});
    return configPromise.then(function (cfg) {
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
      if (defaults.diagnosisOptions) state.config.diagnosisOptions = defaults.diagnosisOptions.slice();
    });
  }

  function loadPatient(user, id) {
    state.user = user;
    Promise.all([
      loadConfig(),
      AppDB.getUserProfile(user.uid),
      AppDB.getClient(id)
    ]).then(function (results) {
      state.profile = results[1] || {};
      var client = results[2];
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
      if (fab) fab.style.display = 'none'; /* Add Report is now a tab, same as web */
    }).catch(function (err) {
      toast(err && err.message ? err.message : 'Failed to load');
      window.location.href = getBaseUrl() + 'index.html?page=patients';
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run);
  else run();
})();
