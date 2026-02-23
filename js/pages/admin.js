/**
 * Admin panel — staff CRUD using secondary Firebase app instance pattern.
 * Only visible to users with role === 'admin'.
 */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var _inited = false;
  var _staff = [];

  var _settingsInited = false;

  function render(state) {
    if (!state.profile || state.profile.role !== 'admin') {
      $('staff-table').innerHTML = '<div class="empty-state"><i class="fas fa-lock"></i><p>Admin access required</p></div>';
      $('admin-staff-wrap').style.display = '';
      $('admin-settings-wrap').style.display = 'none';
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
    if (window.Pages.settings) {
      window.Pages.settings.render(state);
      if (!_settingsInited) {
        _settingsInited = true;
        window.Pages.settings.init(state);
      }
    }
  }

  function switchAdminTab(tab) {
    var staffWrap = $('admin-staff-wrap');
    var settingsWrap = $('admin-settings-wrap');
    document.querySelectorAll('.admin-tab').forEach(function (b) {
      b.classList.toggle('active', b.getAttribute('data-admin-tab') === tab);
      b.classList.toggle('btn-outline', b.getAttribute('data-admin-tab') !== tab);
    });
    if (staffWrap) staffWrap.style.display = tab === 'staff' ? '' : 'none';
    if (settingsWrap) settingsWrap.style.display = tab === 'settings' ? '' : 'none';
  }

  function renderTable() {
    if (!_staff.length) {
      $('staff-table').innerHTML = '<div class="empty-state"><i class="fas fa-users"></i><p>No staff members</p></div>';
      return;
    }
    var html = '<table class="staff-table"><thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Shift</th><th>Status</th><th>Actions</th></tr></thead><tbody>';
    _staff.forEach(function (s) {
      var active = s.isActive !== false;
      html += '<tr>' +
        '<td><strong>' + esc(s.displayName || '—') + '</strong></td>' +
        '<td>' + esc(s.email || '—') + '</td>' +
        '<td><span class="role-badge">' + (s.role || '—') + '</span></td>' +
        '<td>' + (s.shift || '—') + '</td>' +
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
        AppModal.confirm('Deactivate Staff', 'Deactivate <strong>' + esc(s ? s.displayName : '') + '</strong>? They will be unable to log in.', function () {
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
    var roles = ['nurse', 'doctor', 'therapist', 'support', 'admin'];
    var shifts = ['Morning', 'Afternoon', 'Night'];
    var html =
      '<div class="modal-card"><h3 class="modal-title">Add Staff Member</h3>' +
      '<div class="form-grid">' +
        '<div class="fg fg-full"><label>Email</label><input id="as-email" type="email" class="fi" placeholder="staff@centre.org" required></div>' +
        '<div class="fg fg-full"><label>Temporary Password</label><input id="as-pw" type="text" class="fi" placeholder="Min 6 characters" minlength="6"></div>' +
        '<div class="fg fg-full"><label>Full Name</label><input id="as-name" type="text" class="fi" placeholder="Staff name"></div>' +
        '<div class="fg"><label>Role</label><select id="as-role" class="fi">' + roles.map(function (r) { return '<option value="' + r + '">' + r + '</option>'; }).join('') + '</select></div>' +
        '<div class="fg"><label>Shift</label><select id="as-shift" class="fi">' + shifts.map(function (s) { return '<option>' + s + '</option>'; }).join('') + '</select></div>' +
      '</div>' +
      '<div class="modal-actions" style="margin-top:18px">' +
        '<button type="button" class="btn btn-ghost" id="as-cancel">Cancel</button>' +
        '<button type="button" class="btn" id="as-save">Create Account</button>' +
      '</div></div>';

    AppModal.open(html, {
      onReady: function () {
        document.getElementById('as-cancel').addEventListener('click', AppModal.close);
        document.getElementById('as-save').addEventListener('click', function () {
          var email = vv('as-email'), pw = vv('as-pw'), name = vv('as-name');
          var role = vv('as-role'), shift = vv('as-shift');
          if (!email || !pw || pw.length < 6) { window.CareTrack.toast('Valid email & password (6+ chars) required'); return; }
          document.getElementById('as-save').disabled = true;
          document.getElementById('as-save').textContent = 'Creating...';
          AppDB.createStaffAccount(email, pw, { displayName: name, role: role, shift: shift })
            .then(function () {
              AppModal.close();
              window.CareTrack.toast('Staff account created');
              render(window.CareTrack.getState());
            })
            .catch(function (e) {
              window.CareTrack.toast('Error: ' + e.message);
              document.getElementById('as-save').disabled = false;
              document.getElementById('as-save').textContent = 'Create Account';
            });
        });
      }
    });
  }

  function showEditStaff(uid) {
    var s = findStaff(uid); if (!s) return;
    var roles = ['nurse', 'doctor', 'therapist', 'support', 'admin'];
    var shifts = ['Morning', 'Afternoon', 'Night'];
    var html =
      '<div class="modal-card"><h3 class="modal-title">Edit Staff</h3>' +
      '<div class="form-grid">' +
        '<div class="fg fg-full"><label>Full Name</label><input id="es-name" type="text" class="fi" value="' + esc(s.displayName || '') + '"></div>' +
        '<div class="fg"><label>Role</label><select id="es-role" class="fi">' + roles.map(function (r) { return '<option value="' + r + '"' + (r === s.role ? ' selected' : '') + '>' + r + '</option>'; }).join('') + '</select></div>' +
        '<div class="fg"><label>Shift</label><select id="es-shift" class="fi">' + shifts.map(function (sh) { return '<option' + (sh === s.shift ? ' selected' : '') + '>' + sh + '</option>'; }).join('') + '</select></div>' +
      '</div>' +
      '<div class="modal-actions" style="margin-top:18px">' +
        '<button type="button" class="btn btn-ghost" id="es-cancel">Cancel</button>' +
        '<button type="button" class="btn" id="es-save">Save</button>' +
      '</div></div>';

    AppModal.open(html, {
      onReady: function () {
        document.getElementById('es-cancel').addEventListener('click', AppModal.close);
        document.getElementById('es-save').addEventListener('click', function () {
          AppDB.updateStaffProfile(uid, { displayName: vv('es-name'), role: vv('es-role'), shift: vv('es-shift') })
            .then(function () { AppModal.close(); window.CareTrack.toast('Staff updated'); render(window.CareTrack.getState()); })
            .catch(function (e) { window.CareTrack.toast('Error: ' + e.message); });
        });
      }
    });
  }

  function vv(id) { return (document.getElementById(id) || {}).value || ''; }
  function esc(s) { var d = document.createElement('div'); d.textContent = s || ''; return d.innerHTML; }

  var SEED_STAFF = [
    { email: 'test-therapist1@centre.org', password: 'Test123!', displayName: 'Dr. Priya Sharma', role: 'therapist', shift: 'Morning' },
    { email: 'test-therapist2@centre.org', password: 'Test123!', displayName: 'Dr. Rajesh Kumar', role: 'therapist', shift: 'Afternoon' },
    { email: 'test-doctor1@centre.org', password: 'Test123!', displayName: 'Dr. Amit Shah', role: 'doctor', shift: 'Morning' }
  ];

  function seedTestStaff() {
    var btn = $('seed-test-staff-btn');
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Creating…'; }
    var i = 0;
    function next() {
      if (i >= SEED_STAFF.length) {
        if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-flask"></i> Seed test staff'; }
        window.CareTrack.toast('Test staff accounts created. Password: Test123!');
        render(window.CareTrack.getState());
        return;
      }
      var s = SEED_STAFF[i];
      AppDB.createStaffAccount(s.email, s.password, { displayName: s.displayName, role: s.role, shift: s.shift })
        .then(function () { i++; next(); })
        .catch(function (err) {
          if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-flask"></i> Seed test staff'; }
          window.CareTrack.toast(err.message || 'Seed failed (accounts may already exist)');
        });
    }
    next();
  }

  function init() {
    if (_inited) return; _inited = true;
    $('add-staff-btn').addEventListener('click', showAddModal);
    var seedBtn = $('seed-test-staff-btn');
    if (seedBtn) seedBtn.addEventListener('click', seedTestStaff);
    document.querySelectorAll('.admin-tab').forEach(function (b) {
      b.addEventListener('click', function () {
        switchAdminTab(b.getAttribute('data-admin-tab'));
      });
    });
  }

  window.Pages = window.Pages || {};
  window.Pages.admin = { render: render, init: init };
})();
