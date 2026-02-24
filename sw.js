var CACHE_NAME = 'caretrack-v4';
var ASSETS = [
  './',
  './index.html',
  './css/main.css',
  './js/firebase-config.js',
  './js/db.js',
  './js/permissions.js',
  './js/rtdb.js',
  './js/app.js',
  './js/components/modal.js',
  './js/components/report-modal.js',
  './js/components/notifications.js',
  './js/pages/dashboard.js',
  './js/pages/patients.js',
  './js/pages/reports.js',
  './js/pages/patient-detail.js',
  './js/pages/team.js',
  './js/pages/family-report.js',
  './js/pages/tasks.js',
  './js/pages/admin.js',
  './js/pages/settings.js',
  './manifest.json',
  './icons/icon.svg',
  './icons/logo.jpg'
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
