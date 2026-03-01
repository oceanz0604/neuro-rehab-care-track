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
      frTitle: 'Progress Report', frSub: 'Date range — supportive language only',
      lblC: 'Client', lblM: 'Report month', lblFrom: 'From date', lblTo: 'To date', lblL: 'Language', noc: 'Select a client to preview.',
      center: 'Neuro-Psychiatric Rehabilitation Centre', rTitle: 'Monthly Progress Report',
      cLbl: 'Client', tLbl: 'Assigned doctor', aLbl: 'Admitted', pTitle: 'Progress this month',
      mTitle: 'Monthly progress', wTitle: 'Weekly trend summary',
      wCols: ['Area', 'Week 1', 'Week 2', 'Week 3', 'Week 4', 'Change'],
      bars: ['Daily Living Skills', 'Therapy Engagement', 'Behavioral Stability', 'Safety Observations'],
      sections: [
        { t: 'Daily Living Skills', key: 'adl', b: 'Your family member has been making steady progress in personal care, dressing, and daily routines.' },
        { t: 'Therapy Participation', key: 'therapeutic', b: 'Attendance and engagement in sessions has been consistent this month.' },
        { t: 'Behavioral Wellbeing', key: 'behavioral', b: 'Increased emotional stability and improved interactions observed.' },
        { t: 'Safety & Observation', key: 'risk', b: 'Safety observations remain on track. Appropriate supports are in place.' },
        { t: 'Relapse Risk', key: 'relapse_risk', b: 'Relapse risk monitoring for this period.' }
      ],
      tipsTitle: 'How you can support your family member',
      tips: ['Regular, calm visits help your family member feel safe.', 'Participate in family counseling sessions.', 'Encourage every small progress.', 'Contact your assigned social worker for concerns.', 'Follow caregiver guidelines from sessions.'],
      disc: 'This report uses supportive, family-friendly language. It does not contain diagnosis or medication details.',
      noteTitle: 'Additional note',
      notePlaceholder: 'Add a note for this client’s progress report (e.g. summary for family). Saved per client.',
      saveNote: 'Save note',
      footer: 'Neuro-Psychiatric Rehabilitation Centre | Confidential Family Report | Maitra Wellness',
      exportPdf: 'Export PDF', locale: 'en-IN',
      sectionSummary: {
        adl: 'This month, {{count}} daily living areas were assessed. Most areas are at {{level}}.',
        therapeutic: '{{count}} therapy sessions were recorded. Attendance was {{presentCount}} present; engagement was mostly {{engagementSummary}}.',
        behavioral: 'Behavioral and emotional observations were recorded across {{count}} areas this month, with an average of {{avg}}/5.',
        risk: 'Safety was monitored across {{count}} areas. Current observations are {{summary}}.',
        relapse_risk: 'Relapse risk total: {{total}}/9 — {{level}}. Treatment non-adherence: {{tna}}, Stressful situations: {{ss}}, High EE: {{hee}}.'
      },
      sectionSummaryFallback: 'Observations were recorded this month.',
      levelLabels: { Independent: 'Independent', Supervised: 'Supervised', 'Min Assist': 'Min Assist', 'Mod Assist': 'Mod Assist', 'Max Assist': 'Max Assist', Dependent: 'Dependent', mixed: 'mixed', various: 'various' },
      engagementLabels: { active: 'active', mixed: 'mixed', passive: 'passive' },
      riskSummaryLabels: { withinRange: 'within expected range.', monitored: 'being monitored.' },
      noReportMessage: 'We don\'t have any reports for this client in the selected time frame, so no report content to display.',
      recoveryHeading: 'Recovery scoring',
      mrsTitle: 'Master Recovery Score',
      mrsSubtitle: 'Based on weighted recovery indices',
      mrsEmptyText: 'Add psychiatric, medication, ADL and therapeutic reports in this date range to see the score.',
      recoveryIndicesTitle: 'Recovery Indices',
      indexLabels: { ssi: 'Symptom Severity', ifi: 'Insight & Flexibility', fri: 'Functional Recovery', fsi: 'Family Stability', bsi: 'Biological Stability', rrs: 'Relapse Risk' },
      weightLabels: { symptomReduction: 'Symptom', insight: 'Insight', function: 'Function', familySystem: 'Family', medicationAdherence: 'Medication' },
      relapseRiskMonitorTitle: 'Relapse Risk Monitor',
      riskLevels: { Low: 'Low', Moderate: 'Moderate', High: 'High' },
      rrLevelSuffix: ' Risk',
      rrTreatmentNonAdherence: 'Treatment Non-adherence',
      rrStressfulSituations: 'Stressful Situations',
      rrHighEE: 'High EE by Family',
      weeklyTrend: 'Weekly Trend',
      rrEmptyTitle: 'No relapse risk data for this period.',
      rrEmptyText: 'Add a Relapse Risk report from the patient\'s profile (Reports tab) or via Add Report. Each entry records Treatment non-adherence, Stressful situations, and High EE by family (0–3 each).',
      weightLabelPrefix: 'Weights: '
    },
    mr: {
      frTitle: 'कुटुंब प्रगती अहवाल', frSub: 'तारखा श्रेणी — सहाय्यक भाषा',
      lblC: 'रुग्ण निवडा', lblM: 'अहवाल महिना', lblFrom: 'पासून तारीख', lblTo: 'पर्यंत तारीख', lblL: 'भाषा', noc: 'वरून रुग्ण निवडा.',
      center: 'न्यूरो-मनोरुग्ण पुनर्वसन केंद्र', rTitle: 'मासिक कुटुंब प्रगती अहवाल',
      cLbl: 'रुग्ण', tLbl: 'नियुक्त डॉक्टर', aLbl: 'प्रवेश', pTitle: 'या महिन्याची प्रगती',
      mTitle: 'मासिक प्रगती', wTitle: 'साप्ताहिक कल सारांश',
      wCols: ['क्षेत्र', 'आठवडा १', 'आठवडा २', 'आठवडा ३', 'आठवडा ४', 'बदल'],
      bars: ['दैनंदिन जीवन कौशल्ये', 'उपचार सहभाग', 'वर्तणूक स्थिरता', 'सुरक्षा निरीक्षण'],
      sections: [
        { t: 'दैनंदिन जीवन कौशल्ये', key: 'adl', b: 'आपल्या कुटुंब सदस्याने वैयक्तिक काळजी आणि दैनंदिन दिनचर्येत प्रगती केली आहे.' },
        { t: 'उपचारात्मक सहभाग', key: 'therapeutic', b: 'या महिन्यात उपचारात्मक सत्रांमध्ये उपस्थिती नियमित राहिली.' },
        { t: 'वर्तणूक व भावनिक स्थिरता', key: 'behavioral', b: 'काळजी संघाने भावनिक स्थिरतेत वाढ निरीक्षण केले आहेत.' },
        { t: 'सुरक्षा निरीक्षण', key: 'risk', b: 'सुरक्षा निरीक्षण योग्य प्रकारे चालू आहे.' },
        { t: 'पुनरावृत्ती धोका', key: 'relapse_risk', b: 'या कालावधीतील पुनरावृत्ती धोका निरीक्षण.' }
      ],
      tipsTitle: 'आपण कुटुंब सदस्याला कसे सहाय्य करू शकता',
      tips: ['नियमित भेट द्या.', 'कुटुंब समुपदेशन सत्रांमध्ये सहभागी व्हा.', 'छोट्या प्रगतीलाही प्रोत्साहन द्या.', 'शंका असल्यास सामाजिक कार्यकर्त्याशी संपर्क करा.', 'काळजीवाहू मार्गदर्शक पाळा.'],
      disc: 'हा अहवाल सहाय्यक भाषेत आहे. निदान किंवा औषध तपशील नाही.',
      noteTitle: 'अतिरिक्त नोट',
      notePlaceholder: 'या रुग्णाच्या प्रगती अहवालासाठी नोट (उदा. कुटुंबासाठी सारांश). प्रति रुग्ण सेव्ह होते.',
      saveNote: 'नोट सेव्ह करा',
      footer: 'न्यूरो-मनोरुग्ण पुनर्वसन केंद्र | कुटुंब अहवाल — गोपनीय | Maitra Wellness',
      exportPdf: 'PDF एक्सपोर्ट करा', locale: 'mr-IN',
      sectionSummary: {
        adl: 'या महिन्यात {{count}} दैनंदिन जीवन क्षेत्रांचे मूल्यांकन केले गेले. बहुतांश क्षेत्रांमध्ये {{level}}.',
        therapeutic: '{{count}} उपचार सत्र नोंदवले गेले. {{presentCount}} उपस्थित; सहभाग बहुतेक {{engagementSummary}}.',
        behavioral: 'या महिन्यात {{count}} क्षेत्रांमध्ये वर्तणूक आणि भावनिक निरीक्षणे नोंदवली गेली, सरासरी {{avg}}/5.',
        risk: '{{count}} क्षेत्रांमध्ये सुरक्षा निरीक्षण केले गेले. सध्याची निरीक्षणे {{summary}}',
        relapse_risk: 'पुनरावृत्ती धोका एकूण: {{total}}/9 — {{level}}. उपचार अनुपालन: {{tna}}, तणावपूर्ण परिस्थिती: {{ss}}, उच्च EE: {{hee}}.'
      },
      sectionSummaryFallback: 'या महिन्यात निरीक्षणे नोंदवली गेली.',
      levelLabels: { Independent: 'स्वतंत्र', Supervised: 'पर्यवेक्षणाखाली', 'Min Assist': 'किमान सहाय्य', 'Mod Assist': 'मध्यम सहाय्य', 'Max Assist': 'जास्तीत जास्त सहाय्य', Dependent: 'अवलंबून', mixed: 'मिश्रित', various: 'विविध' },
      engagementLabels: { active: 'सक्रिय', mixed: 'मिश्रित', passive: 'निष्क्रिय' },
      riskSummaryLabels: { withinRange: 'अपेक्षित श्रेणीत.', monitored: 'निरीक्षणाखाली.' },
      noReportMessage: 'या कालावधीत या रुग्णासाठी कोणतेही अहवाल नाहीत, म्हणून दर्शविण्यासाठी अहवाल सामग्री उपलब्ध नाही.',
      recoveryHeading: 'पुनर्वसन गुणांकन',
      mrsTitle: 'मास्टर पुनर्वसन गुण',
      mrsSubtitle: 'भारित पुनर्वसन निर्देशांवर आधारित',
      mrsEmptyText: 'गुण पाहण्यासाठी या तारखा श्रेणीत मानसिक, औषध, ADL आणि उपचारात्मक अहवाल जोडा.',
      recoveryIndicesTitle: 'पुनर्वसन निर्देश',
      indexLabels: { ssi: 'लक्षण तीव्रता', ifi: 'अंतर्दृष्टी आणि लवचिकता', fri: 'कार्यात्मक पुनर्वसन', fsi: 'कुटुंब स्थिरता', bsi: 'जैविक स्थिरता', rrs: 'पुनरावृत्ती धोका' },
      weightLabels: { symptomReduction: 'लक्षण', insight: 'अंतर्दृष्टी', function: 'कार्य', familySystem: 'कुटुंब', medicationAdherence: 'औषध' },
      relapseRiskMonitorTitle: 'पुनरावृत्ती धोका निरीक्षक',
      riskLevels: { Low: 'कमी', Moderate: 'मध्यम', High: 'उच्च' },
      rrLevelSuffix: ' धोका',
      rrTreatmentNonAdherence: 'उपचार अनुपालन नाही',
      rrStressfulSituations: 'तणावपूर्ण परिस्थिती',
      rrHighEE: 'कुटुंबातून उच्च EE',
      weeklyTrend: 'साप्ताहिक कल',
      rrEmptyTitle: 'या कालावधीसाठी पुनरावृत्ती धोका डेटा नाही.',
      rrEmptyText: 'रुग्ण प्रोफाइलमधून (अहवाल टॅब) किंवा अहवाल जोडा मधून पुनरावृत्ती धोका अहवाल जोडा. प्रत्येक नोंदीत उपचार अनुपालन नाही, तणावपूर्ण परिस्थिती आणि कुटुंबातून उच्च EE (प्रत्येकी ०–३) नोंदवली जाते.',
      weightLabelPrefix: 'वजन: '
    }
  };

  function render(state) {
    var s = STRINGS[_lang];
    $('fr-title').textContent = s.frTitle;
    $('fr-sub').textContent = s.frSub;
    $('fr-lbl-c').textContent = s.lblC;
    if ($('fr-lbl-from')) $('fr-lbl-from').textContent = s.lblFrom || 'From date';
    if ($('fr-lbl-to')) $('fr-lbl-to').textContent = s.lblTo || 'To date';
    $('fr-lbl-l').textContent = s.lblL;

    var clients = (state.clients || []).filter(function (c) { return c.status === 'active'; });
    var prev = ($('fr-cl-id') && $('fr-cl-id').value) || '';
    if ($('fr-cl-id')) $('fr-cl-id').value = prev;
    var disp = prev ? ((clients.filter(function (c) { return c.id === prev; })[0] || {}).name || '') : '';
    if ($('fr-cl')) $('fr-cl').value = disp;

    var today = new Date().toISOString().slice(0, 10);
    var fromDefault = today;
    var selectedClient = prev ? (state.clients || []).filter(function (c) { return c.id === prev; })[0] : null;
    if (selectedClient && selectedClient.admissionDate) {
      var ad = selectedClient.admissionDate;
      fromDefault = (ad.indexOf('-') !== -1 && ad.length >= 10) ? ad.slice(0, 10) : (function () {
        var d = new Date(ad);
        return isNaN(d.getTime()) ? today : d.toISOString().slice(0, 10);
      })();
      if (fromDefault > today) fromDefault = today;
    } else {
      var firstDay = new Date();
      firstDay.setDate(1);
      fromDefault = firstDay.toISOString().slice(0, 10);
    }
    if ($('fr-date-from') && !$('fr-date-from').value) $('fr-date-from').value = fromDefault;
    if ($('fr-date-to') && !$('fr-date-to').value) $('fr-date-to').value = today;
    generateReport(state);
  }

  function setDateRangeFromClient(client, state) {
    var today = new Date().toISOString().slice(0, 10);
    var fromDefault = today;
    if (client && client.admissionDate) {
      var ad = client.admissionDate;
      fromDefault = (ad.indexOf('-') !== -1 && ad.length >= 10) ? ad.slice(0, 10) : (function () {
        var d = new Date(ad);
        return isNaN(d.getTime()) ? today : d.toISOString().slice(0, 10);
      })();
      if (fromDefault > today) fromDefault = today;
    } else {
      var firstDay = new Date();
      firstDay.setDate(1);
      fromDefault = firstDay.toISOString().slice(0, 10);
    }
    if ($('fr-date-from')) $('fr-date-from').value = fromDefault;
    if ($('fr-date-to')) $('fr-date-to').value = today;
  }

  function generateReport(state) {
    var cid = ($('fr-cl-id') && $('fr-cl-id').value) || '';
    var c = null;
    (state.clients || []).forEach(function (cl) { if (cl.id === cid) c = cl; });
    if (!c) {
      $('fr-prev').hidden = true;
      $('fr-noc').style.display = '';
      var btn = $('fr-export-pdf');
      if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-file-pdf"></i> ' + (STRINGS[_lang].exportPdf); }
      return;
    }
    $('fr-noc').style.display = 'none';
    $('fr-prev').hidden = false;

    var s = STRINGS[_lang];
    var fromVal = ($('fr-date-from') || {}).value || new Date().toISOString().slice(0, 10);
    var toVal = ($('fr-date-to') || {}).value || new Date().toISOString().slice(0, 10);
    var fromDate = new Date(fromVal);
    var toDate = new Date(toVal);
    if (toDate < fromDate) toDate = fromDate;
    var dateRangeStr = fromDate.toLocaleDateString(s.locale, { day: 'numeric', month: 'short', year: 'numeric' }) + ' – ' + toDate.toLocaleDateString(s.locale, { day: 'numeric', month: 'short', year: 'numeric' });

    fetchDateRangeData(cid, fromVal, toVal).then(function (data) {
      data = data || [];
      var bars = computeBars(data, s);
      var trend = computeTrend(data, fromVal.slice(0, 7), s);

      var state = (window.CareTrack && window.CareTrack.getState) ? window.CareTrack.getState() : {};
      var mrsWeights = (state.config && state.config.mrsWeights) || DEFAULT_MRS_WEIGHTS;

      var ssi = computeSSI(data);
      var ifi = computeIFI(data);
      var fri = computeFRI(data);
      var fsi = computeFSI();
      var bsi = computeBSI(data);
      var rrs = computeRRS(data);
      var indices = { ssi: ssi, ifi: ifi, fri: fri, fsi: fsi, bsi: bsi, rrs: rrs };
      var mrs = computeMRS(indices, mrsWeights);

      var rrReps = data.filter(function (r) { return r.section === 'relapse_risk'; });
      var rrCard = computeRelapseRiskCard(rrReps);
      var rrTrend = computeRelapseRiskTrend(data, fromVal, toVal);

      var recoveryHtml = buildRecoverySection(indices, mrs, rrCard, rrTrend, mrsWeights, s);

      var sectionRows = s.sections.map(function (sec) {
        var summary = getSectionSummary(data, sec.key, s);
        return summary ? '<div class="frs"><div class="frs-t">' + sec.t + '</div><div class="frs-b">' + summary + '</div></div>' : '';
      }).filter(Boolean).join('');
      var hasProgressCard = sectionRows.length > 0;
      var barsWithPercent = bars.filter(function (b) { return b[0] > 0; });
      var hasBars = barsWithPercent.length > 0;
      var hasTrend = trend.some(function (r) { return r[1] !== '—%' || r[2] !== '—%' || r[3] !== '—%' || r[4] !== '—%'; });
      var hasAnyContent = hasProgressCard || hasBars || hasTrend;

      var progressCardHtml = hasProgressCard
        ? '<div class="card"><div style="font-weight:700;color:var(--primary);margin-bottom:12px">' + s.pTitle + '</div>' + sectionRows + '</div>'
        : '';
      var barsCardHtml = hasBars
        ? '<div class="card"><div style="font-weight:700;margin-bottom:12px">' + s.mTitle + '</div>' +
          barsWithPercent.map(function (b) {
            return '<div class="pbw"><div class="pbt"><span>' + b[1] + '</span><span style="font-weight:700;color:var(--primary)">' + b[0] + '%</span></div>' +
              '<div class="pbtr"><div class="pbf" style="width:' + b[0] + '%"></div></div></div>';
          }).join('') + '</div>'
        : '';
      var trendCardHtml = hasTrend
        ? '<div class="card"><div style="font-weight:700;margin-bottom:12px">' + s.wTitle + '</div>' +
          '<div class="table-wrap"><table class="wt"><thead><tr>' + s.wCols.map(function (h) { return '<th>' + h + '</th>'; }).join('') + '</tr></thead><tbody>' +
          trend.map(function (r) {
            return '<tr><td style="text-align:left;font-weight:500">' + r[0] + '</td><td>' + r[1] + '</td><td>' + r[2] + '</td><td>' + r[3] + '</td><td>' + r[4] + '</td><td class="chg">' + r[5] + '</td></tr>';
          }).join('') + '</tbody></table></div></div>'
        : '';
      var mainContentHtml = hasAnyContent
        ? progressCardHtml + barsCardHtml + trendCardHtml
        : '<div class="card"><p class="empty-state" style="margin:0;padding:24px;text-align:center;color:var(--text-3);font-size:.95rem">' + esc(s.noReportMessage) + '</p></div>';

      var recoveryBlockHtml = hasAnyContent ? recoveryHtml : '';
      var tipsCardHtml = hasAnyContent
        ? '<div class="card fr-tips-card"><div style="font-weight:700;margin-bottom:12px">' + s.tipsTitle + '</div>' +
          s.tips.map(function (t, i) { return '<div class="tipr"><div class="tipn">' + (i + 1) + '</div><div class="tipt">' + t + '</div></div>'; }).join('') + '</div>'
        : '';

      var noteHtml = (c.progressReportNote && c.progressReportNote.trim()) ? '<div class="card" style="margin-bottom:12px"><div style="font-weight:700;margin-bottom:8px">' + s.noteTitle + '</div><p style="margin:0;font-size:.9rem;white-space:pre-wrap">' + esc(c.progressReportNote) + '</p></div>' : '';
      var btn = $('fr-export-pdf');
      if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-file-pdf"></i> ' + s.exportPdf; }
      $('fr-prev').innerHTML =
        '<div class="fr-note-edit card" style="margin-bottom:16px">' +
        '<div style="font-weight:700;margin-bottom:8px">' + s.noteTitle + '</div>' +
        '<textarea id="fr-progress-note" class="fi" rows="3" placeholder="' + esc(s.notePlaceholder) + '">' + esc(c.progressReportNote || '') + '</textarea>' +
        '<button type="button" class="btn btn-sm" id="fr-save-note" style="margin-top:8px"><i class="fas fa-save"></i> ' + s.saveNote + '</button>' +
        '</div>' +
        '<div id="fr-report-content" class="fr-report-content' + (_lang === 'mr' ? ' fr-lang-mr' : '') + '">' +
        '<div class="rh"><div class="rh-c">' + s.center + '</div><div class="rh-t">' + s.rTitle + '</div>' +
        '<div class="rh-d">' + s.cLbl + ': <strong>' + esc(c.name) + '</strong> | ID: ' + c.id + ' | ' + s.tLbl + ': ' + ((c.assignedDoctors && c.assignedDoctors.length ? c.assignedDoctors.join(', ') : c.assignedTherapist) || '—') + '</div>' +
        '<div class="rh-s">' + dateRangeStr + ' | ' + s.aLbl + ': ' + (c.admissionDate || '—') + '</div></div>' +
        '<div class="alert alert-warn">' + s.disc + '</div>' +
        noteHtml +
        mainContentHtml +
        recoveryBlockHtml +
        tipsCardHtml +
        '<div class="fr-foot">' + s.footer + '</div>' +
        '</div>';
      bindExportPdf(c, fromVal, toVal);
      bindSaveNote(c);
    });
  }

  function fetchDateRangeData(clientId, fromStr, toStr) {
    var start = new Date(fromStr);
    start.setHours(0, 0, 0, 0);
    var end = new Date(toStr);
    end.setHours(23, 59, 59, 999);
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
    if (section === 'relapse_risk') {
      var rrCard = computeRelapseRiskCard(reps);
      if (!rrCard) return fallback;
      return tpl
        .replace(/\{\{total\}\}/g, String(rrCard.total))
        .replace(/\{\{level\}\}/g, rrCard.level)
        .replace(/\{\{tna\}\}/g, String(rrCard.treatmentNonAdherence))
        .replace(/\{\{ss\}\}/g, String(rrCard.stressfulSituations))
        .replace(/\{\{hee\}\}/g, String(rrCard.highEE));
    }
    return fallback;
  }

  /* ── Recovery Scoring ────────────────────────────────────────── */

  var DEFAULT_MRS_WEIGHTS = {
    symptomReduction: 30,
    insight: 20,
    function: 25,
    familySystem: 15,
    medicationAdherence: 10
  };

  function computeRelapseRiskCard(rrReports) {
    if (!rrReports || !rrReports.length) return null;
    var latest = rrReports.reduce(function (a, b) {
      return (new Date(b.createdAt || 0)) > (new Date(a.createdAt || 0)) ? b : a;
    });
    var p = latest.payload || {};
    var tna = parseInt(p.treatmentNonAdherence, 10) || 0;
    var ss = parseInt(p.stressfulSituations, 10) || 0;
    var hee = parseInt(p.highEE, 10) || 0;
    var total = tna + ss + hee;
    var level = total <= 3 ? 'Low' : (total <= 6 ? 'Moderate' : 'High');
    return { treatmentNonAdherence: tna, stressfulSituations: ss, highEE: hee, total: total, level: level };
  }

  function computeRelapseRiskTrend(reports, fromStr, toStr) {
    var rrReps = reports.filter(function (r) { return r.section === 'relapse_risk'; });
    if (!rrReps.length) return [];
    var weeks = {};
    rrReps.forEach(function (r) {
      var p = r.payload || {};
      var d = new Date(p.weekStart || r.createdAt || 0);
      var weekKey = getISOWeek(d);
      if (!weeks[weekKey] || new Date(r.createdAt || 0) > new Date(weeks[weekKey].createdAt || 0)) {
        weeks[weekKey] = r;
      }
    });
    var keys = Object.keys(weeks).sort();
    return keys.map(function (k) {
      var p = weeks[k].payload || {};
      var total = (parseInt(p.treatmentNonAdherence, 10) || 0) + (parseInt(p.stressfulSituations, 10) || 0) + (parseInt(p.highEE, 10) || 0);
      var level = total <= 3 ? 'Low' : (total <= 6 ? 'Moderate' : 'High');
      return { week: k, total: total, level: level };
    });
  }

  function getISOWeek(d) {
    var dt = new Date(d);
    var day = dt.getDay() || 7;
    dt.setDate(dt.getDate() + 4 - day);
    var yearStart = new Date(dt.getFullYear(), 0, 1);
    var weekNo = Math.ceil(((dt - yearStart) / 86400000 + 1) / 7);
    return dt.getFullYear() + '-W' + (weekNo < 10 ? '0' : '') + weekNo;
  }

  function computeSSI(reports) {
    var reps = reports.filter(function (r) { return r.section === 'psychiatric'; });
    if (!reps.length) return null;
    var total = 0, count = 0;
    reps.forEach(function (r) {
      var ratings = (r.payload || {}).ratings || {};
      Object.keys(ratings).forEach(function (k) {
        var v = parseInt(ratings[k], 10);
        if (v >= 1 && v <= 5) { total += v; count++; }
      });
    });
    if (!count) return null;
    return Math.round((total / count / 5) * 100);
  }

  function computeIFI(reports) {
    var psyReps = reports.filter(function (r) { return r.section === 'psychiatric'; });
    var behReps = reports.filter(function (r) { return r.section === 'behavioral'; });
    if (!psyReps.length && !behReps.length) return null;
    var psyKeys = ['Insight', 'Judgment'];
    var behKeys = ['Emotional Regulation', 'Response to Redirection'];
    var total = 0, count = 0;
    psyReps.forEach(function (r) {
      var ratings = (r.payload || {}).ratings || {};
      psyKeys.forEach(function (k) {
        var v = parseInt(ratings[k], 10);
        if (v >= 1 && v <= 5) { total += v; count++; }
      });
    });
    behReps.forEach(function (r) {
      var ratings = (r.payload || {}).ratings || {};
      behKeys.forEach(function (k) {
        var v = parseInt(ratings[k], 10);
        if (v >= 1 && v <= 5) { total += v; count++; }
      });
    });
    if (!count) return null;
    return Math.round((total / count / 5) * 100);
  }

  function computeFRI(reports) {
    var adlScore = avgRatingFromSection(reports, 'adl');
    var therScore = avgEngagement(reports);
    if (!adlScore && !therScore) return null;
    var parts = 0, sum = 0;
    if (adlScore) { sum += adlScore; parts++; }
    if (therScore) { sum += therScore; parts++; }
    return parts ? Math.round(sum / parts) : null;
  }

  function computeFSI() { return null; }

  function computeBSI(reports) {
    var reps = reports.filter(function (r) { return r.section === 'medication'; });
    if (!reps.length) return null;
    var complianceMap = { 'Full': 100, 'Partial': 50, 'Refused': 0 };
    var total = 0, count = 0;
    reps.forEach(function (r) {
      var p = r.payload || {};
      if (p.compliance && complianceMap[p.compliance] !== undefined) {
        total += complianceMap[p.compliance];
        count++;
      }
    });
    return count ? Math.round(total / count) : null;
  }

  function computeRRS(reports) {
    var rrReps = reports.filter(function (r) { return r.section === 'relapse_risk'; });
    if (!rrReps.length) return null;
    var latest = rrReps.reduce(function (a, b) {
      return (new Date(b.createdAt || 0)) > (new Date(a.createdAt || 0)) ? b : a;
    });
    var p = latest.payload || {};
    var total = (parseInt(p.treatmentNonAdherence, 10) || 0) + (parseInt(p.stressfulSituations, 10) || 0) + (parseInt(p.highEE, 10) || 0);
    return Math.round(((9 - total) / 9) * 100);
  }

  function computeMRS(indices, weights) {
    var w = weights || DEFAULT_MRS_WEIGHTS;
    var mapping = [
      { idx: 'ssi', w: w.symptomReduction },
      { idx: 'ifi', w: w.insight },
      { idx: 'fri', w: w.function },
      { idx: 'fsi', w: w.familySystem },
      { idx: 'bsi', w: w.medicationAdherence }
    ];
    var totalWeight = 0, score = 0;
    mapping.forEach(function (m) {
      var val = indices[m.idx];
      if (val !== null && val !== undefined) {
        score += val * (m.w / 100);
        totalWeight += m.w;
      }
    });
    if (!totalWeight) return null;
    return Math.round((score / totalWeight) * 100);
  }

  function buildRecoverySection(indices, mrs, rrCard, rrTrend, weights, s) {
    s = s || STRINGS.en;
    var html = '';

    /* Always show Recovery Indices + MRS card so the section is visible even with no data */
    html += '<div class="card recovery-scoring-card">' +
      '<div style="font-weight:700;color:var(--primary);margin-bottom:12px;font-size:1rem">' + esc(s.recoveryHeading || 'Recovery scoring') + '</div>';

    if (mrs !== null) {
      var mrsColor = mrs >= 70 ? 'var(--success)' : (mrs >= 40 ? 'var(--warning)' : 'var(--danger)');
      html += '<div style="text-align:center;margin-bottom:20px">' +
        '<div style="font-weight:700;font-size:1rem;margin-bottom:8px;color:var(--primary)">' + esc(s.mrsTitle || 'Master Recovery Score') + '</div>' +
        '<div class="mrs-gauge" style="position:relative;width:100px;height:100px;margin:0 auto">' +
          '<svg viewBox="0 0 36 36" style="width:100%;height:100%">' +
            '<path class="mrs-gauge-bg" d="M18 2.0845a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="var(--border)" stroke-width="3"/>' +
            '<path d="M18 2.0845a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="' + mrsColor + '" stroke-width="3" stroke-dasharray="' + mrs + ', 100" stroke-linecap="round"/>' +
          '</svg>' +
          '<div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);font-size:1.5rem;font-weight:800;color:' + mrsColor + '">' + mrs + '%</div>' +
        '</div>' +
        '<div style="font-size:.8rem;color:var(--text-3);margin-top:4px">' + esc(s.mrsSubtitle || 'Based on weighted recovery indices') + '</div>' +
      '</div>';
    } else {
      html += '<div class="rr-empty-state" style="text-align:center;margin-bottom:16px;padding:12px;border-radius:8px">' +
        '<div style="font-weight:600;margin-bottom:4px">' + esc(s.mrsTitle || 'Master Recovery Score') + '</div>' +
        '<div style="font-size:.85rem">' + esc(s.mrsEmptyText || 'Add psychiatric, medication, ADL and therapeutic reports in this date range to see the score.') + '</div>' +
      '</div>';
    }

    var indexDefs = [
      { key: 'ssi', icon: 'fa-brain', color: '#6366f1' },
      { key: 'ifi', icon: 'fa-lightbulb', color: '#8b5cf6' },
      { key: 'fri', icon: 'fa-hands-helping', color: '#06b6d4' },
      { key: 'fsi', icon: 'fa-house-chimney', color: '#f59e0b' },
      { key: 'bsi', icon: 'fa-pills', color: '#10b981' },
      { key: 'rrs', icon: 'fa-rotate-left', color: '#ef4444' }
    ];
    var iLabels = s.indexLabels || {};

    html += '<div style="font-weight:700;margin-bottom:10px">' + esc(s.recoveryIndicesTitle || 'Recovery Indices') + '</div>' +
      '<div class="recovery-indices-grid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:10px;margin-bottom:16px">';
    indexDefs.forEach(function (def) {
      var label = iLabels[def.key] || def.key;
      var val = indices[def.key];
      var display = val !== null && val !== undefined ? val + '%' : 'N/A';
      var barW = val !== null && val !== undefined ? val : 0;
      html += '<div class="ri-card" style="border-radius:10px;padding:10px;text-align:center">' +
        '<div style="font-size:.75rem;color:var(--text-3);margin-bottom:4px"><i class="fas ' + def.icon + '" style="color:' + def.color + '"></i> ' + esc(label) + '</div>' +
        '<div style="font-size:1.25rem;font-weight:700;color:' + def.color + '">' + display + '</div>' +
        '<div class="ri-bar-bg" style="height:4px;border-radius:2px;margin-top:6px;overflow:hidden"><div style="height:100%;width:' + barW + '%;background:' + def.color + ';border-radius:2px"></div></div>' +
      '</div>';
    });
    html += '</div>';

    if (weights && s.weightLabels) {
      var wParts = [];
      Object.keys(s.weightLabels).forEach(function (k) { wParts.push(s.weightLabels[k] + ' ' + (weights[k] || 0) + '%'); });
      html += '<div style="font-size:.75rem;color:var(--text-3)">' + (s.weightLabelPrefix || 'Weights: ') + wParts.join(' · ') + '</div>';
    }

    html += '</div>';

    /* Always show Relapse Risk Monitor card; show empty state when no data */
    html += '<div class="card relapse-risk-card">' +
      '<div style="font-weight:700;margin-bottom:12px;color:var(--primary)">' + esc(s.relapseRiskMonitorTitle || 'Relapse Risk Monitor') + '</div>';

    if (rrCard) {
      var levelColor = rrCard.level === 'Low' ? 'var(--success)' : (rrCard.level === 'Moderate' ? 'var(--warning)' : 'var(--danger)');
      var levelLabel = (s.riskLevels && s.riskLevels[rrCard.level]) ? s.riskLevels[rrCard.level] : rrCard.level;
      var levelSuffix = s.rrLevelSuffix || ' Risk';
      html += '<div style="display:flex;align-items:center;gap:16px;flex-wrap:wrap;margin-bottom:12px">' +
        '<div style="text-align:center;min-width:80px">' +
          '<div style="font-size:2rem;font-weight:800;color:' + levelColor + '">' + rrCard.total + '<span style="font-size:1rem;font-weight:400">/9</span></div>' +
          '<div style="font-size:.85rem;font-weight:600;color:' + levelColor + '">' + esc(levelLabel + levelSuffix) + '</div>' +
        '</div>' +
        '<div style="flex:1;min-width:160px">' +
          '<div class="rr-item" style="display:flex;justify-content:space-between;font-size:.85rem;padding:4px 0;border-bottom:1px solid var(--border,#e5e7eb)"><span>' + esc(s.rrTreatmentNonAdherence || 'Treatment Non-adherence') + '</span><strong>' + rrCard.treatmentNonAdherence + '/3</strong></div>' +
          '<div class="rr-item" style="display:flex;justify-content:space-between;font-size:.85rem;padding:4px 0;border-bottom:1px solid var(--border,#e5e7eb)"><span>' + esc(s.rrStressfulSituations || 'Stressful Situations') + '</span><strong>' + rrCard.stressfulSituations + '/3</strong></div>' +
          '<div class="rr-item" style="display:flex;justify-content:space-between;font-size:.85rem;padding:4px 0"><span>' + esc(s.rrHighEE || 'High EE by Family') + '</span><strong>' + rrCard.highEE + '/3</strong></div>' +
        '</div>' +
      '</div>';

      if (rrTrend.length > 1) {
        var maxTotal = 9;
        html += '<div style="font-weight:600;font-size:.85rem;margin-bottom:8px">' + esc(s.weeklyTrend || 'Weekly Trend') + '</div>' +
          '<div class="rr-trend" style="display:flex;align-items:flex-end;gap:4px;height:60px">';
        rrTrend.forEach(function (w) {
          var pct = Math.round((w.total / maxTotal) * 100);
          var barColor = w.level === 'Low' ? 'var(--success)' : (w.level === 'Moderate' ? 'var(--warning)' : 'var(--danger)');
          var wLevelLabel = (s.riskLevels && s.riskLevels[w.level]) ? s.riskLevels[w.level] : w.level;
          html += '<div style="flex:1;display:flex;flex-direction:column;align-items:center">' +
            '<div style="width:100%;max-width:28px;background:' + barColor + ';border-radius:3px 3px 0 0;height:' + Math.max(pct, 5) + '%" title="' + esc(w.week + ': ' + w.total + '/9 (' + wLevelLabel + ')') + '"></div>' +
            '<div style="font-size:.6rem;color:var(--text-3);margin-top:2px;white-space:nowrap">' + esc(w.week.replace(/^\d{4}-/, '')) + '</div>' +
          '</div>';
        });
        html += '</div>';
      }
    } else {
      html += '<div class="rr-empty-state" style="padding:16px;border-radius:8px;font-size:.9rem">' +
        '<strong>' + esc(s.rrEmptyTitle || 'No relapse risk data for this period.') + '</strong><br>' +
        esc(s.rrEmptyText || 'Add a Relapse Risk report from the patient\'s profile (Reports tab) or via Add Report. Each entry records Treatment non-adherence, Stressful situations, and High EE by family (0–3 each).') +
      '</div>';
    }

    html += '</div>';

    return html;
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

  function bindExportPdf(client, fromStr, toStr) {
    var btn = document.getElementById('fr-export-pdf');
    if (!btn) return;
    btn.onclick = function () {
      exportReportPdf(client, fromStr, toStr);
    };
  }

  function bindSaveNote(client) {
    var btn = document.getElementById('fr-save-note');
    if (!btn || !client) return;
    btn.addEventListener('click', function () {
      var ta = document.getElementById('fr-progress-note');
      var value = (ta && ta.value) ? ta.value.trim() : '';
      if (window.CareTrack && window.CareTrack.setButtonLoading) window.CareTrack.setButtonLoading(btn, true, 'Saving...');
      AppDB.updateClient(client.id, { progressReportNote: value }).then(function () {
        if (window.CareTrack) {
          window.CareTrack.toast('Note saved');
          window.CareTrack.refreshData();
        }
        if (window.CareTrack && window.CareTrack.setButtonLoading) window.CareTrack.setButtonLoading(btn, false);
      }).catch(function (e) {
        if (window.CareTrack) window.CareTrack.toast('Error: ' + (e && e.message ? e.message : 'Save failed'));
        if (window.CareTrack && window.CareTrack.setButtonLoading) window.CareTrack.setButtonLoading(btn, false);
      });
    });
  }

  function exportReportPdf(client, fromStr, toStr) {
    var el = document.getElementById('fr-report-content');
    if (!el || typeof html2pdf === 'undefined') {
      if (window.CareTrack) window.CareTrack.toast('PDF export not available.');
      return;
    }
    var isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    if (isDark) el.classList.add('fr-export-dark');
    var name = (client && client.name) ? client.name.replace(/[^a-zA-Z0-9]/g, '-') : 'Report';
    var filename = 'Family-Report-' + name + '-' + (fromStr || '').slice(0, 10) + '-to-' + (toStr || '').slice(0, 10) + '.pdf';
    var opt = {
      margin: 10,
      filename: filename,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
      pagebreak: { mode: ['avoid-all', 'css'], avoid: ['.rh', '.alert', '.card', '.frs', '.fr-foot', '.recovery-scoring-card', '.fr-tips-card', '.pbw'] }
    };
    var btn = document.getElementById('fr-export-pdf');
    if (btn && window.CareTrack && window.CareTrack.setButtonLoading) window.CareTrack.setButtonLoading(btn, true, 'Generating…');

    function doExport() {
      html2pdf().set(opt).from(el).save().then(function () {
        if (isDark) el.classList.remove('fr-export-dark');
        if (btn) {
          var s = STRINGS[_lang];
          if (window.CareTrack && window.CareTrack.setButtonLoading) window.CareTrack.setButtonLoading(btn, false);
          else { btn.disabled = false; btn.innerHTML = '<i class="fas fa-file-pdf"></i> ' + (s && s.exportPdf ? s.exportPdf : 'Export PDF'); }
        }
        if (window.CareTrack) window.CareTrack.toast('PDF downloaded.');
      }).catch(function (err) {
        if (isDark && el) el.classList.remove('fr-export-dark');
        if (btn) {
          if (window.CareTrack && window.CareTrack.setButtonLoading) window.CareTrack.setButtonLoading(btn, false);
          else {
            var s = STRINGS[_lang];
            btn.disabled = false;
            btn.innerHTML = '<i class="fas fa-file-pdf"></i> ' + (s && s.exportPdf ? s.exportPdf : 'Export PDF');
          }
        }
        if (window.CareTrack) window.CareTrack.toast(err && err.message ? err.message : 'PDF export failed.');
      });
    }

    if (_lang === 'mr' && document.fonts && document.fonts.load) {
      Promise.all([
        document.fonts.load('400 16px "Noto Sans Devanagari"'),
        document.fonts.load('600 16px "Noto Sans Devanagari"'),
        document.fonts.load('700 16px "Noto Sans Devanagari"')
      ]).then(function () {
        requestAnimationFrame(function () { requestAnimationFrame(doExport); });
      }).catch(function () { doExport(); });
    } else {
      doExport();
    }
  }

  function bindClientSearchable() {
    var inp = $('fr-cl');
    var listEl = $('fr-cl-list');
    var hidden = $('fr-cl-id');
    var wrap = inp && inp.closest && inp.closest('.searchable-select');
    if (!inp || !listEl || !hidden || !wrap) return;

    function showList(filter) {
      var st = window.CareTrack && window.CareTrack.getState ? window.CareTrack.getState() : {};
      var clients = (st.clients || []).filter(function (c) { return c.status === 'active'; });
      var q = (filter || '').toLowerCase().trim();
      var filtered = q
        ? clients.filter(function (c) { return (c.name || '').toLowerCase().indexOf(q) !== -1; })
        : clients;
      listEl.innerHTML = filtered.slice(0, 80).map(function (c) {
        var id = (c.id || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
        var name = (c.name || 'Unknown').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        return '<li class="searchable-option" role="option" data-id="' + id + '">' + name + '</li>';
      }).join('');
      listEl.style.display = filtered.length ? 'block' : 'none';
    }

    function pick(clientId, clientName) {
      hidden.value = clientId || '';
      inp.value = clientName || '';
      listEl.style.display = 'none';
      inp.blur();
      var st = window.CareTrack && window.CareTrack.getState ? window.CareTrack.getState() : {};
      var c = clientId ? (st.clients || []).filter(function (cl) { return cl.id === clientId; })[0] : null;
      setDateRangeFromClient(c, st);
      generateReport(st);
    }

    inp.addEventListener('focus', function () { showList(inp.value); });
    inp.addEventListener('input', function () { showList(inp.value); });
    inp.addEventListener('blur', function () {
      setTimeout(function () {
        if (!wrap.contains(document.activeElement)) listEl.style.display = 'none';
      }, 150);
    });
    listEl.addEventListener('mousedown', function (e) {
      var li = e.target.closest('.searchable-option');
      if (li) {
        e.preventDefault();
        var id = li.getAttribute('data-id');
        var name = li.textContent || '';
        pick(id, name);
      }
    });
  }

  function init(state) {
    if (_inited) return; _inited = true;
    bindClientSearchable();
    if ($('fr-date-from')) $('fr-date-from').addEventListener('change', function () { generateReport(window.CareTrack.getState()); });
    if ($('fr-date-to')) $('fr-date-to').addEventListener('change', function () { generateReport(window.CareTrack.getState()); });
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
