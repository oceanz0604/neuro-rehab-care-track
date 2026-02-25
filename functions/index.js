'use strict';

const functions = require('firebase-functions');
const admin = require('firebase-admin');
admin.initializeApp();

const db = admin.firestore();

/** Firebase UIDs are typically 28 chars alphanumeric */
function looksLikeUid(s) {
  return typeof s === 'string' && s.length >= 20 && /^[a-zA-Z0-9_-]+$/.test(s);
}

/**
 * Resolve assignedDoctors (array of display names or UIDs) to FCM tokens.
 * Skips excludeUserId (the person who made the change).
 */
async function getFcmTokensForAssignedDoctors(assignedDoctors, excludeUserId) {
  if (!assignedDoctors || !Array.isArray(assignedDoctors) || assignedDoctors.length === 0) return [];
  const tokens = [];
  const byUid = new Map();
  const byName = new Map();
  const byEmail = new Map();

  const staffSnap = await db.collection('userProfiles').get();
  staffSnap.docs.forEach(doc => {
    const d = doc.data();
    const uid = doc.id;
    byUid.set(uid, d);
    if (d.displayName) byName.set(String(d.displayName).trim().toLowerCase(), uid);
    if (d.email) byEmail.set(String(d.email).trim().toLowerCase(), uid);
  });

  const seenUids = new Set();
  for (const entry of assignedDoctors) {
    const v = String(entry || '').trim();
    if (!v || v === excludeUserId) continue;
    let uid;
    if (looksLikeUid(v)) {
      uid = v;
    } else {
      uid = byName.get(v.toLowerCase()) || byEmail.get(v.toLowerCase());
    }
    if (uid && uid !== excludeUserId && !seenUids.has(uid)) {
      seenUids.add(uid);
      const profile = byUid.get(uid);
      if (profile && profile.fcmToken) tokens.push(profile.fcmToken);
    }
  }
  return tokens;
}

/**
 * Send push notification to assigned doctors when a new report is created for a patient.
 */
exports.onReportCreated = functions.region('asia-south1').firestore
  .document('reports/{reportId}')
  .onCreate(async (snap, context) => {
    const data = snap.data();
    const clientId = data.clientId;
    const submittedBy = data.submittedBy || '';
    const clientName = data.clientName || 'Patient';
    const section = data.section || 'Report';
    const submittedByName = data.submittedByName || 'Staff';

    if (!clientId) return null;

    const clientSnap = await db.collection('clients').doc(clientId).get();
    if (!clientSnap.exists) return null;

    const client = clientSnap.data();
    const assignedDoctors = client.assignedDoctors && Array.isArray(client.assignedDoctors)
      ? client.assignedDoctors
      : (client.assignedTherapist || client.therapist ? [client.assignedTherapist || client.therapist] : []);

    const tokens = await getFcmTokensForAssignedDoctors(assignedDoctors, submittedBy);
    if (tokens.length === 0) return null;

    const title = 'New report: ' + (clientName || 'Patient');
    const body = submittedByName + ' added a ' + section + ' report.';

    const message = {
      notification: { title, body },
      data: {
        title,
        body,
        clientId: String(clientId),
        type: 'report'
      },
      webpush: {
        fcmOptions: { link: '/?page=patient-detail&id=' + clientId }
      },
      tokens
    };

    const result = await admin.messaging().sendEachForMulticast(message);
    return result;
  });

/**
 * Send push notification to assigned doctors when a new diagnosis entry is added for a patient.
 */
exports.onDiagnosisEntryCreated = functions.region('asia-south1').firestore
  .document('clients/{clientId}/diagnosisHistory/{entryId}')
  .onCreate(async (snap, context) => {
    const clientId = context.params.clientId;
    const data = snap.data();
    const addedBy = data.addedBy || '';
    const addedByName = data.addedByName || 'Staff';
    const diagnosis = (data.diagnosis || '').slice(0, 60);

    const clientSnap = await db.collection('clients').doc(clientId).get();
    if (!clientSnap.exists) return null;

    const client = clientSnap.data();
    const clientName = client.name || client.fullName || 'Patient';
    const assignedDoctors = client.assignedDoctors && Array.isArray(client.assignedDoctors)
      ? client.assignedDoctors
      : (client.assignedTherapist || client.therapist ? [client.assignedTherapist || client.therapist] : []);

    const tokens = await getFcmTokensForAssignedDoctors(assignedDoctors, addedBy);
    if (tokens.length === 0) return null;

    const title = 'Diagnosis update: ' + (clientName || 'Patient');
    const body = addedByName + (diagnosis ? ' — ' + diagnosis : ' added a diagnosis update.') + (diagnosis.length >= 60 ? '…' : '');

    const message = {
      notification: { title, body },
      data: {
        title,
        body,
        clientId: String(clientId),
        type: 'diagnosis'
      },
      webpush: {
        fcmOptions: { link: '/?page=patient-detail&id=' + clientId }
      },
      tokens
    };

    const result = await admin.messaging().sendEachForMulticast(message);
    return result;
  });
