/* ── MODAL: ปิด modal เมื่อคลิก backdrop ── */

document.querySelectorAll('.modal-backdrop').forEach(m => {
  m.addEventListener('click', e => {
    if (e.target === m) m.classList.remove('open');
  });
});