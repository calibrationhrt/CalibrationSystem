/* ── DASHBOARD ── */

function getToolStatus(t) {
  const d    = diffDays(t.expire);
  const warn = getWarnDays();
  if (d < 0)      return 'overdue';
  if (d <= warn)  return 'warn';
  return 'ok';
}

function renderKPI() {
  const activeTools = tools.filter(t => (t.status || 'Active') === 'Active');
  const total   = activeTools.length;
  const ok      = activeTools.filter(t => getToolStatus(t) === 'ok').length;
  const warn    = activeTools.filter(t => getToolStatus(t) === 'warn').length;
  const overdue = activeTools.filter(t => getToolStatus(t) === 'overdue').length;

  document.getElementById('kpi-total').textContent   = total;
  document.getElementById('kpi-ok').textContent      = ok;
  document.getElementById('kpi-warn').textContent    = warn;
  document.getElementById('kpi-overdue').textContent = overdue;

  const okPct = total ? Math.round((ok / total) * 100) : 0;
  const warnPct = total ? Math.round((warn / total) * 100) : 0;
  const overduePct = total ? Math.round((overdue / total) * 100) : 0;

  const subOk = document.querySelector('.kpi-green .kpi-sub');
  const subWarn = document.querySelector('.kpi-orange .kpi-sub');
  const subOverdue = document.querySelector('.kpi-red .kpi-sub');

  if (subOk) subOk.textContent = `▲ ${okPct}% ของทั้งหมด`;
  if (subWarn) subWarn.textContent = warn > 0 ? `⚠ ${warnPct}% ต้องนัดสอบเทียบ` : '✅ ไม่มีรายการ';
  if (subOverdue) subOverdue.textContent = overdue > 0 ? `🚨 ${overduePct}% ห้ามใช้งาน!` : '✅ ไม่มีรายการ';
}

function renderDeptBars() {
  const el = document.getElementById('dept-bars');

  const html = departments
    .filter(d => d.active)
    .map(d => {
      const items = tools.filter(t =>
        t.dept === d.name && (t.status || 'Active') === 'Active'
      );
      const total = items.length;
      if (total === 0) return null;

      const ok  = items.filter(t => getStatus(t.expire).cls === 'ok').length;
      const pct = Math.round((ok / total) * 100);

      return { name: d.name, total, ok, pct };
    })
    .filter(Boolean)
    .sort((a, b) => a.pct - b.pct)
    .map(({ name, total, pct }) => {
      const color =
        pct === 100 ? 'var(--green)' :
        pct >= 70   ? 'var(--orange)' :
                      'var(--red)';

      return `
        <div class="dept-row">
          <div class="dept-head">
            <span class="dept-name" title="${name}">${name}</span>
            <span class="dept-stat" style="color:${color}">${pct}% <span style="font-weight:400;color:var(--text2)">(${total})</span></span>
          </div>
          <div class="bar-bg">
            <div class="bar-fill" style="width:${pct}%; background:${color}"></div>
          </div>
        </div>`;
    })
    .join('');

  if (!html.trim()) {
    el.innerHTML = `<div class="empty">ไม่มีข้อมูลของแผนก</div>`;
    return;
  }

  el.innerHTML = html;
}

function renderDashTable() {
  const focus = tools
    .filter(t => (t.status || 'Active') === 'Active')
    .filter(t => {
      const s = getToolStatus(t);
      return s === 'overdue' || s === 'warn';
    })
    .sort((a, b) => diffDays(a.expire) - diffDays(b.expire));

  const tbody = document.getElementById('dash-table');

  if (!focus.length) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6">
          <div class="empty">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
            </svg>
            <p>ไม่มีเครื่องมือที่ต้องดำเนินการ</p>
          </div>
        </td>
      </tr>`;
    return;
  }

  tbody.innerHTML = focus.map(t => {
    const s = getStatus(t.expire);
    return `
      <tr class="row-${s.cls}">
        <td><span class="code">${t.code}</span></td>
        <td style="font-weight:400">${t.name}</td>
        <td>${t.dept}</td>
        <td>${fmtDate(t.expire)}</td>
        <td><span class="badge ${s.badgeCls}"><span class="badge-dot"></span>${s.label}</span></td>
      </tr>`;
  }).join('');
}

function renderDonutChart() {
  const activeTools = tools.filter(t => (t.status || 'Active') === 'Active');
  const total   = activeTools.length;
  const ok      = activeTools.filter(t => getToolStatus(t) === 'ok').length;
  const warn    = activeTools.filter(t => getToolStatus(t) === 'warn').length;
  const overdue = activeTools.filter(t => getToolStatus(t) === 'overdue').length;

  const el = document.getElementById('donut-chart-wrap');
  if (!el) return;

  if (total === 0) {
    el.innerHTML = `<div class="empty"><p>ยังไม่มีข้อมูล</p></div>`;
    return;
  }

  const r  = 54;
  const cx = 80;
  const cy = 80;
  const circumference = 2 * Math.PI * r;

  function slice(value, offset, color) {
    if (value === 0) return '';
    const pct  = value / total;
    const dash = pct * circumference;
    const gap  = circumference - dash;
    return `<circle
      cx="${cx}" cy="${cy}" r="${r}"
      fill="none" stroke="${color}" stroke-width="22"
      stroke-dasharray="${dash} ${gap}"
      stroke-dashoffset="${-offset}"
      stroke-linecap="butt"
      style="transition: stroke-dasharray .6s cubic-bezier(.4,0,.2,1)"
    />`;
  }

  const okOffset   = 0;
  const warnOffset = (ok / total) * circumference;
  const overdueOffset = warnOffset + (warn / total) * circumference;

  const okPct      = Math.round((ok / total) * 100);
  const warnPct    = Math.round((warn / total) * 100);
  const overduePct = Math.round((overdue / total) * 100);

  el.innerHTML = `
    <div class="donut-wrap">
      <div class="donut-svg-wrap">
        <svg viewBox="0 0 160 160" width="160" height="160">
          <!-- background ring -->
          <circle cx="${cx}" cy="${cy}" r="${r}" fill="none"
            stroke="var(--border)" stroke-width="22"/>
          ${slice(ok,      okOffset,      '#16a06e')}
          ${slice(warn,    warnOffset,    '#f59e0b')}
          ${slice(overdue, overdueOffset, '#ef4444')}
          <!-- center text -->
          <text x="${cx}" y="${cy - 8}" text-anchor="middle"
            font-size="22" font-weight="700" fill="var(--text)"
            font-family="Sarabun,sans-serif">${total}</text>
          <text x="${cx}" y="${cy + 12}" text-anchor="middle"
            font-size="10" fill="var(--text2)"
            font-family="Sarabun,sans-serif">เครื่องมือ</text>
        </svg>
      </div>

      <div class="donut-legend">
        <div class="donut-legend-item">
          <div class="donut-dot" style="background:#16a06e"></div>
          <div class="donut-legend-body">
            <span class="donut-legend-label">ปกติ</span>
            <span class="donut-legend-val">${ok} <span class="donut-legend-pct">${okPct}%</span></span>
          </div>
        </div>
        <div class="donut-legend-item">
          <div class="donut-dot" style="background:#f59e0b"></div>
          <div class="donut-legend-body">
            <span class="donut-legend-label">ใกล้ครบกำหนด</span>
            <span class="donut-legend-val">${warn} <span class="donut-legend-pct">${warnPct}%</span></span>
          </div>
        </div>
        <div class="donut-legend-item">
          <div class="donut-dot" style="background:#ef4444"></div>
          <div class="donut-legend-body">
            <span class="donut-legend-label">เกินกำหนด</span>
            <span class="donut-legend-val">${overdue} <span class="donut-legend-pct">${overduePct}%</span></span>
          </div>
        </div>
      </div>
    </div>`;
}

function renderDashboard() {
  document.querySelector('.kpi-grid').classList.add('loading');

  renderKPI();
  renderDonutChart();
  renderDeptBars();
  renderDashTable();
  updateNavBadge();

  document.querySelector('.kpi-grid').classList.remove('loading');
}