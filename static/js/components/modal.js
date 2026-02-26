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
    overlay.style.display = 'flex';
    container.innerHTML = html;
    overlay.classList.add('visible');
    overlay.setAttribute('aria-hidden', 'false');
    document.body.classList.add('modal-open');
    _onClose = opts.onClose || null;
    if (opts.onReady) setTimeout(opts.onReady, 30);
  }

  function close() {
    var callback = _onClose;
    _onClose = null;
    if (_closeTimer) clearTimeout(_closeTimer);
    _closeTimer = null;
    if (callback) callback();
    document.body.classList.remove('modal-open');
    var o = overlay;
    var c = container;
    if (o) {
      if (document.activeElement && o.contains(document.activeElement)) document.activeElement.blur();
    }
    setTimeout(function () {
      if (o) {
        o.classList.remove('visible');
        o.setAttribute('aria-hidden', 'true');
        o.style.display = 'none';
      }
      if (c) c.innerHTML = '';
      _closeTimer = null;
    }, 0);
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
        var cancelBtn = document.getElementById('mdl-cancel');
        var confirmBtn = document.getElementById('mdl-confirm');
        if (cancelBtn) {
          cancelBtn.addEventListener('click', function (e) {
            e.preventDefault();
            e.stopPropagation();
            close();
          });
        }
        if (confirmBtn) {
          confirmBtn.addEventListener('click', function (e) {
            e.preventDefault();
            e.stopPropagation();
            close();
            if (onYes) onYes();
          });
        }
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
