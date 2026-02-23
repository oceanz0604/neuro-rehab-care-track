/**
 * Role-based permissions for UI gating.
 * Supports single role or roles[] on profile. Exposes window.Permissions.
 */
(function () {
  'use strict';

  function normalizeRole(role) {
    return (role || '').toLowerCase();
  }

  function hasRole(profile, role) {
    if (!profile) return false;
    var r = normalizeRole(role);
    var roles = profile.roles && Array.isArray(profile.roles) ? profile.roles : [];
    if (profile.role && normalizeRole(profile.role) === r) return true;
    for (var i = 0; i < roles.length; i++) { if (normalizeRole(roles[i]) === r) return true; }
    return false;
  }

  function canAccessAdmin(profile) {
    return hasRole(profile, 'admin');
  }

  function canAddPatient(profile) {
    return hasRole(profile, 'admin') || hasRole(profile, 'psychiatrist') || hasRole(profile, 'nurse') || hasRole(profile, 'medical_officer');
  }

  function canEditPatient(profile) {
    return hasRole(profile, 'admin') || hasRole(profile, 'psychiatrist') || hasRole(profile, 'nurse') || hasRole(profile, 'medical_officer');
  }

  function canDischargePatient(profile) {
    return hasRole(profile, 'admin') || hasRole(profile, 'psychiatrist') || hasRole(profile, 'medical_officer');
  }

  function canEditReport(profile) {
    return hasRole(profile, 'admin');
  }

  var SECTION_WRITE = {
    psychiatric: ['admin', 'psychiatrist', 'nurse', 'psychologist', 'medical_officer'],
    behavioral: ['admin', 'psychiatrist', 'nurse', 'psychologist', 'medical_officer'],
    medication: ['admin', 'psychiatrist', 'nurse', 'medical_officer'],
    adl: ['admin', 'psychiatrist', 'nurse', 'therapist', 'rehab_worker', 'care_taker', 'medical_officer'],
    therapeutic: ['admin', 'psychiatrist', 'therapist', 'rehab_worker', 'medical_officer'],
    risk: ['admin', 'psychiatrist', 'nurse', 'medical_officer']
  };

  function canSubmitSection(profile, section) {
    var allowed = SECTION_WRITE[section];
    if (!allowed) return false;
    for (var i = 0; i < allowed.length; i++) { if (hasRole(profile, allowed[i])) return true; }
    return false;
  }

  window.Permissions = {
    normalizeRole: normalizeRole,
    hasRole: hasRole,
    canAccessAdmin: canAccessAdmin,
    canAddPatient: canAddPatient,
    canEditPatient: canEditPatient,
    canDischargePatient: canDischargePatient,
    canEditReport: canEditReport,
    canSubmitSection: canSubmitSection
  };
})();
