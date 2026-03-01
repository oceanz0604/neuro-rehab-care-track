/**
 * Settings — Report Parameters, Ward & Beds, Diagnosis Options.
 * Rendered per admin tab. No auto-save; each section has its own Save button.
 */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var _inited = false;

  /** ICD-11 Mental, behavioural or neurodevelopmental disorders (with codes). Merged with org config at load. */
  var ICD11_DIAGNOSIS_OPTIONS = [
    '6A20 - Schizophrenia',
    '6A21 - Schizoaffective disorder',
    '6A22 - Acute and transient psychotic disorder',
    '6A2Y - Other specified primary psychotic disorders',
    '6A60 - Bipolar type I disorder',
    '6A61 - Bipolar type II disorder',
    '6A62 - Cyclothymic disorder',
    '6A70 - Single episode depressive disorder',
    '6A71 - Recurrent depressive disorder',
    '6A72 - Dysthymic disorder',
    '6A73 - Mixed depressive and anxiety disorder',
    '6B00 - Generalised anxiety disorder',
    '6B01 - Panic disorder',
    '6B02 - Agoraphobia',
    '6B03 - Social anxiety disorder',
    '6B04 - Specific phobia',
    '6B05 - Separation anxiety disorder',
    '6B20 - Obsessive-compulsive disorder',
    '6B21 - Body dysmorphic disorder',
    '6B22 - Olfactory reference disorder',
    '6B23 - Hypochondriasis',
    '6B40 - Post-traumatic stress disorder',
    '6B41 - Complex post-traumatic stress disorder',
    '6B43 - Adjustment disorder',
    '6B45 - Prolonged grief disorder',
    '6B30 - Dissociative neurological symptom disorder',
    '6B31 - Dissociative amnesia',
    '6B32 - Trance disorder',
    '6B80 - Anorexia nervosa',
    '6B81 - Bulimia nervosa',
    '6B82 - Binge eating disorder',
    '6B83 - Avoidant-restrictive food intake disorder',
    '6C20 - Disorders of bodily distress',
    '6C21 - Body integrity dysphoria',
    '6C40.0 - Disorder due to alcohol use',
    '6C40.1 - Disorder due to cannabis use',
    '6C40.2 - Disorder due to opioid use',
    '6C40.3 - Disorder due to sedative use',
    '6C40.4 - Disorder due to stimulant use',
    '6C50 - Gaming disorder',
    '6C51 - Gambling disorder',
    '6C70 - Impulse control disorder',
    '6C71 - Intermittent explosive disorder',
    '6C72 - Kleptomania',
    '6C73 - Pyromania',
    '6C90 - Oppositional defiant disorder',
    '6C91 - Conduct disorder',
    '6C92 - Conduct-dissocial disorder',
    '6D10.0 - Personality disorder (mild)',
    '6D10.1 - Personality disorder (moderate)',
    '6D10.2 - Personality disorder (severe)',
    '6D10.3 - Borderline pattern',
    '6D10.4 - Antisocial pattern',
    '6D10.5 - Dissocial pattern',
    '6D10.6 - Anankastic pattern',
    '6D10.7 - Avoidant pattern',
    '6D10.8 - Schizotypal pattern',
    '6D70 - Mild neurocognitive disorder',
    '6D71 - Major neurocognitive disorder',
    '6D70.0 - Delirium',
    '6E20 - Mental or behavioural disorders associated with pregnancy, childbirth or the puerperium',
    '6E8Z - Other specified mental disorder',
    '6E8Y - Unspecified mental disorder'
  ];

  var DEFAULTS = {
    PSY: ['Orientation', 'Mood & Affect', 'Thought Content', 'Thought Process', 'Perceptual Disturbances', 'Insight', 'Judgment', 'Psychomotor Activity', 'Sleep Pattern', 'Appetite'],
    BEH: ['Cooperation', 'Peer Interaction', 'Aggression/Irritability', 'Substance Craving', 'Wandering', 'Emotional Regulation', 'Response to Redirection', 'Routine Participation'],
    ADL: ['Personal Hygiene', 'Dressing', 'Toileting', 'Feeding', 'Mobility', 'Room Maintenance', 'Laundry', 'Money Handling', 'Time Management', 'Phone Use'],
    THER: ['Occupational Therapy', 'Group Therapy', 'Individual Counseling', 'Yoga/Exercise', 'Art/Music/Dance', 'Vocational Training', 'Life Skills', 'Recreation', 'Psychoeducation', 'Cognitive Remediation'],
    RISK: ['Suicidal Ideation', 'Aggression/Violence', 'Absconding Risk', 'Substance Relapse', 'Falls/Physical Safety', 'Vulnerability', 'Medication Safety'],
    RR: ['Treatment Non-adherence', 'Stressful Situations', 'High EE by Family'],
    diagnosisOptions: ICD11_DIAGNOSIS_OPTIONS.slice(),
    wardNames: ['Ward A', 'Ward B', 'Ward C', 'General Ward', 'High Dependency', 'Step-down'],
    roomBedNumbers: ['A/101', 'A/102', 'A/103', 'B/201', 'B/202', 'C/301', 'C/302', 'GD/1', 'GD/2', 'HD/1', 'SD/1']
  };

  var REPORT_SECTIONS = [
    { key: 'PSY', icon: 'fa-brain', title: 'Psychiatric — Mental state parameters' },
    { key: 'BEH', icon: 'fa-comments', title: 'Behavioral — Observation parameters' },
    { key: 'ADL', icon: 'fa-hands-helping', title: 'ADL — Daily living domains' },
    { key: 'THER', icon: 'fa-dumbbell', title: 'Therapeutic — Activity types' },
    { key: 'RISK', icon: 'fa-shield-halved', title: 'Risk — Assessment domains' },
    { key: 'RR', icon: 'fa-rotate-left', title: 'Relapse Risk — Parameters (0–3 each)' }
  ];

  var WARD_BEDS_SECTIONS = [
    { key: 'wardNames', icon: 'fa-building', title: 'Ward names' },
    { key: 'roomBedNumbers', icon: 'fa-bed', title: 'Room / Bed numbers' }
  ];

  function getConfig(state) { return state.config || {}; }

  function getSectionItemsFromDOM(sectionKey) {
    var el = document.getElementById('set-list-' + sectionKey);
    if (!el) return [];
    return Array.prototype.map.call(el.querySelectorAll('.li-txt'), function (inp) { return (inp.value || '').trim(); });
  }

  function saveSection(sectionKey, state, callback, itemsOverride) {
    var items = itemsOverride != null ? itemsOverride : getSectionItemsFromDOM(sectionKey);
    AppDB.getOrgConfig(true).then(function (cfg) {
      var next = cfg || {};
      next[sectionKey] = items;
      return AppDB.setOrgConfig(next);
    }).then(function () {
      if (!state.config) state.config = {};
      state.config[sectionKey] = items;
      if (window.CareTrack && window.CareTrack.toast) window.CareTrack.toast('Saved');
      if (callback) callback();
    }).catch(function () {
      if (window.CareTrack && window.CareTrack.toast) window.CareTrack.toast('Save failed');
    });
  }

  function renderOneSection(parentEl, sec, state, defaults) {
    var cfg = getConfig(state);
    var items = (cfg[sec.key] || defaults[sec.key] || []).slice();
    var sectionId = 'admin-sec-' + sec.key;
    var html = '<div class="collapsible-section collapsed" id="' + sectionId + '">' +
      '<button type="button" class="collapsible-head" aria-expanded="false" data-toggle-collapse="' + sectionId + '">' +
        '<i class="fas fa-chevron-down"></i><span><i class="fas ' + sec.icon + '"></i> ' + sec.title + '</span><span class="set-badge">' + items.length + '</span>' +
      '</button>' +
      '<div class="collapsible-body">' +
        '<div id="set-list-' + sec.key + '"></div>' +
        '<div class="add-row"><input class="add-inp" id="set-inp-' + sec.key + '" placeholder="New item (type and click Save to add)…">' +
        '<button type="button" class="btn btn-sm" data-save="' + sec.key + '" style="margin-left:auto">Save</button></div>' +
      '</div></div>';
    parentEl.insertAdjacentHTML('beforeend', html);

    var listEl = document.getElementById('set-list-' + sec.key);
    listEl.innerHTML = items.map(function (item, i) {
      var safe = (item || '').replace(/"/g, '&quot;');
      return '<div class="list-item">' +
        '<input class="li-txt" value="' + safe + '" data-key="' + sec.key + '" data-i="' + i + '">' +
        '<button type="button" class="li-up" data-key="' + sec.key + '" data-i="' + i + '">&#8593;</button>' +
        '<button type="button" class="li-dn" data-key="' + sec.key + '" data-i="' + i + '">&#8595;</button>' +
        '<button type="button" class="li-del" data-key="' + sec.key + '" data-i="' + i + '">&times;</button>' +
      '</div>';
    }).join('') || '<p style="color:var(--text-3);font-size:.85rem">No items.</p>';

    /* Collapse toggle is handled by delegation in admin.js (#admin-parameters-wrap) so we don't double-toggle */

    parentEl.querySelector('[data-save="' + sec.key + '"]').addEventListener('click', function () {
      var btn = parentEl.querySelector('[data-save="' + sec.key + '"]');
      var inp = document.getElementById('set-inp-' + sec.key);
      var newVal = (inp && inp.value) ? inp.value.trim() : '';
      var items = getSectionItemsFromDOM(sec.key);
      if (newVal) items = items.concat([newVal]);
      btn.disabled = true;
      saveSection(sec.key, state, function () {
        btn.disabled = false;
        if (inp) inp.value = '';
        if (newVal) {
          var p = listEl.querySelector('p');
          if (p) p.remove();
          var div = document.createElement('div');
          div.className = 'list-item';
          div.innerHTML = '<input class="li-txt" value="' + (newVal.replace(/"/g, '&quot;')) + '" data-key="' + sec.key + '" data-i="-1">' +
            '<button type="button" class="li-up" data-key="' + sec.key + '">&#8593;</button>' +
            '<button type="button" class="li-dn" data-key="' + sec.key + '">&#8595;</button>' +
            '<button type="button" class="li-del" data-key="' + sec.key + '">&times;</button>';
          listEl.appendChild(div);
          bindListButtons(listEl, sec.key, state, defaults);
        }
      }, items);
    });

    bindListButtons(listEl, sec.key, state, defaults);
  }

  function bindListButtons(listEl, key, state, defaults) {
    if (!listEl) return;
    listEl.querySelectorAll('.li-up, .li-dn').forEach(function (b) {
      b.onclick = function () {
        var items = getSectionItemsFromDOM(key);
        var i = parseInt(b.getAttribute('data-i'), 10);
        if (i < 0) i = items.length - 1;
        var j = b.classList.contains('li-up') ? i - 1 : i + 1;
        if (j < 0 || j >= items.length) return;
        var tmp = items[i]; items[i] = items[j]; items[j] = tmp;
        var parent = listEl.parentElement;
        listEl.innerHTML = items.map(function (item, idx) {
          var safe = (item || '').replace(/"/g, '&quot;');
          return '<div class="list-item">' +
            '<input class="li-txt" value="' + safe + '" data-key="' + key + '" data-i="' + idx + '">' +
            '<button type="button" class="li-up" data-key="' + key + '" data-i="' + idx + '">&#8593;</button>' +
            '<button type="button" class="li-dn" data-key="' + key + '" data-i="' + idx + '">&#8595;</button>' +
            '<button type="button" class="li-del" data-key="' + key + '" data-i="' + idx + '">&times;</button></div>';
        }).join('');
        bindListButtons(listEl, key, state, defaults);
      };
    });
    listEl.querySelectorAll('.li-del').forEach(function (b) {
      b.onclick = function () {
        var items = getSectionItemsFromDOM(key);
        if (items.length <= 1) { if (window.CareTrack && window.CareTrack.toast) window.CareTrack.toast('Keep at least one'); return; }
        var i = parseInt(b.getAttribute('data-i'), 10);
        if (i < 0) i = items.length - 1;
        items.splice(i, 1);
        listEl.innerHTML = items.map(function (item, idx) {
          var safe = (item || '').replace(/"/g, '&quot;');
          return '<div class="list-item">' +
            '<input class="li-txt" value="' + safe + '" data-key="' + key + '" data-i="' + idx + '">' +
            '<button type="button" class="li-up" data-key="' + key + '" data-i="' + idx + '">&#8593;</button>' +
            '<button type="button" class="li-dn" data-key="' + key + '" data-i="' + idx + '">&#8595;</button>' +
            '<button type="button" class="li-del" data-key="' + key + '" data-i="' + idx + '">&times;</button></div>';
        }).join('') || '<p style="color:var(--text-3);font-size:.85rem">No items.</p>';
        bindListButtons(listEl, key, state, defaults);
      };
    });
  }

  function renderReportParameters(containerId, state) {
    var el = document.getElementById(containerId);
    if (!el) return;
    el.innerHTML = '';
    REPORT_SECTIONS.forEach(function (sec) { renderOneSection(el, sec, state, DEFAULTS); });
  }

  function renderWardBeds(containerId, state) {
    var el = document.getElementById(containerId);
    if (!el) return;
    el.innerHTML = '';
    WARD_BEDS_SECTIONS.forEach(function (sec) { renderOneSection(el, sec, state, DEFAULTS); });
  }

  function renderDiagnosisOptions(containerId, state) {
    var el = document.getElementById(containerId);
    if (!el) return;
    el.innerHTML = '';
    var sec = { key: 'diagnosisOptions', icon: 'fa-stethoscope', title: 'Diagnosis diseases (ICD-11)' };
    renderOneSection(el, sec, state, DEFAULTS);
  }

  var MRS_FIELDS = [
    { key: 'symptomReduction', label: 'Symptom Reduction (SSI)' },
    { key: 'insight', label: 'Insight (IFI)' },
    { key: 'function', label: 'Function (FRI)' },
    { key: 'familySystem', label: 'Family System (FSI)' },
    { key: 'medicationAdherence', label: 'Medication Adherence (BSI)' }
  ];

  var MRS_DEFAULTS = { symptomReduction: 30, insight: 20, function: 25, familySystem: 15, medicationAdherence: 10 };

  function renderMrsWeights(containerId, state) {
    var el = document.getElementById(containerId);
    if (!el) return;
    var cfg = getConfig(state);
    var w = cfg.mrsWeights || MRS_DEFAULTS;

    var html = '<div style="margin-bottom:8px;font-size:.85rem;color:var(--text-3)">Weights must sum to 100%. These control the Master Recovery Score on the Progress Report.</div>';
    html += '<div class="form-grid" style="gap:10px;margin-bottom:12px">';
    MRS_FIELDS.forEach(function (f) {
      html += '<div class="fg"><label>' + f.label + '</label><input type="number" class="fi mrs-w-inp" data-mrs-key="' + f.key + '" min="0" max="100" value="' + (w[f.key] != null ? w[f.key] : MRS_DEFAULTS[f.key]) + '"></div>';
    });
    html += '</div>';
    html += '<div style="display:flex;align-items:center;gap:12px"><button type="button" class="btn btn-sm" id="mrs-weights-save"><i class="fas fa-save"></i> Save Weights</button>' +
      '<span id="mrs-weights-sum" style="font-size:.85rem;color:var(--text-3)"></span></div>';
    el.innerHTML = html;

    function updateSum() {
      var total = 0;
      el.querySelectorAll('.mrs-w-inp').forEach(function (inp) { total += parseInt(inp.value, 10) || 0; });
      var sumEl = document.getElementById('mrs-weights-sum');
      if (sumEl) {
        sumEl.textContent = 'Total: ' + total + '%';
        sumEl.style.color = total === 100 ? 'var(--success, #16a34a)' : 'var(--danger, #dc2626)';
      }
    }
    el.querySelectorAll('.mrs-w-inp').forEach(function (inp) { inp.addEventListener('input', updateSum); });
    updateSum();

    document.getElementById('mrs-weights-save').addEventListener('click', function () {
      var newW = {};
      var total = 0;
      el.querySelectorAll('.mrs-w-inp').forEach(function (inp) {
        var v = parseInt(inp.value, 10) || 0;
        newW[inp.getAttribute('data-mrs-key')] = v;
        total += v;
      });
      if (total !== 100) {
        if (window.CareTrack && window.CareTrack.toast) window.CareTrack.toast('Weights must sum to 100% (currently ' + total + '%)');
        return;
      }
      var btn = document.getElementById('mrs-weights-save');
      if (btn) btn.disabled = true;
      AppDB.getOrgConfig(true).then(function (cfg) {
        var next = cfg || {};
        next.mrsWeights = newW;
        return AppDB.setOrgConfig(next);
      }).then(function () {
        if (!state.config) state.config = {};
        state.config.mrsWeights = newW;
        if (window.CareTrack && window.CareTrack.toast) window.CareTrack.toast('Recovery score weights saved');
        if (btn) btn.disabled = false;
      }).catch(function () {
        if (window.CareTrack && window.CareTrack.toast) window.CareTrack.toast('Save failed');
        if (btn) btn.disabled = false;
      });
    });
  }

  function init(state) {
    if (_inited) return;
    _inited = true;
  }

  window.Pages = window.Pages || {};
  window.Pages.settings = {
    renderReportParameters: renderReportParameters,
    renderWardBeds: renderWardBeds,
    renderDiagnosisOptions: renderDiagnosisOptions,
    renderMrsWeights: renderMrsWeights,
    init: init,
    DEFAULTS: DEFAULTS,
    ICD11_DIAGNOSIS_OPTIONS: ICD11_DIAGNOSIS_OPTIONS
  };
})();
