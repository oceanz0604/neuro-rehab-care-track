# Push notifications setup (no Blaze plan)

Doctors and assigned staff get **browser push notifications** when a patient gets a new report or diagnosis. This uses a **Vercel serverless API** (free tier) instead of Firebase Cloud Functions, so you don’t need the Blaze plan.

---

## 1. VAPID key (already done)

You’ve set `FCM_VAPID_KEY` in `js/firebase-config.js`. No change needed.

---

## 2. Firebase service account (for the API)

1. Open [Firebase Console](https://console.firebase.google.com) → your project.
2. **Project settings** (gear) → **Service accounts**.
3. Click **Generate new private key** → **Generate key**. A JSON file downloads.
4. Open that JSON file and copy its **entire contents** (one object). You’ll paste it into Vercel in the next step.

---

## 3. Deploy the push API to Vercel

1. Sign up / log in at [vercel.com](https://vercel.com).
2. Install the Vercel CLI (optional): `npm i -g vercel`
3. In your project folder, run:
   ```bash
   npm install
   vercel
   ```
   Follow the prompts (link to existing project or create new one).
4. Add the service account as an environment variable:
   - Vercel dashboard → your project → **Settings** → **Environment Variables**
   - Name: `FIREBASE_SERVICE_ACCOUNT`
   - Value: paste the **entire JSON** from the downloaded file (one line is fine)
   - Environment: Production (and Preview if you want)
   - Save
5. Redeploy so the new env var is used: **Deployments** → latest → **⋯** → **Redeploy**.

Your API URL will be like: `https://your-project.vercel.app/api/send-push`

---

## 4. Set the API URL in the app

In **`js/firebase-config.js`**, set:

```js
var PUSH_API_URL = "https://your-project.vercel.app/api/send-push";
```

Use your real Vercel deployment URL from step 3.

---

## 5. Flow

- When someone **saves a report** or **adds a diagnosis**, the app (after the save succeeds) calls your Vercel API with the patient id and type.
- The API verifies the user’s Firebase token, loads the patient’s **assigned doctors**, finds their FCM tokens in `userProfiles`, and sends the push (the person who made the change is not notified).
- No Blaze plan and no Cloud Functions are required.

---

## 6. Files

| File | Role |
|------|------|
| `api/send-push.js` | Vercel serverless API: verifies token, gets tokens, sends FCM |
| `js/push-notifications.js` | Gets FCM token (via `sw.js`), saves to Firestore; `triggerPush()` calls the API after save |
| `sw.js` | Cache + push: receives FCM and shows the notification |
| `js/firebase-config.js` | `FCM_VAPID_KEY` (browser), `PUSH_API_URL` (Vercel API URL) |

If `PUSH_API_URL` is empty, the app does not call the API and push is not sent; the rest of the app works as before.
