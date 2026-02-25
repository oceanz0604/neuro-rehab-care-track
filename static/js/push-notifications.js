/**
 * Push notifications — request permission, get FCM token, save to Firestore.
 * Assigned doctors are notified via PUSH_API_URL (Vercel etc.) when their patients get new reports/diagnoses.
 * Exposes window.AppPush
 */
(function () {
  'use strict';

  function isSupported() {
    return typeof firebase !== 'undefined' &&
      firebase.messaging &&
      typeof FIREBASE_CONFIG !== 'undefined' &&
      FIREBASE_CONFIG.messagingSenderId &&
      typeof FCM_VAPID_KEY === 'string' &&
      FCM_VAPID_KEY.length > 0;
  }

  function init(user) {
    if (!user || !user.uid || !AppDB || !AppDB.saveFcmToken) return Promise.resolve();
    if (!isSupported()) return Promise.resolve();
    if (!('serviceWorker' in navigator)) return Promise.resolve();

    var messaging = firebase.messaging();
    function getTokenWithRetry(retries) {
      retries = retries || 0;
      return messaging.getToken({ vapidKey: FCM_VAPID_KEY }).catch(function (err) {
        var retryable = /no active Service Worker|Subscription failed|failed-service-worker-registration/i.test(err.message || '');
        if (retryable && retries < 2) {
          return new Promise(function (r) { setTimeout(r, 600); }).then(function () {
            return getTokenWithRetry(retries + 1);
          });
        }
        throw err;
      });
    }

    return getTokenWithRetry().then(function (token) {
      return AppDB.saveFcmToken(user.uid, token);
    }).catch(function (err) {
      if (err.code === 'messaging/permission-blocked') return;
      console.warn('Push token error:', err.message || err);
    });
  }

  /** Call push API after report or diagnosis save (no Blaze required). Payload: { clientId, type, ... } */
  function triggerPush(payload) {
    var url = typeof PUSH_API_URL === 'string' ? PUSH_API_URL.trim() : '';
    if (!url || !payload || !payload.clientId || !payload.type) return;
    var user = typeof firebase !== 'undefined' && firebase.auth && firebase.auth().currentUser;
    if (!user) return;
    user.getIdToken().then(function (token) {
      fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
        body: JSON.stringify(payload)
      })
        .then(function (res) { return res.json().then(function (data) { return { ok: res.ok, status: res.status, data: data }; }); })
        .then(function (r) {
          if (!r.ok && console && console.warn) console.warn('Push API:', r.status, r.data);
          if (r.ok && r.data && r.data.sent === 0 && r.data.reason === 'no_tokens' && console && console.info) console.info('Push: no assignees with notifications enabled');
        })
        .catch(function (err) { if (console && console.warn) console.warn('Push API request failed', err); });
    }).catch(function () {});
  }

  window.AppPush = {
    isSupported: isSupported,
    init: init,
    triggerPush: triggerPush
  };
})();
