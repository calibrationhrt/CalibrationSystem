/* ── UTILS: ฟังก์ชันช่วยเหลือทั่วไป ── */

const SETTINGS_KEY = 'cal_settings';

function getToday() {
  return new Date();
}

/** คืนวันของวันนี้เป็น string YYYY-MM-DD */
function formatDateLocal(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** คำนวณจำนวนวันถึงวันหมดอายุ (ลบ = เกินแล้ว) */
function diffDays(expire) {
  if (!expire) return null;
  
  const exp   = parseLocalDate(expire);
   if (!exp) return null;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  exp.setHours(0, 0, 0, 0);

  return Math.round((exp - today) / 86400000);
}

/** โหลด notification settings จาก localStorage */
function loadNotifSettings() {
  try {
    return JSON.parse(localStorage.getItem(SETTINGS_KEY)) || {};
  } catch { return {}; }
}

/** คืนจำนวนวันเตือนล่วงหน้าจาก settings */
function getWarnDays() {
  const s = loadNotifSettings();
  return parseInt(s.days) || 30;
}

/** คืน { cls, label, badgeCls } สำหรับแสดงสถานะ */
function getStatus(expire) {
  const d    = diffDays(expire);
  const warn = getWarnDays();
  if (d < 0)       return { cls: 'overdue', label: 'เกิน '  + Math.abs(d) + ' วัน', badgeCls: 'badge-overdue' };
  if (d <= warn)   return { cls: 'warn',    label: 'เหลือ ' + d           + ' วัน', badgeCls: 'badge-warn'    };
                   return { cls: 'ok',      label: 'ปกติ (' + d           + ' วัน)', badgeCls: 'badge-ok'     };
}

function parseLocalDate(str) {
  if (!str) return null;
  const [y, m, d] = str.split('-').map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

/** แปลง date string เป็นรูปแบบไทย เช่น 21 เม.ย. 69 */
function fmtDate(d) {
  if (!d) return '-';
  const date = parseLocalDate(d);
  if (!date) return '-';
  return date.toLocaleDateString('th-TH', {
    day: '2-digit', month: 'short', year: '2-digit'
  });
}
/** SVG icon สำหรับ alert ตามสถานะ */
function alertIconSvg(cls) {
  if (cls === 'overdue') {
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <polygon points="7.86 2 16.14 2 22 7.86 22 16.14 16.14 22 7.86 22 2 16.14 2 7.86 7.86 2"/>
      <line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
    </svg>`;
  }
  if (cls === 'warn') {
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <circle cx="12" cy="12" r="10"/>
      <line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
    </svg>`;
  }
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <polyline points="20 6 9 17 4 12"/>
  </svg>`;
}

/** คำนวณ expire จาก lastDate + interval (เช่น 6m, 1y) */
function calcExpire(lastDate, interval) {
  if (!lastDate || !interval) return null;

  const date  = parseLocalDate(lastDate);
  const regex = /(\d+)(d|m|y)/g;
  let match;

  while ((match = regex.exec(interval)) !== null) {
    const value = parseInt(match[1]);
    const unit  = match[2];

    if (unit === 'd') date.setDate(date.getDate() + value);
    if (unit === 'm') date.setMonth(date.getMonth() + value);
    if (unit === 'y') date.setFullYear(date.getFullYear() + value);
  }
  return formatDateLocal(date);
}

/** แปลง input interval เป็น normalized string เช่น "1y6m" */
function normalizeInterval(input) {
  if (!input) return '';

  const str   = input.toLowerCase().trim();
  const regex = /(\d+(\.\d+)?)\s*(d|day|days|m|month|months|y|year|years)/g;

  let match;
  let years = 0, months = 0, days = 0;

  while ((match = regex.exec(str)) !== null) {
    const value = parseFloat(match[1]);
    const unit  = match[3];

    if (unit.startsWith('y')) years  += value;
    if (unit.startsWith('m')) months += value;
    if (unit.startsWith('d')) days   += value;
  }

  if (years === 0 && months === 0 && days === 0) return null;

  let result = '';
  if (years) {
    const wholeYears = Math.floor(years);
    const remMonths  = Math.round((years - wholeYears) * 12);
    if (wholeYears) result += wholeYears + 'y';
    months += remMonths;
  }
  if (months) {
    const wholeMonths = Math.floor(months);
    const remDays     = Math.round((months - wholeMonths) * 30);
    if (wholeMonths) result += wholeMonths + 'm';
    days += remDays;
  }
  if (days) result += Math.floor(days) + 'd';

    return result || null;
}

/** แปลง interval string เป็นภาษาไทย เช่น "1 ปี 6 เดือน" */
function formatInterval(interval) {
  if (!interval) return '-';

  const regex = /(\d+)(y|m|d)/g;
  let match;
  let result = [];

  while ((match = regex.exec(interval)) !== null) {
    const value = parseInt(match[1]);
    const unit  = match[2];

    if (unit === 'y') result.push(`${value} ปี`);
    if (unit === 'm') result.push(`${value} เดือน`);
    if (unit === 'd') result.push(`${value} วัน`);
  }

  return result.join(' ') || '-';
}

/** escape HTML entities */
function escapeHtml(str) {
  return String(str)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

/* ── Custom Select ── */
function createCustomSelect(selectEl) {
  const wrap    = document.createElement('div');
  wrap.className = 'custom-select-wrap';

  const trigger = document.createElement('div');
  trigger.className = 'custom-select-trigger';

  const label   = document.createElement('span');
  const arrow   = document.createElement('span');
  arrow.textContent = '▾';
  trigger.appendChild(label);
  trigger.appendChild(arrow);

  const dropdown = document.createElement('div');
  dropdown.className = 'custom-select-dropdown';

  const searchWrap  = document.createElement('div');
  searchWrap.className = 'custom-select-search';
  const searchInput = document.createElement('input');
  searchInput.placeholder = 'ค้นหา...';
  searchWrap.appendChild(searchInput);

  const list = document.createElement('div');
  list.className = 'custom-select-list';

  dropdown.appendChild(searchWrap);
  dropdown.appendChild(list);

  selectEl.style.display = 'none';
  selectEl.parentNode.insertBefore(wrap, selectEl);
  wrap.appendChild(selectEl);
  wrap.appendChild(trigger);
  wrap.appendChild(dropdown);

  function getOptions() {
    return Array.from(selectEl.options);
  }

  function renderList(keyword = '') {
    const opts = getOptions().filter(o =>
      o.text.toLowerCase().includes(keyword.toLowerCase())
    );
    list.innerHTML = opts.length
      ? opts.map(o => `
          <div class="custom-select-option ${o.selected ? 'selected' : ''}"
               data-value="${o.value}">${o.text}</div>`
        ).join('')
      : `<div class="custom-select-option empty">ไม่พบข้อมูล</div>`;

    list.querySelectorAll('.custom-select-option:not(.empty)').forEach(el => {
      el.addEventListener('click', () => {
        selectEl.value = el.dataset.value;
        selectEl.dispatchEvent(new Event('change'));
        label.textContent = el.textContent;
        close();
      });
    });
  }

  function syncLabel() {
    const sel = selectEl.options[selectEl.selectedIndex];
    label.textContent = sel ? sel.text : '';
  }

  function open() {
    trigger.classList.add('open');
    dropdown.classList.add('open');
    searchInput.value = '';
    renderList();
    searchInput.focus();
  }

  function close() {
    trigger.classList.remove('open');
    dropdown.classList.remove('open');
  }

  trigger.addEventListener('click', () =>
    dropdown.classList.contains('open') ? close() : open()
  );

  searchInput.addEventListener('input', () => renderList(searchInput.value));

  document.addEventListener('click', e => {
    if (!wrap.contains(e.target)) close();
  });

  // sync เมื่อ options เปลี่ยน
  const obs = new MutationObserver(() => { renderList(); syncLabel(); });
  obs.observe(selectEl, { childList: true });

  syncLabel();
  return wrap;
}

function initCustomSelects() {
  ['add-dept','edit-dept','add-type','edit-type','add-loc','edit-loc'].forEach(id => {
    const el = document.getElementById(id);
    if (el && !el.dataset.customized) {
      el.dataset.customized = '1';
      createCustomSelect(el);
    }
  });
}

function toggleMenu(event){
  event.stopPropagation();

  document
    .getElementById("setting-menu")
    .classList.toggle("show");
}

document.addEventListener("click", () => {
  const menu = document.getElementById("setting-menu");

  if(menu){
    menu.classList.remove("show");
  }
});