# Deploy checklist — before and after

Use this list when releasing to Firebase Hosting (and when Vercel is used for push).

---

## Before deploying

1. **Config**
   - [ ] `js/firebase-config.js`: `PUSH_API_URL` is set to your Vercel API URL (e.g. `https://neuro-rehab-care-track.vercel.app/api/send-push`). Leave `""` if you don’t use push.
   - [ ] Do **not** commit real secrets (e.g. Firebase service account key) in the repo; keep them in Vercel env vars only.

2. **Firebase**
   - [ ] Firestore rules and indexes are as you want (e.g. `firestore.rules`, `firestore.indexes.json`).
   - [ ] Run `firebase deploy` only for what you need, e.g.:
     - `firebase deploy` — hosting + Firestore + database rules  
     - `firebase deploy --only hosting` — hosting only  
     - `firebase deploy --only firestore` — rules + indexes only  

3. **Vercel (if using push)**
   - [ ] Project is linked to the same GitHub repo.
   - [ ] Env var `FIREBASE_SERVICE_ACCOUNT` is set (full JSON of the service account key) for Production (and Preview if you use it).
   - [ ] Push and deploy so the latest commit is live (or let Vercel auto-deploy on push).

4. **Git**
   - [ ] Commit and push so GitHub has the version you want. Vercel will deploy from the branch you configured (e.g. `main`).

---

## After deploying

1. **Smoke test**
   - [ ] Open the live app URL (e.g. `https://neuro-rehab-care-track-44b6a.web.app`).
   - [ ] Sign in and open Dashboard, Patients, and one patient detail; confirm no console errors.

2. **Service worker**
   - [ ] Hard refresh (Ctrl+Shift+R / Cmd+Shift+R) or close all app tabs and open again so the new `sw.js` (cache v8) is used.
   - [ ] Optional: In DevTools → Application → Service Workers, confirm the worker is active and update on reload if needed.

3. **Push (if enabled)**
   - [ ] Sign in as a user who should receive notifications → allow notifications when the browser prompts.
   - [ ] As another user, add a report or diagnosis for a patient whose assigned doctor is the first user → first user should get a push (or check console for “Push: no assignees with notifications enabled” if no token).

4. **PWA / install**
   - [ ] If you use “Add to Home Screen”, test install and open from the home screen once.

---

## One-time / when something changes

| When | What to do |
|------|------------|
| New Firebase project | Update `js/firebase-config.js` (and `firebase-config.sample.js`), set Vercel `FIREBASE_SERVICE_ACCOUNT` to the new project’s key. |
| New Vercel project | Set `PUSH_API_URL` in `js/firebase-config.js` to the new project’s `/api/send-push` URL. |
| New Web Push (VAPID) key | Replace `FCM_VAPID_KEY` in `js/firebase-config.js` (from Firebase Console → Cloud Messaging → Web Push certificates). |
| Firestore rules or indexes change | Run `firebase deploy --only firestore` and confirm in Firebase Console. |
