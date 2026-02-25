'use strict';

const script = `/* FCM default service worker — required by Firebase SDK. Handles push only; app cache uses sw.js */
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
`;

module.exports = (req, res) => {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).end();
  }
  res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');
  res.status(200).send(script);
};
