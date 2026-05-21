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

/* ── MONTHLY CALIBRATION CHART ── */
let mcChart      = null;
let mcYear       = null;
let mcYearList   = [];
 
function getMCData(year) {
  const MONTHS = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
  const now   = new Date();
  const beNow = now.getFullYear() + 543;
  const maxM  = (year === beNow) ? now.getMonth() : 11; // 0-based
 
  const done    = Array(maxM + 1).fill(0);
  const pending = Array(maxM + 1).fill(0);
 
  // --- "done" = tools whose last calibration date falls in this month/year
  const ceYear = year - 543;
  (tools || []).forEach(t => {
    if (!t.last) return;
    const d = new Date(t.last);
    if (isNaN(d)) return;
    if (d.getFullYear() === ceYear && d.getMonth() <= maxM) {
      done[d.getMonth()]++;
    }
  });
 
  // Also count from calibration history if available
  if (typeof calHistory !== 'undefined') {
    calHistory.forEach(h => {
      const d = new Date(h.date || h.cal_date);
      if (isNaN(d)) return;
      if (d.getFullYear() === ceYear && d.getMonth() <= maxM) {
        done[d.getMonth()]++;
      }
    });
  }
 
  // --- "pending" = overdue + warn count (static current snapshot shown on current month)
  const activeTools = (tools || []).filter(t => (t.status || 'Active') === 'Active');
  const pendingCount = activeTools.filter(t => {
    const s = getToolStatus(t);
    return s === 'overdue' || s === 'warn';
  }).length;
  if (maxM >= 0) pending[maxM] = pendingCount;
 
  return {
    labels:  MONTHS.slice(0, maxM + 1),
    done:    done,
    pending: pending
  };
}

function buildMCYears() {
  const now   = new Date();
  const beNow = now.getFullYear() + 543;
  // Show current year + previous year
  return [beNow, beNow - 1];
}
 
function renderMonthChart() {
  const canvasEl = document.getElementById('mc-chart');
  if (!canvasEl) return;
 
  // Build year list once
  mcYearList = buildMCYears();
  if (!mcYear || !mcYearList.includes(mcYear)) mcYear = mcYearList[0];
 
  // Build dropdown
  const dropEl = document.getElementById('mc-year-dropdown');
  const lblEl  = document.getElementById('mc-year-label');
  if (dropEl) {
    dropEl.innerHTML = mcYearList.map(y =>
      `<div class="mc-year-opt${y === mcYear ? ' active' : ''}" data-year="${y}">พ.ศ. ${y}</div>`
    ).join('');
    dropEl.querySelectorAll('.mc-year-opt').forEach(opt => {
      opt.addEventListener('click', e => {
        e.stopPropagation();
        mcYear = parseInt(opt.dataset.year);
        dropEl.classList.remove('open');
        updateMCChart();
      });
    });
  }
  if (lblEl) lblEl.textContent = mcYear;
 
  // Year btn toggle
  const btnEl = document.getElementById('mc-year-btn');
  if (btnEl && !btnEl._mcBound) {
    btnEl._mcBound = true;
    btnEl.addEventListener('click', e => {
      e.stopPropagation();
      dropEl.classList.toggle('open');
    });
    document.addEventListener('click', () => dropEl && dropEl.classList.remove('open'));
  }
 
  const d = getMCData(mcYear);
  updateMCKPI(d);
 
  const textClr = 'rgba(0,0,0,0.36)';
  const gridClr = 'rgba(0,0,0,0.06)';
  const lblClr  = 'rgba(0,0,0,0.48)';
 
  // Rounded top plugin
  const roundPlugin = {
    id: 'mcRoundBars',
    afterDatasetsDraw(chart) {
      const {ctx} = chart;
      chart.data.datasets.forEach((ds, di) => {
        const meta = chart.getDatasetMeta(di);
        if (meta.hidden) return;
        meta.data.forEach(bar => {
          if (!bar || bar.height <= 0) return;
          const {x, y, width, height, base} = bar;
          const r = Math.min(5, Math.abs(height)/2, width/2);
          ctx.save();
          ctx.fillStyle = ds.backgroundColor;
          ctx.beginPath();
          ctx.moveTo(x - width/2 + r, y);
          ctx.lineTo(x + width/2 - r, y);
          ctx.quadraticCurveTo(x + width/2, y, x + width/2, y + r);
          ctx.lineTo(x + width/2, base);
          ctx.lineTo(x - width/2, base);
          ctx.lineTo(x - width/2, y + r);
          ctx.quadraticCurveTo(x - width/2, y, x - width/2 + r, y);
          ctx.closePath();
          ctx.fill();
          ctx.restore();
        });
      });
    }
  };
 
  if (mcChart) {
    mcChart.data.labels = d.labels;
    mcChart.data.datasets[0].data = d.done;
    mcChart.data.datasets[1].data = d.pending;
    mcChart.update();
    return;
  }
 
  mcChart = new Chart(canvasEl.getContext('2d'), {
    type: 'bar',
    plugins: [roundPlugin],
    data: {
      labels: d.labels,
      datasets: [
        {
          label: 'สอบเทียบสำเร็จ',
          data: d.done,
          backgroundColor: '#4E9AF1',
          barPercentage: 0.85,
          categoryPercentage: 0.45,
          borderSkipped: false,
          datalabels: {
            color: lblClr, anchor: 'end', align: 'end', offset: -1,
            font: { size: 10, weight: '500', family: 'Sarabun' },
            formatter: v => v > 0 ? v : ''
          }
        },
        {
          label: 'รอดำเนินการ',
          data: d.pending,
          backgroundColor: '#F4A259',
          barPercentage: 0.85,
          categoryPercentage: 0.45,
          borderSkipped: false,
          datalabels: {
            color: lblClr, anchor: 'end', align: 'end', offset: -1,
            font: { size: 10, weight: '500', family: 'Sarabun' },
            formatter: v => v > 0 ? v : ''
          }
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      layout: { padding: { top: 16 } },
      animation: { duration: 600, easing: 'easeOutQuart' },
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { display: false },
        datalabels: {},
        tooltip: {
          backgroundColor: '#fff',
          titleColor: '#0f172a',
          bodyColor: '#64748b',
          borderColor: '#e2e8f0',
          borderWidth: 1,
          padding: 10,
          cornerRadius: 8,
          callbacks: {
            title: items => `${items[0].label} พ.ศ. ${mcYear}`,
            label: item  => `  ${item.dataset.label}: ${item.raw} เครื่อง`
          }
        }
      },
      scales: {
        x: {
          grid: { display: false },
          border: { display: false },
          ticks: { color: textClr, font: { size: 11, family: 'Sarabun' } }
        },
        y: {
          grid: { color: gridClr, drawTicks: false },
          border: { display: false, dash: [4,4] },
          ticks: { color: textClr, font: { size: 11, family: 'Sarabun' }, maxTicksLimit: 5, padding: 8 }
        }
      }
    }
  });
}
 
function updateMCChart() {
  const dropEl = document.getElementById('mc-year-dropdown');
  const lblEl  = document.getElementById('mc-year-label');
  if (lblEl) lblEl.textContent = mcYear;
  if (dropEl) {
    dropEl.querySelectorAll('.mc-year-opt').forEach(o => {
      o.classList.toggle('active', parseInt(o.dataset.year) === mcYear);
    });
  }
  const d = getMCData(mcYear);
  updateMCKPI(d);
  if (mcChart) {
    mcChart.data.labels = d.labels;
    mcChart.data.datasets[0].data = d.done;
    mcChart.data.datasets[1].data = d.pending;
    mcChart.update();
  }
}
 
function updateMCKPI(d) {
  const doneEl    = document.getElementById('mc-done');
  const pendingEl = document.getElementById('mc-pending');
  if (doneEl)    doneEl.textContent    = d.done.reduce((a,b) => a+b, 0).toLocaleString('th-TH');
  if (pendingEl) pendingEl.textContent = d.pending.reduce((a,b) => a+b, 0).toLocaleString('th-TH');
}

function renderDashboard() {
  document.querySelector('.kpi-grid').classList.add('loading');

  renderKPI();
  renderDeptBars();
  renderDashTable();
  renderMonthChart();
  updateNavBadge();

  document.querySelector('.kpi-grid').classList.remove('loading');
}