# NeuroRehab CareTrack

A **Neuro-Psychiatric Rehabilitation Reporting System** for clinical staff: daily reports, psychiatric status, medication, behavioral observations, ADL, therapeutic activities, family involvement, risk monitoring, MDT review, team communications, and family progress reports. Built for **Firebase** (Auth + Firestore) and deployed on **Vercel** / **GitHub Pages**.

## Features

- **Firebase Authentication** — Email/password sign-in; roles and display name in Firestore.
- **Firestore** — Clients, reports, team messages; synced across devices.
- **Dashboard** — Active clients, report count, risk alerts, recent reports.
- **Client registry** — Add clients with name, DOB, admission, therapist, diagnosis, risk level.
- **Clinical sections** — Daily reports, Psychiatric, Medication, Behavioral, ADL, Therapeutic, Family, Risk, MDT review.
- **Team communications** — Channel-based messaging with real-time Firestore.
- **Family report** — Monthly progress report in English or Marathi; printable/PDF.
- **Settings** — Customise clinical parameter lists; export/import JSON config.
- **Push notifications** — Assigned doctors get browser push when patients get new reports/diagnoses (via Vercel API).

## Project structure

```
├── index.html              # App entry (root)
├── manifest.json           # PWA manifest
├── sw.js                   # Service worker (cache + push)
├── firebase.json           # Firebase CLI (firestore + database only)
├── vercel.json             # Vercel SPA rewrites
├── package.json
├── api/
│   └── send-push.js        # Vercel serverless (push)
├── firebase/
│   ├── firestore.rules
│   ├── firestore.indexes.json
│   └── database.rules.json
├── static/
│   ├── css/
│   │   └── main.css
│   ├── js/
│   │   ├── firebase-config.js
│   │   ├── db.js
│   │   ├── app.js
│   │   └── ...
│   └── icons/
├── docs/
│   ├── README.md           # This file
│   ├── DEPLOY_CHECKLIST.md
│   └── PUSH_SETUP.md
└── .github/workflows/
    └── deploy-pages.yml    # GitHub Pages deploy
```

## Firebase setup

1. Create a Firebase project; enable **Email/Password** auth and **Firestore** (and Realtime Database if you use team chat).
2. Deploy rules: `firebase deploy --only firestore,database` (uses `firebase/`).
3. Add a web app in the console; copy the config into `static/js/firebase-config.js` (use `static/js/firebase-config.sample.js` as a template).

## Run locally

- From repo root: `npx serve .` or `python -m http.server 8080`, then open `http://localhost:8080`.
- Add `https://localhost:8080` (or your URL) to Firebase Auth → Authorized domains.

## Deploy

- **Vercel:** Link the repo; deploy. Set `FIREBASE_SERVICE_ACCOUNT` for push. See `docs/DEPLOY_CHECKLIST.md`.
- **GitHub Pages:** Enable Pages → Source: GitHub Actions. See `docs/DEPLOY_CHECKLIST.md`.

## Troubleshooting

- **`net::ERR_BLOCKED_BY_CLIENT`** on Firestore (e.g. `firestore.googleapis.com/.../channel`) or push: a **browser extension** (ad blocker, privacy/tracking blocker) is blocking the request. Whitelist your app’s origin (e.g. `https://your-app.vercel.app`) in the extension, or try without extensions / in another profile.

## Docs

- **Deploy:** `docs/DEPLOY_CHECKLIST.md`
- **Push notifications:** `docs/PUSH_SETUP.md`
