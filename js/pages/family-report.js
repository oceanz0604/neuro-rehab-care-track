/**
 * Family Report page — pulls real Firestore report data.
 * Bilingual EN/MR with print support.
 */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var _inited = false;
  var _lang = 'en';

  var STRINGS = {
    en: {
      frTitle: 'Client Progress Report', frSub: 'Monthly — supportive language only',
      lblC: 'Client', lblM: 'Report month', lblL: 'Language', noc: 'Select a client to preview.',
      center: 'Neuro-Psychiatric Rehabilitation Centre', rTitle: 'Monthly Client Progress Report',
      cLbl: 'Client', tLbl: 'Therapist', aLbl: 'Admitted', pTitle: 'Progress this month',
      mTitle: 'Monthly progress', wTitle: 'Weekly trend summary',
      wCols: ['Area', 'Week 1', 'Week 2', 'Week 3', 'Week 4', 'Change'],
      bars: ['Daily Living Skills', 'Therapy Engagement', 'Behavioral Stability', 'Safety Observations'],
      sections: [
        { t: 'Daily Living Skills', key: 'adl', b: 'Your family member has been making steady progress in personal care, dressing, and daily routines.' },
        { t: 'Therapy Participation', key: 'therapeutic', b: 'Attendance and engagement in sessions has been consistent this month.' },
        { t: 'Behavioral Wellbeing', key: 'behavioral', b: 'Increased emotional stability and improved interactions observed.' },
        { t: 'Safety & Observation', key: 'risk', b: 'Safety observations remain on track. Appropriate supports are in place.' }
      ],
      tipsTitle: 'How you can support your family member',
      tips: ['Regular, calm visits help your family member feel safe.', 'Participate in family counseling sessions.', 'Encourage every small progress.', 'Contact your assigned social worker for concerns.', 'Follow caregiver guidelines from sessions.'],
      disc: 'This report uses supportive, family-friendly language. It does not contain diagnosis or medication details.',
      noteTitle: 'Additional note',
      notePlaceholder: 'Add a note for this client’s progress report (e.g. summary for family). Saved per client.',
      saveNote: 'Save note',
      footer: 'Neuro-Psychiatric Rehabilitation Centre | Confidential Family Report | NeuroRehab CareTrack',
      exportPdf: 'Export PDF', locale: 'en-IN',
      sectionSummary: {
        adl: 'This month, {{count}} daily living areas were assessed. Most areas are at {{level}}.',
        therapeutic: '{{count}} therapy sessions were recorded. Attendance was {{presentCount}} present; engagement was mostly {{engagementSummary}}.',
        behavioral: 'Behavioral and emotional observations were recorded across {{count}} areas this month, with an average of {{avg}}/5.',
        risk: 'Safety was monitored across {{count}} areas. Current observations are {{summary}}.'
      },
      sectionSummaryFallback: 'Observations were recorded this month.',
      levelLabels: { Independent: 'Independent', Supervised: 'Supervised', 'Min Assist': 'Min Assist', 'Mod Assist': 'Mod Assist', 'Max Assist': 'Max Assist', Dependent: 'Dependent', mixed: 'mixed', various: 'various' },
      engagementLabels: { active: 'active', mixed: 'mixed', passive: 'passive' },
      riskSummaryLabels: { withinRange: 'within expected range.', monitored: 'being monitored.' }
    },
    mr: {
      frTitle: 'कुटुंब प्रगती अहवाल', frSub: 'मासिक — सहाय्यक भाषा',
      lblC: 'रुग्ण निवडा', lblM: 'अहवाल महिना', lblL: 'भाषा', noc: 'वरून रुग्ण निवडा.',
      center: 'न्यूरो-मनोरुग्ण पुनर्वसन केंद्र', rTitle: 'मासिक कुटुंब प्रगती अहवाल',
      cLbl: 'रुग्ण', tLbl: 'उपचारक', aLbl: 'प्रवेश', pTitle: 'या महिन्याची प्रगती',
      mTitle: 'मासिक प्रगती', wTitle: 'साप्ताहिक कल सारांश',
      wCols: ['क्षेत्र', 'आठवडा १', 'आठवडा २', 'आठवडा ३', 'आठवडा ४', 'बदल'],
      bars: ['दैनंदिन जीवन कौशल्ये', 'उपचार सहभाग', 'वर्तणूक स्थिरता', 'सुरक्षा निरीक्षण'],
      sections: [
        { t: 'दैनंदिन जीवन कौशल्ये', key: 'adl', b: 'आपल्या कुटुंब सदस्याने वैयक्तिक काळजी आणि दैनंदिन दिनचर्येत प्रगती केली आहे.' },
        { t: 'उपचारात्मक सहभाग', key: 'therapeutic', b: 'या महिन्यात उपचारात्मक सत्रांमध्ये उपस्थिती नियमित राहिली.' },
        { t: 'वर्तणूक व भावनिक स्थिरता', key: 'behavioral', b: 'काळजी संघाने भावनिक स्थिरतेत वाढ निरीक्षण केले आहेत.' },
        { t: 'सुरक्षा निरीक्षण', key: 'risk', b: 'सुरक्षा निरीक्षण योग्य प्रकारे चालू आहे.' }
      ],
      tipsTitle: 'आपण कुटुंब सदस्याला कसे सहाय्य करू शकता',
      tips: ['नियमित भेट द्या.', 'कुटुंब समुपदेशन सत्रांमध्ये सहभागी व्हा.', 'छोट्या प्रगतीलाही प्रोत्साहन द्या.', 'शंका असल्यास सामाजिक कार्यकर्त्याशी संपर्क करा.', 'काळजीवाहू मार्गदर्शक पाळा.'],
      disc: 'हा अहवाल सहाय्यक भाषेत आहे. निदान किंवा औषध तपशील नाही.',
      noteTitle: 'अतिरिक्त नोट',
      notePlaceholder: 'या रुग्णाच्या प्रगती अहवालासाठी नोट (उदा. कुटुंबासाठी सारांश). प्रति रुग्ण सेव्ह होते.',
      saveNote: 'नोट सेव्ह करा',
      footer: 'न्यूरो-मनोरुग्ण पुनर्वसन केंद्र | कुटुंब अहवाल — गोपनीय | NeuroRehab CareTrack',
      exportPdf: 'PDF एक्सपोर्ट करा', locale: 'mr-IN',
      sectionSummary: {
        adl: 'या महिन्यात {{count}} दैनंदिन जीवन क्षेत्रांचे मूल्यांकन केले गेले. बहुतांश क्षेत्रांमध्ये {{level}}.',
        therapeutic: '{{count}} उपचार सत्र नोंदवले गेले. {{presentCount}} उपस्थित; सहभाग बहुतेक {{engagementSummary}}.',
        behavioral: 'या महिन्यात {{count}} क्षेत्रांमध्ये वर्तणूक आणि भावनिक निरीक्षणे नोंदवली गेली, सरासरी {{avg}}/5.',
        risk: '{{count}} क्षेत्रांमध्ये सुरक्षा निरीक्षण केले गेले. सध्याची निरीक्षणे {{summary}}'
      },
      sectionSummaryFallback: 'या महिन्यात निरीक्षणे नोंदवली गेली.',
      levelLabels: { Independent: 'स्वतंत्र', Supervised: 'पर्यवेक्षणाखाली', 'Min Assist': 'किमान सहाय्य', 'Mod Assist': 'मध्यम सहाय्य', 'Max Assist': 'जास्तीत जास्त सहाय्य', Dependent: 'अवलंबून', mixed: 'मिश्रित', various: 'विविध' },
      engagementLabels: { active: 'सक्रिय', mixed: 'मिश्रित', passive: 'निष्क्रिय' },
      riskSummaryLabels: { withinRange: 'अपेक्षित श्रेणीत.', monitored: 'निरीक्षणाखाली.' }
    }
  };

  function render(state) {
    var s = STRINGS[_lang];
    $('fr-title').textContent = s.frTitle;
    $('fr-sub').textContent = s.frSub;
    $('fr-lbl-c').textContent = s.lblC;
    $('fr-lbl-m').textContent = s.lblM;
    $('fr-lbl-l').textContent = s.lblL;

    var opts = '<option value="">— ' + s.lblC + ' —</option>' + (state.clients || []).filter(function (c) { return c.status === 'active'; }).map(function (c) {
      return '<option value="' + c.id + '">' + (c.name || 'Unknown') + '</option>';
    }).join('');
    var sel = $('fr-cl');
    var prev = sel.value;
    sel.innerHTML = opts;
    if (prev) sel.value = prev;

    if (!$('fr-mon').value) $('fr-mon').value = new Date().toISOString().slice(0, 7);
    generateReport(state);
  }

  function generateReport(state) {
    var cid = $('fr-cl').value;
    var c = null;
    (state.clients || []).forEach(function (cl) { if (cl.id === cid) c = cl; });
    if (!c) { $('fr-prev').hidden = true; $('fr-noc').style.display = ''; return; }
    $('fr-noc').style.display = 'none';
    $('fr-prev').hidden = false;

    var s = STRINGS[_lang];
    var mon = $('fr-mon').value || new Date().toISOString().slice(0, 7);
    var mStr = new Date(mon + '-01').toLocaleDateString(s.locale, { month: 'long', year: 'numeric' });

    fetchMonthData(cid, mon).then(function (data) {
      data = data || [];
      var bars = computeBars(data, s);
      var trend = computeTrend(data, mon, s);

      var noteHtml = (c.progressReportNote && c.progressReportNote.trim()) ? '<div class="card" style="margin-bottom:12px"><div style="font-weight:700;margin-bottom:8px">' + s.noteTitle + '</div><p style="margin:0;font-size:.9rem;white-space:pre-wrap">' + esc(c.progressReportNote) + '</p></div>' : '';
      $('fr-prev').innerHTML =
        '<div class="fr-export-wrap" style="margin-bottom:12px">' +
        '<button type="button" class="btn" id="fr-export-pdf"><i class="fas fa-file-pdf"></i> ' + s.exportPdf + '</button>' +
        '</div>' +
        '<div class="fr-note-edit card" style="margin-bottom:16px">' +
        '<div style="font-weight:700;margin-bottom:8px">' + s.noteTitle + '</div>' +
        '<textarea id="fr-progress-note" class="fi" rows="3" placeholder="' + esc(s.notePlaceholder) + '">' + esc(c.progressReportNote || '') + '</textarea>' +
        '<button type="button" class="btn btn-sm" id="fr-save-note" style="margin-top:8px"><i class="fas fa-save"></i> ' + s.saveNote + '</button>' +
        '</div>' +
        '<div id="fr-report-content" class="fr-report-content">' +
        '<div class="rh"><div class="rh-c">' + s.center + '</div><div class="rh-t">' + s.rTitle + '</div>' +
        '<div class="rh-d">' + s.cLbl + ': <strong>' + esc(c.name) + '</strong> | ID: ' + c.id + ' | ' + s.tLbl + ': ' + (c.assignedTherapist || '—') + '</div>' +
        '<div class="rh-s">' + mStr + ' | ' + s.aLbl + ': ' + (c.admissionDate || '—') + '</div></div>' +
        '<div class="alert alert-warn">' + s.disc + '</div>' +
        noteHtml +
        '<div class="card"><div style="font-weight:700;color:var(--primary);margin-bottom:12px">' + s.pTitle + '</div>' +
        s.sections.map(function (sec) {
          var summary = getSectionSummary(data, sec.key, s);
          return '<div class="frs"><div class="frs-t">' + sec.t + '</div><div class="frs-b">' + (summary || sec.b) + '</div></div>';
        }).join('') + '</div>' +
        '<div class="card"><div style="font-weight:700;margin-bottom:12px">' + s.mTitle + '</div>' +
        bars.map(function (b) {
          return '<div class="pbw"><div class="pbt"><span>' + b[1] + '</span><span style="font-weight:700;color:var(--primary)">' + b[0] + '%</span></div>' +
          '<div class="pbtr"><div class="pbf" style="width:' + b[0] + '%"></div></div></div>';
        }).join('') + '</div>' +
        '<div class="card"><div style="font-weight:700;margin-bottom:12px">' + s.wTitle + '</div>' +
        '<div class="table-wrap"><table class="wt"><thead><tr>' + s.wCols.map(function (h) { return '<th>' + h + '</th>'; }).join('') + '</tr></thead><tbody>' +
        trend.map(function (r) {
          return '<tr><td style="text-align:left;font-weight:500">' + r[0] + '</td><td>' + r[1] + '</td><td>' + r[2] + '</td><td>' + r[3] + '</td><td>' + r[4] + '</td><td class="chg">' + r[5] + '</td></tr>';
        }).join('') + '</tbody></table></div></div>' +
        '<div class="card" style="background:var(--primary-bg)"><div style="font-weight:700;margin-bottom:12px">' + s.tipsTitle + '</div>' +
        s.tips.map(function (t, i) { return '<div class="tipr"><div class="tipn">' + (i + 1) + '</div><div class="tipt">' + t + '</div></div>'; }).join('') + '</div>' +
        '<div class="fr-foot">' + s.footer + '</div>' +
        '</div>';
      bindExportPdf(c, mon);
      bindSaveNote(c);
    });
  }

  function fetchMonthData(clientId, month) {
    var start = new Date(month + '-01');
    var end = new Date(start.getFullYear(), start.getMonth() + 1, 0, 23, 59, 59);
    return AppDB.getClientReports(clientId, null, 200).then(function (result) {
      var docs = (result && result.docs) ? result.docs : [];
      return docs.filter(function (r) {
        if (!r.createdAt) return false;
        var d = new Date(r.createdAt);
        return d >= start && d <= end;
      });
    }).catch(function (err) {
      if (window.CareTrack) window.CareTrack.toast(err && err.message ? err.message : 'Could not load reports.');
      return [];
    });
  }

  function computeBars(reports, s) {
    var adlAvg = avgRatingFromSection(reports, 'adl');
    var therAvg = avgEngagement(reports);
    var behAvg = avgRatingFromSection(reports, 'behavioral');
    var riskAvg = avgSafetyScore(reports);
    return [
      [adlAvg || 0, s.bars[0]],
      [therAvg || 0, s.bars[1]],
      [behAvg || 0, s.bars[2]],
      [riskAvg || 0, s.bars[3]]
    ];
  }

  function avgRatingFromSection(reports, section) {
    var reps = reports.filter(function (r) { return r.section === section; });
    if (!reps.length) return 0;
    var total = 0, count = 0;
    reps.forEach(function (r) {
      var ratings = (r.payload || {}).ratings || (r.payload || {}).levels || {};
      Object.keys(ratings).forEach(function (k) {
        var v = typeof ratings[k] === 'number' ? ratings[k] : levelToScore(ratings[k]);
        if (v > 0) { total += v; count++; }
      });
    });
    return count ? Math.round((total / count) * 20) : 0;
  }

  function levelToScore(level) {
    var map = { 'Independent': 5, 'Supervised': 4, 'Min Assist': 3, 'Mod Assist': 2, 'Max Assist': 1, 'Dependent': 0, 'None': 5, 'Low': 4, 'Medium': 2, 'High': 1 };
    return map[level] || 0;
  }

  function avgEngagement(reports) {
    var reps = reports.filter(function (r) { return r.section === 'therapeutic'; });
    if (!reps.length) return 0;
    var total = 0, count = 0;
    reps.forEach(function (r) {
      var acts = (r.payload || {}).activities || {};
      Object.keys(acts).forEach(function (k) {
        var a = acts[k] || {};
        if (a.attendance === 'Present') total += 3;
        else if (a.attendance === 'Absent') total += 0;
        else total += 1;
        if (a.engagement === 'Active') total += 2;
        else if (a.engagement === 'Passive') total += 1;
        count++;
      });
    });
    return count ? Math.round((total / (count * 5)) * 100) : 0;
  }

  function avgSafetyScore(reports) {
    var reps = reports.filter(function (r) { return r.section === 'risk'; });
    if (!reps.length) return 0;
    var total = 0, count = 0;
    reps.forEach(function (r) {
      var levels = (r.payload || {}).levels || {};
      Object.keys(levels).forEach(function (k) {
        total += levelToScore(levels[k]); count++;
      });
    });
    return count ? Math.round((total / count) * 20) : 0;
  }

  var ADL_ORDER = ['Independent', 'Supervised', 'Min Assist', 'Mod Assist', 'Max Assist', 'Dependent'];

  function aggregateAdl(reps) {
    var domainCount = 0;
    var levelCounts = {};
    reps.forEach(function (r) {
      var levels = (r.payload || {}).levels || {};
      Object.keys(levels).forEach(function (k) {
        domainCount++;
        var v = levels[k];
        if (v) levelCounts[v] = (levelCounts[v] || 0) + 1;
      });
    });
    if (!domainCount) return { count: 0, levelKey: 'various' };
    var best = null;
    var maxCount = 0;
    ADL_ORDER.forEach(function (lvl) {
      if (levelCounts[lvl] && levelCounts[lvl] > maxCount) { maxCount = levelCounts[lvl]; best = lvl; }
    });
    if (!best) return { count: domainCount, levelKey: 'various' };
    var distinct = Object.keys(levelCounts).length;
    return { count: domainCount, levelKey: distinct > 2 ? 'mixed' : best };
  }

  function aggregateTherapeutic(reps) {
    var total = 0;
    var presentCount = 0;
    var activeCount = 0;
    var passiveMinimal = 0;
    reps.forEach(function (r) {
      var acts = (r.payload || {}).activities || {};
      Object.keys(acts).forEach(function (k) {
        var a = acts[k] || {};
        total++;
        if (a.attendance === 'Present') presentCount++;
        if (a.engagement === 'Active') activeCount++;
        else if (a.engagement === 'Passive' || a.engagement === 'Minimal') passiveMinimal++;
      });
    });
    if (!total) return { count: 0, presentCount: 0, engagementKey: 'mixed' };
    var engagementKey = activeCount > passiveMinimal ? 'active' : (passiveMinimal > activeCount ? 'passive' : 'mixed');
    return { count: total, presentCount: presentCount, engagementKey: engagementKey };
  }

  function aggregateBehavioral(reps) {
    var total = 0;
    var sum = 0;
    reps.forEach(function (r) {
      var ratings = (r.payload || {}).ratings || {};
      Object.keys(ratings).forEach(function (k) {
        var v = ratings[k];
        if (typeof v === 'number' && v >= 1 && v <= 5) { total++; sum += v; }
      });
    });
    if (!total) return { count: 0, avg: 0 };
    return { count: total, avg: (sum / total).toFixed(1) };
  }

  function aggregateRisk(reps) {
    var domainCount = 0;
    var hasMediumOrHigh = false;
    reps.forEach(function (r) {
      var levels = (r.payload || {}).levels || {};
      Object.keys(levels).forEach(function (k) {
        var v = (levels[k] || '').toLowerCase();
        domainCount++;
        if (v === 'medium' || v === 'high') hasMediumOrHigh = true;
      });
    });
    if (!domainCount) return { count: 0, summaryKey: 'withinRange' };
    return { count: domainCount, summaryKey: hasMediumOrHigh ? 'monitored' : 'withinRange' };
  }

  function getSectionSummary(reports, section, s) {
    var reps = reports.filter(function (r) { return r.section === section; });
    if (!reps.length) return '';
    var templates = s.sectionSummary || {};
    var fallback = s.sectionSummaryFallback || 'Observations were recorded this month.';
    var tpl = templates[section];
    if (!tpl) return fallback;

    var agg;
    var levelLabels = s.levelLabels || {};
    var engagementLabels = s.engagementLabels || {};
    var riskSummaryLabels = s.riskSummaryLabels || {};

    if (section === 'adl') {
      agg = aggregateAdl(reps);
      if (agg.count === 0) return fallback;
      var levelStr = levelLabels[agg.levelKey] != null ? levelLabels[agg.levelKey] : agg.levelKey;
      return tpl.replace(/\{\{count\}\}/g, String(agg.count)).replace(/\{\{level\}\}/g, levelStr);
    }
    if (section === 'therapeutic') {
      agg = aggregateTherapeutic(reps);
      if (agg.count === 0) return fallback;
      var engStr = engagementLabels[agg.engagementKey] != null ? engagementLabels[agg.engagementKey] : agg.engagementKey;
      return tpl.replace(/\{\{count\}\}/g, String(agg.count)).replace(/\{\{presentCount\}\}/g, String(agg.presentCount)).replace(/\{\{engagementSummary\}\}/g, engStr);
    }
    if (section === 'behavioral') {
      agg = aggregateBehavioral(reps);
      if (agg.count === 0) return fallback;
      return tpl.replace(/\{\{count\}\}/g, String(agg.count)).replace(/\{\{avg\}\}/g, String(agg.avg));
    }
    if (section === 'risk') {
      agg = aggregateRisk(reps);
      if (agg.count === 0) return fallback;
      var sumStr = riskSummaryLabels[agg.summaryKey] != null ? riskSummaryLabels[agg.summaryKey] : 'being monitored.';
      return tpl.replace(/\{\{count\}\}/g, String(agg.count)).replace(/\{\{summary\}\}/g, sumStr);
    }
    return fallback;
  }

  function computeTrend(reports, month, s) {
    var weeks = getWeekBoundaries(month);
    return s.bars.map(function (label, idx) {
      var sections = ['adl', 'therapeutic', 'behavioral', 'risk'];
      var sec = sections[idx];
      var weekVals = weeks.map(function (w) {
        var wReports = reports.filter(function (r) {
          if (r.section !== sec || !r.createdAt) return false;
          var d = new Date(r.createdAt);
          return d >= w.start && d <= w.end;
        });
        return computeWeekScore(wReports, sec);
      });
      var first = weekVals[0] || 0;
      var last = weekVals[weekVals.length - 1] || 0;
      var change = first > 0 ? Math.round(((last - first) / first) * 100) : 0;
      var changeStr = change >= 0 ? '+' + change + '%' : change + '%';
      return [label, (weekVals[0] || '—') + '%', (weekVals[1] || '—') + '%', (weekVals[2] || '—') + '%', (weekVals[3] || '—') + '%', changeStr];
    });
  }

  function getWeekBoundaries(month) {
    var start = new Date(month + '-01');
    var weeks = [];
    for (var i = 0; i < 4; i++) {
      var ws = new Date(start);
      ws.setDate(ws.getDate() + (i * 7));
      var we = new Date(ws);
      we.setDate(we.getDate() + 6);
      weeks.push({ start: ws, end: we });
    }
    return weeks;
  }

  function computeWeekScore(reports, section) {
    if (!reports.length) return 0;
    if (section === 'therapeutic') return avgEngagement(reports);
    return avgRatingFromSection(reports, section);
  }

  function esc(s) { var d = document.createElement('div'); d.textContent = s || ''; return d.innerHTML; }

  function bindExportPdf(client, month) {
    var btn = document.getElementById('fr-export-pdf');
    if (!btn) return;
    btn.onclick = function () {
      exportReportPdf(client, month);
    };
  }

  function bindSaveNote(client) {
    var btn = document.getElementById('fr-save-note');
    if (!btn || !client) return;
    btn.addEventListener('click', function () {
      var ta = document.getElementById('fr-progress-note');
      var value = (ta && ta.value) ? ta.value.trim() : '';
      btn.disabled = true;
      AppDB.updateClient(client.id, { progressReportNote: value }).then(function () {
        if (window.CareTrack) {
          window.CareTrack.toast('Note saved');
          window.CareTrack.refreshData();
        }
        btn.disabled = false;
      }).catch(function (e) {
        if (window.CareTrack) window.CareTrack.toast('Error: ' + (e && e.message ? e.message : 'Save failed'));
        btn.disabled = false;
      });
    });
  }

  function exportReportPdf(client, month) {
    var el = document.getElementById('fr-report-content');
    if (!el || typeof html2pdf === 'undefined') {
      if (window.CareTrack) window.CareTrack.toast('PDF export not available.');
      return;
    }
    var name = (client && client.name) ? client.name.replace(/[^a-zA-Z0-9]/g, '-') : 'Report';
    var filename = 'Family-Report-' + name + '-' + (month || '').slice(0, 7) + '.pdf';
    var opt = {
      margin: 10,
      filename: filename,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };
    var btn = document.getElementById('fr-export-pdf');
    if (btn) { btn.disabled = true; btn.textContent = 'Generating…'; }
    html2pdf().set(opt).from(el).save().then(function () {
      if (btn) {
        var s = STRINGS[_lang];
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-file-pdf"></i> ' + (s && s.exportPdf ? s.exportPdf : 'Export PDF');
      }
      if (window.CareTrack) window.CareTrack.toast('PDF downloaded.');
    }).catch(function (err) {
      if (btn) {
        var s = STRINGS[_lang];
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-file-pdf"></i> ' + (s && s.exportPdf ? s.exportPdf : 'Export PDF');
      }
      if (window.CareTrack) window.CareTrack.toast(err && err.message ? err.message : 'PDF export failed.');
    });
  }

  function init(state) {
    if (_inited) return; _inited = true;
    $('fr-cl').addEventListener('change', function () { generateReport(window.CareTrack.getState()); });
    $('fr-mon').addEventListener('change', function () { generateReport(window.CareTrack.getState()); });
    document.querySelectorAll('.lbtn[data-lang]').forEach(function (b) {
      b.addEventListener('click', function () {
        _lang = b.getAttribute('data-lang');
        document.querySelectorAll('.lbtn').forEach(function (x) { x.classList.remove('active'); });
        b.classList.add('active');
        render(window.CareTrack.getState());
      });
    });
  }

  window.Pages = window.Pages || {};
  window.Pages.freport = { render: render, init: init };
})();
