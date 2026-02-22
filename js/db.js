/**
 * Firebase init and Firestore/Auth helpers.
 * Requires firebase-config.js (copy from firebase-config.sample.js) with your project keys.
 */
(function () {
  'use strict';

  if (typeof firebase === 'undefined') {
    console.error('Firebase SDK not loaded.');
    window.AppDB = { ready: false, error: 'Firebase SDK missing' };
    return;
  }

  if (typeof FIREBASE_CONFIG === 'undefined' || !FIREBASE_CONFIG.apiKey) {
    console.error('Create js/firebase-config.js from firebase-config.sample.js and add your Firebase project keys.');
    window.AppDB = { ready: false, error: 'Firebase config missing' };
    return;
  }

  try {
    firebase.initializeApp(FIREBASE_CONFIG);
  } catch (e) {
    console.error('Firebase init failed', e);
    window.AppDB = { ready: false, error: e.message };
    return;
  }

  var auth = firebase.auth();
  var db = firebase.firestore();

  // ─── Auth ─────────────────────────────────────────────────────
  function getCurrentUser() {
    return auth.currentUser;
  }

  function onAuthStateChanged(callback) {
    return auth.onAuthStateChanged(callback);
  }

  function signIn(email, password) {
    return auth.signInWithEmailAndPassword(email, password);
  }

  function signUp(email, password) {
    return auth.createUserWithEmailAndPassword(email, password);
  }

  function signOut() {
    return auth.signOut();
  }

  // ─── User profile (Firestore) ─────────────────────────────────
  function getUserProfile(uid) {
    return db.collection('userProfiles').doc(uid).get().then(function (snap) {
      return snap.exists ? snap.data() : null;
    });
  }

  function setUserProfile(uid, data) {
    return db.collection('userProfiles').doc(uid).set(data, { merge: true });
  }

  // ─── Clients ──────────────────────────────────────────────────
  function getClients() {
    return db.collection('clients').orderBy('createdAt', 'desc').get()
      .then(function (snap) {
        return snap.docs.map(function (d) {
          var o = d.data();
          o.id = d.id;
          return o;
        });
      });
  }

  function addClient(data) {
    var payload = {
      name: data.name,
      gender: data.gender || '',
      dob: data.dob || null,
      admission: data.admission || null,
      legal: data.legal || '',
      referral: data.referral || '',
      therapist: data.therapist || '',
      psychiatrist: data.psychiatrist || '',
      emergency: data.emergency || '',
      payment: data.payment || '',
      diagnosis: data.diagnosis || '',
      risk: data.risk || 'low',
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    return db.collection('clients').add(payload).then(function (ref) {
      return ref.id;
    });
  }

  function updateClient(id, data) {
    var payload = {};
    var keys = ['name', 'gender', 'dob', 'admission', 'legal', 'referral', 'therapist', 'psychiatrist', 'emergency', 'payment', 'diagnosis', 'risk'];
    keys.forEach(function (k) {
      if (data[k] !== undefined) payload[k] = data[k];
    });
    payload.updatedAt = firebase.firestore.FieldValue.serverTimestamp();
    return db.collection('clients').doc(id).update(payload);
  }

  // ─── Reports ───────────────────────────────────────────────────
  function saveReport(data) {
    var payload = {
      clientId: data.clientId,
      clientName: data.clientName || '',
      section: data.section,
      userId: data.userId,
      userName: data.userName || '',
      shift: data.shift || '',
      payload: data.payload || {},
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    return db.collection('reports').add(payload);
  }

  function getRecentReports(limit) {
    return db.collection('reports')
      .orderBy('createdAt', 'desc')
      .limit(limit || 20)
      .get()
      .then(function (snap) {
        return snap.docs.map(function (d) {
          var o = d.data();
          o.id = d.id;
          if (o.createdAt && o.createdAt.toDate) o.createdAt = o.createdAt.toDate().toISOString();
          return o;
        });
      });
  }

  // ─── Channel messages ─────────────────────────────────────────
  var CHANNELS = ['General Ward', 'Urgent Alerts', 'Shift Handover', 'Nursing', 'Psychiatry', 'Rehab'];

  function getChannelId(name) {
    return name.replace(/\s+/g, '_');
  }

  function getMessages(channelName, limit) {
    var cid = getChannelId(channelName);
    return db.collection('channels').doc(cid).collection('messages')
      .orderBy('createdAt', 'asc')
      .limit(limit || 100)
      .get()
      .then(function (snap) {
        return snap.docs.map(function (d) {
          var o = d.data();
          o.id = d.id;
          if (o.createdAt && o.createdAt.toDate) o.createdAt = o.createdAt.toDate().toISOString();
          return o;
        });
      });
  }

  function sendMessage(channelName, text, sender) {
    var cid = getChannelId(channelName);
    return db.collection('channels').doc(cid).collection('messages').add({
      text: text,
      sender: sender,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
  }

  function subscribeMessages(channelName, callback) {
    var cid = getChannelId(channelName);
    return db.collection('channels').doc(cid).collection('messages')
      .orderBy('createdAt', 'asc')
      .onSnapshot(function (snap) {
        var list = snap.docs.map(function (d) {
          var o = d.data();
          o.id = d.id;
          if (o.createdAt && o.createdAt.toDate) o.createdAt = o.createdAt.toDate().toISOString();
          return o;
        });
        callback(list);
      });
  }

  // ─── Config (settings lists) ───────────────────────────────────
  function getConfig(uid) {
    return db.collection('userProfiles').doc(uid).collection('config').doc('lists').get()
      .then(function (snap) {
        return snap.exists ? snap.data() : null;
      });
  }

  function setConfig(uid, data) {
    return db.collection('userProfiles').doc(uid).collection('config').doc('lists').set(data, { merge: true });
  }

  window.AppDB = {
    ready: true,
    auth: auth,
    db: db,
    getCurrentUser: getCurrentUser,
    onAuthStateChanged: onAuthStateChanged,
    signIn: signIn,
    signUp: signUp,
    signOut: signOut,
    getUserProfile: getUserProfile,
    setUserProfile: setUserProfile,
    getClients: getClients,
    addClient: addClient,
    updateClient: updateClient,
    saveReport: saveReport,
    getRecentReports: getRecentReports,
    CHANNELS: CHANNELS,
    getMessages: getMessages,
    sendMessage: sendMessage,
    subscribeMessages: subscribeMessages,
    getConfig: getConfig,
    setConfig: setConfig
  };
})();
