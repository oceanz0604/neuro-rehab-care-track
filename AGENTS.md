# AGENTS.md

## Cursor Cloud specific instructions

### Project overview

NeuroRehab CareTrack (branded "Maitra Wellness") is a **static web app** (vanilla HTML/CSS/JS, no bundler, no build step) backed by Firebase (Auth, Firestore, Realtime Database). See `docs/README.md` for full details.

### Running the dev server

Serve the repo root as static files:

```
npx serve . -l 8080
```

Then open `http://localhost:8080`. The app loads `index.html` directly — there is no build step.

### Dependencies

`npm install` is only needed for the Vercel serverless function (`api/send-push.js`) which uses `firebase-admin`. The front-end loads all libraries from CDNs (Firebase SDK, Font Awesome, html2pdf.js, Google Fonts).

### Lint / Test / Build

- **No linter** is configured in this project (no ESLint, Prettier, or similar).
- **No test framework** is configured (no Jest, Mocha, or similar).
- **No build step** — the app is pure static files served directly.

### Firebase configuration

`static/js/firebase-config.js` contains the Firebase project credentials (already populated). The sample template is at `static/js/firebase-config.sample.js`.

### Authentication

The app uses Firebase Email/Password auth. Users cannot self-register — accounts must be created via the Admin panel by an existing admin user. To test login, you need valid credentials for the Firebase project (`neuro-rehab-care-track-44b6a`).

### Key gotchas

- The `serve` package is not in `package.json` — it is fetched on-demand via `npx`. This is fine for development.
- All front-end JS files use `var` declarations and IIFEs — there is no module system or import/export.
- Script load order in `index.html` matters (e.g. `firebase-config.js` must load before `db.js`).
- The service worker (`sw.js`) caches aggressively; use hard refresh or clear cache when testing changes.
