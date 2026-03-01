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
  var _staffCache = [];
  var _taskCache = [];
  var _mentionActiveIndex = 0;
  var _mentionItems = [];

  function loadStaffForMentions() {
    if (_staffCache.length > 0) return Promise.resolve(_staffCache);
    if (!window.AppDB || typeof window.AppDB.getAllStaff !== 'function') return Promise.resolve([]);
    return window.AppDB.getAllStaff().then(function (list) {
      _staffCache = list || [];
      return _staffCache;
    }).catch(function () { return []; });
  }

  function loadTasksForMentions() {
    if (_taskCache.length > 0) return Promise.resolve(_taskCache);
    if (!window.AppDB || typeof window.AppDB.getTasks !== 'function') return Promise.resolve([]);
    return window.AppDB.getTasks().then(function (list) {
      _taskCache = list || [];
      return _taskCache;
    }).catch(function () { return []; });
  }

  function shortTaskLabel(title) {
    var t = (title || '').trim();
    if (!t) return 'Task…';
    var words = t.split(/\s+/).slice(0, 4);
    var short = words.join(' ');
    return short.length < t.length ? short + '…' : short;
  }

  function getClientForTask(task, clients) {
    if (!task || !task.clientId || !clients || !clients.length) return null;
    return clients.filter(function (c) { return c.id === task.clientId; })[0] || null;
  }

  function getVisibleTasksForMentions(tasks, profile, clients) {
    if (!window.Permissions || !window.Permissions.canViewTask) return tasks || [];
    if (!profile) return [];
    return (tasks || []).filter(function (t) {
      var client = getClientForTask(t, clients);
      return window.Permissions.canViewTask(profile, t, client);
    });
  }

  function getMentionQuery(value, cursorPos) {
    if (cursorPos <= 0 || !value) return null;
    var before = value.slice(0, cursorPos);
    var lastAt = before.lastIndexOf('@');
    if (lastAt === -1) return null;
    var afterAt = before.slice(lastAt + 1);
    if (/[\s]/.test(afterAt)) return null;
    return { query: afterAt, start: lastAt, end: cursorPos };
  }

  function showMentionList(items, queryStart, queryEnd) {
    var listEl = $('chat-mention-list');
    var inp = $('msg-in');
    if (!listEl || !inp) return;
    _mentionItems = items;
    _mentionActiveIndex = 0;
    if (!items.length) {
      listEl.setAttribute('hidden', '');
      listEl.innerHTML = '';
      return;
    }
    listEl.innerHTML = items.map(function (item, i) {
      var icon = item.type === 'patient' ? 'fa-user' : item.type === 'task' ? 'fa-list-check' : 'fa-user-tag';
      var meta = item.type === 'patient' ? 'Patient' : item.type === 'task' ? 'Task' : (item.role || 'Staff');
      var cls = 'chat-mention-item' + (i === 0 ? ' chat-mention-active' : '');
      return '<div class="' + cls + '" role="option" data-index="' + i + '" data-display="' + esc(item.display) + '">' +
        '<i class="fas ' + icon + '"></i><span>' + esc(item.display) + '</span><span class="chat-mention-meta">' + esc(meta) + '</span></div>';
    }).join('');
    listEl.removeAttribute('hidden');
    listEl.querySelectorAll('.chat-mention-item').forEach(function (el) {
      el.addEventListener('mousedown', function (e) {
        e.preventDefault();
        var idx = parseInt(el.getAttribute('data-index'), 10);
        selectMention(idx);
      });
    });
  }

  var MENTION_MARKER = '\u200B'; // zero-width space: wrap inserted segment so we know it's a mention
  var TASK_INNER = '\u200C';     // zero-width non-joiner: wraps encoded task id (must not appear inside encoded id)
  var ZW_NO_TASK = ['\u200B', '\u200D', '\uFEFF']; // only these 3 for encoding so regex [^TASK_INNER]+ matches full id

  function encodeTaskId(id) {
    if (!id) return '';
    var s = '';
    for (var i = 0; i < id.length; i++) {
      var c = id.charCodeAt(i);
      var i0 = c % 3;
      var i1 = Math.floor(c / 3) % 3;
      var i2 = Math.floor(c / 9) % 3;
      var i3 = Math.floor(c / 27) % 3;
      var i4 = Math.floor(c / 81) % 3;
      s += ZW_NO_TASK[i0] + ZW_NO_TASK[i1] + ZW_NO_TASK[i2] + ZW_NO_TASK[i3] + ZW_NO_TASK[i4];
    }
    return s;
  }
  function decodeTaskId(encoded) {
    if (!encoded || encoded.length % 5 !== 0) return '';
    var map = {}; ZW_NO_TASK.forEach(function (z, i) { map[z] = i; });
    var id = '';
    for (var i = 0; i < encoded.length; i += 5) {
      var a = map[encoded[i]], b = map[encoded[i + 1]], c = map[encoded[i + 2]], d = map[encoded[i + 3]], e = map[encoded[i + 4]];
      if (a === undefined || b === undefined || c === undefined || d === undefined || e === undefined) return '';
      id += String.fromCharCode(a + b * 3 + c * 9 + d * 27 + e * 81);
    }
    return id;
  }

  function selectMention(index) {
    var listEl = $('chat-mention-list');
    var inp = $('msg-in');
    if (!inp || !listEl || index < 0 || index >= _mentionItems.length) return;
    var item = _mentionItems[index];
    var mention = getMentionQuery(inp.value, inp.selectionStart || inp.value.length);
    if (!mention) { hideMentionList(); return; }
    var before = inp.value.slice(0, mention.start);
    var after = inp.value.slice(mention.end);
    var insert = item.type === 'task'
      ? MENTION_MARKER + TASK_INNER + encodeTaskId(item.id || '') + TASK_INNER + (item.display || '') + MENTION_MARKER + ' '
      : MENTION_MARKER + item.display + MENTION_MARKER + ' ';
    inp.value = before + insert + after;
    inp.selectionStart = inp.selectionEnd = before.length + insert.length;
    inp.focus();
    hideMentionList();
  }

  function hideMentionList() {
    var listEl = $('chat-mention-list');
    if (listEl) {
      listEl.setAttribute('hidden', '');
      listEl.innerHTML = '';
    }
    _mentionItems = [];
  }

  function updateMentionListFromInput() {
    var inp = $('msg-in');
    if (!inp) return;
    var val = inp.value;
    var cursor = inp.selectionStart != null ? inp.selectionStart : val.length;
    var mention = getMentionQuery(val, cursor);
    if (!mention) {
      hideMentionList();
      return;
    }
    var q = (mention.query || '').toLowerCase().trim();
    var state = window.CareTrack && window.CareTrack.getState ? window.CareTrack.getState() : {};
    var patients = (state.clients || []).filter(function (c) {
      return c.status !== 'discharged' && (c.name || '').toLowerCase().indexOf(q) !== -1;
    }).slice(0, 10).map(function (c) {
      return { type: 'patient', id: c.id, display: c.name || 'Unknown', name: c.name };
    });
    var staff = _staffCache.filter(function (s) {
      var name = (s.displayName || s.email || '').toLowerCase();
      var email = (s.email || '').toLowerCase();
      return name.indexOf(q) !== -1 || email.indexOf(q) !== -1;
    }).slice(0, 10).map(function (s) {
      return { type: 'user', id: s.uid, display: s.displayName || s.email || 'Staff', role: s.role };
    });
    var profile = state.profile || {};
    var clients = state.clients || [];
    var visibleTasks = getVisibleTasksForMentions(_taskCache, profile, clients);
    var tasks = visibleTasks.filter(function (t) {
      return ((t.title || '').toLowerCase().indexOf(q) !== -1);
    }).slice(0, 8).map(function (t) {
      return { type: 'task', id: t.id, display: shortTaskLabel(t.title), title: t.title };
    });
    var combined = [];
    patients.forEach(function (p) { combined.push(p); });
    staff.forEach(function (s) { combined.push(s); });
    tasks.forEach(function (t) { combined.push(t); });
    showMentionList(combined.slice(0, 15), mention.start, mention.end);
  }

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
              '<span class="msg-text">' + linkify(m.text, m.mentions) + '</span>' +
              '<span class="msg-time">' + ts + '</span>' +
            '</div></div>';
        } else {
          html += '<div class="msg-wrap theirs"' + dateAttr + '>' +
            '<span class="msg-sender">' + esc(m.sender) + '</span>' +
            '<div class="msg-bubble theirs' + urgentCls + '">' +
              (m.isUrgent ? '<span class="msg-urgent-icon"><i class="fas fa-exclamation-circle"></i></span>' : '') +
              '<span class="msg-text">' + linkify(m.text, m.mentions) + '</span>' +
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
    var raw = (inp.value || '').trim();
    if (!raw) return;

    var state = window.CareTrack.getState();
    var profile = state.profile || {};
    var clients = state.clients || [];
    var mentions = [];
    var taskRegex = new RegExp(MENTION_MARKER + TASK_INNER + '([^' + TASK_INNER + ']+)' + TASK_INNER + '([^' + MENTION_MARKER + ']*)' + MENTION_MARKER, 'g');
    var text = raw.replace(taskRegex, function (match, encodedId, label) {
      var safeLabel = (label != null ? String(label) : '').trim() || 'Task…';
      var taskId = decodeTaskId(encodedId);
      if (taskId) mentions.push({ type: 'task', id: taskId, name: safeLabel });
      return '@' + safeLabel;
    });
    var personRegex = new RegExp(MENTION_MARKER + '([^' + MENTION_MARKER + ']+)' + MENTION_MARKER, 'g');
    text = text.replace(personRegex, function (match, name) {
      name = (name || '').trim();
      if (name) {
        var patient = clients.filter(function (c) { return (c.name || '').trim() === name; })[0];
        var staff = _staffCache.filter(function (s) { return ((s.displayName || s.email || '').trim() === name); })[0];
        if (patient) mentions.push({ type: 'patient', id: patient.id, name: name });
        else if (staff) mentions.push({ type: 'user', id: staff.uid, name: name });
      }
      return name ? '@' + name : match;
    });

    AppChat.sendMessage(_channel, {
      text: text,
      sender: profile.displayName || (state.user || {}).email || 'Staff',
      senderId: (state.user || {}).uid || '',
      isUrgent: _isUrgent,
      mentions: mentions.length ? mentions : undefined
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
    loadStaffForMentions();
    loadTasksForMentions();
    $('send-msg').addEventListener('click', sendMsg);
    var inp = $('msg-in');
    inp.addEventListener('keydown', function (e) {
      var listEl = $('chat-mention-list');
      var listVisible = listEl && !listEl.hasAttribute('hidden') && _mentionItems.length > 0;
      if (listVisible) {
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          _mentionActiveIndex = (_mentionActiveIndex + 1) % _mentionItems.length;
          listEl.querySelectorAll('.chat-mention-item').forEach(function (el, i) {
            el.classList.toggle('chat-mention-active', i === _mentionActiveIndex);
          });
          return;
        }
        if (e.key === 'ArrowUp') {
          e.preventDefault();
          _mentionActiveIndex = _mentionActiveIndex <= 0 ? _mentionItems.length - 1 : _mentionActiveIndex - 1;
          listEl.querySelectorAll('.chat-mention-item').forEach(function (el, i) {
            el.classList.toggle('chat-mention-active', i === _mentionActiveIndex);
          });
          return;
        }
        if (e.key === 'Enter') {
          e.preventDefault();
          selectMention(_mentionActiveIndex);
          return;
        }
        if (e.key === 'Escape') {
          e.preventDefault();
          hideMentionList();
          return;
        }
      }
      if (e.key === 'Enter') { e.preventDefault(); sendMsg(); }
    });
    inp.addEventListener('input', function () {
      loadStaffForMentions();
      loadTasksForMentions();
      updateMentionListFromInput();
    });
    inp.addEventListener('click', updateMentionListFromInput);
    inp.addEventListener('blur', function () {
      setTimeout(function () {
        var listEl = $('chat-mention-list');
        if (listEl && !listEl.contains(document.activeElement) && document.activeElement !== inp) hideMentionList();
      }, 150);
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
      list.addEventListener('click', function (e) {
        var a = e.target && e.target.closest && e.target.closest('a.msg-mention');
        if (!a) return;
        e.preventDefault();
        var type = a.getAttribute('data-type');
        var id = a.getAttribute('data-id');
        if (type === 'patient' && id && window.CareTrack && window.CareTrack.openPatient) {
          window.CareTrack.openPatient(id, 'comms');
        } else if (type === 'task' && id && window.CareTrack && window.CareTrack.openTask) {
          window.CareTrack.openTask(id, 'comms');
        }
      });
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
    var viewTop = scrollTop + 56;
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
    content.querySelectorAll('.wa-date-sep.wa-date-sep-under-popup').forEach(function (el) {
      el.classList.remove('wa-date-sep-under-popup');
    });
    if (currentLabel) {
      popup.textContent = currentLabel;
      popup.removeAttribute('aria-hidden');
      popup.removeAttribute('hidden');
      popup.classList.add('visible');
      dateEls.forEach(function (el) {
        if (el.classList && el.classList.contains('wa-date-sep') && el.offsetTop <= viewTop) {
          el.classList.add('wa-date-sep-under-popup');
        }
      });
      if (_datePopupHideTimer) clearTimeout(_datePopupHideTimer);
      _datePopupHideTimer = setTimeout(function () {
        popup.classList.remove('visible');
        popup.setAttribute('aria-hidden', 'true');
        popup.setAttribute('hidden', '');
        content.querySelectorAll('.wa-date-sep.wa-date-sep-under-popup').forEach(function (el) {
          el.classList.remove('wa-date-sep-under-popup');
        });
        _datePopupHideTimer = null;
      }, 1500);
    }
  }

  /** Turn plain text into HTML with URLs as clickable links and @mentions as links (escaped for XSS safety). */
  function linkify(s, mentions) {
    if (s == null || s === '') return '';
    var str = String(s);
    var urlRegex = /(https?:\/\/[^\s<>"']+)/gi;
    var parts = str.split(urlRegex);
    return parts.map(function (p) {
      if (p && /^https?:\/\//i.test(p)) {
        return '<a href="' + esc(p) + '" target="_blank" rel="noopener noreferrer" class="msg-link">' + esc(p) + '</a>';
      }
      return formatMentions(esc(p), mentions);
    }).join('');
  }

  function escapeRegex(s) {
    return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /** Replace @Name with link (show name only, no @). Only replaces exact names from mentions so the rest of the message stays plain. */
  function formatMentions(escapedText, mentions) {
    if (mentions && mentions.length) {
      var sorted = mentions.slice().sort(function (a, b) {
        return (b.name || '').length - (a.name || '').length;
      });
      var result = escapedText;
      sorted.forEach(function (m) {
        var name = (m.name || '').trim();
        if (!name) return;
        var re = new RegExp('@' + escapeRegex(name), 'g');
        var display = esc(name);
        var link = (m.type === 'patient' && m.id)
          ? '<a href="#" class="msg-mention" data-type="patient" data-id="' + esc(m.id) + '" title="View patient">' + display + '</a>'
          : (m.type === 'user' && m.id)
            ? '<a href="#" class="msg-mention" data-type="user" data-id="' + esc(m.id) + '" title="' + display + '">' + display + '</a>'
            : (m.type === 'task' && m.id)
              ? '<a href="#" class="msg-mention msg-mention-task" data-type="task" data-id="' + esc(m.id) + '" title="Open task">' + display + '</a>'
              : '<span class="msg-mention" title="' + display + '">' + display + '</span>';
        result = result.replace(re, link);
      });
      return result;
    }
    return escapedText.replace(/@([^\s@<>"'&]+)/g, function (_, name) {
      return '<span class="msg-mention" title="' + esc(name) + '">' + esc(name) + '</span>';
    });
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
