/* ── LINE NOTIFICATIONS ── */

/* ─── Core: ส่งข้อความผ่าน Supabase Edge Function ─── */
async function sendLineMessage(message) {
  const settings = loadNotifSettings();
  const token    = settings.lineToken;
  const userId   = settings.lineUser;

  if (!token || !userId) {
    showToast('⚠ ยังไม่ได้ตั้งค่า LINE Token / User ID');
    return false;
  }

  try {
    const res = await fetch(
      'https://zecloiixseojpeqferow.supabase.co/functions/v1/send-line',
      {
        method: 'POST',
        headers: {
          'Content-Type':  'application/json',
          'Authorization': `Bearer ${SUPABASE_KEY}`,
          'apikey':        SUPABASE_KEY,
        },
        body: JSON.stringify({ token, userId, message })
      }
    );

    if (!res.ok) {
      const errText = await res.text();
      console.error('LINE API error:', errText);
      showToast('❌ ส่ง LINE ไม่สำเร็จ');
      return false;
    }

    return true;

  } catch (err) {
    console.error('LINE fetch error:', err);
    showToast('❌ เชื่อมต่อ LINE ไม่ได้');
    return false;
  }
}

/* ─── สร้างข้อความแจ้งเตือนสำหรับเครื่องมือชิ้นเดียว ─── */
function buildToolAlertMsg(tool) {
  const d    = diffDays(tool.expire);
  const sign = d < 0 ? `เกินกำหนดแล้ว ${Math.abs(d)} วัน ❌`
                     : `เหลืออีก ${d} วัน ⚠`;

  return `🔔 แจ้งเตือนการสอบเทียบ

📌 ${tool.name}  (${tool.code})
🏢 แผนก: ${tool.dept}
👤 ผู้รับผิดชอบ: ${tool.owner}
📅 วันหมดอายุ: ${fmtDate(tool.expire)}
⏳ สถานะ: ${sign}

— Calibration Management System`;
}

/* ─── ส่งแจ้งเตือนเครื่องมือชิ้นเดียว (จากปุ่ม 📧) ─── */
async function sendLineToolAlert(tool) {
  const msg = buildToolAlertMsg(tool);
  const ok  = await sendLineMessage(msg);
  if (ok) showToast(`✅ ส่งแจ้งเตือน LINE: ${tool.owner} แล้ว`);
}

/* ─── ส่ง batch ผ่าน Edge Function ─── */
async function sendLineAlerts() {
  const s = loadNotifSettings();

  try {
    const res = await fetch(
      'https://zecloiixseojpeqferow.supabase.co/functions/v1/send-line',
      {
        method: 'POST',
        headers: {
          'Content-Type':  'application/json',
          'Authorization': `Bearer ${SUPABASE_KEY}`,
          'apikey':        SUPABASE_KEY,
        },
        body: JSON.stringify({ warnDays: parseInt(s.days) || 30 })
      }
    );

    const result = await res.json();

    if (!res.ok) {
      showToast('❌ ส่ง LINE ไม่สำเร็จ');
      return;
    }

    if (result.message === 'ไม่มีรายการแจ้งเตือน') {
      showToast('✅ ไม่มีเครื่องมือที่ต้องแจ้งเตือน');
    } else {
      showToast(`✅ ส่งแจ้งเตือน ${result.sent} รายการทาง LINE แล้ว`);
    }

  } catch (err) {
    console.error('LINE fetch error:', err);
    showToast('❌ เชื่อมต่อ LINE ไม่ได้');
  }
}

/* ─── ทดสอบการเชื่อมต่อ ─── */
async function testLineNotification() {
  const msg = `🔔 ทดสอบระบบแจ้งเตือน

Calibration Management System

เชื่อมต่อ LINE สำเร็จ ✅
วันที่: ${new Date().toLocaleDateString('th-TH', { dateStyle: 'long' })}`;

  const ok = await sendLineMessage(msg);
  if (ok) showToast('✅ ส่ง LINE ทดสอบแล้ว');
}