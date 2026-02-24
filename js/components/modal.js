/**
 * NeuroRehab CareTrack — reusable modal system.
 * Exposes window.AppModal
 */
(function () {
  'use strict';

  var overlay = document.getElementById('modal-overlay');
  var container = document.getElementById('modal-container');
  var _onClose = null;
  var _closeTimer = null;

  function open(html, opts) {
    opts = opts || {};
    if (!overlay || !container) {
      try { console.error('CareTrack: modal overlay or container not found'); alert('Modal not available'); } catch (e) {}
      return;
    }
    if (_closeTimer) { clearTimeout(_closeTimer); _closeTimer = null; }
    if (overlay.parentNode !== document.body) {
      document.body.appendChild(overlay);
    }
    container.innerHTML = html;
    overlay.classList.add('visible');
    overlay.setAttribute('aria-hidden', 'false');
    document.body.classList.add('modal-open');
    _onClose = opts.onClose || null;
    if (opts.onReady) setTimeout(opts.onReady, 30);
  }

  function close() {
    if (overlay) {
      overlay.classList.remove('visible');
      overlay.setAttribute('aria-hidden', 'true');
    }
    document.body.classList.remove('modal-open');
    if (_onClose) { _onClose(); _onClose = null; }
    if (_closeTimer) clearTimeout(_closeTimer);
    _closeTimer = setTimeout(function () { container.innerHTML = ''; _closeTimer = null; }, 250);
  }

  if (overlay) {
    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) close();
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && overlay.classList.contains('visible')) close();
    });
  }

  function confirm(title, message, onYes, confirmLabel) {
    var label = (confirmLabel && confirmLabel.length) ? confirmLabel : 'Confirm';
    var html =
      '<div class="modal-card">' +
        '<h3 class="modal-title">' + title + '</h3>' +
        '<p class="modal-body">' + message + '</p>' +
        '<div class="modal-actions">' +
          '<button type="button" class="btn btn-ghost" id="mdl-cancel">Cancel</button>' +
          '<button type="button" class="btn btn-danger" id="mdl-confirm">' + label + '</button>' +
        '</div>' +
      '</div>';
    open(html, {
      onReady: function () {
        document.getElementById('mdl-cancel').addEventListener('click', close);
        document.getElementById('mdl-confirm').addEventListener('click', function () {
          close();
          if (onYes) onYes();
        });
      }
    });
  }

  function alert(title, message) {
    var html =
      '<div class="modal-card">' +
        '<h3 class="modal-title">' + title + '</h3>' +
        '<p class="modal-body">' + message + '</p>' +
        '<div class="modal-actions">' +
          '<button type="button" class="btn" id="mdl-ok">OK</button>' +
        '</div>' +
      '</div>';
    open(html, {
      onReady: function () {
        document.getElementById('mdl-ok').addEventListener('click', close);
      }
    });
  }

  window.AppModal = {
    open: open,
    close: close,
    confirm: confirm,
    alert: alert
  };
})();
