/* Firebase Cloud Messaging — background push handler. Uses same config as main app. */
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');

// Config must match js/firebase-config.js (copy here for SW context; cannot load external script in some environments)
var firebaseConfig = {
  apiKey: "AIzaSyDkfOC2jlFKn22htsuYaRQNQA0oZ0mdNBo",
  authDomain: "neuro-rehab-care-track-44b6a.firebaseapp.com",
  projectId: "neuro-rehab-care-track-44b6a",
  storageBucket: "neuro-rehab-care-track-44b6a.firebasestorage.app",
  messagingSenderId: "68762297273",
  appId: "1:68762297273:web:05ee98834f4d6adf968c68"
};
firebase.initializeApp(firebaseConfig);
var messaging = firebase.messaging();

messaging.onBackgroundMessage(function (payload) {
  var data = payload.data || {};
  var title = data.title || 'CareTrack';
  var body = data.body || '';
  var clientId = data.clientId || '';
  var url = clientId ? '/?page=patient-detail&id=' + encodeURIComponent(clientId) : '/';
  return self.registration.showNotification(title, {
    body: body,
    icon: '/icons/logo.jpg',
    data: { url: url, clientId: clientId },
    tag: data.tag || 'caretrack-' + (clientId || 'general'),
    renotify: true
  });
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
