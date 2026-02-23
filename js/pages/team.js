/**
 * Team Chat page — uses RTDB for real-time messaging.
 * Single listener on the active channel; detached on page leave.
 */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var _inited = false;
  var _channel = 'General Ward';
  var _isUrgent = false;

  function render(state) {
    renderChannelList();
    $('chat-header').textContent = _channel;
    subscribeToChannel(state);
  }

  function renderChannelList() {
    var channels = (AppChat && AppChat.CHANNELS) || [];
    $('channel-list').innerHTML = channels.map(function (ch) {
      return '<div class="channel-item' + (ch === _channel ? ' active' : '') + '" data-ch="' + ch + '">' +
        '<i class="fas fa-hashtag" style="font-size:.75rem;color:var(--text-3)"></i> ' + ch + '</div>';
    }).join('');
    $('channel-list').querySelectorAll('.channel-item').forEach(function (el) {
      el.addEventListener('click', function () {
        _channel = el.getAttribute('data-ch');
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
    if (AppChat && AppChat.ready) AppChat.unsubscribeAll();
  }

  function esc(s) { var d = document.createElement('div'); d.textContent = s || ''; return d.innerHTML; }

  window.Pages = window.Pages || {};
  window.Pages.comms = { render: render, init: init, destroy: destroy };
})();
