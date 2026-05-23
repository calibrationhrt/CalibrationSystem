/* ── HISTORY PAGE ── */

function renderYearOptions(data) {
  const select = document.getElementById('hist-year');
  
  const yearsFromData = data.map(d => d.date?.slice(0, 4)).filter(Boolean);
  const currentYear   = new Date().getFullYear().toString();
  const years         = Array.from(new Set([currentYear, ...yearsFromData]));
  years.sort((a, b) => b - a);

  select.innerHTML = `
    <option value="all">ทั้งหมด</option>
    ${years.map(y => `<option value="${y}">${y}</option>`).join('')}
  `;

  select.value = selectedYear;
}

function getResultClass(resultRaw) {
  const result = (resultRaw || '').trim().toLowerCase();
  if (result === 'ผ่าน' || result === 'pass') return 'badge-ok';
  if (result === 'ไม่ผ่าน' || result === 'fail') return 'badge-overdue';
  return 'badge-warn';
}

async function renderHistory(forceReload = false) {
  if (!tools.length) await loadTools();

  if (!calHistoryLoaded || forceReload) {
    const { data, error } = await client
      .from('calibrations')
      .select('*')
      .order('date', { ascending: false });

    if (error) {
      console.error(error);
      return;
    }

    calHistory       = data;
    calHistoryLoaded = true;
  }

  renderYearOptions(calHistory);

  const toolMap = Object.fromEntries(tools.map(t => [String(t.id), t]));

  let filtered = calHistory;

  if (selectedYear !== 'all') {
    const selected = selectedYear.toString().trim();
    filtered = filtered.filter(h => (h.date || '').slice(0, 4) === selected);
  }

  const keyword = (document.getElementById('hist-search').value || '')
    .toLowerCase().trim();

  if (keyword) {
    filtered = filtered.filter(h => {
      const tool = toolMap[String(h.tool_id)];
      const text = [
        tool?.code, tool?.name, h.result, h.cert, h.lab, h.by_user
      ].join(' ').toLowerCase();
      return text.includes(keyword);
    });
  }

  if (!filtered.length) {
    document.getElementById('hist-tbody').innerHTML = `
      <tr>
        <td colspan="7" style="text-align:center;padding:20px;color:var(--text2)">
          ${keyword ? 'ไม่พบข้อมูลที่ค้นหา' : 'ไม่มีข้อมูลในปีที่เลือก'}
        </td>
      </tr>
    `;
    return;
  }

  document.getElementById('hist-tbody').innerHTML = filtered.map(h => {
    const tool = toolMap[String(h.tool_id)];
    return `
      <tr>
        <td>${h.date ? fmtDate(h.date) : '-'}</td>
        <td>${tool ? tool.code : '-'}</td>
        <td>${tool ? tool.name : 'ไม่พบข้อมูล'}</td>
        <td>
          <span class="badge ${getResultClass(h.result)}">
            <span class="badge-dot"></span>${h.result}
          </span>
        </td>
        <td style="color:var(--blue)">${h.cert || '-'}</td>
        <td>${h.lab || '-'}</td>
        <td>${h.by_user || '-'}</td>
      </tr>
    `;
  }).join('');
}

async function clearHistory() {
  const confirmed = await showConfirmTypeModal(
    '🗑 ล้างประวัติทั้งหมด',
    'การดำเนินการนี้ไม่สามารถย้อนกลับได้ กรุณาพิมพ์ "DELETE" เพื่อยืนยัน',
    'DELETE'
  );

   if (!confirmed) {
    showToast('❌ ยกเลิกการล้าง');
    return;
  }

  const { error } = await client
    .from('calibrations')
    .delete()
    .neq('id', 0);

  if (error) {
    console.error(error);
    showToast('❌ ล้างประวัติไม่สำเร็จ');
    return;
  }

  calHistory       = [];
  calHistoryLoaded = false;
  renderHistory();
  showToast('🗑 ล้างประวัติเรียบร้อยแล้ว');
}