var CACHE_NAME = 'caretrack-v8';
var ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './static/css/main.css',
  './static/js/firebase-config.js',
  './static/js/db.js',
  './static/js/push-notifications.js',
  './static/js/permissions.js',
  './static/js/rtdb.js',
  './static/js/app.js',
  './static/js/components/modal.js',
  './static/js/components/report-modal.js',
  './static/js/components/notifications.js',
  './static/js/pages/dashboard.js',
  './static/js/pages/patients.js',
  './static/js/pages/reports.js',
  './static/js/pages/patient-detail.js',
  './static/js/pages/team.js',
  './static/js/pages/family-report.js',
  './static/js/pages/tasks.js',
  './static/js/pages/admin.js',
  './static/js/pages/settings.js',
  './static/icons/icon.svg',
  './static/icons/logo.jpg'
];

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) {
      return cache.addAll(ASSETS);
    }).then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (k) { return k !== CACHE_NAME; }).map(function (k) { return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (e) {
  if (e.request.method !== 'GET') return;
  var url = new URL(e.request.url);
  if (url.origin !== location.origin) return;

  e.respondWith(
    fetch(e.request).then(function (resp) {
      if (resp && resp.status === 200) {
        var clone = resp.clone();
        caches.open(CACHE_NAME).then(function (cache) { cache.put(e.request, clone); });
      }
      return resp;
    }).catch(function () {
      return caches.match(e.request);
    })
  );
});

self.addEventListener('push', function (e) {
  var data = {};
  try {
    if (e.data) data = e.data.json();
  } catch (err) { data = {}; }
  var notif = data.notification || {};
  var d = data.data || {};
  var title = notif.title || d.title || 'CareTrack';
  var body = notif.body || d.body || '';
  var clientId = d.clientId || '';
  var url = clientId ? '/?page=patient-detail&id=' + encodeURIComponent(clientId) : '/';
  e.waitUntil(
    self.registration.showNotification(title, {
      body: body,
      icon: '/static/icons/logo.jpg',
      data: { url: url, clientId: clientId },
      tag: 'caretrack-' + (clientId || 'general'),
      renotify: true
    })
  );
});

self.addEventListener('notificationclick', function (e) {
  e.notification.close();
  var url = (e.notification.data && e.notification.data.url) || '/';
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (clientList) {
      for (var i = 0; i < clientList.length; i++) {
        if (clientList[i].focus) {
          clientList[i].navigate(url);
          return clientList[i].focus();
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(url);
    })
  );
});
