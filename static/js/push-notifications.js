/**
 * Push notifications — request permission, get FCM token, save to Firestore.
 * Assigned doctors are notified via PUSH_API_URL (Vercel etc.) when their patients get new reports/diagnoses.
 * Exposes window.AppPush
 */
(function () {
  'use strict';

  /** Set to true to disable sending notifications (e.g. for local testing). Revert to false for production. */
  var PUSH_DISABLED = false;

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
    if (!('serviceWorker' in navigator) || !('Notification' in window)) return Promise.resolve();

    var messaging = firebase.messaging();
    function requestPermission() {
      if (Notification.permission === 'granted') return Promise.resolve();
      if (Notification.permission === 'denied') return Promise.reject({ code: 'messaging/permission-blocked' });
      return Notification.requestPermission().then(function (p) {
        if (p !== 'granted') return Promise.reject({ code: 'messaging/permission-blocked' });
      });
    }
    function getRegistration() {
      return navigator.serviceWorker.register('/firebase-messaging-sw.js', { scope: '/' })
        .then(function (reg) { return reg.ready; });
    }
    function getTokenWithRetry(registration, retries) {
      retries = retries || 0;
      return messaging.getToken({
        vapidKey: FCM_VAPID_KEY,
        serviceWorkerRegistration: registration
      }).catch(function (err) {
        var retryable = /no active Service Worker|Subscription failed|failed-service-worker-registration|push service error/i.test(err.message || '');
        if (retryable && retries < 3) {
          var delay = 800 * (retries + 1);
          return new Promise(function (r) { setTimeout(r, delay); }).then(function () {
            return getTokenWithRetry(registration, retries + 1);
          });
        }
        throw err;
      });
    }

    return requestPermission()
      .then(getRegistration)
      .then(function (registration) {
        return getTokenWithRetry(registration);
      })
      .then(function (token) {
        return AppDB.saveFcmToken(user.uid, token);
      })
      .catch(function (err) {
        if (err.code === 'messaging/permission-blocked') return;
        console.warn('Push token error:', err.message || err);
      });
  }

  /** Call push API. Payload: { type, ... } with clientId (patient), taskId (task), or type:'chat_message'+channel (chat). */
  function triggerPush(payload) {
    if (PUSH_DISABLED) return;
    var url = typeof PUSH_API_URL === 'string' ? PUSH_API_URL.trim() : '';
    if (!url || !payload || !payload.type) return;
    var hasTarget = payload.clientId || payload.taskId || (payload.type === 'chat_message' && payload.channel);
    if (!hasTarget) return;
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
          if (r.ok && r.data) {
            if (r.data.sent > 0 && console && console.info) console.info('Push: notifications sent to', r.data.sent, 'assignee(s). (You won\'t receive one for reports you submit—only other assignees do.)');
            if (r.data.sent === 0 && r.data.reason === 'no_tokens' && console && console.info) {
              var d = r.data;
              var msg = 'Push: ' + (d.assignedCount || 0) + ' assignee(s) on patient';
              if (d.resolvedCount != null) msg += ', ' + d.resolvedCount + ' in staff list';
              msg += ', none with notifications enabled yet. Report was saved.';
              if (d.hint) msg += ' ' + d.hint;
              console.info(msg);
            }
          }
        })
        .catch(function (err) { if (console && console.warn) console.warn('Push API request failed', err); });
    }).catch(function () {});
  }

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.addEventListener('message', function (e) {
      if (e.data && e.data.type === 'caretrack-push-received' && console && console.info) {
        var d = e.data;
        console.info('Push notification received:', d.title || '', d.clientId ? '(patient ' + d.clientId + ')' : '');
      }
    });
  }

  window.AppPush = {
    isSupported: isSupported,
    init: init,
    triggerPush: triggerPush
  };
})();
