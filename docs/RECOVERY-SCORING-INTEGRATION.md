# Recovery Scoring — Implementation Plan

> Integrates **Relapse Risk** (new report section), **6 recovery indices** (SSI, IFI, FRI, FSI, BSI, RRS), and a **Master Recovery Score (MRS)** into the Progress Report for each patient.

---

## A. What We're Building

### 1. New Report Section: Relapse Risk

A new section in the existing Add Report flow. Staff fill three 0–3 items weekly per patient.

| Item | Score | Description |
|------|-------|-------------|
| Treatment non-adherence | 0–3 | How non-adherent is the patient |
| Ongoing stressful situations | 0–3 | Environmental stress level |
| High EE (Expressed Emotion) by family | 0–3 | Family expressed-emotion level |

**Total:** 0–3 = Low, 4–6 = Moderate, 7–9 = High Risk.

### 2. Six Recovery Indices (each 0–100)

| Index | Name | Derived from |
|-------|------|-------------|
| **SSI** | Symptom Severity | `psychiatric` reports → invert ratings so higher = better |
| **IFI** | Insight & Flexibility | `psychiatric` (Insight, Judgment) + `behavioral` (Emotional Regulation, Response to Redirection) |
| **FRI** | Functional Recovery | `adl` + `therapeutic` reports (existing bar logic) |
| **FSI** | Family Stability | Manual input or 0 until family assessment is added |
| **BSI** | Biological Stability | `medication` reports (compliance, vitals) |
| **RRS** | Relapse Risk Score | `relapse_risk` reports → normalise total 0–9 to 0–100 (inverted: 0 risk = 100 score) |

### 3. Master Recovery Score (MRS)

Weighted composite: `MRS = (SSI × w1) + (IFI × w2) + (FRI × w3) + (FSI × w4) + (BSI × w5)`.

Default weights (customisable by admin):

| Domain | Maps to | Default |
|--------|---------|---------|
| Symptom Reduction | SSI | 30% |
| Insight | IFI | 20% |
| Function | FRI | 25% |
| Family System | FSI | 15% |
| Medication Adherence | BSI | 10% |

---

## B. Files to Change (exact locations)

### Phase 1 — New Report Section: Relapse Risk

| File | What to change |
|------|---------------|
| `static/js/pages/patient-detail.js` line 36–43 | Add `{ key: 'relapse_risk', label: 'Relapse Risk', icon: 'fa-rotate-left' }` to `REPORT_SECTIONS` |
| `static/js/components/report-modal.js` line 8–14 | Add `relapse_risk: ['Treatment Non-adherence', 'Stressful Situations', 'High EE by Family']` to `DEFAULT_PARAMS` |
| `static/js/components/report-modal.js` line 17 | Add `relapse_risk: 'RR'` to `KEY_MAP` |
| `static/js/components/report-modal.js` line 20 | Add `relapse_risk: 'amber'` to `sectionColor` map |
| `static/js/components/report-modal.js` ~line 128–134 | In `buildFormHtml`: add `if (section === 'relapse_risk') return buildRelapseRiskForm(params, payload);` |
| `static/js/components/report-modal.js` (new function) | Add `buildRelapseRiskForm(params, payload)`: three rows, each a select 0–3 (data attr `data-rr`). Optional week picker input. |
| `static/js/components/report-modal.js` ~line 136–176 | In `collectPayloadFromForm`: add `else if (section === 'relapse_risk') { ... }` to collect `{ treatmentNonAdherence, stressfulSituations, highEE }` from `[data-rr]` selects (parseInt). |
| `static/js/components/report-modal.js` ~line 29–57 | In `formatPayloadForView`: add `else if (section === 'relapse_risk') { ... }` to render a view table with three rows + total + Low/Mod/High label. |
| `static/js/permissions.js` line 132–139 | Add `relapse_risk: 'nurse'` to `SECTION_MIN_ROLE` |
| `static/js/pages/dashboard.js` line 411–417 | Add `relapse_risk: 'fa-rotate-left'` to `SECTION_ICONS`, `relapse_risk: 'amber'` to `SECTION_COLORS` |

**Form UI (buildRelapseRiskForm):**

```
Treatment Non-adherence  [0] [1] [2] [3]   (select or button group, data-rr="treatmentNonAdherence")
Stressful Situations     [0] [1] [2] [3]   (data-rr="stressfulSituations")
High EE by Family        [0] [1] [2] [3]   (data-rr="highEE")
Week of (optional)       [date picker]      (data-rr-week)
```

**Payload shape:**

```json
{
  "treatmentNonAdherence": 2,
  "stressfulSituations": 1,
  "highEE": 3,
  "weekStart": "2026-02-23",
  "notes": ""
}
```

**No new Firestore collection.** Saved as a regular report with `section: 'relapse_risk'`.

---

### Phase 2 — Relapse Risk on Progress Report

| File | What to change |
|------|---------------|
| `static/js/pages/family-report.js` ~line 20–27 (STRINGS.en.sections) | Add `{ t: 'Relapse Risk', key: 'relapse_risk', b: 'Relapse risk monitoring for this period.' }` to `sections` array (both en and mr) |
| `static/js/pages/family-report.js` (new function) | `computeRelapseRiskCard(reports)`: filter `section === 'relapse_risk'`, get latest in range, return `{ treatmentNonAdherence, stressfulSituations, highEE, total, level }` where level = Low/Mod/High |
| `static/js/pages/family-report.js` ~line 122+ (generateReport) | After existing bars/trend: call `computeRelapseRiskCard(data)`, render a card: "Relapse Risk: Low/Mod/High (total X/9)" with three sub-scores |

---

### Phase 3 — Weekly Trend Graph

| File | What to change |
|------|---------------|
| `static/js/pages/family-report.js` (new function) | `computeRelapseRiskTrend(reports, fromStr, toStr)`: group `relapse_risk` reports by week (use `createdAt` or `weekStart`), return `[{ week, total, level }]` array |
| `static/js/pages/family-report.js` (generateReport) | Render a simple inline bar/line chart (HTML+CSS bars or small canvas) showing weekly totals with colour: green (Low), amber (Mod), red (High) |

---

### Phase 4 — Derive SSI, IFI, FRI, BSI from Existing Reports

| File | What to change |
|------|---------------|
| `static/js/pages/family-report.js` (new functions) | Add index derivation functions, all returning 0–100: |

**Functions:**

| Function | Input reports | Logic |
|----------|--------------|-------|
| `computeSSI(reports)` | `psychiatric` | Average all rating values (1–5), normalise to 0–100 (rating/5 × 100) |
| `computeIFI(reports)` | `psychiatric` + `behavioral` | Average ratings for Insight, Judgment (psychiatric) + Emotional Regulation, Response to Redirection (behavioral), normalise to 0–100 |
| `computeFRI(reports)` | `adl` + `therapeutic` | Combine existing `avgRatingFromSection(reports, 'adl')` and `avgEngagement(reports)`, average the two |
| `computeFSI()` | N/A | Return 0 (placeholder until family assessment exists) |
| `computeBSI(reports)` | `medication` | Score compliance (Full=100, Partial=50, Refused=0), average across reports |
| `computeRRS(reports)` | `relapse_risk` | Latest report total (0–9), invert and normalise: `((9 - total) / 9) × 100` so 0 risk = 100 |

---

### Phase 5 — MRS Weights in Config + Admin UI

| File | What to change |
|------|---------------|
| `static/js/pages/family-report.js` (new function) | `computeMRS(indices, weights)`: `sum(index[key] × weight[key] / 100)` for each domain |
| `static/js/pages/family-report.js` (generateReport) | Load weights from `state.config.mrsWeights` (or defaults); compute all indices; compute MRS; render as prominent "Recovery Score: 68%" |
| `static/js/db.js` (getOrgConfig/setOrgConfig) | Already exists — store `mrsWeights` in `config/org` doc |
| `static/js/pages/settings.js` | Add a "Recovery Score Weights" collapsible section: five number inputs (Symptom Reduction, Insight, Function, Family System, Medication Adherence); validate sum = 100; save via `setOrgConfig({ mrsWeights: { ... } })` |
| `index.html` (~line 369, admin-parameters-wrap) | Add a new collapsible section `parameters-section-mrs-weights` with placeholder div `id="mrs-weights-content"` |

**Default weights (used when no config exists):**

```javascript
var DEFAULT_MRS_WEIGHTS = {
  symptomReduction: 30,
  insight: 20,
  function: 25,
  familySystem: 15,
  medicationAdherence: 10
};
```

---

### Phase 6 — Progress Report UI (indices + MRS + PDF)

| File | What to change |
|------|---------------|
| `static/js/pages/family-report.js` (generateReport) | After existing content, add: |

**UI additions to Progress Report:**

1. **Recovery Indices card** (6 gauges or progress bars):
   - SSI: Symptom Severity — 72%
   - IFI: Insight & Flexibility — 65%
   - FRI: Functional Recovery — 80%
   - FSI: Family Stability — 0% (N/A)
   - BSI: Biological Stability — 90%
   - RRS: Relapse Risk — 78%

2. **Relapse Risk Monitor card**:
   - Three scores + total + Low/Mod/High badge
   - Weekly trend bars (Phase 3)

3. **Master Recovery Score** (prominent):
   - Large circular gauge or bold text: "68%"
   - Subtitle: "Based on weighted recovery indices"

4. **PDF export**: Include all of the above in `#fr-report-content`.

---

## C. Implementation Checklist

- [x] **Phase 1**: Add `relapse_risk` section to report sections, form, payload, permissions, dashboard icons
- [x] **Phase 2**: Show Relapse Risk card on Progress Report (latest in range)
- [x] **Phase 3**: Weekly trend graph on Progress Report
- [x] **Phase 4**: Derive SSI, IFI, FRI, BSI, RRS from existing + relapse_risk reports
- [x] **Phase 5**: MRS weights in org config + Admin UI
- [x] **Phase 6**: Full Progress Report UI (indices cards + MRS gauge + Relapse Risk card + trend) + PDF

---

## D. Data Flow Summary

```
[Add Report → Relapse Risk]
        ↓
  Firestore reports (section: 'relapse_risk')
        ↓
[Progress Report page]
        ↓
  getClientReports(clientId)  ──→  filter by section
        ↓                              ↓
  psychiatric ──→ SSI, IFI      relapse_risk ──→ RRS + card + trend
  behavioral  ──→ IFI
  adl         ──→ FRI
  therapeutic ──→ FRI
  medication  ──→ BSI
  (manual)    ──→ FSI (0 for now)
        ↓
  All indices (0–100)
        ↓
  MRS = weighted sum (weights from config/org)
        ↓
  Render: indices cards + MRS gauge + Relapse Risk card + trend
        ↓
  PDF export
```
