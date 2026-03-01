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
      var contentEl = $('msg-list-content');
      if (contentEl) contentEl.innerHTML = '<div class="empty-state"><i class="fas fa-exclamation-circle"></i><p>Chat unavailable — Realtime Database not configured.</p></div>';
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
      var contentEl = $('msg-list-content');
      if (!contentEl) return;
      if (!msgs.length) {
        contentEl.innerHTML = '<div class="empty-state" style="padding:24px"><i class="fas fa-comments"></i><p>No messages yet. Start the conversation!</p></div>';
        return;
      }
      var prevDateKey = '';
      var html = '';
      msgs.forEach(function (m) {
        var dateKey = getDateKey(m.timestamp);
        if (dateKey && dateKey !== prevDateKey) {
          html += '<div class="wa-date-sep" data-date="' + esc(dateKey) + '">' + esc(getDateLabel(m.timestamp)) + '</div>';
          prevDateKey = dateKey;
        }
        var mine = m.senderId === userId;
        var ts = m.timestamp ? new Date(m.timestamp).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '';
        var urgentCls = m.isUrgent ? ' urgent' : '';
        var dateAttr = dateKey ? ' data-date="' + esc(dateKey) + '"' : '';
        if (mine) {
          html += '<div class="msg-wrap mine"' + dateAttr + '>' +
            '<div class="msg-bubble mine' + urgentCls + '">' +
              (m.isUrgent ? '<span class="msg-urgent-icon"><i class="fas fa-exclamation-circle"></i></span>' : '') +
              '<span class="msg-text">' + linkify(m.text) + '</span>' +
              '<span class="msg-time">' + ts + '</span>' +
            '</div></div>';
        } else {
          html += '<div class="msg-wrap theirs"' + dateAttr + '>' +
            '<span class="msg-sender">' + esc(m.sender) + '</span>' +
            '<div class="msg-bubble theirs' + urgentCls + '">' +
              (m.isUrgent ? '<span class="msg-urgent-icon"><i class="fas fa-exclamation-circle"></i></span>' : '') +
              '<span class="msg-text">' + linkify(m.text) + '</span>' +
              '<span class="msg-time">' + ts + '</span>' +
            '</div></div>';
        }
      });
      contentEl.innerHTML = html;
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
      if (window.AppPush && AppPush.triggerPush) {
        AppPush.triggerPush({
          type: 'chat_message',
          channel: _channel,
          senderId: (state.user || {}).uid || '',
          sender: profile.displayName || (state.user || {}).email || 'Staff',
          text: text.slice(0, 100)
        });
      }
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
    var list = $('msg-list');
    if (list) {
      list.addEventListener('scroll', function () {
        updateDatePopupOnScroll();
      }, { passive: true });
    }
  }

  function destroy() {
    if (AppChat && AppChat.ready) AppChat.unsubscribeChannel(_channel);
  }

  function setOnUnreadChange(cb) { _onUnreadChange = cb; }
  function getUnreadTotalExport() { return getUnreadTotal(); }
  function getUnreadPerChannel() { return Object.assign({}, _unread); }

  function esc(s) { var d = document.createElement('div'); d.textContent = s || ''; return d.innerHTML; }

  /** Date label for separators: "Today", "Yesterday", or "23 Feb 2026". */
  function getDateLabel(timestamp) {
    if (!timestamp) return '';
    var d = new Date(timestamp);
    if (isNaN(d.getTime())) return '';
    var today = new Date();
    today.setHours(0, 0, 0, 0);
    var day = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    var diff = Math.floor((today - day) / (24 * 60 * 60 * 1000));
    if (diff === 0) return 'Today';
    if (diff === 1) return 'Yesterday';
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  function getDateKey(timestamp) {
    if (!timestamp) return '';
    var d = new Date(timestamp);
    return isNaN(d.getTime()) ? '' : d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  function getDateLabelFromKey(dateKey) {
    if (!dateKey) return '';
    var parts = dateKey.split('-');
    if (parts.length !== 3) return dateKey;
    var d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
    return getDateLabel(d.getTime());
  }

  var _datePopupHideTimer = null;

  function updateDatePopupOnScroll() {
    var list = $('msg-list');
    var popup = $('wa-date-popup');
    var content = $('msg-list-content');
    if (!list || !popup || !content) return;
    var scrollTop = list.scrollTop;
    var viewTop = scrollTop + 50;
    var dateEls = content.querySelectorAll('.wa-date-sep, .msg-wrap[data-date]');
    var currentLabel = '';
    for (var i = 0; i < dateEls.length; i++) {
      var el = dateEls[i];
      var top = el.offsetTop;
      if (top <= viewTop) {
        var key = el.getAttribute('data-date');
        if (key) currentLabel = getDateLabelFromKey(key);
      }
    }
    if (currentLabel) {
      popup.textContent = currentLabel;
      popup.removeAttribute('aria-hidden');
      popup.removeAttribute('hidden');
      popup.classList.add('visible');
      if (_datePopupHideTimer) clearTimeout(_datePopupHideTimer);
      _datePopupHideTimer = setTimeout(function () {
        popup.classList.remove('visible');
        popup.setAttribute('aria-hidden', 'true');
        popup.setAttribute('hidden', '');
        _datePopupHideTimer = null;
      }, 1500);
    }
  }

  /** Turn plain text into HTML with URLs as clickable links (escaped for XSS safety). */
  function linkify(s) {
    if (s == null || s === '') return '';
    var str = String(s);
    var urlRegex = /(https?:\/\/[^\s<>"']+)/gi;
    var parts = str.split(urlRegex);
    return parts.map(function (p) {
      if (p && /^https?:\/\//i.test(p)) {
        return '<a href="' + esc(p) + '" target="_blank" rel="noopener noreferrer" class="msg-link">' + esc(p) + '</a>';
      }
      return esc(p);
    }).join('');
  }

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
