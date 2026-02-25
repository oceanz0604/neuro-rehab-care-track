# Deploy checklist — before and after

The app is **not** deployed to Firebase Hosting. Use **Vercel** and/or **GitHub Pages** for the app. Use **Firebase** only for Firestore and Realtime Database rules and indexes.

---

## Before deploying

1. **Config**
   - `static/js/firebase-config.js`: `PUSH_API_URL` is set to your Vercel API URL. Leave `""` if you don’t use push.
   - Do **not** commit secrets; keep the Firebase service account JSON in Vercel env vars only.

2. **Firebase (rules and indexes only)**
   - When Firestore or RTDB rules/indexes change, run:
     - `firebase deploy --only firestore` — Firestore rules + indexes
     - `firebase deploy --only database` — Realtime Database rules
   - Rules and indexes live in the `firebase/` folder (see `firebase.json`).

3. **Vercel (app + push API)**
   - Link the Vercel project to your GitHub repo. Set **Root Directory** to empty (repo root) so both the app and `api/` are deployed.
   - In **Settings → Environment Variables**, set `FIREBASE_SERVICE_ACCOUNT` for the push API.

4. **GitHub Pages**
   - **Settings → Pages → Source**: **GitHub Actions**. The workflow deploys the repo root (so `index.html`, `static/`, `api/` are included).

5. **Git**
   - Commit and push so Vercel and GitHub Actions deploy.

---

## After deploying

1. **Smoke test** — Open the app URL, sign in, check Dashboard and a patient; confirm no console errors.
2. **Service worker** — Hard refresh so the latest `sw.js` is used.
3. **Push (if enabled)** — Sign in and allow notifications; test with another user adding a report for an assigned patient.
4. **PWA** — Test “Add to Home Screen” if you use it.

---

## Where things run

| What              | Where |
|-------------------|--------|
| App (static site) | **Vercel** and/or **GitHub Pages** |
| Push API          | **Vercel** (`/api/send-push`) |
| Firestore         | **Firebase** (`firebase deploy --only firestore`) |
| Realtime DB       | **Firebase** (`firebase deploy --only database`) |

---

## One-time / when something changes

| When                        | What to do |
|-----------------------------|------------|
| New Firebase project        | Update `static/js/firebase-config.js`; set Vercel `FIREBASE_SERVICE_ACCOUNT`. |
| New Vercel project         | Set `PUSH_API_URL` in `static/js/firebase-config.js`. |
| New Web Push (VAPID) key   | Replace `FCM_VAPID_KEY` in `static/js/firebase-config.js`. |
| Firestore rules/indexes    | Edit `firebase/` files, then `firebase deploy --only firestore`. |
| Database rules             | Edit `firebase/database.rules.json`, then `firebase deploy --only database`. |
