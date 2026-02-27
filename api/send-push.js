'use strict';

const admin = require('firebase-admin');

function looksLikeUid(s) {
  return typeof s === 'string' && s.length >= 20 && /^[a-zA-Z0-9_-]+$/.test(s);
}

async function getFcmTokensForAssignedDoctors(db, assignedDoctors, excludeUserId) {
  if (!assignedDoctors || !Array.isArray(assignedDoctors) || assignedDoctors.length === 0) return { tokens: [], resolvedCount: 0 };
  const tokens = [];
  let resolvedCount = 0;
  const byUid = new Map();
  const byName = new Map();
  const byEmail = new Map();

  const staffSnap = await db.collection('userProfiles').get();
  const norm = (s) => String(s || '').trim().toLowerCase().replace(/\s+/g, ' ');
  staffSnap.docs.forEach(doc => {
    const d = doc.data();
    const uid = doc.id;
    byUid.set(uid, d);
    if (d.displayName) byName.set(norm(d.displayName), uid);
    if (d.email) byEmail.set(norm(d.email), uid);
  });

  const seenUids = new Set();
  for (const entry of assignedDoctors) {
    const v = String(entry || '').trim();
    if (!v || v === excludeUserId) continue;
    let uid;
    if (looksLikeUid(v)) uid = v;
    else uid = byName.get(norm(v)) || byEmail.get(norm(v));
    if (uid && uid !== excludeUserId && !seenUids.has(uid)) {
      seenUids.add(uid);
      resolvedCount++;
      const profile = byUid.get(uid);
      if (profile && profile.fcmToken) tokens.push(profile.fcmToken);
    }
  }
  return { tokens, resolvedCount };
}

/** Get FCM tokens for a list of UIDs, excluding one. */
async function getFcmTokensForUids(db, uids, excludeUserId) {
  if (!uids || !uids.length) return { tokens: [] };
  const tokens = [];
  const set = new Set(uids.filter(Boolean).map(String));
  set.delete(excludeUserId || '');
  if (set.size === 0) return { tokens: [] };
  const snap = await db.collection('userProfiles').get();
  snap.docs.forEach(doc => {
    if (set.has(doc.id)) {
      const d = doc.data();
      if (d && d.fcmToken) tokens.push(d.fcmToken);
    }
  });
  return { tokens };
}

/** All staff with FCM token except excludeUserId (for chat). */
async function getAllFcmTokensExcept(db, excludeUserId) {
  const tokens = [];
  const snap = await db.collection('userProfiles').get();
  snap.docs.forEach(doc => {
    if (doc.id === excludeUserId) return;
    const d = doc.data();
    if (d && d.fcmToken && (d.isActive !== false)) tokens.push(d.fcmToken);
  });
  return { tokens };
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const authHeader = req.headers.authorization;
  const idToken = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!idToken) return res.status(401).json({ error: 'Missing Authorization token' });

  const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!serviceAccount) return res.status(500).json({ error: 'Server config missing' });

  try {
    let app = admin.apps[0];
    if (!app) {
      const cred = typeof serviceAccount === 'string' ? JSON.parse(serviceAccount) : serviceAccount;
      app = admin.initializeApp({ credential: admin.credential.cert(cred) });
    }
    const decoded = await admin.auth().verifyIdToken(idToken);
    const db = admin.firestore();

    let body = req.body;
    if (typeof body === 'string') {
      try { body = JSON.parse(body); } catch (_) { return res.status(400).json({ error: 'Invalid JSON body' }); }
    }
    body = body || {};
    const {
      clientId, taskId, type, clientName, section, submittedBy, submittedByName,
      addedBy, addedByName, diagnosis, text,
      taskTitle, createdBy, createdByName, assignedTo, assignedToName,
      channel, senderId, sender
    } = body;

    if (!type) return res.status(400).json({ error: 'type required' });

    let tokens = [];
    let title, bodyText, link = '/';
    const excludeUid = decoded.uid;

    // ─── Chat message: notify all staff except sender ───
    if (type === 'chat_message') {
      const { tokens: t } = await getAllFcmTokensExcept(db, senderId || excludeUid);
      tokens = t;
      title = 'Team Chat: ' + (channel || 'Chat');
      const preview = (text || '').slice(0, 60);
      bodyText = (sender || 'Someone') + ': ' + (preview || 'New message') + (preview.length >= 60 ? '…' : '');
      link = '/index.html?page=comms';
    }
    // ─── Task: comment / created / updated ───
    else if (taskId) {
      const taskSnap = await db.collection('tasks').doc(taskId).get();
      if (!taskSnap.exists) return res.status(404).json({ error: 'Task not found' });
      const task = taskSnap.data();
      const assigneeUid = task.assignedTo || null;
      const creatorUid = task.createdBy || null;
      const uids = [assigneeUid, creatorUid].filter(Boolean);
      const uniq = [...new Set(uids)];
      const exclude = type === 'task_comment' ? (addedBy || excludeUid) : type === 'task_created' ? (createdBy || excludeUid) : excludeUid;
      const { tokens: t } = await getFcmTokensForUids(db, uniq, exclude);
      tokens = t;

      const name = taskTitle || task.title || 'Task';
      if (type === 'task_comment') {
        title = 'Task comment: ' + name;
        const preview = (text || '').slice(0, 50);
        bodyText = (addedByName || 'Someone') + ' commented' + (preview ? ' — ' + preview + (preview.length >= 50 ? '…' : '') : '.');
      } else if (type === 'task_created') {
        title = 'New task: ' + name;
        bodyText = (createdByName || 'Someone') + ' created a task' + (assignedToName ? ' assigned to you' : '');
      } else {
        title = 'Task updated: ' + name;
        bodyText = (addedByName || createdByName || 'Someone') + ' updated the task.';
      }
      link = '/task.html?id=' + taskId;
    }
    // ─── Client/patient: report, diagnosis_note, client_comment, patient_created, patient_updated ───
    else if (clientId) {
      const clientSnap = await db.collection('clients').doc(clientId).get();
      if (!clientSnap.exists) return res.status(404).json({ error: 'Client not found' });
      const client = clientSnap.data();
      const assignedDoctors = client.assignedDoctors && Array.isArray(client.assignedDoctors)
        ? client.assignedDoctors
        : (client.assignedTherapist || client.therapist ? [client.assignedTherapist || client.therapist] : []);

      const exclude = type === 'report' ? (submittedBy || excludeUid) : (addedBy || createdBy || excludeUid);
      const { tokens: t, resolvedCount } = await getFcmTokensForAssignedDoctors(db, assignedDoctors, exclude);
      tokens = t;

      if (tokens.length === 0) return res.status(200).json({
        sent: 0,
        reason: 'no_tokens',
        assignedCount: assignedDoctors.length,
        resolvedCount: resolvedCount || 0,
        hint: resolvedCount === 0 ? 'Assignees not found in userProfiles' : 'Assignees have not enabled notifications yet'
      });

      const patientName = clientName || client.name || 'Patient';
      link = '/patient.html?id=' + clientId;

      if (type === 'report') {
        title = 'New report: ' + patientName;
        bodyText = (submittedByName || 'Staff') + ' added a ' + (section || 'report') + ' report.';
      } else if (type === 'diagnosis_note' || type === 'diagnosis') {
        title = 'Diagnosis update: ' + patientName;
        const d = (diagnosis || '').slice(0, 60);
        bodyText = (addedByName || 'Staff') + (d ? ' — ' + d : ' added a diagnosis update.') + (d.length >= 60 ? '…' : '');
      } else if (type === 'client_comment') {
        title = 'New comment: ' + patientName;
        const preview = (text || '').slice(0, 50);
        bodyText = (addedByName || 'Someone') + ' commented' + (preview ? ' — ' + preview + (preview.length >= 50 ? '…' : '') : '.');
      } else if (type === 'patient_created') {
        title = 'New patient: ' + patientName;
        bodyText = (addedByName || createdByName || 'Staff') + ' added a new patient.';
      } else if (type === 'patient_updated') {
        title = 'Patient updated: ' + patientName;
        bodyText = (addedByName || 'Staff') + ' updated patient details.';
      } else {
        title = 'Update: ' + patientName;
        bodyText = (addedByName || 'Staff') + ' updated the patient.';
      }
    } else {
      return res.status(400).json({ error: 'clientId or taskId required (or type chat_message with channel)' });
    }

    if (tokens.length === 0) return res.status(200).json({ sent: 0, reason: 'no_tokens' });

    const message = {
      notification: { title, body: bodyText },
      data: {
        title: String(title),
        body: String(bodyText),
        type: String(type),
        ...(clientId && { clientId: String(clientId) }),
        ...(taskId && { taskId: String(taskId) })
      },
      webpush: {
        notification: { title, body: bodyText },
        fcmOptions: { link }
      },
      tokens
    };

    const result = await admin.messaging().sendEachForMulticast(message);
    return res.status(200).json({ sent: result.successCount, failed: result.failureCount });
  } catch (e) {
    if (e.code === 'auth/id-token-expired' || e.code === 'auth/argument-error') return res.status(401).json({ error: 'Invalid token' });
    console.error(e);
    return res.status(500).json({ error: e.message || 'Send failed' });
  }
};
