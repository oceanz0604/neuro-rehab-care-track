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

## 5. Why am I not getting notifications?

1. **You must allow notifications** when the app asks (browser prompt). If you dismissed or blocked it, reload and allow when prompted, or enable the site in browser settings.
2. **Your FCM token must be saved.** If the console shows "Push token error" (e.g. "push service error"), the token was never saved. Try: different browser or device; disable ad/privacy blockers for this site; ensure Firebase Cloud Messaging API is enabled in Google Cloud Console for your project.
3. **You must be assigned to the patient.** The patient’s **Assigned doctors** (or therapist) must include your **display name** or **email** exactly as in your profile (userProfiles). Check the patient edit form and your profile display name.
4. **The person who saved the report is not notified.** Only *other* assignees get the push.

After saving a report, check the browser console: you’ll see either "Push: notifications sent to N assignee(s)" or a message like "X assignee(s) on patient, Y in staff list, none with notifications enabled yet" so you can tell if the issue is no assignees, name mismatch, or no tokens.

---

## 6. Files

| File | Role |
|------|------|
| `api/send-push.js` | Vercel serverless API |
| `static/js/push-notifications.js` | FCM token + `triggerPush()` |
| `api/firebase-messaging-sw.js` | Serves FCM worker with correct MIME type |
| `static/js/firebase-config.js` | `FCM_VAPID_KEY`, `PUSH_API_URL` |
