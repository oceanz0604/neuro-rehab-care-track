var CACHE = 'caretrack-v1';
var ASSETS = [
  './',
  './index.html',
  './css/main.css',
  './js/app.js',
  './js/db.js',
  './js/firebase-config.js',
  './manifest.json',
  './icons/icon.svg'
];

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(CACHE).then(function (cache) {
      return cache.addAll(ASSETS);
    }).then(function () {
      return self.skipWaiting();
    })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(
        keys.filter(function (k) { return k !== CACHE; })
            .map(function (k) { return caches.delete(k); })
      );
    }).then(function () {
      return self.clients.claim();
    })
  );
});

self.addEventListener('fetch', function (e) {
  var url = new URL(e.request.url);

  if (url.origin !== location.origin) {
    e.respondWith(
      fetch(e.request).catch(function () {
        return caches.match(e.request);
      })
    );
    return;
  }

  e.respondWith(
    caches.match(e.request).then(function (cached) {
      var fetched = fetch(e.request).then(function (response) {
        if (response && response.status === 200) {
          var copy = response.clone();
          caches.open(CACHE).then(function (cache) { cache.put(e.request, copy); });
        }
        return response;
      }).catch(function () { return cached; });
      return cached || fetched;
    })
  );
});
