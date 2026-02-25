/**
 * Inherited single-role permissions. Each user has one role; higher roles
 * inherit all permissions of lower roles. Admin has all permissions.
 * Order (lowest → highest): Social Worker, Rehab Worker, Care Taker, Nurse,
 * Medical Officer, Therapist, Psychologist, Psychiatrist, Admin.
 */
(function () {
  'use strict';

  var ROLE_HIERARCHY = [
    'social_worker',
    'rehab_worker',
    'care_taker',
    'nurse',
    'medical_officer',
    'therapist',
    'psychologist',
    'psychiatrist',
    'admin'
  ];

  function normalizeRole(role) {
    return (role || '').toLowerCase().trim();
  }

  function getRoleRank(role) {
    var r = normalizeRole(role);
    var idx = ROLE_HIERARCHY.indexOf(r);
    return idx === -1 ? -1 : idx;
  }

  /** Get the single effective role for a profile (supports legacy roles[] by taking highest). */
  function getRole(profile) {
    if (!profile) return null;
    var single = normalizeRole(profile.role || '');
    if (single && ROLE_HIERARCHY.indexOf(single) !== -1) return single;
    var roles = profile.roles && Array.isArray(profile.roles) ? profile.roles : [];
    if (!roles.length) return single || 'social_worker';
    var maxRank = -1;
    var best = single || 'social_worker';
    for (var i = 0; i < roles.length; i++) {
      var r = normalizeRole(roles[i]);
      var rank = getRoleRank(r);
      if (rank > maxRank) { maxRank = rank; best = r; }
    }
    return best;
  }

  /** True if profile has this role or any higher role in the hierarchy. */
  function hasRole(profile, role) {
    var userRank = getRoleRank(getRole(profile));
    var minRank = getRoleRank(role);
    return userRank >= 0 && minRank >= 0 && userRank >= minRank;
  }

  function hasRoleAtLeast(profile, minRole) {
    return hasRole(profile, minRole);
  }

  function canAccessAdmin(profile) {
    return getRole(profile) === 'admin';
  }

  function canAddPatient(profile) {
    return hasRole(profile, 'nurse');
  }

  function canEditPatient(profile) {
    return hasRole(profile, 'nurse');
  }

  function canDischargePatient(profile) {
    return hasRole(profile, 'medical_officer');
  }

  /** True if profile is an assigned doctor for this client (by display name). */
  function isAssignedDoctor(profile, client) {
    if (!profile || !client) return false;
    var name = (profile.displayName || '').trim();
    if (!name) return false;
    if ((client.assignedTherapist || '').trim() === name) return true;
    return (client.assignedDoctors || []).some(function (d) { return (d || '').trim() === name; });
  }

  /** True if profile is the user who added this patient (by uid). */
  function isCreator(profile, client) {
    if (!profile || !client) return false;
    var uid = (profile.uid || '').trim();
    return uid && (client.createdBy || '').toString().trim() === uid;
  }

  /** Edit patient: assigned doctors, admins, or user who added the patient. */
  function canEditPatientFor(profile, client) {
    if (!profile || !client) return false;
    if (getRole(profile) === 'admin') return true;
    if (isAssignedDoctor(profile, client)) return true;
    if (isCreator(profile, client)) return true;
    return false;
  }

  /** Discharge + History tab: assigned doctors or admins only. */
  function canDischargePatientFor(profile, client) {
    if (!profile || !client) return false;
    if (getRole(profile) === 'admin') return true;
    return isAssignedDoctor(profile, client);
  }

  /** Add Diagnosis: assigned doctors or admins only. */
  function canAddDiagnosisFor(profile, client) {
    return canDischargePatientFor(profile, client);
  }

  /** History tab visible: assigned doctors or admins only. */
  function canViewHistoryFor(profile, client) {
    return canDischargePatientFor(profile, client);
  }

  /** Overview tab and Comments tab: everyone from nurse up. */
  function canViewOverview(profile) {
    return hasRole(profile, 'nurse');
  }

  /** Add Report button visible: everyone from nurse up. */
  function canAddReport(profile) {
    return hasRole(profile, 'nurse');
  }

  function canEditReport(profile) {
    return getRole(profile) === 'admin';
  }

  var SECTION_MIN_ROLE = {
    psychiatric: 'nurse',
    behavioral: 'nurse',
    medication: 'nurse',
    adl: 'care_taker',
    therapeutic: 'nurse',
    risk: 'nurse'
  };

  function canSubmitSection(profile, section) {
    var minRole = SECTION_MIN_ROLE[section];
    if (!minRole) return false;
    return hasRole(profile, minRole);
  }

  window.Permissions = {
    ROLE_HIERARCHY: ROLE_HIERARCHY,
    normalizeRole: normalizeRole,
    getRole: getRole,
    getRoleRank: getRoleRank,
    hasRole: hasRole,
    hasRoleAtLeast: hasRoleAtLeast,
    canAccessAdmin: canAccessAdmin,
    canAddPatient: canAddPatient,
    canEditPatient: canEditPatient,
    canDischargePatient: canDischargePatient,
    canEditReport: canEditReport,
    canSubmitSection: canSubmitSection,
    isAssignedDoctor: isAssignedDoctor,
    isCreator: isCreator,
    canEditPatientFor: canEditPatientFor,
    canDischargePatientFor: canDischargePatientFor,
    canAddDiagnosisFor: canAddDiagnosisFor,
    canViewHistoryFor: canViewHistoryFor,
    canViewOverview: canViewOverview,
    canAddReport: canAddReport
  };
})();
