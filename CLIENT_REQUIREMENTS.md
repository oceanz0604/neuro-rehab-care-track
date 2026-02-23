# Client Requirements (Parsed & Mapped)

This document restates the client feedback in clear, actionable requirements and maps them to the current codebase.

**P1 phase implemented** (see summary table for items): Discharge (planned + final), Diagnosis history, Client Progress Report naming + custom date + last 4 weeks + report note + edit), Shift removed, Multiple roles + medical_officer, Therapist “My patients” view, Report edit (admin only).

---

## 1. Discharge dates

| # | Requirement | Clarification | Current state |
|---|-------------|---------------|---------------|
| 1.1 | **Planned Discharge Date** | Add a field per patient. Show on: (a) Patient listing (table/card), (b) Patient profile/detail page. | **Not present.** Client model has `dischargeDate` (used only when discharged). Need new field e.g. `plannedDischargeDate`. |
| 1.2 | **Final Discharge Date** | When patient is discharged (exit), set/update a “Final Discharge Date”. | **Partially present.** `db.dischargeClient(id, date)` already sets `dischargeDate` on discharge. Rename or add explicit “Final Discharge Date” in UI and ensure it’s always set on discharge. |

**Implementation:** Add `plannedDischargeDate` to client schema and UI (patients list, patient detail header/edit). Treat existing `dischargeDate` as “Final Discharge Date” (or add `finalDischargeDate` and keep backward compatibility).

---

## 2. Diagnosis with history

| # | Requirement | Clarification | Current state |
|---|-------------|---------------|---------------|
| 2.1 | **Diagnosis field with history** | Each patient has a Diagnosis field; support **history** (changes over time). | **Single diagnosis only.** Patient has `diagnosis` (string). No history. Need diagnosis history (e.g. subcollection or array of `{ diagnosis, from, to, by }`) and UI to view/edit. |

**Implementation:** Add diagnosis history (Firestore structure + API), keep current `diagnosis` as “current” for backward compatibility. UI: show current + “History” in profile; edit adds new history entry.

---

## 3. Mobile & tablet optimization

| # | Requirement | Clarification | Current state |
|---|-------------|---------------|---------------|
| 3.1 | **Responsive layout** | App should work well on mobile and tablet (touch, layout, readability). | **Partially responsive.** Sidebar, topbar, tables exist; no dedicated breakpoints or “card” listing for small screens. Need viewport breakpoints, touch targets, optional card view for patients/reports. |

**Implementation:** CSS breakpoints, optional card layout for patients (and reports) on small screens, ensure modals and forms are usable on touch.

---

## 4. Patient detail tab simplification

| # | Requirement | Clarification | Current state |
|---|-------------|---------------|---------------|
| 4.1 | **Single unified view** | Replace multiple tabs on patient detail with one consolidated view. | **Multiple tabs.** `patient-detail.js` has: Overview, Psychiatric, Behavioral, Medication, ADL, Therapeutic, Risk, History. Client wants one scrollable view instead of tab switching. |

**Implementation:** Redesign patient detail as one long page (e.g. Overview block, then each clinical section as a block, then History). Optional: collapsible sections or sticky section nav for long pages.

---

## 5. Reports naming & behavior (“Client Progress Report”)

| # | Requirement | Clarification | Current state |
|---|-------------|---------------|---------------|
| 5.1 | **Name change** | Use “Client Progress Report” (or similar) for the main reports feature. | **“Reports”** in nav and page title. Rename to “Client Progress Report(s)” where appropriate. |
| 5.2 | **Custom date** | Allow user to pick a custom date (range) for viewing/generating reports. | **Fixed presets only:** Today, Yesterday, Last 7 days. Add custom date range (from/to). |
| 5.3 | **Note section** | Add a free-text “Note” (or “Additional note”) to progress reports. | **Section-level notes exist** (`payload.notes`). Confirm if a single “report-level” note is needed (e.g. for the whole submission). |
| 5.4 | **Report generated history** | Show history of when reports were generated (and possibly by whom). | **Creation only.** Reports have `createdAt`, `submittedBy`, `submittedByName`. Add “Report generated history” UI (e.g. per patient or global) if this means a separate “generation” log; otherwise clarify vs existing report list. |

**Implementation:** Rename UI to “Client Progress Report”; add date range picker; add report-level note if required; add or clarify “report generated history” (list/export of report creation events).

---

## 6. Staff: multiple roles

| # | Requirement | Clarification | Current state |
|---|-------------|---------------|---------------|
| 6.1 | **Multiple roles per staff** | A staff member can have more than one role (e.g. nurse + therapist). | **Single role.** `userProfiles` has `role` (string). Need `roles` (array) and update permissions to “user has at least one of …”. |

**Implementation:** Migrate to `roles: string[]` (or keep `role` for primary and add `roles`), update admin add/edit staff UI (multi-select), and permission checks (`canEditPatient`, `canSubmitSection`, etc.) to use roles array.

---

## 7. Admin: categorize Settings

| # | Requirement | Clarification | Current state |
|---|-------------|---------------|---------------|
| 7.1 | **Categorize Admin → Settings** | Group Settings into categories (e.g. Clinical options, Wards, etc.). | **Flat list.** Admin has Staff | Settings | Audit. Settings page shows a flat list of config sections (diagnosis options, ward names, etc.). Add categories (e.g. “Clinical”, “Facility”, “Reporting”). |
| 7.2 | **Explore ICD-11** | Consider using ICD-11 for diagnosis coding (e.g. in diagnosis options or diagnosis history). | **Not implemented.** Diagnosis is free text / config list. Research ICD-11 API or code list and add optional coding (e.g. code + label) alongside current diagnosis. |

**Implementation:** Add category headers or tabs in Settings; optionally add ICD-11 lookup/autocomplete for diagnosis (future phase).

---

## 8. Report edit & access

| # | Requirement | Clarification | Current state |
|---|-------------|---------------|---------------|
| 8.1 | **Report edit** | Allow editing of existing reports (e.g. fix typos, add note). | **Create only.** Reports are written once; no edit flow. Need edit API + UI (who can edit, time limit, audit). |
| 8.2 | **Report edit – Admin only** | Only Admin can edit reports. | **N/A until edit exists.** When implementing edit, restrict to `role === 'admin'` (or permission helper). |

**Implementation:** Add “Edit report” (e.g. from report detail modal / patient history). Backend: update document + audit. Permission: admin-only.

---

## 9. Reports view & filters

| # | Requirement | Clarification | Current state |
|---|-------------|---------------|---------------|
| 9.1 | **Reports (last 4 weeks)** | Option to view reports for “last 4 weeks” (in addition to today / yesterday / week). | **Presets:** today, yesterday, last 7 days. Add “Last 4 weeks” and custom range. |
| 9.2 | **Today’s report – clean view** | A clear, focused view for “today’s reports” (and possibly default to today). | **Already have “Today”.** Improve layout/emphasis for “today” (e.g. default to Today, cleaner table/cards). |
| 9.3 | **Diagnosis (filter)** | Filter reports by diagnosis (and/or show diagnosis on report row). | **Not present.** Reports list doesn’t filter by diagnosis. Need diagnosis on client; filter reports by client diagnosis. |
| 9.4 | **Therapist – multiple** | Support multiple therapists per patient (or filter by therapist). | **Single.** Patient has `assignedTherapist` (one). Either add “therapists” array and filter by “any of”, or keep one and add multi-select filter (by therapist) on reports. |
| 9.5 | **Remove shift field everywhere** | Remove “Shift” from UI and data (reports, staff, topbar). | **Used in:** staff profile (admin), report payload, topbar badge, report detail modal. Remove from: topbar, report submit form, report display, staff profile (or deprecate in DB). |

**Implementation:** Add “Last 4 weeks” and custom date; default Reports to “Today” with clean layout; add diagnosis (and therapist) to report row/filter; remove shift from all UIs and optionally from payload.

---

## 10. Team chat & notifications

| # | Requirement | Clarification | Current state |
|---|-------------|---------------|---------------|
| 10.1 | **Team chat alert / notification change** | Adjust how chat alerts or notifications work (e.g. sound, badge, when to notify). | **Unread badges and in-app notifications exist.** Clarify: browser push, sound, or different rules for “Urgent” vs “General”. |

**Implementation:** After clarification, adjust notification logic (e.g. only urgent, or different sound/badge for channel type).

---

## 11. Progress report algorithm (per client, admin-editable)

| # | Requirement | Clarification | Current state |
|---|-------------|---------------|---------------|
| 11.1 | **Algorithm for progress report** | Have a defined “algorithm” (e.g. rules or template) for generating progress reports; use it when generating the report. | **No algorithm.** Reports are form-based (section + payload). No shared “algorithm” or template. |
| 11.2 | **Edit algorithm per client (admin)** | Admin can edit this algorithm on-the-go per client. | **N/A.** Requires algorithm model (e.g. config per client or per section). |

**Implementation:** Define “algorithm” (e.g. which sections, weights, or narrative template). Store per client (or global with overrides). Use in “generate report” flow. Admin-only edit UI for that config.

---

## 12. Role: medical-officer

| # | Requirement | Clarification | Current state |
|---|-------------|---------------|---------------|
| 12.1 | **New role** | Add role `medical-officer` with appropriate permissions (view/edit/report/discharge etc.). | **Roles:** admin, psychiatrist, nurse, therapist, psychologist, social_worker, rehab_worker, care_taker. Add `medical_officer` (or `medical-officer`) and map in `permissions.js` and admin role list. |

**Implementation:** Add to `admin.js` ROLES and to `permissions.js` (e.g. same as psychiatrist for patient/report/discharge if desired).

---

## 13. Role-based default views (Doctor vs Therapist)

| # | Requirement | Clarification | Current state |
|---|-------------|---------------|---------------|
| 13.1 | **View for Doctor** | Different default or filtered view for “doctor” (e.g. psychiatrist / medical-officer). | **No role-based view.** All roles see same dashboard/patients list. |
| 13.2 | **View for Therapist** | Therapists see **their attached patients first**, then can access all other patients. | **No “attached” concept.** Patient has one `assignedTherapist`. Need “my patients” vs “all patients” (filter or separate list) and default to “my patients” for therapist role. |

**Implementation:** For therapist (and optionally doctor): (1) “My patients” = patients where `assignedTherapist` matches current user (by name or by linked uid if you add it). (2) Default view for therapist = “My patients” first; toggle or link to “All patients”. (3) Doctor: define “doctor” roles and give them a suitable default (e.g. all patients, or high-risk first).

---

## 14. MVP-2: Task management

| # | Requirement | Clarification | Current state |
|---|-------------|---------------|---------------|
| 14.1 | **Task management** | Separate future phase (MVP-2); not in current scope. | **Not implemented.** Defer to later phase. |

---

## Suggested implementation order (high level)

1. **Quick wins (no schema change):**  
   Rename “Reports” → “Client Progress Report”; add “Last 4 weeks” + custom date; remove shift from UI; add role `medical_officer`; default Reports to “Today” with clean view.

2. **Schema + discharge:**  
   Planned Discharge Date (field + listing + profile); clarify Final Discharge Date in UI.

3. **Report edit (admin only):**  
   Edit report API + UI; permission admin-only.

4. **Staff multiple roles:**  
   `roles[]` + migration + admin UI + permission checks.

5. **Diagnosis history:**  
   Diagnosis history model + UI (view/edit) and optional ICD-11 later.

6. **Patient detail:**  
   Single unified view (replace tabs with one scrollable page).

7. **Therapist/Doctor views:**  
   “My patients” for therapist, default views by role.

8. **Settings categories + ICD-11:**  
   Categorize Settings; explore ICD-11 for diagnosis.

9. **Progress report algorithm:**  
   Define algorithm, per-client config, use in generation, admin edit.

10. **Mobile/tablet:**  
    Responsive pass (breakpoints, cards, touch).

11. **MVP-2:**  
    Task management (separate phase).

---

## Summary table

| Theme | Items | Priority / notes |
|-------|--------|-------------------|
| Discharge | Planned + Final discharge date | P1 |
| Diagnosis | History + optional ICD-11 | P1 (history), P2 (ICD-11) |
| Reports naming & UX | “Client Progress Report”, custom date, note, history, last 4 weeks, today clean view | P1 |
| Shift | Remove everywhere | P1 |
| Roles | Multiple roles, medical-officer, doctor/therapist views | P1 (medical-officer, views), P1 (multi-role) |
| Report edit | Admin-only edit | P1 |
| Admin/Settings | Categorize Settings, ICD-11 | P2 |
| Patient detail | Single unified view | P2 |
| Algorithm | Per-client progress report algorithm, admin edit | P2 |
| Mobile/tablet | Responsive optimization | P2 |
| Chat | Notification/alert change | P2 (after clarification) |
| MVP-2 | Task management | Later |

If you tell me which items you want to implement first (e.g. “discharge + remove shift + rename reports”), I can outline concrete code changes file-by-file next.
