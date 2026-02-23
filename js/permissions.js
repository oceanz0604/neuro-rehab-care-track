/**
 * Role-based permissions for UI gating.
 * Expects canonical roles in userProfiles (doctor etc. migrated in db layer). Exposes window.Permissions.
 */
(function () {
  'use strict';

  function normalizeRole(role) {
    return (role || '').toLowerCase();
  }

  function canAccessAdmin(role) {
    return normalizeRole(role) === 'admin';
  }

  function canAddPatient(role) {
    var r = normalizeRole(role);
    return r === 'admin' || r === 'psychiatrist' || r === 'nurse';
  }

  function canEditPatient(role) {
    var r = normalizeRole(role);
    return r === 'admin' || r === 'psychiatrist' || r === 'nurse';
  }

  function canDischargePatient(role) {
    var r = normalizeRole(role);
    return r === 'admin' || r === 'psychiatrist';
  }

  var SECTION_WRITE = {
    psychiatric: ['admin', 'psychiatrist', 'nurse', 'psychologist'],
    behavioral: ['admin', 'psychiatrist', 'nurse', 'psychologist'],
    medication: ['admin', 'psychiatrist', 'nurse'],
    adl: ['admin', 'psychiatrist', 'nurse', 'therapist', 'rehab_worker', 'care_taker'],
    therapeutic: ['admin', 'psychiatrist', 'therapist', 'rehab_worker'],
    risk: ['admin', 'psychiatrist', 'nurse']
  };

  function canSubmitSection(role, section) {
    var r = normalizeRole(role);
    var allowed = SECTION_WRITE[section];
    return allowed && allowed.indexOf(r) !== -1;
  }

  window.Permissions = {
    normalizeRole: normalizeRole,
    canAccessAdmin: canAccessAdmin,
    canAddPatient: canAddPatient,
    canEditPatient: canEditPatient,
    canDischargePatient: canDischargePatient,
    canSubmitSection: canSubmitSection
  };
})();
