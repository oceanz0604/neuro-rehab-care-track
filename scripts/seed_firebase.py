#!/usr/bin/env python3
r"""
Seed Neuro Rehab Care Track Firebase (Auth, Firestore, optional RTDB).
Uses Firebase Admin SDK. Run from project root or set KEY_FILE and DB_URL.

Usage:
  pip install -r scripts/requirements-seed.txt
  python scripts/seed_firebase.py

Or with custom key path:
  set FIREBASE_KEY_FILE=C:\path\to\your-key.json
  python scripts/seed_firebase.py
"""
import os
import sys
import time
from datetime import datetime, timedelta, timezone

# Default key file path (shared by user)
DEFAULT_KEY_FILE = r"C:\Users\decrypter\Downloads\neuro-rehab-care-track-44b6a-firebase-adminsdk-fbsvc-4c095304d1.json"
DATABASE_URL = "https://neuro-rehab-care-track-44b6a-default-rtdb.asia-southeast1.firebasedatabase.app"

def main():
    key_file = os.environ.get("FIREBASE_KEY_FILE", DEFAULT_KEY_FILE)
    if not os.path.isfile(key_file):
        print("ERROR: Firebase key file not found:", key_file)
        print("Set FIREBASE_KEY_FILE or place key at the path above.")
        sys.exit(1)

    import firebase_admin
    from firebase_admin import credentials, auth, firestore
    from google.cloud.firestore_v1 import SERVER_TIMESTAMP

    # Initialize Firebase Admin (Firestore + Auth)
    if not firebase_admin._apps:
        cred = credentials.Certificate(key_file)
        firebase_admin.initialize_app(cred, options={"projectId": "neuro-rehab-care-track-44b6a"})

    db = firestore.client()

    # --- 1) Create Auth users and Firestore userProfiles ---
    staff = [
        {"email": "admin@neurorehab.demo", "password": "Admin123!", "displayName": "Admin User", "roles": ["admin"]},
        {"email": "nurse@neurorehab.demo", "password": "Nurse123!", "displayName": "Nurse Jane", "roles": ["nurse"]},
        {"email": "doctor@neurorehab.demo", "password": "Doctor123!", "displayName": "Dr. Smith", "roles": ["medical_officer", "doctor"]},
        {"email": "therapist@neurorehab.demo", "password": "Therapist123!", "displayName": "Therapist Lee", "roles": ["therapist"]},
    ]
    uid_by_email = {}

    for s in staff:
        try:
            user = auth.create_user(
                email=s["email"],
                password=s["password"],
                display_name=s["displayName"],
            )
            uid_by_email[s["email"]] = user.uid
            db.collection("userProfiles").document(user.uid).set({
                "displayName": s["displayName"],
                "email": s["email"],
                "role": s["roles"][0],
                "roles": s["roles"],
                "isActive": True,
                "createdAt": SERVER_TIMESTAMP,
                "updatedAt": SERVER_TIMESTAMP,
            }, merge=True)
            print("Created user:", s["email"], "uid:", user.uid)
        except auth.EmailAlreadyExistsError:
            # Fetch existing user to get UID for profiles
            try:
                user = auth.get_user_by_email(s["email"])
                uid_by_email[s["email"]] = user.uid
                db.collection("userProfiles").document(user.uid).set({
                    "displayName": s["displayName"],
                    "email": s["email"],
                    "role": s["roles"][0],
                    "roles": s["roles"],
                    "isActive": True,
                    "updatedAt": SERVER_TIMESTAMP,
                }, merge=True)
                print("Updated profile for existing user:", s["email"])
            except Exception as e:
                print("Skip user", s["email"], e)
        except Exception as e:
            print("Skip user", s["email"], e)

    admin_uid = uid_by_email.get("admin@neurorehab.demo")
    nurse_uid = uid_by_email.get("nurse@neurorehab.demo")
    doctor_uid = uid_by_email.get("doctor@neurorehab.demo")
    therapist_uid = uid_by_email.get("therapist@neurorehab.demo")

    # --- 2) Org config (settings lists) ---
    config_lists = {
        "PSY": ["Orientation", "Mood & Affect", "Thought Content", "Thought Process", "Perceptual Disturbances", "Insight", "Judgment", "Psychomotor Activity", "Sleep Pattern", "Appetite"],
        "BEH": ["Cooperation", "Peer Interaction", "Aggression/Irritability", "Substance Craving", "Wandering", "Emotional Regulation", "Response to Redirection", "Routine Participation"],
        "ADL": ["Personal Hygiene", "Dressing", "Toileting", "Feeding", "Mobility", "Room Maintenance", "Laundry", "Money Handling", "Time Management", "Phone Use"],
        "THER": ["Occupational Therapy", "Group Therapy", "Individual Counseling", "Yoga/Exercise", "Art/Music/Dance", "Vocational Training", "Life Skills", "Recreation", "Psychoeducation", "Cognitive Remediation"],
        "RISK": ["Suicidal Ideation", "Aggression/Violence", "Absconding Risk", "Substance Relapse", "Falls/Physical Safety", "Vulnerability", "Medication Safety"],
        "diagnosisOptions": ["Schizophrenia", "Bipolar Disorder", "Major Depressive Disorder", "Anxiety Disorder", "Personality Disorder", "Substance Use Disorder", "Cognitive Disorder", "Other"],
        "wardNames": ["Ward A", "Ward B", "Ward C", "General Ward", "High Dependency", "Step-down"],
        "roomBedNumbers": ["A/101", "A/102", "A/103", "B/201", "B/202", "C/301", "C/302", "GD/1", "GD/2", "HD/1", "SD/1"],
    }
    db.collection("config").document("org").set(config_lists, merge=True)
    print("Wrote config/org (settings lists)")

    # --- 3) Clients (patients) ---
    now = datetime.now(timezone.utc)
    today = now.strftime("%Y-%m-%d")
    admit_30 = (now - timedelta(days=30)).strftime("%Y-%m-%d")
    admit_14 = (now - timedelta(days=14)).strftime("%Y-%m-%d")
    planned_15 = (now + timedelta(days=15)).strftime("%Y-%m-%d")
    planned_30 = (now + timedelta(days=30)).strftime("%Y-%m-%d")

    clients_data = [
        {"name": "Alice Cooper", "dob": "1985-03-12", "gender": "Female", "diagnosis": "Bipolar Disorder", "admissionDate": admit_30, "plannedDischargeDate": planned_30, "status": "active", "currentRisk": "high", "assignedTherapist": "Therapist Lee", "ward": "Ward A", "roomNumber": "A/101", "createdBy": admin_uid or ""},
        {"name": "Bob Wilson", "dob": "1972-07-08", "gender": "Male", "diagnosis": "Schizophrenia", "admissionDate": admit_14, "plannedDischargeDate": planned_15, "status": "active", "currentRisk": "medium", "assignedTherapist": "Dr. Smith", "ward": "Ward B", "roomNumber": "B/201", "createdBy": admin_uid or ""},
        {"name": "Carol Davis", "dob": "1990-11-22", "gender": "Female", "diagnosis": "Major Depressive Disorder", "admissionDate": admit_30, "plannedDischargeDate": planned_30, "status": "active", "currentRisk": "low", "assignedTherapist": "Therapist Lee", "ward": "General Ward", "roomNumber": "GD/1", "createdBy": admin_uid or ""},
        {"name": "David Brown", "dob": "1965-01-05", "gender": "Male", "diagnosis": "Anxiety Disorder", "admissionDate": admit_14, "plannedDischargeDate": planned_15, "status": "active", "currentRisk": "none", "assignedTherapist": "Dr. Smith", "ward": "Ward C", "roomNumber": "C/301", "createdBy": admin_uid or ""},
    ]

    client_ids = []
    for c in clients_data:
        c["createdAt"] = SERVER_TIMESTAMP
        c["updatedAt"] = SERVER_TIMESTAMP
        ref = db.collection("clients").add(c)
        client_ids.append(ref[1].id)
        print("Added client:", c["name"], "->", ref[1].id)

    # --- 4) Diagnosis history for first two clients ---
    for i, cid in enumerate(client_ids[:2]):
        db.collection("clients").document(cid).collection("diagnosisHistory").add({
            "diagnosis": clients_data[i]["diagnosis"],
            "fromDate": clients_data[i]["admissionDate"],
            "addedBy": doctor_uid or admin_uid or "",
            "addedByName": "Dr. Smith" if doctor_uid else "Admin",
            "createdAt": SERVER_TIMESTAMP,
        })
    print("Added diagnosis history for 2 clients")

    # --- 5) Reports (recent, various sections) ---
    sections = ["psychiatric", "behavioral", "adl", "therapeutic", "risk"]
    payloads = {
        "psychiatric": {"ratings": {"Orientation": 4, "Mood & Affect": 3, "Thought Content": 4}, "notes": "Stable."},
        "behavioral": {"ratings": {"Cooperation": 5, "Peer Interaction": 4}, "notes": "Engaged in group."},
        "adl": {"levels": {"Personal Hygiene": "Independent", "Mobility": "Supervised"}, "notes": ""},
        "therapeutic": {"activities": {"Group Therapy": {"attendance": "Yes", "engagement": "Good"}}, "notes": ""},
        "risk": {"levels": {"Suicidal Ideation": "None", "Aggression/Violence": "Low"}, "notes": ""},
    }
    submitted_by = nurse_uid or admin_uid or ""
    submitted_name = "Nurse Jane" if nurse_uid else "Admin User"

    for j, cid in enumerate(client_ids):
        name = clients_data[j]["name"]
        for sec in sections:
            db.collection("reports").add({
                "clientId": cid,
                "clientName": name,
                "section": sec,
                "submittedBy": submitted_by,
                "submittedByName": submitted_name,
                "payload": payloads.get(sec, {}),
                "createdAt": SERVER_TIMESTAMP,
            })
    print("Added reports for all clients x sections")

    # --- 6) RTDB chat (sample messages via REST API) ---
    try:
        import requests
        from google.oauth2 import service_account
        from google.auth.transport.requests import Request as AuthRequest

        scopes = ["https://www.googleapis.com/auth/firebase.database", "https://www.googleapis.com/auth/userinfo.email"]
        cred_rtdb = service_account.Credentials.from_service_account_file(key_file, scopes=scopes)
        cred_rtdb.refresh(AuthRequest())
        token = cred_rtdb.token
    except Exception as e:
        print("RTDB skip (no REST seed):", e)
        token = None

    if token:
        base = DATABASE_URL.rstrip("/")
        channels = [("General_Ward", "General Ward"), ("Urgent_Alerts", "Urgent Alerts")]
        for ch_key, ch_name in channels:
            ts = int(time.time() * 1000)
            payload = {
                "text": "Seed message for " + ch_name,
                "sender": "System",
                "senderId": "",
                "isUrgent": ch_key == "Urgent_Alerts",
                "timestamp": ts,
            }
            # REST API: POST to .../chat/ChannelKey.json appends a new message
            url = f"{base}/chat/{ch_key}.json?access_token={token}"
            r = requests.post(url, json=payload, timeout=10)
            if r.status_code in (200, 204):
                print("RTDB message added:", ch_name)
            else:
                print("RTDB", ch_name, r.status_code, r.text[:200])

    print("\nDone. You can log in with:")
    for s in staff:
        print("  ", s["email"], " / ", s["password"])


if __name__ == "__main__":
    main()
