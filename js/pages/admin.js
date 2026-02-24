/**
 * Admin panel — staff CRUD using secondary Firebase app instance pattern.
 * Only visible to users with role === 'admin'.
 * Roles: admin, psychiatrist, nurse, therapist, psychologist, social_worker, rehab_worker, care_taker.
 */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var _inited = false;
  var _staff = [];

  var ROLES = [
    { value: 'admin', label: 'Admin' },
    { value: 'psychiatrist', label: 'Psychiatrist' },
    { value: 'medical_officer', label: 'Medical Officer' },
    { value: 'nurse', label: 'Nurse' },
    { value: 'therapist', label: 'Therapist' },
    { value: 'psychologist', label: 'Psychologist' },
    { value: 'social_worker', label: 'Social Worker' },
    { value: 'rehab_worker', label: 'Rehab Worker' },
    { value: 'care_taker', label: 'Care Taker' }
  ];
  var ROLE_LABELS = {};
  ROLES.forEach(function (r) { ROLE_LABELS[r.value] = r.label; });
  function roleLabel(role) { return ROLE_LABELS[role] || (role || '—'); }
  function rolesToLabels(roles) {
    if (!roles || !roles.length) return '—';
    return (roles.map(function (r) { return roleLabel(r); })).join(', ');
  }

  function render(state) {
    if (!state.profile || !(window.Permissions && window.Permissions.canAccessAdmin(state.profile))) {
      $('staff-table').innerHTML = '<div class="empty-state"><i class="fas fa-lock"></i><p>Admin access required</p></div>';
      $('admin-staff-wrap').style.display = '';
      $('admin-report-params-wrap').style.display = 'none';
      $('admin-ward-beds-wrap').style.display = 'none';
      $('admin-diagnosis-wrap').style.display = 'none';
      $('admin-audit-wrap').style.display = 'none';
      return;
    }
    switchAdminTab('staff');
    $('staff-table').innerHTML = '<div class="empty-state"><i class="fas fa-spinner fa-spin"></i><p>Loading staff...</p></div>';
    AppDB.getAllStaff().then(function (list) {
      _staff = list;
      renderTable();
    }).catch(function () {
      $('staff-table').innerHTML = '<div class="alert alert-danger">Failed to load staff list.</div>';
    });
    if (window.Pages.settings) window.Pages.settings.init(state);
  }

  var _auditLastDoc = null;

  function switchAdminTab(tab) {
    var staffWrap = $('admin-staff-wrap');
    var reportParamsWrap = $('admin-report-params-wrap');
    var wardBedsWrap = $('admin-ward-beds-wrap');
    var diagnosisWrap = $('admin-diagnosis-wrap');
    var auditWrap = $('admin-audit-wrap');
    document.querySelectorAll('.admin-tab').forEach(function (b) {
      b.classList.toggle('active', b.getAttribute('data-admin-tab') === tab);
      b.classList.toggle('btn-outline', b.getAttribute('data-admin-tab') !== tab);
    });
    if (staffWrap) staffWrap.style.display = tab === 'staff' ? '' : 'none';
    if (reportParamsWrap) reportParamsWrap.style.display = tab === 'report-params' ? '' : 'none';
    if (wardBedsWrap) wardBedsWrap.style.display = tab === 'ward-beds' ? '' : 'none';
    if (diagnosisWrap) diagnosisWrap.style.display = tab === 'diagnosis' ? '' : 'none';
    if (auditWrap) auditWrap.style.display = tab === 'audit' ? '' : 'none';
    var state = window.CareTrack && window.CareTrack.getState ? window.CareTrack.getState() : {};
    if (tab === 'report-params' && window.Pages.settings && window.Pages.settings.renderReportParameters) {
      window.Pages.settings.renderReportParameters('report-params-content', state);
    }
    if (tab === 'ward-beds' && window.Pages.settings && window.Pages.settings.renderWardBeds) {
      window.Pages.settings.renderWardBeds('ward-beds-content', state);
    }
    if (tab === 'diagnosis' && window.Pages.settings && window.Pages.settings.renderDiagnosisOptions) {
      window.Pages.settings.renderDiagnosisOptions('diagnosis-options-content', state);
    }
    if (tab === 'audit') loadAuditLog(false);
  }

  function loadAuditLog(append) {
    var table = $('audit-table');
    var moreBtn = $('audit-load-more');
    if (!table) return;
    if (!append) { table.innerHTML = '<div class="empty-state"><i class="fas fa-spinner fa-spin"></i> Loading...</div>'; _auditLastDoc = null; }
    if (moreBtn) moreBtn.disabled = true;
    AppDB.getAuditLog(30, append ? _auditLastDoc : null).then(function (result) {
      var docs = result.docs || [];
      _auditLastDoc = result.lastDoc;
      if (!append) table.innerHTML = '';
      if (!docs.length && !append) {
        table.innerHTML = '<div class="empty-state"><i class="fas fa-clipboard-list"></i><p>No audit entries</p></div>';
        if (moreBtn) moreBtn.style.display = 'none';
        return;
      }
      var rowHtml = docs.map(function (e) {
        var ts = e.timestamp ? new Date(e.timestamp).toLocaleString('en-IN') : '—';
        var details = e.details && typeof e.details === 'object' ? (e.details.clientId || e.details.section || '') : '';
        return '<tr><td style="font-size:.8rem;white-space:nowrap">' + ts + '</td><td>' + esc(e.action || '') + '</td><td>' + esc(e.targetType || '') + '</td><td style="font-size:.8rem">' + esc(e.targetId || '') + (details ? ' <span style="color:var(--text-3)">' + esc(details) + '</span>' : '') + '</td></tr>';
      }).join('');
      if (append && table.querySelector('tbody')) {
        table.querySelector('tbody').insertAdjacentHTML('beforeend', rowHtml);
      } else {
        table.innerHTML = '<table class="staff-table"><thead><tr><th>Time</th><th>Action</th><th>Target</th><th>ID</th></tr></thead><tbody>' + rowHtml + '</tbody></table>';
      }
      if (moreBtn) { moreBtn.style.display = docs.length >= 30 ? 'block' : 'none'; moreBtn.disabled = false; }
    }).catch(function () {
      table.innerHTML = '<div class="empty-state"><i class="fas fa-exclamation-triangle"></i><p>Failed to load audit log</p></div>';
      if (moreBtn) { moreBtn.style.display = 'none'; moreBtn.disabled = false; }
    });
  }

  function renderTable() {
    if (!_staff.length) {
      $('staff-table').innerHTML = '<div class="empty-state"><i class="fas fa-users"></i><p>No staff members</p></div>';
      return;
    }
    var html = '<table class="staff-table"><thead><tr><th>Name</th><th>Email</th><th>Roles</th><th>Status</th><th>Actions</th></tr></thead><tbody>';
    _staff.forEach(function (s) {
      var active = s.isActive !== false;
      var rolesDisplay = rolesToLabels(s.roles);
      html += '<tr>' +
        '<td><strong>' + esc(s.displayName || '—') + '</strong></td>' +
        '<td>' + esc(s.email || '—') + '</td>' +
        '<td><span class="role-badge">' + esc(rolesDisplay) + '</span></td>' +
        '<td><span class="status-badge ' + (active ? 'status-active' : 'status-discharged') + '">' + (active ? 'Active' : 'Inactive') + '</span></td>' +
        '<td style="white-space:nowrap">' +
          '<button type="button" class="btn btn-sm btn-outline" data-edit="' + s.uid + '" style="margin-right:4px"><i class="fas fa-pen"></i></button>' +
          (active
            ? '<button type="button" class="btn btn-sm btn-danger" data-deact="' + s.uid + '"><i class="fas fa-ban"></i></button>'
            : '<button type="button" class="btn btn-sm" data-react="' + s.uid + '"><i class="fas fa-check"></i></button>'
          ) +
        '</td></tr>';
    });
    html += '</tbody></table>';
    $('staff-table').innerHTML = html;

    $('staff-table').querySelectorAll('[data-edit]').forEach(function (b) {
      b.addEventListener('click', function () { showEditStaff(b.getAttribute('data-edit')); });
    });
    $('staff-table').querySelectorAll('[data-deact]').forEach(function (b) {
      b.addEventListener('click', function () {
        var uid = b.getAttribute('data-deact');
        var s = findStaff(uid);
        AppModal.confirm('Deactivate Staff', 'Deactivate <strong>' + esc(s ? s.displayName : '') + '</strong>? They will be unable to log in and their current session will end immediately.', function () {
          AppDB.deactivateStaff(uid).then(function () {
            window.CareTrack.toast('Staff deactivated');
            render(window.CareTrack.getState());
          });
        });
      });
    });
    $('staff-table').querySelectorAll('[data-react]').forEach(function (b) {
      b.addEventListener('click', function () {
        AppDB.reactivateStaff(b.getAttribute('data-react')).then(function () {
          window.CareTrack.toast('Staff reactivated');
          render(window.CareTrack.getState());
        });
      });
    });
  }

  function findStaff(uid) {
    var found = null;
    _staff.forEach(function (s) { if (s.uid === uid) found = s; });
    return found;
  }

  function showAddModal() {
    var roleChecks = ROLES.map(function (r) {
      return '<label class="role-check"><input type="checkbox" class="as-role-cb" value="' + esc(r.value) + '"> ' + esc(r.label) + '</label>';
    }).join('');
    var html =
      '<div class="modal-card"><h3 class="modal-title">Add Staff Member</h3>' +
      '<p id="as-error" class="error-msg" style="display:none;margin-bottom:12px;padding:10px;background:var(--accent-bg);border-radius:var(--radius-sm)"></p>' +
      '<div class="form-grid">' +
        '<div class="fg fg-full"><label>Email</label><input id="as-email" type="email" class="fi" placeholder="staff@centre.org" required></div>' +
        '<div class="fg fg-full"><label>Password</label><input id="as-pw" type="text" class="fi" placeholder="Min 6 characters" minlength="6"></div>' +
        '<div class="fg fg-full"><label>Full Name</label><input id="as-name" type="text" class="fi" placeholder="Staff name"></div>' +
        '<div class="fg fg-full"><label>Roles</label><div class="role-check-group">' + roleChecks + '</div></div>' +
      '</div>' +
      '<div class="modal-actions" style="margin-top:18px">' +
        '<button type="button" class="btn btn-ghost" id="as-cancel">Cancel</button>' +
        '<button type="button" class="btn" id="as-save">Create Account</button>' +
      '</div></div>';

    AppModal.open(html, {
      onReady: function () {
        document.getElementById('as-cancel').addEventListener('click', AppModal.close);
        document.getElementById('as-save').addEventListener('click', function () {
          var errEl = document.getElementById('as-error');
          if (errEl) { errEl.style.display = 'none'; errEl.textContent = ''; }
          var email = vv('as-email'), pw = vv('as-pw'), name = vv('as-name');
          var roles = [];
          document.querySelectorAll('.as-role-cb:checked').forEach(function (cb) { roles.push(cb.value); });
          if (!roles.length) roles = ['nurse'];
          var primaryRole = roles.indexOf('admin') !== -1 ? 'admin' : roles[0];
          if (!email || !pw || pw.length < 6) {
            if (errEl) { errEl.textContent = 'Valid email and password (at least 6 characters) are required.'; errEl.style.display = 'block'; }
            return;
          }
          document.getElementById('as-save').disabled = true;
          document.getElementById('as-save').textContent = 'Creating...';
          AppDB.createStaffAccount(email, pw, { displayName: name, role: primaryRole, roles: roles })
            .then(function () {
              AppModal.close();
              window.CareTrack.toast('Staff account created');
              render(window.CareTrack.getState());
            })
            .catch(function (e) {
              var msg = e.message || e.code || 'Could not create account. Try again.';
              if (errEl) { errEl.textContent = msg; errEl.style.display = 'block'; }
              document.getElementById('as-save').disabled = false;
              document.getElementById('as-save').textContent = 'Create Account';
            });
        });
      }
    });
  }

  function showEditStaff(uid) {
    var s = findStaff(uid); if (!s) return;
    var currentRoles = s.roles && s.roles.length ? s.roles : [s.role || 'nurse'];
    var roleChecks = ROLES.map(function (r) {
      var checked = currentRoles.indexOf(r.value) !== -1 ? ' checked' : '';
      return '<label class="role-check"><input type="checkbox" class="es-role-cb" value="' + esc(r.value) + '"' + checked + '> ' + esc(r.label) + '</label>';
    }).join('');
    var html =
      '<div class="modal-card"><h3 class="modal-title">Edit Staff</h3>' +
      '<div class="form-grid">' +
        '<div class="fg fg-full"><label>Email</label><input id="es-email" type="email" class="fi" value="' + esc(s.email || '') + '" readonly style="background:var(--grey-bg);cursor:not-allowed"></div>' +
        '<div class="fg fg-full"><label>Full Name</label><input id="es-name" type="text" class="fi" value="' + esc(s.displayName || '') + '"></div>' +
        '<div class="fg fg-full"><label>New password <span style="color:var(--text-3);font-weight:400">(leave blank to keep current)</span></label><input id="es-pw" type="password" class="fi" placeholder="Min 6 characters" minlength="6" autocomplete="new-password"></div>' +
        '<div class="fg fg-full"><label>Roles</label><div class="role-check-group">' + roleChecks + '</div></div>' +
      '</div>' +
      '<div class="modal-actions" style="margin-top:18px">' +
        '<button type="button" class="btn btn-ghost" id="es-cancel">Cancel</button>' +
        '<button type="button" class="btn" id="es-save">Save</button>' +
      '</div></div>';

    AppModal.open(html, {
      onReady: function () {
        document.getElementById('es-cancel').addEventListener('click', AppModal.close);
        document.getElementById('es-save').addEventListener('click', function () {
          var roles = [];
          document.querySelectorAll('.es-role-cb:checked').forEach(function (cb) { roles.push(cb.value); });
          if (!roles.length) roles = ['nurse'];
          var primaryRole = roles.indexOf('admin') !== -1 ? 'admin' : roles[0];
          var newPw = (document.getElementById('es-pw').value || '').trim();
          var profileData = { displayName: vv('es-name'), role: primaryRole, roles: roles };
          var currentUid = (AppDB.getCurrentUser && AppDB.getCurrentUser()) ? AppDB.getCurrentUser().uid : null;
          var isSelf = currentUid === uid;

          AppDB.updateStaffProfile(uid, profileData)
            .then(function () {
              if (newPw.length >= 6) {
                if (isSelf && AppDB.updateCurrentUserPassword) {
                  return AppDB.updateCurrentUserPassword(newPw).then(function () {
                    AppModal.close();
                    window.CareTrack.toast('Staff and password updated');
                    render(window.CareTrack.getState());
                  });
                }
                if (!isSelf) {
                  window.CareTrack.toast('Profile updated. To set another user\'s password, use Firebase Console → Authentication.');
                }
              }
              AppModal.close();
              window.CareTrack.toast('Staff updated');
              render(window.CareTrack.getState());
            })
            .catch(function (e) {
              if (e.code === 'auth/requires-recent-login') {
                window.CareTrack.toast('Re-sign in and try again to change password.');
              } else {
                window.CareTrack.toast('Error: ' + (e.message || 'Save failed'));
              }
            });
        });
      }
    });
  }

  function vv(id) { return (document.getElementById(id) || {}).value || ''; }
  function esc(s) { var d = document.createElement('div'); d.textContent = s || ''; return d.innerHTML; }

  function init() {
    if (_inited) return; _inited = true;
    $('add-staff-btn').addEventListener('click', showAddModal);
    document.querySelectorAll('.admin-tab').forEach(function (b) {
      b.addEventListener('click', function () {
        switchAdminTab(b.getAttribute('data-admin-tab'));
      });
    });
    var auditMore = $('audit-load-more');
    if (auditMore) auditMore.addEventListener('click', function () { loadAuditLog(true); });
  }

  window.Pages = window.Pages || {};
  window.Pages.admin = { render: render, init: init, ROLES: ROLES, roleLabel: roleLabel };
  window.CareTrackRoleLabel = roleLabel;
})();
