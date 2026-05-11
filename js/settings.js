/* ── SETTINGS PAGE ── */

/* ── DEPARTMENTS ── */
async function openDeptModal() {
  await loadDepartments();
  renderDeptModal();
  openModal('modal-dept');
}

function renderDeptModal() {
  const el = document.getElementById('dept-modal-list');
  if (!el) return;

  const keyword = (document.getElementById('dept-search')?.value || '').toLowerCase();

  const deptCount = tools.reduce((acc, t) => {
    acc[t.dept] = (acc[t.dept] || 0) + 1;
    return acc;
  }, {});

  const list = departments.filter(d =>
    d.name.toLowerCase().includes(keyword)
  );

  if (!list.length) {
    el.innerHTML = `<div class="empty" style="padding:20px;text-align:center;color:var(--text2)">ไม่พบข้อมูล</div>`;
    return;
  }

  el.innerHTML = list.map(d => {
    const count = deptCount[d.name] || 0;
    return `
      <div class="setting-row ${d.active ? '' : 'inactive'}">
        <div class="setting-left">
          <div class="setting-title">${escapeHtml(d.name)}</div>
          <div class="setting-sub">${count} เครื่องมือ</div>
        </div>
        <div class="setting-right">
          <label class="switch">
            <input type="checkbox"
              ${d.active ? 'checked' : ''}
              onchange="toggleDept(${d.id}, this.checked)">
            <span></span>
          </label>
          <button class="btn btn-ghost btn-sm" onclick="editDept(${d.id})">✏️</button>
          <button class="btn btn-danger btn-sm" onclick="deleteDept(${d.id})">🗑</button>
        </div>
      </div>`;
  }).join('');

  populateDeptDropdowns();
}


function populateDeptDropdowns() {
  const active = departments.filter(d => d.active).map(d => d.name);

  const instDept = document.getElementById('inst-dept');
  if (instDept) {
    const prev = instDept.value;
    instDept.innerHTML =
      `<option value="">แผนกทั้งหมด</option>` +
      active.map(n => `<option value="${n}">${n}</option>`).join('');
    if (active.includes(prev)) instDept.value = prev;
  }

  ['add-dept', 'edit-dept'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    const prev = el.value;
    el.innerHTML = active.map(n => `<option value="${n}">${n}</option>`).join('');
    if (active.includes(prev)) el.value = prev;
  });
}

async function toggleDept(id, active) {
  const { error } = await client
    .from('departments')
    .update({ active })
    .eq('id', id);

  if (error) {
    console.error(error);
    showToast('❌ อัปเดตไม่สำเร็จ');
    return;
  }

  await loadDepartments();
  renderDeptModal();
  showToast('✅ อัปเดตแผนกแล้ว');
}

async function updateDeptName(id, name) {
  const oldDept = departments.find(d => d.id === id);
  const oldName = oldDept?.name;

  if (!name || !name.trim()) return;


  const cleanName = name.trim().replace(/\s+/g, ' ');

  
  if (departments.some(d =>
    d.name.toLowerCase() === cleanName.toLowerCase() && d.id !== id
  )) {
    showToast('⚠ มีชื่อแผนกนี้แล้ว');
    return;
  }

  const { error } = await client
    .from('departments')
    .update({ name })
    .eq('id', id);

  if (error) {
    showToast('❌ เปลี่ยนชื่อไม่สำเร็จ');
    return;
  }

  if (oldName) {
    await client.from('tools').update({ dept: name }).eq('dept', oldName);
  }

  await loadDepartments();
  await loadTools();

  renderDeptModal();
  renderDashboard();
  renderInstruments();

  showToast(`✅ เปลี่ยนชื่อแผนก "${oldName}" → "${name}" แล้ว`);
}

async function initSettings() {
  try {
    await loadDepartments();
    await loadTypes();
    await loadLocations();
    populateNotifSettings();

    if (!settingsInitialized) {
      settingsInitialized = true;

      document.getElementById('type-search')
        ?.addEventListener('input', () => {
          clearTimeout(typeSearchTimer);
          typeSearchTimer = setTimeout(() => renderTypeManage(), 300);
        });

      document.getElementById('loc-search')
        ?.addEventListener('input', () => {
          clearTimeout(locSearchTimer);
          locSearchTimer = setTimeout(() => renderLocManage(), 300);
        });
    }

  } catch (err) {
    console.error('initSettings error:', err);
    showToast('❌ โหลดข้อมูลการตั้งค่าไม่สำเร็จ');
  }
}

async function addDept() {
  const name = await showInputModal('เพิ่มแผนก', 'ชื่อแผนกใหม่');
  if (!name || !name.trim()) return;

  const cleanName = name.trim().replace(/\s+/g, ' ');

  if (departments.some(d => d.name === cleanName)) {
    showToast('⚠ มีชื่อแผนกนี้แล้ว');
    return;
  }

  client.from('departments')
    .insert([{ name: cleanName, active: true }])
    .then(async ({ error }) => {
      if (error) return showToast('❌ เพิ่มไม่สำเร็จ');

      await loadDepartments();
      renderDeptModal();
      showToast('✅ เพิ่มแผนกแล้ว');
    });
}

async function editDept(id) {
  const dept = departments.find(d => d.id === id);
  if (!dept) return;

  const toolCount = tools.filter(t => t.dept === dept.name).length;
  const desc = toolCount > 0 ? `เครื่องมือ ${toolCount} รายการจะถูกเปลี่ยนชื่อแผนกด้วย` : '';
  const name = await showInputModal('เปลี่ยนชื่อแผนก', 'ชื่อแผนกใหม่', dept.name, desc);
  if (!name || !name.trim()) return;
  updateDeptName(id, name.trim());
}

async function deleteDept(id) {
  const dept = departments.find(d => d.id === id);
  if (!dept) return;

  const count = tools.filter(t => t.dept === dept.name).length;

  if (!confirm(`ลบแผนก "${dept.name}" ใช่ไหม?`)) return;

  if (count > 0) {
    const go = confirm(
      `ยังมีเครื่องมือ ${count} รายการในแผนกนี้\nต้องการไปจัดการตอนนี้ไหม?`
    );

    if (go) {
      goPage('instruments');
    }

    return;
  }

  const { error } = await client
    .from('departments')
    .delete()
    .eq('id', id);

  if (error) {
    showToast('❌ ลบแผนกไม่สำเร็จ');
    return;
  }

  await loadDepartments();
  renderDeptModal();
  renderDashboard();
  showToast(`🗑 ลบแผนก "${dept.name}" แล้ว`);
}

/* ── TYPES & LOCATIONS ── */
async function openTypeModal() {
  await loadTypes();
  renderTypeManage();
  openModal('modal-type');
}

async function openLocModal() {
  await loadLocations();
  renderLocManage();
  openModal('modal-loc');
}

function populateTypeDropdowns() {
  const active = types.filter(t => t.active).map(t => t.name);
  ['add-type', 'edit-type'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    const prev = el.value;
    el.innerHTML = active.map(n => `<option value="${n}">${n}</option>`).join('');
    if (active.includes(prev)) el.value = prev;
  });
}

function populateLocDropdowns() {
  const active = locations.filter(l => l.active).map(l => l.name);
  ['add-loc', 'edit-loc'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    const prev = el.value;
    el.innerHTML = active.map(n => `<option value="${n}">${n}</option>`).join('');
    if (active.includes(prev)) el.value = prev;
  });
}

function renderTypeManage() {
  const keyword = (document.getElementById('type-search')?.value || '').toLowerCase();

  const filtered = types.filter(t =>
    t.name.toLowerCase().includes(keyword)
  );

  renderManageList('type-manage', filtered, 'type');
}

function renderLocManage() {
  const keyword = (document.getElementById('loc-search')?.value || '').toLowerCase();

  const filtered = locations.filter(l =>
    l.name.toLowerCase().includes(keyword)
  );

  renderManageList('loc-manage', filtered, 'loc');
}

function renderManageList(containerId, items, prefix) {
  const container = document.getElementById(containerId);
  if (!container) return;

  if (!items.length) {
    container.innerHTML = `<div style="padding:10px;color:var(--text2)">ยังไม่มีข้อมูล</div>`;
    return;
  }

  container.innerHTML = items.map(item => `
    <div class="setting-row ${item.active ? '' : 'inactive'}">
      <div class="setting-left">
        <div class="setting-title">${escapeHtml(item.name)}</div>
      </div>
      <div class="setting-right">
        <label class="switch">
          <input type="checkbox" ${item.active ? 'checked' : ''}
            onchange="toggleItem('${prefix}', ${item.id}, this.checked)">
          <span></span>
        </label>
        <button class="btn btn-ghost btn-sm"
          onclick="editItem('${prefix}', ${item.id})">✏️</button>
        <button class="btn btn-danger btn-sm"
          onclick="deleteItem('${prefix}', ${item.id})">🗑</button>
      </div>
    </div>
  `).join('');
}

/* ── CRUD helpers ── */
const tableMap = { type: 'types', loc: 'locations' };

function getList(prefix) {
  return prefix === 'type' ? types : locations;
}

async function toggleItem(prefix, id, active) {
  const { error } = await client.from(tableMap[prefix]).update({ active }).eq('id', id);
  if (error) { showToast('❌ อัปเดตไม่สำเร็จ'); return; }
  await reloadAndRender(prefix);
  showToast('✅ อัปเดตแล้ว');
}

async function editItem(prefix, id) {
  const list = getList(prefix);
  const item = list.find(i => i.id === id);
  if (!item) return;

  const label = prefix === 'type' ? 'ประเภท' : 'ตำแหน่ง';
  const name = await showInputModal(`เปลี่ยนชื่อ${label}`, `ชื่อ${label}ใหม่`, item.name);
  if (!name?.trim()) return;

  const cleanName = name.trim().replace(/\s+/g, ' ');

  if (list.some(i =>
    i.name.toLowerCase() === cleanName.toLowerCase() && i.id !== id
  )) {
    showToast('⚠ มีชื่อนี้แล้ว');
    return;
  }

  const { error } = await client
    .from(tableMap[prefix])
    .update({ name: cleanName })
    .eq('id', id);

  if (error) {
    showToast('❌ เปลี่ยนชื่อไม่สำเร็จ');
    return;
  }

  await reloadAndRender(prefix);
  showToast('✅ เปลี่ยนชื่อแล้ว');
}

async function deleteItem(prefix, id) {
  const list = getList(prefix);
  const item = list.find(i => i.id === id);
  if (!item) return;
  if (!confirm(`ลบ "${item.name}" ใช่ไหม?`)) return;

  const { error } = await client.from(tableMap[prefix]).delete().eq('id', id);
  if (error) { showToast('❌ ลบไม่สำเร็จ'); return; }
  await reloadAndRender(prefix);
  showToast(`🗑 ลบ "${item.name}" แล้ว`);
}

async function addType() {
  const name = await showInputModal('เพิ่มประเภทเครื่องมือ', 'ชื่อประเภทใหม่');
  if (!name?.trim()) return;

  const cleanName = name.trim().replace(/\s+/g, ' ');

  if (types.some(t => t.name.toLowerCase() === cleanName.toLowerCase())) {
    showToast('⚠ มีชื่อประเภทนี้แล้ว');
    return;
  }

  client.from('types')
    .insert([{ name: cleanName, active: true }])
    .then(async ({ error }) => {
      if (error) { showToast('❌ เพิ่มไม่สำเร็จ'); return; }
      await reloadAndRender('type');
      showToast('✅ เพิ่มประเภทแล้ว');
    });
}

async function addLocation() {
  const name = await showInputModal('เพิ่มตำแหน่งที่ตั้ง', 'ชื่อตำแหน่งใหม่');
  if (!name?.trim()) return;

  const cleanName = name.trim().replace(/\s+/g, ' ');

  if (locations.some(l => l.name.toLowerCase() === cleanName.toLowerCase())) {
    showToast('⚠ มีชื่อตำแหน่งนี้แล้ว');
    return;
  }

  client.from('locations')
    .insert([{ name: cleanName, active: true }])
    .then(async ({ error }) => {
      if (error) { showToast('❌ เพิ่มไม่สำเร็จ'); return; }
      await reloadAndRender('loc');
      showToast('✅ เพิ่มตำแหน่งแล้ว');
    });
}

async function reloadAndRender(prefix) {
  if (prefix === 'type') {
    await loadTypes();
    renderTypeManage();
  } else {
    await loadLocations();
    renderLocManage();
  }
}

/* ── Notification Settings ── */
function saveNotifSettings() {
  const days  = document.getElementById('set-days').value.trim();
  const email = document.getElementById('set-email').value.trim();
  const lineToken = document.getElementById('set-line-token')?.value.trim() || '';
  const lineUser  = document.getElementById('set-line-user')?.value.trim() || '';
  const existing = loadNotifSettings();
 
  if (!days || isNaN(days) || Number(days) < 1) {
    showToast('⚠ กรุณาระบุจำนวนวันที่ถูกต้อง');
    return;
  }
 
  localStorage.setItem(SETTINGS_KEY, JSON.stringify({ ...existing, days, email, lineToken, lineUser }));
 
  renderDashboard();
  renderInstruments();
  showToast('✅ บันทึกการตั้งค่าเรียบร้อยแล้ว');
}
 
function populateNotifSettings() {
  const s  = loadNotifSettings();
  const el = (id) => document.getElementById(id);
  if (el('set-days'))  el('set-days').value  = s.days  || 30;
  if (el('set-email')) el('set-email').value = s.email || '';
  if (el('set-line-token')) {el('set-line-token').value = s.lineToken || '';}
  if (el('set-line-user')) {el('set-line-user').value = s.lineUser || '';}
}
 
/* ── Line Notification Settings ── */
async function saveLineSettings() {
  const token  = document.getElementById('set-line-token')?.value.trim() || '';
  const userId = document.getElementById('set-line-user')?.value.trim() || '';
  const days   = parseInt(document.getElementById('set-days')?.value) || 30;

  if (!token || !userId) {
    showToast('⚠ กรุณากรอก Token และ User ID');
    return;
  }

  // localStorage
  const existing = loadNotifSettings();

  localStorage.setItem(SETTINGS_KEY, JSON.stringify({
    ...existing,
    lineToken: token,
    lineUser: userId,
  }));

  // Supabase
  const { error } = await client
    .from('settings')
    .upsert({
      id: 1,
      line_token: token,
      line_user: userId,
      warn_days:  days
    });

  if (error) {
    console.error(error);
    showToast('❌ บันทึก Supabase ไม่สำเร็จ');
    return;
  }

  showToast('✅ บันทึก LINE Settings แล้ว');
}