/* ── ALERTS PAGE ── */
function initAlertsPage() {
  const active    = tools.filter(t => (t.status || 'Active') === 'Active' && t.expire);
  const todayStr  = formatDateLocal(getToday());
  const allDates  = active.map(t => formatDateLocal(new Date(t.expire))).filter(Boolean).sort();
  const pastDates = allDates.filter(d => d <= todayStr);

  selectedDate = pastDates.length ? pastDates[pastDates.length - 1]
               : allDates.length  ? allDates[0]
               : todayStr;

  alertFilter = 'all';
  document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
  document.getElementById('chip-all')?.classList.add('active');

  renderAlerts();
}

function filterAlerts(f) {
  alertFilter = f;
  document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
  document.getElementById('chip-' + f).classList.add('active');
  renderAlerts();
}

function updateAlertChips() {
  const warn  = getWarnDays();
  let active  = tools.filter(t => (t.status || 'Active') === 'Active');

  if (selectedDate) {
    active = active.filter(t => t.expire && formatDateLocal(new Date(t.expire)) === selectedDate);
  }

  const overdue   = active.filter(t => diffDays(t.expire) < 0).length;
  const warnCount = active.filter(t => diffDays(t.expire) >= 0 && diffDays(t.expire) <= warn).length;
  const ok        = active.filter(t => diffDays(t.expire) > warn).length;
 

  document.getElementById('chip-all').innerText     = `⚙️ ทั้งหมด (${active.length})`;
  document.getElementById('chip-overdue').innerText = `🔴 เกินกำหนด (${overdue})`;
  document.getElementById('chip-warn').innerText    = `🟡 ใกล้ครบกำหนด (${warnCount})`;
  document.getElementById('chip-ok').innerText      = `🟢 ปกติ (${ok})`;
}

function updateNavBadge() {
  const warn  = getWarnDays();
  const count = tools.filter(t => {
    if ((t.status || 'Active') !== 'Active') return false;
    const d = diffDays(t.expire);
    return d < 0 || d <= warn;
  }).length;

  const badge = document.getElementById('nav-alert-badge');
  if (badge) {
    badge.textContent    = count;
    badge.style.display  = count > 0 ? 'flex' : 'none';
  }

  const dot = document.getElementById('notif-dot');
  if (dot) {
    dot.style.display = count > 0 ? 'block' : 'none';
  }
}

/* ── ปฏิทิน 28 วัน ── */
function selectDate(dateStr) {
  if (selectedDate === dateStr) {
    const active    = tools.filter(t => (t.status || 'Active') === 'Active' && t.expire);
    const todayStr  = formatDateLocal(getToday());
    const allDates  = active.map(t => formatDateLocal(new Date(t.expire))).filter(Boolean).sort();
    const pastDates = allDates.filter(d => d <= todayStr);
    selectedDate    = pastDates.length ? pastDates[pastDates.length - 1]
                    : allDates.length  ? allDates[0]
                    : todayStr;
  } else {
    selectedDate = dateStr;
  }
  renderAlerts();
}

function renderCalendarTitle() {
  const MONTHS_TH_FULL = [
    'มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน',
    'กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม'
  ];

  const start      = new Date(getToday());
  const end        = new Date(getToday());
  end.setDate(end.getDate() + 27);

  const startMonth = MONTHS_TH_FULL[start.getMonth()];
  const endMonth   = MONTHS_TH_FULL[end.getMonth()];
  const year       = start.getFullYear() + 543;

  const text = start.getMonth() === end.getMonth()
    ? `📝 ปฏิทินการสอบเทียบ  ${startMonth} ${year}`
    : `📝 ปฏิทินการสอบเทียบ  ${startMonth} – ${endMonth} ${year}`;

  document.getElementById('cal-title').innerText = text;
}

function renderCalendar() {
  const MONTHS_TH = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.',
                     'ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
  const todayStr    = formatDateLocal(getToday());
  const activeTools = tools.filter(t => (t.status || 'Active') === 'Active'); // ✅ กรอง Active

  const days = Array.from({ length: 28 }, (_, i) => {
    const d = new Date(getToday());
    d.setDate(d.getDate() + i);
    return d;
  });

  document.getElementById('cal-strip').innerHTML = days.map(d => {
    const ds      = formatDateLocal(d);
    const hasOver = activeTools.some(t => formatDateLocal(new Date(t.expire)) === ds && diffDays(t.expire) < 0);  // ✅ แก้
    const hasWarn = activeTools.some(t => formatDateLocal(new Date(t.expire)) === ds && diffDays(t.expire) >= 0 && diffDays(t.expire) <= getWarnDays()); // ✅ แก้
    const isToday = ds === todayStr;

    let cls = '';
    if (isToday)       cls = 'today';
    else if (hasOver)  cls = 'overdue-day';
    else if (hasWarn)  cls = 'has-event';

    if (selectedDate === ds) cls += ' selected';

    const dot = (hasOver || hasWarn) && !isToday ? '<div class="cal-dot"></div>' : '';

    return `
      <div class="cal-day ${cls}" onclick="selectDate('${ds}')">
        <div class="cal-d">${d.getDate()}</div>
        <div class="cal-m">${MONTHS_TH[d.getMonth()]}</div>
        ${dot}
      </div>`;
  }).join('');
}

function renderAlertList() {
  let data = tools
    .filter(t => (t.status || 'Active') === 'Active')
    .slice().sort((a, b) => {
      const da = diffDays(a.expire);
      const db = diffDays(b.expire);
      if (da < 0 && db >= 0) return -1;
      if (da >= 0 && db < 0) return 1;
      return da - db;
    });

  if (alertFilter === 'overdue') {
    data = data.filter(t => diffDays(t.expire) < 0);
  } else if (alertFilter === 'warn') {
    const w = getWarnDays();
    data = data.filter(t => { const d = diffDays(t.expire); return d >= 0 && d <= w; });
  } else if (alertFilter === 'ok') {
    data = data.filter(t => diffDays(t.expire) > getWarnDays());
  }

  if (selectedDate) {
    data = data.filter(t => formatDateLocal(new Date(t.expire)) === selectedDate);
  }

  const el = document.getElementById('alerts-list');

  if (!data.length) {
    el.innerHTML = `
      <div class="empty">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <circle cx="12" cy="12" r="10"/><polyline points="20 6 9 17 4 12"/>
        </svg>
        <p>ไม่มีรายการ</p>
      </div>`;
    return;
  }

  el.innerHTML = `<div class="alert-list">${data.map(t => {
    const s      = getStatus(t.expire);
    const danger = diffDays(t.expire) < -30 ? 'alert-danger' : '';
    return `
      <div class="alert-row ${danger}" onclick="openDetail(${t.id})">
        <div class="alert-icon ${s.cls}">${alertIconSvg(s.cls)}</div>
        <div class="alert-body">
          <div class="alert-name">
            ${t.name}
            <span style="font-size:10px;color:var(--text2)">#${t.code}</span>
          </div>
          <div class="alert-meta">${t.dept} · ${t.owner} · หมดอายุ ${fmtDate(t.expire)}</div>
        </div>
        <div class="alert-days ${s.cls}">${s.label}</div>
      </div>`;
  }).join('')}</div>`;
}

function renderAlerts() {
  updateAlertChips();
  renderCalendarTitle();
  renderCalendar();
  renderAlertList();
}