# Firebase Usage Analysis — Spark (Free) Plan

This document estimates **Firestore** and **Realtime Database (RTDB)** usage for NeuroRehab CareTrack and checks fit within the free tier, with suggested optimizations.

---

## 1. Free Tier Limits (Spark Plan)

### Firestore
| Resource | Limit |
|----------|--------|
| Document reads | **50,000 / day** |
| Document writes | **20,000 / day** |
| Document deletes | **20,000 / day** |
| Stored data | 1 GiB |
| Outbound transfer | 10 GiB / month |

### Realtime Database
| Resource | Limit |
|----------|--------|
| Stored data | 1 GB |
| **Download bandwidth** | **10 GB / month** |
| Simultaneous connections | **100** |

---

## 2. Firestore Usage by Operation

### 2.1 Reads (each `.get()` or snapshot = 1 read per document)

| Call site | Operation | Docs per call | When |
|-----------|-----------|----------------|------|
| **Login / app load** | | | |
| `loadConfig()` | `getOrgConfig()` | 1 | Once per session (cached 5 min) |
| Auth callback | `getUserProfile(uid)` | 1 | Once per session (cached 5 min) |
| `loadData()` | `getClients(force)` | **N** (all clients) | On load; refresh bypasses cache |
| `loadData()` | `getRecentReports(20)` | 20 | On load |
| `AppNotify.refresh()` | `getUnacknowledgedEscalations()` | up to **50** | Every loadData (psychiatrist only) |
| **Reports page** | `getRecentReports(400)` | **400** | First open of Reports (no cache) |
| **Patient detail** | `getClient(id)` | 0 or 1 | From cache or 1 read |
| **Patient detail** | `getClientReports(id, null, 100)` | up to 100 | Overview + trend |
| **Patient detail** | `loadOverviewTrend()` | `getClientReports(id, null, 100)` | **100** again (duplicate)** |
| **Patient detail** | `getLatestReport(id, section)` | 1 per section | 5 sections = **5 reads** |
| **Patient detail** | `loadHistory()` | `getClientReports(..., 20)` | 20 per page |
| **Family report** | `getClientReports(clientId, null, 200)` | up to **200** | Per client/month view |
| **Admin** | `getAllStaff()` | **M** (all staff) | On open (cached 5 min) |
| **Admin** | `getAuditLog(30)` | 30 | On open; "Load more" +30 |
| **Patients** | `getAllStaff()` | M | For assignee dropdown (cached) |

**Rough per-session (no cache):**
- Nurse, 50 clients: **1 + 1 + 50 + 20 + 0 = 72** reads on load.
- Psychiatrist: **+50** escalations ⇒ **122** reads on load.
- Opening **Reports** once: **+400** ⇒ **472** (nurse) or **522** (psychiatrist).
- Opening **one Patient detail**: **1 + 100 + 100 + 5 + 20 = 226** (overview + trend + 5 sections + history).
- Opening **Family report** for one client: **+200**.
- Opening **Admin**: **M + 30** (e.g. 10 staff ⇒ 40).

So **one active user** doing dashboard → Reports → one patient → family report can easily do **~900–1200+ reads in a session**. **50,000 / day** ≈ **~40–60 such sessions per day** if no optimizations.

### 2.2 Writes

| Action | Writes |
|--------|--------|
| `saveReport()` | 1 |
| `logAudit('report_save', ...)` | 1 |
| `addClient()` | 1 + 1 audit |
| `updateClient()` | 1 + 1 audit |
| `dischargeClient()` | 1 + 1 audit |
| `addRiskEscalation()` | 1 |
| `acknowledgeEscalation()` | 1 |
| `setUserProfile()` / `setOrgConfig()` / `setConfig()` | 1 each |
| `createStaffAccount()` | 1 (userProfile) |
| `updateStaffProfile()` | 1 |

Writes are well within **20,000/day** unless you have very heavy reporting or bulk updates.

### 2.3 Deletes

No document deletes in the app; deletes = **0**.

---

## 3. Realtime Database (RTDB) Usage

- **Chat** is the only RTDB use (no Firestore for chat).
- Billing is by **downloaded bytes**, not per read.

### 3.1 Connections per user

- **Unread listeners**: 6 channels × `limitToLast(1)` ⇒ **6 persistent listeners**.
- **Viewing one channel**: 1 × `limitToLast(50)` ⇒ **1 listener**.
- **Total per user**: **7 listeners** ⇒ 7 connections (or fewer if SDK shares a connection; worst case ~7).
- **10 users** ⇒ up to **~70 connections** (under 100).

### 3.2 Bandwidth (download)

- **Unread**: 6 × small payload (1 message per channel) on each change; initial + updates.
- **Active channel**: `limitToLast(50)` ⇒ up to ~50 messages per sync; each message ~200–500 B ⇒ **~10–25 KB per full refresh**.
- **`getUrgentMessages(now - day)`**: One-time per `AppNotify.refresh()`; can be many messages in 24 h ⇒ **high if many urgent messages**.

**10 GB/month** ≈ **~333 MB/day**. If each user pulls ~1–2 MB/day for chat + notifications, **~150–300 active users/month** could stay within free tier, depending on message volume.

---

## 4. Risk Summary (Before Optimizations)

| Risk | Issue |
|------|--------|
| **Firestore reads** | Reports page **400**-doc fetch and patient-detail **double 100**-doc fetch can push **~900–1200+ reads per active session**. **50k/day** can be exceeded with **~40–60 full sessions/day**. |
| **RTDB connections** | **7 per user**; 100-user cap ⇒ **~14 users** if each has 7 connections. For a single small team (e.g. &lt;15), usually OK. |
| **RTDB bandwidth** | `getUrgentMessages(24h)` with no limit can download a lot if Urgent channel is busy; one-time per refresh. |

---

## 5. Optimizations Implemented / Recommended

### 5.1 Firestore (implemented in codebase)

1. **Reports page** ✅
   - **Before**: `getRecentReports(400)` on first open ⇒ **400 reads**.
   - **After**: Seed from `state.recentReports` (20) when user comes from dashboard (0 extra reads). Otherwise fetch **50** (not 400). **Saves ~350–400 reads** on first open when not cached.

2. **Patient detail** ✅
   - **Before**: `getClientReports(id, null, 100)` for overview/trend and again in history fallback ⇒ up to **200 reads**.
   - **After**: Single fetch of 100 cached in `_cachedReports100`; reused for overview trend and for history-tab fallback (filter by section client-side). **Saves ~100 reads** per patient when history fallback is used.

3. **Family report**
   - **Before**: `getClientReports(clientId, null, 200)` per month.
   - **After**: Left at 200 for full month view. Optional: reduce to 100 if one-month report count is acceptable.

4. **Escalations** ✅
   - **Before**: `getUnacknowledgedEscalations()` limit **50**.
   - **After**: Limit **20**. **Saves up to 30 reads** per refresh for psychiatrists.

5. **Cache**
   - **Already**: 5-min TTL on clients, profile, org config, staff. Keep using cache and avoid `force` unless user explicitly refreshes.

### 5.2 RTDB (implemented)

1. **Urgent messages** ✅
   - **Before**: `getUrgentMessages(now - day)` with no limit ⇒ all messages in 24 h.
   - **After**: `.limitToLast(50)` on the query so notification bell only loads last 50. **Reduces bandwidth** when Urgent channel is very active.

2. **Connections**
   - Unread + one channel = 7 listeners per user. For **Spark 100-connection** limit, keep **concurrent users** to **&lt;15** or ensure only one tab per user to stay safe.

---

## 6. Estimated Usage After Optimizations

Assuming **~20 active users/day**, each doing:

- 1 login, 2–3 navigations (dashboard, reports, 1–2 patients), no admin:

| Event | Reads (before) | Reads (after) |
|-------|-----------------|----------------|
| Load (nurse, 50 clients) | 72 | 72 |
| Reports page | 400 | 50 (first page) |
| 1 Patient detail | 226 | ~120 (shared 100 + 5 + 20) |
| **Per user (approx)** | **~700** | **~250** |
| **20 users** | **~14,000** | **~5,000** |

So **well under 50,000 reads/day** with the optimizations above.

---

## 7. Monitoring

- **Firebase Console** → **Usage and billing** → **Firestore** and **Realtime Database**.
- Watch **document reads** (Firestore) and **downloaded bytes** (RTDB) daily; set budget alerts if you enable Blaze.

---

## 8. References

- [Firestore quotas](https://firebase.google.com/docs/firestore/quotas)
- [Firebase pricing plans](https://firebase.google.com/docs/projects/billing/firebase-pricing-plans)
- [Realtime Database billing](https://firebase.google.com/docs/database/usage/billing)
