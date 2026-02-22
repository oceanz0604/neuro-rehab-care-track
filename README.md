# NeuroRehab CareTrack

A **Neuro-Psychiatric Rehabilitation Reporting System** for clinical staff: daily reports, psychiatric status, medication, behavioral observations, ADL, therapeutic activities, family involvement, risk monitoring, MDT review, team communications, and family progress reports (English + Marathi). Built for **Firebase** (Auth + Firestore) and **GitHub Pages** hosting.

## Features

- **Firebase Authentication** — Email/password sign-in; first-time users are created automatically; role, display name, and shift stored in Firestore.
- **Firestore** — Clients, reports, and team messages stored in the cloud and synced across devices.
- **Dashboard** — Active clients, report count, high/medium risk alerts, recent reports, quick guide.
- **Client registry** — Add clients with name, DOB, admission, therapist, diagnosis, risk level; list is shared across all staff.
- **Clinical sections** — Daily reports, Psychiatric (1–5 ratings), Medication & vitals, Behavioral, ADL (Independent/Prompting/Assistance/Dependent), Therapeutic, Family, Risk (per-domain level), MDT review.
- **Team communications** — Channel-based messaging (General Ward, Urgent Alerts, Handover, Nursing, Psychiatry, Rehab) with real-time Firestore subscription.
- **Family report** — Monthly progress report in **English** or **मराठी**; supportive language only (no diagnosis/medication); printable/PDF.
- **Settings** — Customise clinical parameter lists (psychiatric, behavioral, ADL, therapeutic, risk); export/import JSON config.

## Firebase setup

1. **Create a Firebase project**  
   Go to [Firebase Console](https://console.firebase.google.com/) → Create project (or use an existing one).

2. **Enable Authentication**  
   Build → Authentication → Get started → Sign-in method → **Email/Password** → Enable → Save.

3. **Create Firestore database**  
   Build → Firestore Database → Create database → Start in **test mode** (or production with rules below) → Choose a region.

4. **Deploy security rules**  
   In Firestore → Rules, paste the contents of `firestore.rules` from this repo, then Publish.  
   (Optional) Deploy indexes from `firestore.indexes.json` via Firebase CLI:  
   `firebase deploy --only firestore:indexes`

5. **Register a web app**  
   Project overview → Add app → Web (</>).  
   Copy the `firebaseConfig` object.

6. **Configure the app**  
   In this repo, open `js/firebase-config.js` (or copy `js/firebase-config.sample.js` to `js/firebase-config.js`).  
   Replace the placeholder values with your project’s:

   - `apiKey`
   - `authDomain`
   - `projectId`
   - `storageBucket`
   - `messagingSenderId`
   - `appId`

   Do **not** commit real API keys to a public repo if you prefer; keep `firebase-config.js` with placeholders in the repo and use a local copy with real keys (and add `js/firebase-config.js` to `.gitignore` if you do).

## Run locally

- **Option A:** Open `index.html` in a browser (file://).  
  Some features may be limited by CORS; a local server is better.

- **Option B:** Use a simple HTTP server, e.g.  
  - Python 3: `python -m http.server 8080`  
  - Node: `npx serve .`  
  Then open `http://localhost:8080` (or the port shown).

Sign in with an email and password (and role/display name/shift). The first time you use an email, a new account is created and the profile is saved to Firestore.

## Deploy to GitHub Pages

1. **Push the repo to GitHub**  
   Create a repository and push this project (including `index.html`, `css/`, `js/`, and `firestore.rules` / `firestore.indexes.json` if you want them for reference).

2. **Enable GitHub Pages**  
   Repo → **Settings** → **Pages** → Source: **Deploy from a branch** → Branch: `main` (or your default branch), folder: **/ (root)** → Save.

3. **Use the site URL**  
   The site will be at:  
   `https://<your-username>.github.io/<repo-name>/`  
   If the repo name is `Neuro-Rehab-Care-Track`, use:  
   `https://<your-username>.github.io/Neuro-Rehab-Care-Track/`

4. **Firebase for GitHub Pages**  
   In Firebase Console → Authentication → **Authorized domains**, add:  
   `your-username.github.io`  
   so sign-in works on the deployed site.

## Project structure

```
Neuro-Rehab-Care-Track/
├── index.html          # Single-page app shell and all sections
├── css/
│   └── main.css       # Styles
├── js/
│   ├── firebase-config.js      # Your Firebase config (edit with real keys)
│   ├── firebase-config.sample.js
│   ├── db.js          # Firebase init, Auth, Firestore helpers
│   └── app.js         # App state, navigation, all pages and forms
├── firestore.rules
├── firestore.indexes.json
├── .gitignore
└── README.md
```

## Data model (Firestore)

- **clients** — One doc per client; fields e.g. `name`, `gender`, `dob`, `admission`, `therapist`, `diagnosis`, `risk`, `createdAt`, `updatedAt`.
- **reports** — One doc per saved report; `clientId`, `clientName`, `section`, `userId`, `userName`, `shift`, `payload` (section-specific data), `createdAt`.
- **channels/{channelId}/messages** — One doc per message; `text`, `sender`, `createdAt`.
- **userProfiles/{userId}** — One doc per user; `role`, `displayName`, `shift`.  
  Optional: **userProfiles/{userId}/config/lists** for saved settings (e.g. custom PSY/BEH/ADL/THER/RISK lists).

## License

Use and adapt as needed for your organisation.
