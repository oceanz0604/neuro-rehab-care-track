/**
 * NeuroRehab CareTrack — notification bell (derived from cached data, no listener).
 * Exposes window.AppNotify
 */
(function () {
  'use strict';

  var _items = [];
  var _panel = null;
  var _badge = null;

  function init() {
    _panel = document.getElementById('notif-panel');
    _badge = document.getElementById('notif-badge');
  }

  /** Rebuild notification list from existing data (no extra Firestore reads). */
  function refresh(clients) {
    _items = [];
    var now = Date.now();
    var day = 24 * 60 * 60 * 1000;

    (clients || []).forEach(function (c) {
      if (c.status === 'active' && c.currentRisk === 'high') {
        _items.push({
          type: 'risk',
          title: 'High Risk: ' + (c.name || 'Unknown'),
          sub: 'Current risk level is HIGH',
          id: c.id,
          page: 'patient-detail'
        });
      }
    });

    if (AppChat && AppChat.ready) {
      AppChat.getUrgentMessages(now - day).then(function (msgs) {
        msgs.forEach(function (m) {
          _items.push({
            type: 'urgent',
            title: 'Urgent: ' + (m.sender || 'Staff'),
            sub: (m.text || '').slice(0, 80),
            id: null,
            page: 'comms'
          });
        });
        updateBadge();
      });
    }

    updateBadge();
  }

  function updateBadge() {
    if (!_badge) return;
    if (_items.length > 0) {
      _badge.textContent = _items.length > 9 ? '9+' : _items.length;
      _badge.classList.add('visible');
    } else {
      _badge.classList.remove('visible');
    }
  }

  function renderPanel() {
    if (!_panel) return;
    if (!_items.length) {
      _panel.innerHTML = '<div class="notif-empty">No notifications</div>';
      return;
    }
    _panel.innerHTML = _items.map(function (n) {
      var icon = n.type === 'risk' ? 'fa-triangle-exclamation' : 'fa-bell';
      var cls  = n.type === 'risk' ? 'notif-risk' : 'notif-urgent';
      return '<div class="notif-item ' + cls + '" data-page="' + (n.page || '') + '" data-id="' + (n.id || '') + '">' +
        '<i class="fas ' + icon + '"></i>' +
        '<div><div class="notif-title">' + n.title + '</div><div class="notif-sub">' + n.sub + '</div></div>' +
      '</div>';
    }).join('');
  }

  function togglePanel() {
    if (!_panel) return;
    var vis = _panel.classList.toggle('visible');
    if (vis) renderPanel();
  }

  function getItems() { return _items; }

  window.AppNotify = {
    init: init,
    refresh: refresh,
    togglePanel: togglePanel,
    getItems: getItems
  };
})();
