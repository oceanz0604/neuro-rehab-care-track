# Implementation Plan — NeuroRehab CareTrack

Scope: role-based access control (RBAC) with UI gating, plus remaining features from the spec (excluding Payment Mode, Sleep Hours Trend, Doctor approval, HL7/FHIR, and monthly auto-generation).

---

## 1. Roles to Implement

| Role key | Display name | Description |
|----------|--------------|-------------|
| `admin` | Admin | Full access: user management, org settings, all clients and reports, family reports. |
| `psychiatrist` | Psychiatrist | Full clinical read; risk alerts and escalation; can write any report section; family report view/export. |
| `nurse` | Nurse | Shift reporting: psychiatric, behavioral, medication (when added), risk; read clients and reports; no admin, no settings. |
| `therapist` | Therapist | ADL + Therapeutic sections (read/write); read psychiatric, behavioral, risk; read clients; family report view/export. |
| `psychologist` | Psychologist | Psychiatric + Behavioral (read/write); read other sections; read clients; family report view/export. |
| `social_worker` | Social Worker | Family report (primary): view, generate, export PDF; read clients and basic report summary; no clinical report write. |
| `rehab_worker` | Rehab Worker | ADL + Therapeutic (read/write); read clients; family report view/export. |
| `care_taker` | Care Taker | Limited: read assigned clients (or read-only client list); can submit limited sections if needed (e.g. ADL only) — TBD per centre. |

**Current codebase:** roles are `nurse`, `doctor`, `therapist`, `support`, `admin`.  
**Target:** add `psychiatrist`, `psychologist`, `social_worker`, `rehab_worker`, `care_taker`; keep `admin`; map `doctor` → `psychiatrist` for existing data.

---

## 2. Access Control Matrix

| Capability | admin | psychiatrist | nurse | therapist | psychologist | social_worker | rehab_worker | care_taker |
|------------|:-----:|:------------:|:-----:|:---------:|:-------------:|:-------------:|:-----------:|:----------:|
| **Admin panel** (Staff, Settings) | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Dashboard** (view) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Patients list** (view) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅* |
| **Add patient** | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Edit patient** | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Discharge patient** | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **View patient detail** (all tabs) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅* |
| **Submit: Psychiatric** | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ |
| **Submit: Behavioral** | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ |
| **Submit: Medication & Compliance** (when built) | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Submit: ADL** | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ | ○ |
| **Submit: Therapeutic** | ✅ | ✅ | ❌ | ✅ | ❌ | ❌ | ✅ | ❌ |
| **Submit: Risk** | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Report history** (view) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Family Reports** (view, generate, export PDF) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Team Chat** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Notifications / Alerts** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |

- ✅ = allowed  
- ❌ = not allowed (menu/tab/button hidden or disabled)  
- ○ = optional (care_taker: configurable, e.g. ADL only)  
- \* care_taker: optionally restrict to “assigned” clients only (future: assigned list)

---

## 3. UI Gating (Buttons & Options by Role)

### 3.1 Navigation (sidebar)

| Item | Show for |
|------|----------|
| Dashboard | All |
| Patients | All |
| Team Chat | All |
| Family Reports | All |
| **Admin** | `admin` only |

### 3.2 Dashboard

| Element | Show for |
|---------|----------|
| Refresh | All |
| Stats cards | All |
| Risk Alerts (clickable) | All |
| Recent Reports | All |

### 3.3 Patients list

| Element | Show for |
|---------|----------|
| Add Patient button | `admin`, `psychiatrist`, `nurse` |
| Search / filters | All |
| Row click → Patient detail | All |

### 3.4 Patient detail

| Element | Show for |
|---------|----------|
| Tabs: Overview, Psychiatric, Behavioral, ADL, Therapeutic, Risk, History | All see all tabs (read). Write per section per matrix above. |
| Edit button | `admin`, `psychiatrist`, `nurse` |
| Discharge button | `admin`, `psychiatrist` |
| Back button | All |
| **Save Report** (per section) | Shown only if role can submit that section; otherwise tab is read-only or hidden save. |

### 3.5 Patient detail — section visibility

- **Read-only for role:** show last report + data; hide “Save Report” and edit controls.  
- **No access:** hide tab (e.g. Medication for therapist) or show “No permission” (recommended: hide tab if role cannot read or write that section).  
- **Write access:** show form + “Save Report” as today.

Proposed: all roles can **read** all sections (so doctor/nurse can review). **Write** is gated by matrix (e.g. only nurse/psychiatrist/psychologist can save Psychiatric).

### 3.6 Family Reports

| Element | Show for |
|---------|----------|
| Page access | All |
| Client select, month, language | All |
| Generate preview | All |
| Export PDF | All |

### 3.7 Admin

| Element | Show for |
|---------|----------|
| Staff tab | `admin` only |
| Settings tab | `admin` only |
| Add Staff, Edit, Deactivate/Reactivate | `admin` only |
| Export/Import/Reset config | `admin` only |

### 3.8 Top bar / global

| Element | Show for |
|---------|----------|
| Theme toggle | All |
| Notifications bell | All |
| Shift badge | All |

---

## 4. Firestore Rules (aligned with roles)

- **Today:** any authenticated user can read/write `clients` and `reports`; only `admin` can write `config` and manage `userProfiles`.
- **Phase 2 (optional):** stricter rules, e.g.  
  - `reports`: write only if user role is allowed to write that `section` (would require reading `userProfiles` in rules).  
  - `clients`: add/edit only for `admin`, `psychiatrist`, `nurse`; discharge only `admin`, `psychiatrist`.

First phase: **UI gating only** (no Firestore rule changes). Second phase: tighten rules to match matrix if required.

---

## 5. Implementation Phases

### Phase 1 — Roles and UI gating (no new features)

1. **Roles**
   - Extend role list in Admin (add/edit staff) to: `admin`, `psychiatrist`, `nurse`, `therapist`, `psychologist`, `social_worker`, `rehab_worker`, `care_taker`.
   - Migrate existing `doctor` → `psychiatrist` in code/display (optional data migration for existing users).
   - Store role in `userProfiles.role` (already present).

2. **UI gating**
   - Add a small `permissions` helper (e.g. `canAddPatient(role)`, `canEditPatient(role)`, `canSubmitSection(role, section)`, `canAccessAdmin(role)`).
   - Wire permissions to UI:
     - Hide **Admin** nav item for non-admin.
     - **Patients:** show “Add Patient” only for admin, psychiatrist, nurse.
     - **Patient detail:** show “Edit” for admin, psychiatrist, nurse; “Discharge” for admin, psychiatrist.
     - **Patient detail tabs:** show “Save Report” only when `canSubmitSection(profile.role, section)`; otherwise show section as read-only (or hide Save button).
   - No change to Family Reports or Team Chat visibility (all can access).

3. **Testing**
   - Log in as each role (create test users) and confirm nav, buttons, and save visibility match the matrix.

### Phase 2 — Client fields and Medication & Compliance

1. **Client profile**
   - Add fields: **Legal Status**, **Emergency Contact**, **Consent** (e.g. URL or “uploaded” flag; file upload optional later).
   - Update Firestore `clients` schema and `normalizeClient`; add to Add/Edit patient forms.

2. **Medication & Compliance section**
   - New report section `medication` (or `compliance`).
   - Fields: Medication Given (Y/N), Compliance (Full/Partial/Refused), Side Effects (None/EPS/Sedation/Other), PRN Given (Y/N + reason), Vitals (BP/Pulse/Temp/Weight), Lab Due (Y/N), notes.
   - Add to patient detail tabs; write permission for admin, psychiatrist, nurse (same as other clinical sections in matrix).
   - Optional: alert when “Refused” repeated (e.g. last 3 reports).

### Phase 3 — Risk extensions and escalation

1. **Risk section**
   - Add **Restraint Used** (Y/N + justification), **Intervention Taken** (text) to risk report payload and form.
   - When risk level is Medium/High, optional “Notify Psychiatrist” action that creates an alert or in-app notification; add “acknowledged” flag and show in notifications for psychiatrist.

### Phase 4 — Dashboard trend graphs and audit trail

1. **Trend graphs**
   - Add simple charts (e.g. ADL score or risk level over time) on dashboard or patient overview (last 4–8 weeks).

2. **Audit trail**
   - New collection `auditLog` (or `audit`): `uid`, `action`, `targetType`, `targetId`, `timestamp`, optional `details`.
   - Log: report save, client add/update, discharge.
   - Optional: Admin-only “Audit log” view to query by user/date/action.

---

## 6. Role List Summary (for implementation)

Use this list in code (e.g. dropdown in Admin, and in `permissions.js`):

```text
admin
psychiatrist
nurse
therapist
psychologist
social_worker
rehab_worker
care_taker
```

Display names (for UI): Admin, Psychiatrist, Nurse, Therapist, Psychologist, Social Worker, Rehab Worker, Care Taker.

---

## 7. Out of Scope (per your decision)

- Payment Mode
- Sleep Hours Trend (family report)
- Doctor approval before family report release
- Monthly automatic report generation
- HL7 / FHIR

---

*Next step: implement Phase 1 (roles list in Admin + UI gating) in the codebase.*
