/* ── APP: entry point ── */
document.addEventListener('DOMContentLoaded', async () => {
  await initAuth();
  await loadTools();
  await loadDepartments();
  await loadTypes();
  await loadLocations();
  await initCustomSelects();

  /* History: year filter */
  document.getElementById('hist-year').addEventListener('change', (e) => {
    selectedYear = e.target.value;
    renderHistory();
  });

  /* History: search */
  document.getElementById('hist-search').addEventListener('input', () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => renderHistory(), 300);
  });

  document.getElementById('hist-search').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') renderHistory();
  });

  renderDashboard();
  renderInstruments();
  renderHistory();

  /* Auto-refresh dashboard */
    setInterval(async () => {
    if (document.visibilityState !== 'visible') return; // ← เพิ่มบรรทัดนี้
      try {
        await loadTools();
        renderDashboard();
      } catch (err) {
        console.warn('⚠ Auto-refresh ล้มเหลว:', err);
      }
    }, 60000);

  /* ── LINE auto-alert: ส่งทุก 24 ชั่วโมง (ถ้าตั้งค่าไว้) ── */
  setInterval(async () => {
    if (document.visibilityState !== 'visible') return;
    const s = loadNotifSettings();
    if (s.lineToken && s.lineUser) {
      await sendLineAlerts();
    }
  }, 24 * 60 * 60 * 1000); // ทุก 24 ชั่วโมง
});