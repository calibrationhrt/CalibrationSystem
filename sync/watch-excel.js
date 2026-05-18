import chokidar from "chokidar";
import * as XLSX from "xlsx";
import fs from "fs";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://zecloiixseojpeqferow.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InplY2xvaWl4c2VvanBlcWZlcm93Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3Njg1MDUxMywiZXhwIjoyMDkyNDI2NTEzfQ.9m7Z22YbuSscIpCwgtjZwUyLFTISBFASrHxxnfZJjv8";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

function formatDateLocal(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function parseExcelDate(v) {
  if (!v) return null;

  if (v instanceof Date) {
    const y = v.getFullYear();
    const m = String(v.getMonth() + 1).padStart(2, '0');
    const d = String(v.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  const s = String(v).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;

  const match = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
  if (match) {
    const [, dd, mm, yy] = match;
    const year = yy.length === 2 ? parseInt(yy) + 2000 : parseInt(yy);
    return `${year}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`;
  }

  return null;
}

function calcExpire(lastDateStr, interval) {
  if (!lastDateStr || !interval) return null;

  const [y, m, d] = lastDateStr.split('-').map(Number);
  const date = new Date(y, m - 1, d);

  const regex = /(\d+)\s*(year|years|y|month|months|m|day|days|d)/g;
  let match;

  while ((match = regex.exec(interval)) !== null) {
    const value = parseInt(match[1]);
    const unit = match[2];
    if (unit.startsWith("y")) date.setFullYear(date.getFullYear() + value);
    if (unit.startsWith("m")) date.setMonth(date.getMonth() + value);
    if (unit.startsWith("d")) date.setDate(date.getDate() + value);
  }

  return formatDateLocal(date);
}

const EXCEL_FILE = "D:\\Plan\\Calibration_Website.xlsx";

async function syncExcel() {
  try {
    console.log("📖 Reading Excel...");

    const file = await fs.promises.readFile(EXCEL_FILE);
    const workbook = XLSX.read(file, { type: "buffer", cellDates: true });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rawRows = XLSX.utils.sheet_to_json(sheet);

    const rows = rawRows.map(row => {
      const lastDateStr = parseExcelDate(row["วันสอบเทียบล่าสุด"]);
      const interval = row["รอบสอบเทียบ"] || null;

      return {
        code:     row["รหัสเครื่องมือ"],
        name:     row["ชื่อเครื่องมือ"],
        type:     row["ประเภท"],
        dept:     row["แผนก"],
        loc:      row["ตำแหน่งที่ตั้ง"],
        owner:    row["ผู้รับผิดชอบ"],
        last:     lastDateStr,
        interval: interval,
        expire:   calcExpire(lastDateStr, interval), // ✅ ส่ง null ได้เลย เพื่อ clear ค่าเก่าใน DB
        source:   row["แหล่งสอบเทียบ"],
        cert:     row["เลขที่ใบรับรอง"],
        lab:      row["ห้องปฏิบัติการ"],
        status:   row["สถานะ"] || "Active"
      };
    });

    console.log(rows.slice(0, 3));
    console.log(`📦 ${rows.length} rows`);

    const { error } = await supabase
      .from("tools")
      .upsert(rows, { onConflict: "code", ignoreDuplicates: false });

    if (error) {
      console.error("❌ Supabase Error:", error);
    } else {
      console.log("✅ Sync Success");
    }

  } catch (err) {
    console.error(err);
  }
}

let timeout;

chokidar.watch(EXCEL_FILE, {
  ignoreInitial: true,
  awaitWriteFinish: { stabilityThreshold: 3000, pollInterval: 100 }
})
.on("all", async (event, path) => {
  console.log("📁 Event:", event);
  clearTimeout(timeout);
  timeout = setTimeout(async () => {
    console.log("📝 Syncing Excel...");
    await syncExcel();
  }, 3000);
});

console.log("👀 Watching Excel...");