/* ── UI: ฟังก์ชัน UI ทั่วไป ── */

/* TOAST NOTIFICATION */
function showToast(msg) {
  const toast = document.getElementById('toast');
  document.getElementById('toast-msg').textContent = msg;
  toast.classList.add('show');

  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 3000);
}

/* MODAL UTILS */
function openModal(id)  { document.getElementById(id).classList.add('open');    }
function closeModal(id) { document.getElementById(id).classList.remove('open'); }

/* INPUT MODAL */
let _inputResolve = null;

function showInputModal(title, placeholder = '', defaultValue = '', desc = '') {
  document.getElementById('input-modal-title').textContent = title;
  document.getElementById('input-modal-field').placeholder = placeholder;
  document.getElementById('input-modal-field').value = defaultValue;

  const descEl = document.getElementById('input-modal-desc');
  if (desc) {
    descEl.textContent = desc;
    descEl.style.display = 'block';
  } else {
    descEl.style.display = 'none';
  }

  openModal('modal-input');
  setTimeout(() => document.getElementById('input-modal-field').focus(), 100);

  return new Promise(resolve => { _inputResolve = resolve; });
}

function resolveInputModal() {
  const val = document.getElementById('input-modal-field').value.trim();
  closeModal('modal-input');
  if (_inputResolve) { _inputResolve(val); _inputResolve = null; }
}

function rejectInputModal() {
  closeModal('modal-input');
  if (_inputResolve) { _inputResolve(null); _inputResolve = null; }
}

/* CONFIRM TYPE MODAL */
let _confirmTypeResolve = null;
let _confirmTypeKeyword = '';

function showConfirmTypeModal(title, desc, keyword, placeholder = '') {
  _confirmTypeKeyword = keyword;
  document.getElementById('confirm-type-title').textContent   = title;
  document.getElementById('confirm-type-desc').textContent    = desc;
  document.getElementById('confirm-type-field').placeholder   = placeholder || `พิมพ์ "${keyword}" เพื่อยืนยัน`;
  document.getElementById('confirm-type-field').value         = '';
  document.getElementById('confirm-type-error').style.display = 'none';

  openModal('modal-confirm-type');
  setTimeout(() => document.getElementById('confirm-type-field').focus(), 100);

  return new Promise(resolve => { _confirmTypeResolve = resolve; });
}

function resolveConfirmTypeModal() {
  const val = document.getElementById('confirm-type-field').value.trim();
  if (val !== _confirmTypeKeyword) {
    const errEl = document.getElementById('confirm-type-error');
    errEl.textContent    = `กรุณาพิมพ์ "${_confirmTypeKeyword}" ให้ถูกต้อง`;
    errEl.style.display  = 'block';
    return;
  }
  closeModal('modal-confirm-type');
  if (_confirmTypeResolve) { _confirmTypeResolve(true); _confirmTypeResolve = null; }
}

function rejectConfirmTypeModal() {
  closeModal('modal-confirm-type');
  if (_confirmTypeResolve) { _confirmTypeResolve(false); _confirmTypeResolve = null; }
}

/* NAVIGATION */
async function goPage(id) {
  if (id === 'settings' && !isAdmin()) {
    showToast('🔒 กรุณาเข้าสู่ระบบก่อน');
    openModal('modal-login');
    return;
  }

  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

  document.getElementById('page-' + id).classList.add('active');
  document.getElementById('nav-'  + id).classList.add('active');

  const renderers = {
    instruments: renderInstruments,
    alerts:      initAlertsPage,
    history:     renderHistory,
    settings:    async () => { await initSettings(); }
  };

  if (renderers[id]) await renderers[id]();
}