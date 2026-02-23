# Firebase seed script

Seeds the Neuro Rehab Care Track Firebase project with:

- **Auth**: 4 users (admin, nurse, doctor, therapist)
- **Firestore**: `userProfiles`, `config/org`, `clients`, `diagnosisHistory`, `reports`, `riskEscalations`
- **RTDB** (optional): sample chat messages

## Setup

1. Install dependencies:

   ```bash
   pip install -r requirements-seed.txt
   ```

2. Use the Firebase Admin SDK key file. Default path:

   `C:\Users\decrypter\Downloads\neuro-rehab-care-track-44b6a-firebase-adminsdk-fbsvc-4c095304d1.json`

   Or set:

   ```bash
   set FIREBASE_KEY_FILE=C:\path\to\your-key.json
   ```

## Run

From the project root:

```bash
python scripts/seed_firebase.py
```

Or from `scripts/`:

```bash
python seed_firebase.py
```

## Logins created

| Email                    | Password     | Role        |
|-------------------------|-------------|-------------|
| admin@neurorehab.demo  | Admin123!   | admin       |
| nurse@neurorehab.demo   | Nurse123!   | nurse       |
| doctor@neurorehab.demo  | Doctor123!  | medical_officer |
| therapist@neurorehab.demo | Therapist123! | therapist |

If a user already exists (e.g. from a previous run), the script updates their profile and skips creating a duplicate.
