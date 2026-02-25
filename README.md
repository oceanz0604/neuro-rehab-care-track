# NeuroRehab CareTrack

Neuro-Psychiatric Rehabilitation Reporting System. Deploy on **Vercel** or **GitHub Pages**; Firebase for Auth, Firestore, and Realtime Database only.

## Root structure

| Path | Purpose |
|------|---------|
| `index.html` | App entry |
| `manifest.json` | PWA manifest |
| `sw.js` | Service worker (cache + push) |
| `firebase.json` | Firebase CLI (firestore + database) |
| `vercel.json` | Vercel SPA rewrites |
| `package.json` | Dependencies for API |
| `api/` | Vercel serverless (push) |
| `firebase/` | Firestore & RTDB rules and indexes |
| `static/` | CSS, JS, icons |
| `docs/` | README, deploy checklist, push setup |

## Docs

- **Full README & setup:** [docs/README.md](docs/README.md)
- **Deploy checklist:** [docs/DEPLOY_CHECKLIST.md](docs/DEPLOY_CHECKLIST.md)
- **Push notifications:** [docs/PUSH_SETUP.md](docs/PUSH_SETUP.md)

## Quick start

1. Copy `static/js/firebase-config.sample.js` to `static/js/firebase-config.js` and add your Firebase config.
2. Deploy rules: `firebase deploy --only firestore,database`
3. Deploy app: push to GitHub (Vercel and/or GitHub Pages).
