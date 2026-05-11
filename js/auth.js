const SESSION_KEY    = 'cal_login_time';
const SESSION_EXPIRE = 8 * 60 * 60 * 1000; // 8 ชั่วโมง

/* sessionStorage — อยู่ผ่าน refresh แต่หายเมื่อปิด Tab */
function setSessionFlag()   { sessionStorage.setItem(SESSION_KEY, Date.now().toString()); }
function getSessionFlag()   { return sessionStorage.getItem(SESSION_KEY); }
function clearSessionFlag() { sessionStorage.removeItem(SESSION_KEY); }

function isAdmin() {
  return currentUser !== null;
}

/** เช็ค session เมื่อโหลดหน้า */
async function initAuth() {
  const { data: { session } } = await client.auth.getSession();

  const loginTime = getSessionFlag();

  if (session && !loginTime) {
    /* ปิด Tab แล้วเปิดใหม่ — ไม่มี flag ใน sessionStorage → force logout */
    await client.auth.signOut();
    currentUser = null;
  } else if (session && loginTime && Date.now() - Number(loginTime) > SESSION_EXPIRE) {
    /* เปิดค้างไว้เกิน 8 ชั่วโมง → force logout */
    await client.auth.signOut();
    clearSessionFlag();
    currentUser = null;
  } else {
    currentUser = session?.user ?? null;
  }

  updateAuthUI();

  client.auth.onAuthStateChange((_event, session) => {
    currentUser = session?.user ?? null;
    updateAuthUI();
    renderDashboard();
  });
}

function updateAuthUI() {
  const avatar      = document.getElementById('user-avatar');
  const userName    = document.getElementById('user-name');
  const navSettings = document.getElementById('nav-settings');
  const ddAvatar    = document.getElementById('dd-avatar');
  const ddName      = document.getElementById('dd-name');
  const ddEmail     = document.getElementById('dd-email');

  if (isAdmin()) {
    const s           = loadNotifSettings();
    const displayName = s.displayname || currentUser.email.split('@')[0];

    avatar.textContent   = displayName.slice(0, 2).toUpperCase();
    userName.textContent = displayName;
    navSettings.style.display = 'flex';
    document.body.classList.add('is-admin');

    if (ddAvatar) ddAvatar.textContent = displayName.slice(0, 2).toUpperCase();
    if (ddName)   ddName.textContent   = displayName;
    if (ddEmail)  ddEmail.textContent  = currentUser.email;
  } else {
    avatar.textContent   = '👤';
    userName.textContent = 'เข้าสู่ระบบ';
    navSettings.style.display = 'none';
    document.body.classList.remove('is-admin');
    if (document.getElementById('page-settings').classList.contains('active')) {
      goPage('dashboard');
    }
  }

  renderInstruments();
}

function toggleUserMenu() {
  if (!isAdmin()) {
    openModal('modal-login');
    return;
  }
  const dd = document.getElementById('user-dropdown');
  dd.classList.toggle('open');
}

document.addEventListener('click', (e) => {
  const wrap = document.getElementById('user-menu-wrap');
  if (wrap && !wrap.contains(e.target)) {
    document.getElementById('user-dropdown')?.classList.remove('open');
  }
});

function handleLogout() {
  document.getElementById('user-dropdown').classList.remove('open');
  if (confirm('ออกจากระบบ?')) doLogout();
}

function handleUserClick() {
  if (isAdmin()) {
    if (confirm('ออกจากระบบ?')) doLogout();
  } else {
    openModal('modal-login');
  }
}

async function doLogin() {
  const input    = document.getElementById('login-email').value.trim();
  const email    = input.includes('@') ? input : input + '@gmail.com';
  const password = document.getElementById('login-password').value;
  const errEl    = document.getElementById('login-error');

  errEl.textContent = '';

  const { error } = await client.auth.signInWithPassword({ email, password });

  if (error) {
    errEl.textContent = '❌ อีเมลหรือรหัสผ่านไม่ถูกต้อง';
    return;
  }

  setSessionFlag();

  closeModal('modal-login');
  document.getElementById('login-password').value = '';
  showToast('✅ เข้าสู่ระบบสำเร็จ');
}

async function doLogout() {
  await client.auth.signOut();
  clearSessionFlag();
  showToast('👋 ออกจากระบบแล้ว');
}

function openDisplayNameModal() {
  const s = loadNotifSettings();
  document.getElementById('input-displayname').value = s.displayname || '';
  document.getElementById('user-dropdown').classList.remove('open');
  openModal('modal-displayname');
}

function saveDisplayName() {
  const name = document.getElementById('input-displayname').value.trim();
  const s    = loadNotifSettings();
  s.displayname = name;
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
  closeModal('modal-displayname');
  updateAuthUI();
  showToast('✅ เปลี่ยนชื่อแล้ว');
}