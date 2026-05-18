/* ── INSTRUMENTS PAGE ── */
/* ── EXCEL IMPORT ── */

const IMPORT_COLUMNS = [
  { key: 'code',     label: 'รหัสเครื่องมือ',      required: true  },
  { key: 'name',     label: 'ชื่อเครื่องมือ',       required: true  },
  { key: 'type',     label: 'ประเภท',          required: false },
  { key: 'dept',     label: 'แผนก',            required: false },
  { key: 'loc',      label: 'ตำแหน่งที่ตั้ง',       required: false },
  { key: 'owner',    label: 'ผู้รับผิดชอบ',        required: false  },
  { key: 'last',     label: 'วันสอบเทียบล่าสุด',   required: false  },
  { key: 'interval', label: 'รอบสอบเทียบ',      required: false  },
  { key: 'source',   label: 'แหล่งสอบเทียบ',     required: false },
  { key: 'cert',     label: 'เลขที่ใบรับรอง',      required: false },
  { key: 'lab',      label: 'ห้องปฏิบัติการ',       required: false },
  { key: 'status',   label: 'สถานะ',            required: false },
];

let importRows = [];

function openImportModal() {
  if (!isAdmin()) { showToast('🔒 กรุณาเข้าสู่ระบบก่อน'); return; }
  importRows = [];
  document.getElementById('import-filename').textContent    = 'ยังไม่ได้เลือกไฟล์';
  document.getElementById('import-preview').style.display  = 'none';
  document.getElementById('import-confirm-btn').style.display = 'none';
  document.getElementById('import-file-input').value       = '';
  document.getElementById('import-drop-area').style.borderColor = '';
  openModal('modal-import');
}

/* ── Download Template ── */
function downloadTemplate() {
  const headers = IMPORT_COLUMNS.map(c => c.label);
  const example = [
    'PG-001', 'Pressure Gauge', 'เกจ', 'QC', 'ห้องทดสอบ',
    'สมชาย ใจดี', '2024-01-15', '1y', 'External', 'CERT-001', 'TH-LAB'
  ];

  const ws = XLSX.utils.aoa_to_sheet([headers, example]);

  // กำหนดความกว้างคอลัมน์
  ws['!cols'] = IMPORT_COLUMNS.map((_, i) => ({ wch: i < 2 ? 20 : 16 }));

  // ทำให้ header เด่น
  headers.forEach((_, i) => {
    const cell = XLSX.utils.encode_cell({ r: 0, c: i });
    if (!ws[cell]) return;
    ws[cell].s = { font: { bold: true }, fill: { fgColor: { rgb: 'D1FAE5' } } };
  });

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'เครื่องมือ');
  XLSX.writeFile(wb, 'template_calibration.xlsx');
}

/* ── Handle File ── */
function handleImportDrop(e) {
  e.preventDefault();
  document.getElementById('import-drop-area').style.borderColor = '';
  const file = e.dataTransfer.files[0];
  if (file) handleImportFile(file);
}

function handleImportFile(file) {
  if (!file) return;
  document.getElementById('import-filename').textContent = file.name;

  const reader = new FileReader();
  reader.onload = (e) => parseImportFile(e.target.result);
  reader.readAsArrayBuffer(file);
}

function parseImportFile(buffer) {
  const wb      = XLSX.read(buffer, { type: 'arraybuffer', cellDates: true });
  const ws      = wb.Sheets[wb.SheetNames[0]];
  const rows    = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

  if (rows.length < 2) {
    showToast('⚠ ไฟล์ไม่มีข้อมูล');
    return;
  }

  const headerRow = rows[0].map(h => String(h).trim());
  const dataRows  = rows.slice(1).filter(r => r.some(c => c !== ''));

  // map header label → key
  const colMap = {};
  IMPORT_COLUMNS.forEach(col => {
    const idx = headerRow.indexOf(col.label);
    if (idx !== -1) colMap[col.key] = idx;
  });

  importRows = dataRows.map((row, rowIdx) => {
    const obj    = {};
    const errors = [];

    IMPORT_COLUMNS.forEach(col => {
      const idx = colMap[col.key];
      let val   = idx !== undefined ? String(row[idx] ?? '').trim() : '';

      // แปลงวันที่จาก Excel serial
      if ((col.key === 'last') && row[idx] instanceof Date) {
        const msPerDay = 86400000;
        const rounded  = new Date(Math.round(row[idx].getTime() / msPerDay) * msPerDay);
        val = `${rounded.getUTCFullYear()}-${String(rounded.getUTCMonth()+1).padStart(2,'0')}-${String(rounded.getUTCDate()).padStart(2,'0')}`;

      } else if (col.key === 'last' && val) {
        if (/^\d{2}\/\d{2}\/\d{4}$/.test(val)) {
          const [d, m, y] = val.split('/');
          val = `${y}-${m.padStart(2,'0')}-${d.padStart(2,'0')}`;
        } else if (/^\d{2}-\d{2}-\d{2}$/.test(val)) {
          const [d, m, y] = val.split('-');
          val = `20${y}-${m.padStart(2,'0')}-${d.padStart(2,'0')}`;
        } else if (/^\d{2}-\d{2}-\d{4}$/.test(val)) {
          const [d, m, y] = val.split('-');
          val = `${y}-${m.padStart(2,'0')}-${d.padStart(2,'0')}`;
        }
      }

      if (col.key === 'source') {
        val = val.toLowerCase().includes('ext') ? 'External' : 'Internal';
      }

      if (col.key === 'status') {
        val = val.toLowerCase().includes('inactive') ? 'Inactive' : 'Active';
      }

      if (col.required && !val) {
        errors.push(col.label);
      }

      obj[col.key] = val;
    });

    // คำนวณ expire
    const interval = normalizeInterval(obj.interval);
    obj.interval   = interval || obj.interval;
    obj.expire     = (obj.last && interval) ? calcExpire(obj.last, interval) : '';
    obj.cert       = obj.cert  || '-';
    obj.lab        = obj.lab   || '-';

    if (!obj.expire && obj.last && obj.interval) errors.push('รอบสอบเทียบไม่ถูกต้อง');

    return { ...obj, _row: rowIdx + 2, _errors: errors };
  });

  renderImportPreview();
}

function renderImportPreview() {
  const valid   = importRows.filter(r => !r._errors.length);
  const invalid = importRows.filter(r =>  r._errors.length);

  document.getElementById('import-preview').style.display = 'block';
  document.getElementById('import-preview-label').textContent =
    `พบ ${importRows.length} รายการ · ✅ นำเข้าได้ ${valid.length} · ❌ ข้อผิดพลาด ${invalid.length}`;

  document.getElementById('import-error-count').textContent =
    invalid.length ? `แถวที่มีปัญหา: ${invalid.map(r => r._row).join(', ')}` : '';

  const showRows = importRows.slice(0, 50);

  document.getElementById('import-preview-table').innerHTML = `
    <thead>
      <tr style="background:var(--bg2);position:sticky;top:0">
        <th style="padding:8px;text-align:left;border-bottom:0.5px solid var(--border)">แถว</th>
        ${['รหัส','ชื่อ','แผนก','ผู้รับผิดชอบ','วันหมดอายุ','สถานะ'].map(h =>
          `<th style="padding:8px;text-align:left;border-bottom:0.5px solid var(--border)">${h}</th>`
        ).join('')}
      </tr>
    </thead>
    <tbody>
      ${showRows.map(r => {
        const hasErr = r._errors.length > 0;
        const bg     = hasErr ? 'background:#FFF5F5' : '';
        return `
          <tr style="${bg}">
            <td style="padding:6px 8px;color:var(--text2)">${r._row}</td>
            <td style="padding:6px 8px;font-weight:500">${r.code || '-'}</td>
            <td style="padding:6px 8px">${r.name || '-'}</td>
            <td style="padding:6px 8px">${r.dept || '-'}</td>
            <td style="padding:6px 8px">${r.owner || '-'}</td>
            <td style="padding:6px 8px">${r.expire ? fmtDate(r.expire) : '-'}</td>
            <td style="padding:6px 8px">
              ${hasErr
                ? `<span style="color:#b91c1c;font-size:11px">❌ ${r._errors.join(', ')}</span>`
                : `<span style="color:#15803d;font-size:11px">✅ พร้อมนำเข้า</span>`}
            </td>
          </tr>`;
      }).join('')}
    </tbody>`;

  document.getElementById('import-confirm-btn').style.display =
    valid.length > 0 ? 'inline-flex' : 'none';
}

/* ── Confirm Import → Upsert to Supabase ── */
async function confirmImport() {
  const valid = importRows.filter(r => !r._errors.length);
  if (!valid.length) return;

  const btn       = document.getElementById('import-confirm-btn');
  btn.disabled    = true;
  btn.textContent = '⏳ กำลังนำเข้า...';

  // ── auto-insert แผนกใหม่ ──
  const newDepts = [...new Set(valid.map(r => r.dept).filter(Boolean))]
    .filter(d => !departments.some(x => x.name === d));
  if (newDepts.length) {
    await client.from('departments').insert(newDepts.map(name => ({ name, active: true })));
    await loadDepartments();
  }

  // ── auto-insert ประเภทใหม่ ──
  const newTypes = [...new Set(valid.map(r => r.type).filter(Boolean))]
    .filter(t => !types.some(x => x.name === t));
  if (newTypes.length) {
    await client.from('types').insert(newTypes.map(name => ({ name, active: true })));
    await loadTypes();
  }

  // ── auto-insert ตำแหน่งใหม่ ──
  const newLocs = [...new Set(valid.map(r => r.loc).filter(Boolean))]
    .filter(l => !locations.some(x => x.name === l));
  if (newLocs.length) {
    await client.from('locations').insert(newLocs.map(name => ({ name, active: true })));
    await loadLocations();
  }

  const payload = valid.map(r => ({
    code:     r.code,
    name:     r.name,
    type:     r.type     || '',
    dept:     r.dept     || '',
    loc:      r.loc      || '',
    owner:    r.owner    || '-',
    last:     r.last     || null,
    interval: r.interval || null,
    expire:   r.expire   || null,
    source:   r.source   || 'Internal',
    cert:     r.cert,
    lab:      r.lab,
    status:   r.status   || 'Active',
  }));

  const codes = valid.map(r => r.code);
  const duplicates = codes.filter((c, i) => codes.indexOf(c) !== i);

  if (duplicates.length) {
    showToast(`❌ มีรหัสซ้ำในไฟล์: ${[...new Set(duplicates)].join(', ')}`);
    btn.disabled    = false;
    btn.textContent = '✅ นำเข้าข้อมูล';
    return;
  }

  const { error } = await client
    .from('tools')
    .upsert(payload, { onConflict: 'code' });
  

  btn.disabled    = false;
  btn.textContent = '✅ นำเข้าข้อมูล';

  if (error) {
    console.error(error);
    showToast('❌ นำเข้าไม่สำเร็จ: ' + error.message);
    return;
  }

  closeModal('modal-import');
  await loadTools();
  renderDashboard();
  renderInstruments();

  showToast([
    `✅ นำเข้า ${valid.length} รายการแล้ว`,
    newDepts.length ? `· แผนกใหม่ ${newDepts.length}` : '',
    newTypes.length ? `· ประเภทใหม่ ${newTypes.length}` : '',
    newLocs.length  ? `· ตำแหน่งใหม่ ${newLocs.length}` : '',
  ].filter(Boolean).join(' '));
}

function sortBy(col) {
  if (sortCol === col) {
    sortDir *= -1;
  } else {
    sortCol = col;
    sortDir = 1;
  }
  renderInstruments();
}

function renderInstruments() {
  const q  = (document.getElementById('inst-search').value || '').toLowerCase();
  const sf = document.getElementById('inst-status').value;
  const df = document.getElementById('inst-dept').value;
  const sf2 = document.getElementById('inst-status-active').value;

  let data = tools.filter(t => {
    const s        = getStatus(t.expire).cls;
    const matchQ   = !q  || (t.code + t.name + t.owner).toLowerCase().includes(q);
    const matchSF  = !sf || s === sf;
    const matchDF  = !df || t.dept === df;
     const matchSA = !sf2 || (t.status || 'Active') === sf2;
    return matchQ && matchSF && matchDF && matchSA;
  });

  data.sort((a, b) => {
    let va, vb;
    if (sortCol === 'expire' || sortCol === 'last') {
      va = new Date(a[sortCol]);
      vb = new Date(b[sortCol]);
    } else {
      va = a[sortCol] || '';
      vb = b[sortCol] || '';
    }
    return va > vb ? sortDir : va < vb ? -sortDir : 0;
  });

  const tbody = document.getElementById('inst-tbody');
  const empty = document.getElementById('inst-empty');

  if (!data.length) {
    tbody.innerHTML = '';
    empty.style.display = 'flex';
    return;
  }
  empty.style.display = 'none';

  tbody.innerHTML = data.map(t => {
    const s = getStatus(t.expire);
    return `
      <tr class="row-${s.cls}" style="cursor:pointer" onclick="openDetail(${t.id})">
        <td><span class="code">${t.code}</span></td>
        <td style="font-weight:500">${t.name}</td>
        <td><span class="badge badge-blue">${t.type}</span></td>
        <td>${t.dept}</td>
        <td>${fmtDate(t.last)}</td>
        <td style="font-weight:${s.cls !== 'ok' ? '600' : '400'}">${fmtDate(t.expire)}</td>
        <td>${t.owner}</td>
        <td><span class="badge ${s.badgeCls}"><span class="badge-dot"></span>${s.label}</span></td>
      </td>
      </tr>`;
  }).join('');
}

/* ── ADD MODAL ── */
function openAddModal() {
  if (!isAdmin()) {
    showToast('🔒 กรุณาเข้าสู่ระบบก่อน');
    openModal('modal-login');
    return;
  }

  ['add-code', 'add-name', 'add-owner'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });

  document.getElementById('add-last').value     = formatDateLocal(getToday());
  document.getElementById('add-interval').value = '';

  openModal('modal-add');
}

async function saveInstrument() {
  const code   = document.getElementById('add-code').value.trim();
  const name   = document.getElementById('add-name').value.trim();
  const last   = document.getElementById('add-last').value;
  const dept   = document.getElementById('add-dept').value;
  const owner  = document.getElementById('add-owner').value.trim();
  const source = document.getElementById('add-source').value;

  const rawInterval = document.getElementById('add-interval').value;
  const interval    = normalizeInterval(rawInterval);
  if (!interval) {
    showToast('⚠ รูปแบบรอบไม่ถูกต้อง เช่น 1d, 6m, 1y, 1.6y');
    return;
  }
  document.getElementById('add-interval').value = interval;

  const expire = last && interval ? calcExpire(last, interval) : null;

  if (!code || !name || !expire || !owner) {
    showToast('⚠ กรุณากรอกข้อมูลให้ครบ');
    return;
  }

  const exists = tools.some(t => t.code.toLowerCase() === code.toLowerCase());
  if (exists) {
    showToast('❌ รหัสเครื่องนี้มีอยู่แล้ว');
    return;
  }

  const { error } = await client
    .from('tools')
    .insert([{
      code,
      name,
      owner,
      dept,
      last,
      expire,
      interval,
      type: document.getElementById('add-type').value,
      loc: document.getElementById('add-loc').value,
      cert: '-',
      lab: '-',
      source
   }]);

  if (error) {
    console.error(error)
    showToast('❌ บันทึกไม่สำเร็จ');
    return;
  }

  await loadTools();

  closeModal('modal-add');
  renderDashboard();

  if (document.getElementById('page-instruments').classList.contains('active')) {
    renderInstruments();
  }

  showToast('✅ เพิ่มเครื่องมือเรียบร้อยแล้ว');
}

/* ── DETAIL MODAL ── */
function updatedMark(field) {
  return (justUpdatedId === currentToolId && updatedFields.includes(field))
    ? '<span class="badge-updated-mini">UPDATED</span>'
    : '';
}

function openDetail(id) {
  currentToolId = id;

  const t = tools.find(x => x.id === id);
  if (!t) return;

  const s            = getStatus(t.expire);
  const expireColor  = s.cls === 'ok' ? 'var(--green)' : s.cls === 'warn' ? 'var(--orange)' : 'var(--red)';

  document.getElementById('detail-title').innerHTML =
  `<span class="code" style="font-size:12px">${t.code}</span>
   <span class="badge ${t.status === 'Active' ? 'badge-ok' : 'badge-overdue'}" 
         style="font-size:11px;margin-left:6px">
     <span class="badge-dot"></span>${t.status || 'Active'}
   </span>`;

  document.getElementById('detail-body').innerHTML = `
    <div style="margin-bottom:12px">
      <span class="badge ${s.badgeCls}" style="font-size:13px;padding:5px 14px">
        <span class="badge-dot"></span>${s.label}
      </span>
    </div>

    <div class="detail-grid">
      <div class="detail-item">
        <div class="detail-key">ชื่อเครื่องมือ ${updatedMark('name')}</div>
        <div class="detail-val">${t.name}</div>
      </div>
      <div class="detail-item">
        <div class="detail-key">รหัสเครื่องมือ</div>
        <div class="detail-val">${t.code}</div>
      </div>
      <div class="detail-item">
        <div class="detail-key">สอบเทียบล่าสุด ${updatedMark('last')}</div>
        <div class="detail-val">${fmtDate(t.last)}</div>
      </div>
      <div class="detail-item">
        <div class="detail-key">วันหมดอายุ</div>
        <div class="detail-val" style="color:${expireColor};font-weight:700">${fmtDate(t.expire)}</div>
      </div>
      <div class="detail-item">
        <div class="detail-key">รอบสอบเทียบ ${updatedMark('interval')}</div>
        <div class="detail-val">${formatInterval(t.interval)}</div>
      </div>
      <div class="detail-item">
        <div class="detail-key">ผู้รับผิดชอบ ${updatedMark('owner')}</div>
        <div class="detail-val">${t.owner}</div>
      </div>
      <div class="detail-item">
        <div class="detail-key">แผนก ${updatedMark('dept')}</div>
        <div class="detail-val">${t.dept}</div>
      </div>
      <div class="detail-item">
        <div class="detail-key">ตำแหน่งที่ตั้ง</div>
        <div class="detail-val">${t.loc}</div>
      </div>
      <div class="detail-item">
        <div class="detail-key">แหล่งสอบเทียบ</div>
        <div class="detail-val">
          <span class="badge ${t.source === 'External' ? 'badge-warn' : 'badge-blue'}">
            ${t.source === 'External' ? '🌐 External' : '🏭 Internal'}
          </span>
        </div>
      </div>
      <div class="detail-item">
        <div class="detail-key">ประเภทเครื่องมือ</div>
        <div class="detail-val">${t.type}</div>
      </div>
      <div class="detail-item">
        <div class="detail-key">เลขที่ใบรับรอง</div>
        <div class="detail-val" style="color:var(--blue)">${t.cert}</div>
      </div>
      <div class="detail-item">
        <div class="detail-key">ห้องปฏิบัติการ</div>
        <div class="detail-val">${t.lab}</div>
      </div>
    </div>`;

  openModal('modal-detail');

  document.querySelector('#modal-detail .modal-foot').innerHTML = isAdmin() ? `
    <div class="left-btns">
      <button class="btn btn-danger" onclick="deleteTool()">ลบ</button>
      <button class="btn btn-fixed"  onclick="openEditModal()">แก้ไข</button>
    </div>
    <div class="right-btns">
      <button class="btn btn-primary" onclick="openCalModal()">บันทึกการสอบเทียบ</button>
    </div>
  ` : `
    <div style="color:var(--text2);font-size:12px;padding:4px 0">
      🔒 กรุณาเข้าสู่ระบบเพื่อแก้ไขข้อมูล
    </div>
  `;
}

/* ── EDIT MODAL ── */
function openEditModal() {
  const t = tools.find(x => x.id === currentToolId);
  if (!t) return;

  document.getElementById('edit-code').value     = t.code;
  document.getElementById('edit-name').value     = t.name;
  document.getElementById('edit-owner').value    = t.owner;
  document.getElementById('edit-dept').value     = t.dept   || '';
  document.getElementById('edit-last').value     = t.last;
  document.getElementById('edit-interval').value = t.interval;
  document.getElementById('edit-source').value   = t.source || 'internal';
  document.getElementById('edit-loc').value      = t.loc    || '';
  document.getElementById('edit-type').value     = t.type   || '';
  document.getElementById('edit-status').value   = t.status || 'Active';

  openModal('modal-edit');
}

async function updateTool() {
  updatedFields = [];

  const code   = document.getElementById('edit-code').value.trim();
  const name   = document.getElementById('edit-name').value.trim();
  const owner  = document.getElementById('edit-owner').value.trim();
  const dept   = document.getElementById('edit-dept').value;
  const last   = document.getElementById('edit-last').value;
  const source = document.getElementById('edit-source').value;
  const loc    = document.getElementById('edit-loc').value;
  const type   = document.getElementById('edit-type').value;
  const status = document.getElementById('edit-status').value; 

  const rawInterval = document.getElementById('edit-interval').value;
  const interval    = normalizeInterval(rawInterval);

  const old = tools.find(t => t.id === currentToolId);

  if (old.code     !== code)     updatedFields.push('code');
  if (old.name     !== name)     updatedFields.push('name');
  if (old.dept     !== dept)     updatedFields.push('dept');
  if (old.owner    !== owner)    updatedFields.push('owner');
  if (old.last     !== last)     updatedFields.push('last');
  if (old.interval !== interval) updatedFields.push('interval');

  
  if (!code || !name) {
    showToast('⚠ กรุณากรอกข้อมูลให้ครบ');
    return;
  }

  if (!interval) {
    showToast('⚠ รูปแบบรอบไม่ถูกต้อง');
    return;
  }

  const duplicate = tools.some(t =>
  t.code.toLowerCase() === code.toLowerCase() && t.id !== currentToolId
    );
    if (duplicate) {
      showToast('❌ รหัสซ้ำกับเครื่องอื่น');
      return;
  }    

  const expire = last && interval ? calcExpire(last, interval) : null;
  
  const { error } = await client
    .from('tools')
    .update({ code, name, owner, dept, last, interval, expire, loc, type, source, status })
    .eq('id', currentToolId);

  if (error) {
    console.error(error);
    showToast('❌ อัปเดตไม่สำเร็จ');
    return;
  }

  justUpdatedId = currentToolId;
  await loadTools();

  closeModal('modal-edit');
  openDetail(currentToolId);

  setTimeout(() => {
    document.querySelectorAll('.badge-updated-mini')
      .forEach(el => el.classList.add('fade'));

    setTimeout(() => {
      justUpdatedId = null;
      updatedFields = [];
    }, 2000);
  }, 1000);

  renderDashboard();
  renderInstruments();
  showToast('✅ แก้ไขข้อมูลเรียบร้อย');
}

/* ── CALIBRATION MODAL ── */
function openCalModal() {
  document.getElementById('cal-date').value = formatDateLocal(getToday());
  openModal('modal-cal');
}

async function saveCalibration() {
  const date   = document.getElementById('cal-date').value;
  const result = document.getElementById('cal-result').value;
  const cert   = document.getElementById('cal-cert').value;
  const lab    = document.getElementById('cal-lab').value;
  const by     = document.getElementById('cal-by').value;

  if (!date || !result) {
    showToast('⚠ กรุณากรอกข้อมูลให้ครบ');
    return;
  }

  const { error } = await client
    .from('calibrations')
    .insert([{
      tool_id: currentToolId,
      date,
      result,
      cert,
      lab,
      by_user: by
    }]);

  if (error) {
    console.error(error);
    showToast('❌ บันทึกไม่สำเร็จ');
    return;
  }

  const tool = tools.find(t => t.id === currentToolId);

  if (!tool || !tool.interval) {
    showToast('⚠ เครื่องมือนี้ยังไม่ได้ตั้งรอบสอบเทียบ');
  } else {
    const newExpire = calcExpire(date, tool.interval);

    await client
      .from('tools')
      .update({ last: date, expire: newExpire })
      .eq('id', currentToolId);
  }

  await loadTools();

  closeModal('modal-cal');
  openDetail(currentToolId);
  showToast('✅ บันทึกการสอบเทียบแล้ว');

  renderDashboard();
  renderInstruments();
}

/* ── DELETE ── */
async function deleteTool() {
  if (!currentToolId) {
    showToast('❌ ไม่พบ ID');
    return;
  }

  if (!confirm('ลบเครื่องมือนี้ใช่ไหม ?')) return;

  const tool = tools.find(t => t.id === currentToolId);

  const { error } = await client
    .from('tools')
    .delete()
    .eq('id', currentToolId);

  if (error) {
    console.error('DELETE ERROR:', error);
    showToast('❌ ลบไม่สำเร็จ');
    return;
  }

  closeModal('modal-detail');

  await loadTools();
  renderDashboard();
  renderInstruments();

  showToast('🗑 ลบ ' + (tool?.code || '') + ' เรียบร้อยแล้ว ✓');
}
