'use strict';

const admin = require('firebase-admin');

function looksLikeUid(s) {
  return typeof s === 'string' && s.length >= 20 && /^[a-zA-Z0-9_-]+$/.test(s);
}

async function getFcmTokensForAssignedDoctors(db, assignedDoctors, excludeUserId) {
  if (!assignedDoctors || !Array.isArray(assignedDoctors) || assignedDoctors.length === 0) return [];
  const tokens = [];
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
      const profile = byUid.get(uid);
      if (profile && profile.fcmToken) tokens.push(profile.fcmToken);
    }
  }
  return tokens;
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
    const { clientId, type, clientName, section, submittedBy, submittedByName, addedBy, addedByName, diagnosis } = body;
    if (!clientId || !type) return res.status(400).json({ error: 'clientId and type required' });

    const clientSnap = await db.collection('clients').doc(clientId).get();
    if (!clientSnap.exists) return res.status(404).json({ error: 'Client not found' });

    const client = clientSnap.data();
    const assignedDoctors = client.assignedDoctors && Array.isArray(client.assignedDoctors)
      ? client.assignedDoctors
      : (client.assignedTherapist || client.therapist ? [client.assignedTherapist || client.therapist] : []);

    const excludeUid = type === 'report' ? (submittedBy || decoded.uid) : (addedBy || decoded.uid);
    const tokens = await getFcmTokensForAssignedDoctors(db, assignedDoctors, excludeUid);
    if (tokens.length === 0) return res.status(200).json({ sent: 0, reason: 'no_tokens', assignedCount: assignedDoctors.length });

    let title, bodyText;
    if (type === 'report') {
      title = 'New report: ' + (clientName || client.name || 'Patient');
      bodyText = (submittedByName || 'Staff') + ' added a ' + (section || 'report') + ' report.';
    } else {
      title = 'Diagnosis update: ' + (clientName || client.name || 'Patient');
      const d = (diagnosis || '').slice(0, 60);
      bodyText = (addedByName || 'Staff') + (d ? ' — ' + d : ' added a diagnosis update.') + (d.length >= 60 ? '…' : '');
    }

    const message = {
      notification: { title, body: bodyText },
      data: {
        title: String(title),
        body: String(bodyText),
        clientId: String(clientId),
        type: String(type)
      },
      webpush: {
        notification: { title, body: bodyText },
        fcmOptions: { link: '/?page=patient-detail&id=' + clientId }
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
