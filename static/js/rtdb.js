/**
 * NeuroRehab CareTrack — Realtime Database layer for team chat.
 * Uses RTDB instead of Firestore to save read quotas (bandwidth-based billing).
 * Exposes window.AppChat
 */
(function () {
  'use strict';

  if (typeof firebase === 'undefined' || typeof firebase.database !== 'function') {
    console.warn('Firebase RTDB SDK not loaded — chat disabled');
    window.AppChat = { ready: false, CHANNELS: [] };
    return;
  }

  var rtdb = firebase.database();
  var _listeners = {};
  var _unreadListeners = {};

  var CHANNELS = [
    'General Ward', 'Urgent Alerts', 'Shift Handover',
    'Nursing', 'Psychiatry', 'Rehab'
  ];

  function channelKey(name) { return (name || '').replace(/\s+/g, '_'); }

  /**
   * Subscribe to a channel. Delivers full message array on every change.
   * Uses limitToLast(50) — bandwidth ~10 KB per trigger, safe for 30 users.
   */
  function subscribeChannel(channelName, onMessages) {
    var key = channelKey(channelName);
    unsubscribeChannel(channelName);
    var ref = rtdb.ref('chat/' + key).orderByChild('timestamp').limitToLast(50);
    ref.on('value', function (snap) {
      var msgs = [];
      snap.forEach(function (child) {
        var m = child.val(); m.id = child.key; msgs.push(m);
      });
      onMessages(msgs);
    });
    _listeners[key] = ref;
  }

  function unsubscribeChannel(channelName) {
    var key = channelKey(channelName);
    if (_listeners[key]) { _listeners[key].off(); delete _listeners[key]; }
  }

  function unsubscribeAll() {
    Object.keys(_listeners).forEach(function (k) { _listeners[k].off(); });
    _listeners = {};
    Object.keys(_unreadListeners).forEach(function (k) { _unreadListeners[k].off(); });
    _unreadListeners = {};
  }

  /**
   * Subscribe to a channel's latest message only (for unread detection).
   * Callback(latestMessage) with latestMessage = { timestamp, text, ... } or null.
   */
  function subscribeChannelLatest(channelName, callback) {
    var key = channelKey(channelName);
    if (_unreadListeners[key]) _unreadListeners[key].off();
    var ref = rtdb.ref('chat/' + key).orderByChild('timestamp').limitToLast(1);
    ref.on('value', function (snap) {
      var latest = null;
      snap.forEach(function (child) { latest = child.val(); latest.id = child.key; return true; });
      callback(latest);
    });
    _unreadListeners[key] = ref;
  }

  /**
   * Subscribe to all channels' latest message. Callback(channelName, latestMessage) when any channel updates.
   */
  function subscribeAllChannelsLatest(callback) {
    CHANNELS.forEach(function (ch) {
      subscribeChannelLatest(ch, function (latest) { callback(ch, latest); });
    });
  }

  function sendMessage(channelName, data) {
    var key = channelKey(channelName);
    return rtdb.ref('chat/' + key).push({
      text: data.text || '',
      sender: data.sender || 'Staff',
      senderId: data.senderId || '',
      isUrgent: !!data.isUrgent,
      timestamp: firebase.database.ServerValue.TIMESTAMP
    });
  }

  /** One-time read of urgent messages since a timestamp (for notification bell). Limited to last 50 to save bandwidth. */
  function getUrgentMessages(sinceTs) {
    return rtdb.ref('chat/' + channelKey('Urgent Alerts'))
      .orderByChild('timestamp')
      .startAt(sinceTs || 0)
      .limitToLast(50)
      .once('value')
      .then(function (snap) {
        var list = [];
        snap.forEach(function (c) { var m = c.val(); m.id = c.key; list.push(m); });
        return list;
      });
  }

  window.AppChat = {
    ready: true,
    CHANNELS: CHANNELS,
    channelKey: channelKey,
    subscribeChannel: subscribeChannel,
    subscribeChannelLatest: subscribeChannelLatest,
    subscribeAllChannelsLatest: subscribeAllChannelsLatest,
    unsubscribeChannel: unsubscribeChannel,
    unsubscribeAll: unsubscribeAll,
    sendMessage: sendMessage,
    getUrgentMessages: getUrgentMessages
  };
})();
