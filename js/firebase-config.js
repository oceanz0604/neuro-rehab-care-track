/**
 * Firebase configuration — replace with your project values from Firebase Console.
 * Get them from: Project Settings → General → Your apps.
 * RTDB URL: Firebase Console → Realtime Database → copy the URL.
 */
var FIREBASE_CONFIG = {
  apiKey: "AIzaSyDkfOC2jlFKn22htsuYaRQNQA0oZ0mdNBo",
  authDomain: "neuro-rehab-care-track-44b6a.firebaseapp.com",
  databaseURL: "https://neuro-rehab-care-track-44b6a-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "neuro-rehab-care-track-44b6a",
  storageBucket: "neuro-rehab-care-track-44b6a.firebasestorage.app",
  messagingSenderId: "68762297273",
  appId: "1:68762297273:web:05ee98834f4d6adf968c68"
};
// For push notifications (public key only). Private key stays in Firebase Console / server only.
var FCM_VAPID_KEY = "BPYXCSoz3iG2V7MmqV-ZwZ4r_2s6JXxcI4SjbLmt7DbUnOeWehHdMK0NwBJp2y-ipN5H2YldDTXz-zJLAdEGtCg";
// Vercel API for push notifications (from your neuro-rehab-care-track project)
var PUSH_API_URL = "https://neuro-rehab-care-track.vercel.app/api/send-push";
