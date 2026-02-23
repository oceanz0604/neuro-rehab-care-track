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

  /** Rebuild notification list; for psychiatrists also fetch risk escalations. */
  function refresh(clients, state) {
    _items = [];
    var now = Date.now();
    var day = 24 * 60 * 60 * 1000;
    var profile = (state && state.profile) || {};
    var role = (profile.role || '').toLowerCase();

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

    if (role === 'psychiatrist' && window.AppDB && window.AppDB.getUnacknowledgedEscalations) {
      window.AppDB.getUnacknowledgedEscalations().then(function (list) {
        (list || []).forEach(function (e) {
          _items.push({
            type: 'escalation',
            title: 'Risk escalation: ' + (e.clientName || 'Patient'),
            sub: 'Requested by ' + (e.requestedByName || 'Staff'),
            id: e.clientId,
            escalationId: e.id,
            page: 'patient-detail'
          });
        });
        updateBadge();
      }).catch(function () { updateBadge(); });
    }

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
      var icon = n.type === 'risk' ? 'fa-triangle-exclamation' : (n.type === 'escalation' ? 'fa-bell' : 'fa-bell');
      var cls  = n.type === 'risk' ? 'notif-risk' : (n.type === 'escalation' ? 'notif-escalation' : 'notif-urgent');
      var ack = n.type === 'escalation' && n.escalationId
        ? '<button type="button" class="btn btn-sm notif-ack" data-escalation-id="' + n.escalationId + '">Acknowledge</button>'
        : '';
      return '<div class="notif-item ' + cls + '" data-page="' + (n.page || '') + '" data-id="' + (n.id || '') + '">' +
        '<i class="fas ' + icon + '"></i>' +
        '<div style="flex:1"><div class="notif-title">' + n.title + '</div><div class="notif-sub">' + n.sub + '</div></div>' +
        ack +
      '</div>';
    }).join('');

    _panel.querySelectorAll('.notif-ack').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        var id = btn.getAttribute('data-escalation-id');
        if (!id || !window.AppDB || !window.AppDB.acknowledgeEscalation) return;
        btn.disabled = true;
        window.AppDB.acknowledgeEscalation(id).then(function () {
          if (window.CareTrack) window.CareTrack.refreshData();
        }).catch(function () { btn.disabled = false; });
      });
    });
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
