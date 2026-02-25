/**
 * Team Chat page — uses RTDB for real-time messaging.
 * Single listener on the active channel; unread listeners on all channels for badges and auto-switch.
 */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var _inited = false;
  var _channel = 'General Ward';
  var _isUrgent = false;
  var _unread = {};
  var _lastSeenTs = {};
  var _unreadListenersActive = false;
  var _onUnreadChange = null;

  function getUnreadTotal() {
    var t = 0;
    Object.keys(_unread).forEach(function (ch) { t += (_unread[ch] || 0); });
    return t;
  }

  function setUnread(channelName, count) {
    _unread[channelName] = Math.max(0, count || 0);
    if (_onUnreadChange) _onUnreadChange(getUnreadTotal());
  }

  function clearUnread(channelName) {
    setUnread(channelName, 0);
  }

  function isOnCommsPage() {
    return window.CareTrack && (window.CareTrack.getState && window.CareTrack.getState().page) === 'comms';
  }

  function startUnreadListeners() {
    if (!AppChat || !AppChat.ready || _unreadListenersActive) return;
    _unreadListenersActive = true;
    AppChat.subscribeAllChannelsLatest(function (ch, latest) {
      if (!latest || !latest.timestamp) return;
      var prev = _lastSeenTs[ch];
      if (prev === undefined) {
        _lastSeenTs[ch] = latest.timestamp;
        return;
      }
      if (latest.timestamp <= prev) return;
      _lastSeenTs[ch] = latest.timestamp;
      if (ch === _channel && isOnCommsPage()) return;
      setUnread(ch, (_unread[ch] || 0) + 1);
      if (isOnCommsPage()) {
        _channel = ch;
        clearUnread(ch);
        render(window.CareTrack.getState());
      }
    });
  }

  function stopUnreadListeners() {
    if (!AppChat || !AppChat.ready) return;
    AppChat.unsubscribeAll();
    _unreadListenersActive = false;
  }

  function render(state) {
    startUnreadListeners();
    renderChannelList();
    $('chat-header').textContent = _channel;
    subscribeToChannel(state);
  }

  function renderChannelList() {
    var channels = (AppChat && AppChat.CHANNELS) || [];
    $('channel-list').innerHTML = channels.map(function (ch) {
      var n = _unread[ch] || 0;
      var badge = n > 0 ? ' <span class="channel-unread">' + (n > 99 ? '99+' : n) + '</span>' : '';
      return '<div class="channel-item' + (ch === _channel ? ' active' : '') + '" data-ch="' + ch + '">' +
        '<i class="fas fa-hashtag" style="font-size:.75rem;color:var(--text-3)"></i> ' + ch + badge + '</div>';
    }).join('');
    $('channel-list').querySelectorAll('.channel-item').forEach(function (el) {
      el.addEventListener('click', function () {
        _channel = el.getAttribute('data-ch');
        clearUnread(_channel);
        render(window.CareTrack.getState());
      });
    });
  }

  function subscribeToChannel(state) {
    if (!AppChat || !AppChat.ready) {
      $('msg-list').innerHTML = '<div class="empty-state"><i class="fas fa-exclamation-circle"></i><p>Chat unavailable — Realtime Database not configured.</p></div>';
      return;
    }
    var profile = state.profile || {};
    var userId = (state.user || {}).uid || '';

    AppChat.subscribeChannel(_channel, function (msgs) {
      if (msgs.length) {
        var maxTs = 0;
        msgs.forEach(function (m) { if (m.timestamp > maxTs) maxTs = m.timestamp; });
        if (maxTs > (_lastSeenTs[_channel] || 0)) _lastSeenTs[_channel] = maxTs;
      }
      if (!msgs.length) {
        $('msg-list').innerHTML = '<div class="empty-state" style="padding:24px"><i class="fas fa-comments"></i><p>No messages yet. Start the conversation!</p></div>';
        return;
      }
      $('msg-list').innerHTML = msgs.map(function (m) {
        var mine = m.senderId === userId;
        var ts = m.timestamp ? new Date(m.timestamp).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '';
        var urgentCls = m.isUrgent ? ' urgent' : '';
        return '<div class="msg-wrap' + (mine ? ' mine' : '') + '">' +
          '<div class="msg-bubble' + (mine ? ' mine' : ' theirs') + urgentCls + '">' +
            (m.isUrgent ? '<i class="fas fa-exclamation-triangle" style="color:var(--accent);margin-right:4px;font-size:.75rem"></i>' : '') +
            esc(m.text) +
            '<div class="msg-meta">' + esc(m.sender) + ' &middot; ' + ts + '</div>' +
          '</div></div>';
      }).join('');
      var ml = $('msg-list');
      if (ml) ml.scrollTop = ml.scrollHeight;
    });
  }

  function sendMsg() {
    var inp = $('msg-in');
    var text = (inp.value || '').trim();
    if (!text) return;

    var state = window.CareTrack.getState();
    var profile = state.profile || {};
    AppChat.sendMessage(_channel, {
      text: text,
      sender: profile.displayName || (state.user || {}).email || 'Staff',
      senderId: (state.user || {}).uid || '',
      isUrgent: _isUrgent
    }).then(function () {
      inp.value = '';
      if (_isUrgent) {
        _isUrgent = false;
        $('urgent-toggle').classList.remove('active');
      }
    }).catch(function () {
      window.CareTrack.toast('Failed to send message');
    });
  }

  function init() {
    if (_inited) return; _inited = true;
    $('send-msg').addEventListener('click', sendMsg);
    $('msg-in').addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); sendMsg(); }
    });
    $('urgent-toggle').addEventListener('click', function () {
      _isUrgent = !_isUrgent;
      $('urgent-toggle').classList.toggle('active', _isUrgent);
    });
  }

  function destroy() {
    if (AppChat && AppChat.ready) AppChat.unsubscribeChannel(_channel);
  }

  function setOnUnreadChange(cb) { _onUnreadChange = cb; }
  function getUnreadTotalExport() { return getUnreadTotal(); }
  function getUnreadPerChannel() { return Object.assign({}, _unread); }

  function esc(s) { var d = document.createElement('div'); d.textContent = s || ''; return d.innerHTML; }

  window.Pages = window.Pages || {};
  window.Pages.comms = {
    render: render,
    init: init,
    destroy: destroy,
    startUnreadListeners: startUnreadListeners,
    setOnUnreadChange: setOnUnreadChange,
    getUnreadTotal: getUnreadTotalExport,
    getUnreadPerChannel: getUnreadPerChannel
  };
})();
