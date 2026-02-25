/**
 * NeuroRehab CareTrack — Firestore data layer with in-memory cache.
 * Exposes window.AppDB
 */
(function () {
  'use strict';

  if (typeof firebase === 'undefined') {
    window.AppDB = { ready: false, error: 'Firebase SDK not loaded' };
    return;
  }
  if (typeof FIREBASE_CONFIG === 'undefined' || !FIREBASE_CONFIG.apiKey || FIREBASE_CONFIG.apiKey === 'YOUR_API_KEY') {
    window.AppDB = { ready: false, error: 'Firebase config missing or invalid' };
    return;
  }

  try { firebase.initializeApp(FIREBASE_CONFIG); }
  catch (e) { if (e.code !== 'app/duplicate-app') { window.AppDB = { ready: false, error: e.message }; return; } }

  var auth = firebase.auth();
  var db   = firebase.firestore();

  /* ─── Cache Layer (5-min TTL) ────────────────────────────────── */
  var _cache = {};
  var CACHE_TTL = 5 * 60 * 1000;

  function cacheGet(key) {
    var e = _cache[key];
    if (!e) return null;
    if (Date.now() - e.ts > CACHE_TTL) { delete _cache[key]; return null; }
    return e.data;
  }
  function cacheSet(key, data) { _cache[key] = { data: data, ts: Date.now() }; }
  function cacheClear(prefix) {
    if (!prefix) { _cache = {}; return; }
    Object.keys(_cache).forEach(function (k) { if (k.indexOf(prefix) === 0) delete _cache[k]; });
  }

  /* ─── Auth ──────────────────────────────────────────────────── */
  function signIn(email, pw) { return auth.signInWithEmailAndPassword(email, pw); }
  function signOut() { cacheClear(); return auth.signOut(); }
  function onAuthStateChanged(cb) { return auth.onAuthStateChanged(cb); }
  function getCurrentUser() { return auth.currentUser; }

  /* ─── User Profiles ─────────────────────────────────────────── */
  function getUserProfile(uid, force) {
    if (!force) { var c = cacheGet('prof_' + uid); if (c) return Promise.resolve(c); }
    return db.collection('userProfiles').doc(uid).get().then(function (s) {
      var d = s.exists ? s.data() : null;
      if (d) { d.uid = uid; d = normalizeProfile(d); cacheSet('prof_' + uid, d); }
      return d;
    });
  }

  /** Listen for profile changes (e.g. isActive). Returns unsubscribe. */
  function listenUserProfile(uid, callback) {
    return db.collection('userProfiles').doc(uid).onSnapshot(function (snap) {
      var d = snap.exists ? snap.data() : null;
      if (d) d.uid = uid;
      callback(d);
    });
  }

  function setUserProfile(uid, data) {
    cacheClear('prof_' + uid);
    data.updatedAt = firebase.firestore.FieldValue.serverTimestamp();
    return db.collection('userProfiles').doc(uid).set(data, { merge: true });
  }

  /* ─── Normalize legacy Firestore data to expected shape ───────── */
  function normalizeClient(o) {
    if (!o) return o;
    var diagnoses = o.diagnoses && Array.isArray(o.diagnoses) ? o.diagnoses : (o.diagnosis ? [o.diagnosis] : []);
    var assignedDoctors = o.assignedDoctors && Array.isArray(o.assignedDoctors) ? o.assignedDoctors : (o.assignedTherapist || o.therapist ? [(o.assignedTherapist || o.therapist)] : []);
    var diagnosis = o.diagnosis || (diagnoses.length ? diagnoses[0] : '');
    var assignedTherapist = o.assignedTherapist || o.therapist || (assignedDoctors.length ? assignedDoctors[0] : '');
    return {
      id: o.id,
      name: o.name || o.fullName || '',
      dob: o.dob || o.dateOfBirth || '',
      gender: o.gender || '',
      diagnosis: diagnosis,
      diagnoses: diagnoses,
      admissionDate: o.admissionDate || o.admission || '',
      plannedDischargeDate: o.plannedDischargeDate || '',
      admissionDays: o.admissionDays != null ? o.admissionDays : null,
      status: o.status || 'active',
      currentRisk: o.currentRisk || o.riskLevel || 'none',
      assignedTherapist: assignedTherapist,
      assignedDoctors: assignedDoctors,
      ward: o.ward || '',
      roomNumber: o.roomNumber || o.room || '',
      dischargeDate: o.dischargeDate || '',
      legalStatus: o.legalStatus || '',
      emergencyContact: o.emergencyContact || '',
      consent: o.consent || '',
      progressReportNote: o.progressReportNote || '',
      createdBy: o.createdBy || '',
      createdAt: o.createdAt,
      updatedAt: o.updatedAt
    };
  }

  function normalizeReport(o) {
    if (!o) return o;
    return {
      id: o.id,
      clientId: o.clientId || '',
      clientName: o.clientName || '',
      section: o.section || '',
      submittedBy: o.submittedBy || o.userId || '',
      submittedByName: o.submittedByName || o.userName || '',
      shift: o.shift || '',
      reportNote: o.reportNote || '',
      payload: o.payload || {},
      createdAt: o.createdAt,
      updatedAt: o.updatedAt,
      updatedBy: o.updatedBy || '',
      updatedByName: o.updatedByName || ''
    };
  }

  var ROLE_HIERARCHY = ['social_worker', 'rehab_worker', 'care_taker', 'nurse', 'medical_officer', 'therapist', 'psychologist', 'psychiatrist', 'admin'];

  function normalizeProfile(o) {
    if (!o) return o;
    var rawRoles = o.roles && Array.isArray(o.roles) ? o.roles : (o.role ? [o.role] : ['nurse']);
    var singleRole = (o.role && ROLE_HIERARCHY.indexOf(String(o.role).toLowerCase()) !== -1)
      ? o.role
      : rawRoles[0] || 'nurse';
    if (rawRoles.length > 1) {
      var maxRank = -1;
      rawRoles.forEach(function (r) {
        var idx = ROLE_HIERARCHY.indexOf(String(r).toLowerCase());
        if (idx > maxRank) { maxRank = idx; singleRole = ROLE_HIERARCHY[idx]; }
      });
    }
    return {
      uid: o.uid,
      displayName: o.displayName || o.display_name || o.name || '',
      email: o.email || '',
      role: singleRole,
      roles: [singleRole],
      shift: o.shift || 'Morning',
      isActive: o.isActive !== false && o.isActive !== 'false',
      createdAt: o.createdAt,
      updatedAt: o.updatedAt
    };
  }

  /* ─── Staff Management (Admin) ──────────────────────────────── */
  function getAllStaff(force) {
    if (!force) { var c = cacheGet('staff'); if (c) return Promise.resolve(c); }
    return db.collection('userProfiles').get().then(function (snap) {
      var list = snap.docs.map(function (d) { var o = d.data(); o.uid = d.id; return normalizeProfile(o); });
      cacheSet('staff', list);
      return list;
    });
  }

  function createStaffAccount(email, password, profile) {
    var tempApp;
    try { tempApp = firebase.initializeApp(FIREBASE_CONFIG, 'tmp_' + Date.now()); }
    catch (e) { return Promise.reject(e); }
    var tempAuth = tempApp.auth();
    return tempAuth.createUserWithEmailAndPassword(email, password)
      .then(function (cred) {
        var uid = cred.user.uid;
        var role = profile.role || (profile.roles && profile.roles[0]) || 'nurse';
        var doc = {
          displayName: profile.displayName || '',
          email: email,
          role: role,
          roles: [role],
          isActive: true,
          createdAt: firebase.firestore.FieldValue.serverTimestamp()
        };
        return db.collection('userProfiles').doc(uid).set(doc)
          .then(function () { return tempAuth.signOut(); })
          .then(function () { return tempApp.delete(); })
          .then(function () { cacheClear('staff'); return { uid: uid, profile: doc }; });
      })
      .catch(function (err) {
        try { if (tempApp) tempApp.delete(); } catch (_) {}
        throw err;
      });
  }

  function updateStaffProfile(uid, data) {
    cacheClear('staff'); cacheClear('prof_' + uid);
    data.updatedAt = firebase.firestore.FieldValue.serverTimestamp();
    return db.collection('userProfiles').doc(uid).update(data);
  }

  function deactivateStaff(uid) { return updateStaffProfile(uid, { isActive: false }); }
  function reactivateStaff(uid) { return updateStaffProfile(uid, { isActive: true }); }

  /** Update current user's password (client SDK). Fails with requires-recent-login if session is stale. */
  function updateCurrentUserPassword(newPassword) {
    var user = auth.currentUser;
    if (!user) return Promise.reject(new Error('Not signed in'));
    return user.updatePassword(newPassword);
  }

  /* ─── Clients ───────────────────────────────────────────────── */
  function getClients(force) {
    if (!force) { var c = cacheGet('clients'); if (c) return Promise.resolve(c); }
    var col = db.collection('clients');
    return col.orderBy('name').get().then(function (snap) {
      var list = snap.docs.map(function (d) { var o = d.data(); o.id = d.id; return normalizeClient(o); });
      list.sort(function (a, b) { return (a.name || '').localeCompare(b.name || ''); });
      cacheSet('clients', list);
      return list;
    }).catch(function (err) {
      if (err.code === 'failed-precondition' || err.message.indexOf('index') !== -1) {
        return col.get().then(function (snap) {
          var list = snap.docs.map(function (d) { var o = d.data(); o.id = d.id; return normalizeClient(o); });
          list.sort(function (a, b) { return (a.name || '').localeCompare(b.name || ''); });
          cacheSet('clients', list);
          return list;
        });
      }
      throw err;
    });
  }

  function getClient(id) {
    var cached = cacheGet('clients');
    if (cached) {
      var found = null;
      cached.forEach(function (c) { if (c.id === id) found = c; });
      if (found) return Promise.resolve(found);
    }
    return db.collection('clients').doc(id).get().then(function (s) {
      if (!s.exists) return null;
      var o = s.data(); o.id = s.id; return normalizeClient(o);
    });
  }

  function addClient(data) {
    cacheClear('clients');
    data.status = data.status || 'active';
    data.currentRisk = data.currentRisk || 'none';
    if (data.admissionDays != null && data.admissionDate) {
      var d = new Date(data.admissionDate + 'T12:00:00');
      d.setDate(d.getDate() + (parseInt(data.admissionDays, 10) || 0));
      data.plannedDischargeDate = data.plannedDischargeDate || d.toISOString().slice(0, 10);
    }
    if (data.diagnoses && Array.isArray(data.diagnoses)) data.diagnosis = data.diagnoses[0] || data.diagnosis || '';
    else if (data.diagnosis && !data.diagnoses) data.diagnoses = [data.diagnosis];
    if (data.assignedDoctors && Array.isArray(data.assignedDoctors)) data.assignedTherapist = data.assignedDoctors[0] || data.assignedTherapist || '';
    else if (data.assignedTherapist && !data.assignedDoctors) data.assignedDoctors = [data.assignedTherapist];
    data.createdAt = firebase.firestore.FieldValue.serverTimestamp();
    data.updatedAt = firebase.firestore.FieldValue.serverTimestamp();
    return db.collection('clients').add(data).then(function (ref) {
      logAudit('client_add', 'client', ref.id, null).catch(function () {});
      return ref;
    });
  }

  function updateClient(id, data) {
    cacheClear('clients');
    data.updatedAt = firebase.firestore.FieldValue.serverTimestamp();
    return db.collection('clients').doc(id).update(data).then(function () {
      logAudit('client_update', 'client', id, null).catch(function () {});
    });
  }

  function dischargeClient(id, date) {
    var payload = { status: 'discharged', dischargeDate: date || new Date().toISOString().slice(0, 10) };
    cacheClear('clients');
    payload.updatedAt = firebase.firestore.FieldValue.serverTimestamp();
    return db.collection('clients').doc(id).update(payload).then(function () {
      logAudit('client_discharge', 'client', id, null).catch(function () {});
    });
  }

  function updateClientRisk(id, level) { return updateClient(id, { currentRisk: level }); }

  /* ─── Diagnosis history ──────────────────────────────────────── */
  function getClientDiagnosisHistory(clientId, limit) {
    return db.collection('clients').doc(clientId).collection('diagnosisHistory')
      .orderBy('createdAt', 'desc')
      .limit(limit || 50)
      .get()
      .then(function (snap) {
        return snap.docs.map(function (d) {
          var o = d.data(); o.id = d.id;
          if (o.fromDate && o.fromDate.toDate) o.fromDate = o.fromDate.toDate().toISOString().slice(0, 10);
          if (o.toDate && o.toDate.toDate) o.toDate = o.toDate.toDate().toISOString().slice(0, 10);
          if (o.createdAt && o.createdAt.toDate) o.createdAt = o.createdAt.toDate().toISOString();
          return o;
        });
      });
  }

  function addClientDiagnosisEntry(clientId, data) {
    var user = getCurrentUser();
    var doc = {
      diagnosis: data.diagnosis || '',
      fromDate: data.fromDate || new Date().toISOString().slice(0, 10),
      notes: data.notes || '',
      addedBy: user ? user.uid : '',
      addedByName: data.addedByName || '',
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    return db.collection('clients').doc(clientId).collection('diagnosisHistory').add(doc).then(function (ref) {
      cacheClear('clients');
      logAudit('diagnosis_history_add', 'client', clientId, { entryId: ref.id }).catch(function () {});
      return ref;
    });
  }

  /* ─── Client notes (comments) ─────────────────────────────────── */
  function getClientNotes(clientId, limit) {
    return db.collection('clients').doc(clientId).collection('notes')
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

  function addClientNote(clientId, data) {
    var user = getCurrentUser();
    var doc = {
      text: (data.text || '').trim(),
      addedBy: user ? user.uid : '',
      addedByName: data.addedByName || '',
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    return db.collection('clients').doc(clientId).collection('notes').add(doc).then(function (ref) {
      logAudit('client_note_add', 'client', clientId, { noteId: ref.id }).catch(function () {});
      return ref;
    });
  }

  /* ─── Reports ───────────────────────────────────────────────── */
  function _tsToISO(o) {
    if (o.createdAt && o.createdAt.toDate) o.createdAt = o.createdAt.toDate().toISOString();
    return o;
  }

  function saveReport(data) {
    return db.collection('reports').add({
      clientId: data.clientId,
      clientName: data.clientName || '',
      section: data.section,
      submittedBy: data.submittedBy,
      submittedByName: data.submittedByName || '',
      payload: data.payload || {},
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    }).then(function (ref) {
      logAudit('report_save', 'report', ref.id, { clientId: data.clientId, section: data.section }).catch(function () {});
      return ref;
    });
  }

  function updateReport(reportId, data) {
    var user = getCurrentUser();
    var update = {
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      updatedBy: user ? user.uid : '',
      updatedByName: (data && data.updatedByName) ? data.updatedByName : ''
    };
    if (data.payload !== undefined) update.payload = data.payload;
    if (data.reportNote !== undefined) update.reportNote = data.reportNote;
    return db.collection('reports').doc(reportId).update(update).then(function () {
      logAudit('report_edit', 'report', reportId, data.details || {}).catch(function () {});
    });
  }

  function deleteReport(reportId) {
    return db.collection('reports').doc(reportId).delete().then(function () {
      logAudit('report_delete', 'report', reportId, null).catch(function () {});
    });
  }

  function getRecentReports(limit) {
    return db.collection('reports').orderBy('createdAt', 'desc').limit(limit || 20).get()
      .then(function (snap) { return snap.docs.map(function (d) { var o = d.data(); o.id = d.id; return _tsToISO(normalizeReport(o)); }); });
  }

  function getClientReports(clientId, section, limit, startAfterDoc) {
    var q = db.collection('reports').where('clientId', '==', clientId);
    if (section) q = q.where('section', '==', section);
    q = q.orderBy('createdAt', 'desc');
    if (startAfterDoc) q = q.startAfter(startAfterDoc);
    q = q.limit(limit || 20);
    return q.get().then(function (snap) {
      return {
        docs: snap.docs.map(function (d) { var o = d.data(); o.id = d.id; return _tsToISO(normalizeReport(o)); }),
        lastDoc: snap.docs.length ? snap.docs[snap.docs.length - 1] : null
      };
    });
  }

  function getLatestReport(clientId, section) {
    return db.collection('reports')
      .where('clientId', '==', clientId)
      .where('section', '==', section)
      .orderBy('createdAt', 'desc')
      .limit(1)
      .get()
      .then(function (snap) {
        if (snap.empty) return null;
        var o = snap.docs[0].data(); o.id = snap.docs[0].id; return _tsToISO(normalizeReport(o));
      });
  }

  /* ─── Config (settings lists) ───────────────────────────────── */
  function getConfig(uid, force) {
    if (!force) { var c = cacheGet('cfg_' + uid); if (c) return Promise.resolve(c); }
    return db.collection('userProfiles').doc(uid).collection('config').doc('lists').get()
      .then(function (s) { var d = s.exists ? s.data() : null; if (d) cacheSet('cfg_' + uid, d); return d; });
  }

  function setConfig(uid, data) {
    cacheClear('cfg_' + uid);
    return db.collection('userProfiles').doc(uid).collection('config').doc('lists').set(data, { merge: true });
  }

  function getOrgConfig(force) {
    if (!force) { var c = cacheGet('orgConfig'); if (c) return Promise.resolve(c); }
    return db.collection('config').doc('org').get()
      .then(function (s) { var d = s.exists ? s.data() : null; if (d) cacheSet('orgConfig', d); return d; });
  }

  function setOrgConfig(data) {
    cacheClear('orgConfig');
    return db.collection('config').doc('org').set(data, { merge: true });
  }

  /* ─── Tasks (MVP-2) ───────────────────────────────────────────── */
  function getTasks() {
    return db.collection('tasks').orderBy('createdAt', 'desc').limit(200).get().then(function (snap) {
      return snap.docs.map(function (d) {
        var o = d.data();
        o.id = d.id;
        if (o.dueDate && o.dueDate.toDate) o.dueDate = o.dueDate.toDate().toISOString().slice(0, 10);
        if (o.createdAt && o.createdAt.toDate) o.createdAt = o.createdAt.toDate().toISOString();
        if (o.updatedAt && o.updatedAt.toDate) o.updatedAt = o.updatedAt.toDate().toISOString();
        return o;
      });
    });
  }

  function addTask(data) {
    var user = getCurrentUser();
    var title = (data.title || '').trim();
    if (!title) return Promise.reject(new Error('Title is required'));
    var doc = {
      title: title,
      dueDate: data.dueDate && String(data.dueDate).trim() ? String(data.dueDate).trim() : null,
      status: data.status === 'in_progress' || data.status === 'done' ? data.status : 'todo',
      notes: (data.notes || '').trim(),
      clientId: data.clientId && String(data.clientId).trim() ? String(data.clientId).trim() : null,
      clientName: (data.clientName || '').trim() || null,
      assignedTo: data.assignedTo && String(data.assignedTo).trim() ? String(data.assignedTo).trim() : null,
      assignedToName: (data.assignedToName || '').trim() || null,
      createdBy: user ? user.uid : null,
      createdByName: (data.createdByName || '').trim() || null,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    return db.collection('tasks').add(doc).then(function (ref) {
      logAudit('task_add', 'task', ref.id, { clientId: doc.clientId }).catch(function () {});
      return ref;
    });
  }

  function updateTask(id, data) {
    var user = getCurrentUser();
    var doc = {
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    if (data.title !== undefined) doc.title = (data.title || '').trim();
    if (data.dueDate !== undefined) doc.dueDate = data.dueDate || null;
    if (data.status !== undefined) doc.status = data.status || 'todo';
    if (data.notes !== undefined) doc.notes = (data.notes || '').trim();
    if (data.clientId !== undefined) doc.clientId = data.clientId || null;
    if (data.clientName !== undefined) doc.clientName = data.clientName || null;
    if (data.assignedTo !== undefined) doc.assignedTo = data.assignedTo || null;
    if (data.assignedToName !== undefined) doc.assignedToName = data.assignedToName || null;
    return db.collection('tasks').doc(id).update(doc).then(function () {
      logAudit('task_update', 'task', id, null).catch(function () {});
    });
  }

  function deleteTask(id) {
    return db.collection('tasks').doc(id).delete().then(function () {
      logAudit('task_delete', 'task', id, null).catch(function () {});
    });
  }

  /* ─── Audit log ──────────────────────────────────────────────── */
  function logAudit(action, targetType, targetId, details) {
    var user = getCurrentUser();
    return db.collection('auditLog').add({
      uid: user ? user.uid : '',
      action: action,
      targetType: targetType || '',
      targetId: targetId || '',
      details: details || null,
      timestamp: firebase.firestore.FieldValue.serverTimestamp()
    });
  }

  function getAuditLog(limit, startAfterDoc) {
    var q = db.collection('auditLog').orderBy('timestamp', 'desc').limit(limit || 50);
    if (startAfterDoc) q = q.startAfter(startAfterDoc);
    return q.get().then(function (snap) {
      return {
        docs: snap.docs.map(function (d) {
          var o = d.data();
          o.id = d.id;
          if (o.timestamp && o.timestamp.toDate) o.timestamp = o.timestamp.toDate().toISOString();
          return o;
        }),
        lastDoc: snap.docs.length ? snap.docs[snap.docs.length - 1] : null
      };
    });
  }

  /* ─── Export ────────────────────────────────────────────────── */
  window.AppDB = {
    ready: true, auth: auth, db: db,
    getCurrentUser: getCurrentUser,
    onAuthStateChanged: onAuthStateChanged,
    signIn: signIn,
    signOut: signOut,
    getUserProfile: getUserProfile,
    setUserProfile: setUserProfile,
    listenUserProfile: listenUserProfile,
    getAllStaff: getAllStaff,
    createStaffAccount: createStaffAccount,
    updateStaffProfile: updateStaffProfile,
    deactivateStaff: deactivateStaff,
    reactivateStaff: reactivateStaff,
    updateCurrentUserPassword: updateCurrentUserPassword,
    getClients: getClients,
    getClient: getClient,
    addClient: addClient,
    updateClient: updateClient,
    dischargeClient: dischargeClient,
    updateClientRisk: updateClientRisk,
    getClientDiagnosisHistory: getClientDiagnosisHistory,
    addClientDiagnosisEntry: addClientDiagnosisEntry,
    getClientNotes: getClientNotes,
    addClientNote: addClientNote,
    saveReport: saveReport,
    updateReport: updateReport,
    deleteReport: deleteReport,
    getRecentReports: getRecentReports,
    getClientReports: getClientReports,
    getLatestReport: getLatestReport,
    getConfig: getConfig,
    setConfig: setConfig,
    getOrgConfig: getOrgConfig,
    setOrgConfig: setOrgConfig,
    getTasks: getTasks,
    addTask: addTask,
    updateTask: updateTask,
    deleteTask: deleteTask,
    logAudit: logAudit,
    getAuditLog: getAuditLog,
    cacheClear: cacheClear
  };
})();
