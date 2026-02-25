# Push notifications setup (no Blaze plan)

Doctors and assigned staff get **browser push notifications** when a patient gets a new report or diagnosis, via a **Vercel serverless API** (free tier).

---

## 1. VAPID key

Set `FCM_VAPID_KEY` in `static/js/firebase-config.js` (from Firebase Console → Cloud Messaging → Web Push certificates).

---

## 2. Firebase service account (for the API)

1. Firebase Console → Project settings → **Service accounts** → **Generate new private key**.
2. Copy the full JSON and add it in Vercel: **Settings → Environment Variables** → `FIREBASE_SERVICE_ACCOUNT`.

---

## 3. Set the API URL in the app

In **`static/js/firebase-config.js`**:

```js
var PUSH_API_URL = "https://your-project.vercel.app/api/send-push";
```

---

## 4. Flow

- Saving a report or diagnosis triggers a call to the Vercel API with the patient id and type.
- The API verifies the token, loads the patient’s assigned doctors, finds their FCM tokens in `userProfiles`, and sends the push (the person who made the change is not notified).

---

## 5. Files

| File | Role |
|------|------|
| `api/send-push.js` | Vercel serverless API |
| `static/js/push-notifications.js` | FCM token + `triggerPush()` |
| `sw.js` | Cache + push handler |
| `static/js/firebase-config.js` | `FCM_VAPID_KEY`, `PUSH_API_URL` |
