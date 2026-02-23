/**
 * Settings page — Firestore-persisted parameter lists with 2s debounced auto-save.
 */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var _inited = false;
  var _saveTimer = null;
  var DEBOUNCE = 2000;

  var DEFAULTS = {
    PSY: ['Orientation', 'Mood & Affect', 'Thought Content', 'Thought Process', 'Perceptual Disturbances', 'Insight', 'Judgment', 'Psychomotor Activity', 'Sleep Pattern', 'Appetite'],
    BEH: ['Cooperation', 'Peer Interaction', 'Aggression/Irritability', 'Substance Craving', 'Wandering', 'Emotional Regulation', 'Response to Redirection', 'Routine Participation'],
    ADL: ['Personal Hygiene', 'Dressing', 'Toileting', 'Feeding', 'Mobility', 'Room Maintenance', 'Laundry', 'Money Handling', 'Time Management', 'Phone Use'],
    THER: ['Occupational Therapy', 'Group Therapy', 'Individual Counseling', 'Yoga/Exercise', 'Art/Music/Dance', 'Vocational Training', 'Life Skills', 'Recreation', 'Psychoeducation', 'Cognitive Remediation'],
    RISK: ['Suicidal Ideation', 'Aggression/Violence', 'Absconding Risk', 'Substance Relapse', 'Falls/Physical Safety', 'Vulnerability', 'Medication Safety'],
    diagnosisOptions: ['Schizophrenia', 'Bipolar Disorder', 'Major Depressive Disorder', 'Anxiety Disorder', 'Personality Disorder', 'Substance Use Disorder', 'Cognitive Disorder', 'Other'],
    wardNames: ['Ward A', 'Ward B', 'Ward C', 'General Ward', 'High Dependency', 'Step-down'],
    roomBedNumbers: ['A/101', 'A/102', 'A/103', 'B/201', 'B/202', 'C/301', 'C/302', 'GD/1', 'GD/2', 'HD/1', 'SD/1']
  };

  var SECTIONS = [
    { key: 'PSY', icon: 'fa-brain',           title: 'Psychiatric — Mental state parameters' },
    { key: 'BEH', icon: 'fa-comments',        title: 'Behavioral — Observation parameters' },
    { key: 'ADL', icon: 'fa-hands-helping',   title: 'ADL — Daily living domains' },
    { key: 'THER', icon: 'fa-dumbbell',       title: 'Therapeutic — Activity types' },
    { key: 'RISK', icon: 'fa-shield-halved', title: 'Risk — Assessment domains' },
    { key: 'diagnosisOptions', icon: 'fa-stethoscope', title: 'Diagnosis options' },
    { key: 'wardNames', icon: 'fa-building', title: 'Ward names' },
    { key: 'roomBedNumbers', icon: 'fa-bed', title: 'Room / Bed numbers' }
  ];

  function getConfig(state) { return state.config || {}; }
  function setConfigKey(state, key, arr) {
    if (!state.config) state.config = {};
    state.config[key] = arr;
    scheduleSave(state);
  }

  function scheduleSave(state) {
    clearTimeout(_saveTimer);
    _saveTimer = setTimeout(function () {
      AppDB.setOrgConfig(state.config).then(function () {
        window.CareTrack.toast('Settings saved');
      }).catch(function () {
        window.CareTrack.toast('Save failed');
      });
    }, DEBOUNCE);
  }

  function render(state) {
    var cfg = getConfig(state);
    $('settings-lists').innerHTML = SECTIONS.map(function (sec) {
      var items = cfg[sec.key] || DEFAULTS[sec.key] || [];
      return '<div class="card">' +
        '<div class="set-hdr"><span class="set-title"><i class="fas ' + sec.icon + '"></i> ' + sec.title + '</span><span class="set-badge">' + items.length + '</span></div>' +
        '<div class="set-desc">Edit, reorder, or remove items.</div>' +
        '<div id="set-list-' + sec.key + '"></div>' +
        '<div class="add-row"><input class="add-inp" id="set-inp-' + sec.key + '" placeholder="New item…">' +
        '<button type="button" class="btn btn-sm" data-add="' + sec.key + '">+ Add</button></div></div>';
    }).join('');

    SECTIONS.forEach(function (sec) { renderList(sec.key, state); });

    $('settings-lists').querySelectorAll('[data-add]').forEach(function (b) {
      b.addEventListener('click', function () {
        var key = b.getAttribute('data-add');
        var inp = $('set-inp-' + key);
        var val = (inp.value || '').trim();
        if (!val) { window.CareTrack.toast('Enter item name'); return; }
        var cfg = getConfig(state);
        var arr = (cfg[key] || DEFAULTS[key] || []).slice();
        arr.push(val);
        setConfigKey(state, key, arr);
        inp.value = '';
        renderList(key, state);
      });
    });
  }

  function renderList(key, state) {
    var cfg = getConfig(state);
    var items = cfg[key] || DEFAULTS[key] || [];
    var el = $('set-list-' + key);
    if (!el) return;

    el.innerHTML = items.map(function (item, i) {
      var safe = (item || '').replace(/"/g, '&quot;');
      return '<div class="list-item">' +
        '<input class="li-txt" value="' + safe + '" data-key="' + key + '" data-i="' + i + '">' +
        '<button type="button" class="li-up" data-key="' + key + '" data-i="' + i + '">&#8593;</button>' +
        '<button type="button" class="li-dn" data-key="' + key + '" data-i="' + i + '">&#8595;</button>' +
        '<button type="button" class="li-del" data-key="' + key + '" data-i="' + i + '">&times;</button>' +
      '</div>';
    }).join('') || '<p style="color:var(--text-3);font-size:.85rem">No items.</p>';

    el.querySelectorAll('.li-txt').forEach(function (inp) {
      inp.addEventListener('blur', function () {
        var arr = (getConfig(state)[key] || DEFAULTS[key] || []).slice();
        if (inp.value.trim()) { arr[parseInt(inp.getAttribute('data-i'), 10)] = inp.value.trim(); setConfigKey(state, key, arr); }
      });
    });
    el.querySelectorAll('.li-up, .li-dn').forEach(function (b) {
      b.addEventListener('click', function () {
        var arr = (getConfig(state)[key] || DEFAULTS[key] || []).slice();
        var i = parseInt(b.getAttribute('data-i'), 10);
        var j = b.classList.contains('li-up') ? i - 1 : i + 1;
        if (j < 0 || j >= arr.length) return;
        var tmp = arr[i]; arr[i] = arr[j]; arr[j] = tmp;
        setConfigKey(state, key, arr);
        renderList(key, state);
      });
    });
    el.querySelectorAll('.li-del').forEach(function (b) {
      b.addEventListener('click', function () {
        var arr = (getConfig(state)[key] || DEFAULTS[key] || []).slice();
        if (arr.length <= 1) { window.CareTrack.toast('Keep at least one'); return; }
        arr.splice(parseInt(b.getAttribute('data-i'), 10), 1);
        setConfigKey(state, key, arr);
        renderList(key, state);
      });
    });
  }

  function init(state) {
    if (_inited) return; _inited = true;

    $('export-config').addEventListener('click', function () {
      var cfg = getConfig(state);
      var blob = new Blob([JSON.stringify(cfg, null, 2)], { type: 'application/json' });
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'NeuroRehab_Config.json';
      a.click();
      window.CareTrack.toast('Exported');
    });

    $('import-config-btn').addEventListener('click', function () { $('cfg-file').click(); });
    $('cfg-file').addEventListener('change', function (e) {
      var file = e.target && e.target.files && e.target.files[0];
      if (!file) return;
      var reader = new FileReader();
      reader.onload = function () {
        try {
          var cfg = JSON.parse(reader.result);
          SECTIONS.forEach(function (sec) {
            if (cfg[sec.key] && Array.isArray(cfg[sec.key]) && cfg[sec.key].length) {
              setConfigKey(state, sec.key, cfg[sec.key]);
            }
          });
          render(state);
          window.CareTrack.toast('Imported');
        } catch (_) { window.CareTrack.toast('Invalid config file'); }
      };
      reader.readAsText(file);
      e.target.value = '';
    });

    $('reset-config').addEventListener('click', function () {
      AppModal.confirm('Reset Settings', 'Reset all parameter lists to defaults?', function () {
        SECTIONS.forEach(function (sec) { setConfigKey(state, sec.key, DEFAULTS[sec.key].slice()); });
        render(state);
        window.CareTrack.toast('Reset to defaults');
      });
    });
  }

  window.Pages = window.Pages || {};
  window.Pages.settings = { render: render, init: init, DEFAULTS: DEFAULTS };
})();
