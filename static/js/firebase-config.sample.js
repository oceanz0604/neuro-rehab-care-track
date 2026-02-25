/**
 * Firebase configuration — copy this to firebase-config.js and fill in your values.
 * Get them from: Firebase Console → Project Settings → General → Your apps.
 * RTDB URL: Firebase Console → Realtime Database → copy the URL.
 * FCM VAPID key: Firebase Console → Project Settings → Cloud Messaging → Web Push certificates → Generate key pair.
 */
var FIREBASE_CONFIG = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  databaseURL: "https://YOUR_PROJECT-default-rtdb.firebaseio.com",
  projectId: "YOUR_PROJECT",
  storageBucket: "YOUR_PROJECT.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};
// Optional: for push notifications. Generate in Cloud Messaging → Web Push certificates.
var FCM_VAPID_KEY = "";
